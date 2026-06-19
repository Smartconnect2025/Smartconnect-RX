/**
 * Server-side on-demand prescription PDF generation.
 *
 * Older prescriptions (and any whose client-side upload failed) have no stored
 * PDF. This rebuilds the Electronic Rx PDF from the prescription/patient/provider
 * data so it can either be (a) uploaded to the patient-files bucket and linked
 * back to the prescription — so the "View Prescription PDF" button always has
 * something to open — or (b) returned as base64 for an in-memory pharmacy
 * attachment without ever touching storage.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import {
  uploadPrescriptionPdf,
  getPrescriptionPdfUrl,
} from "@core/services/storage/prescriptionPdfStorage";

interface AddressShape {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

// Sanity guard: a real Electronic Rx is vector text (plus, usually, a signature
// image). Measured healthy output is ~6.4KB at the smallest (empty-field,
// printed-name fallback, no signature image) and larger for any populated/signed
// Rx. A 3KB floor rejects truly broken/near-empty artifacts while never
// rejecting a readable, signature-less Rx.
const MIN_PDF_BYTES = 3000;

/**
 * Render the Electronic Rx PDF bytes from prescription/patient/provider data.
 * Pure generation — performs NO storage writes and does NOT consult
 * `pdf_storage_path` (callers decide idempotency). Shared by the store-and-link
 * path and the in-memory base64 path so there is a single source of truth for
 * how a prescription PDF is built.
 */
async function renderPrescriptionPdf(
  admin: SupabaseClient,
  prescriptionId: string,
): Promise<
  | {
      arrayBuffer: ArrayBuffer;
      filename: string;
      patientId: string;
      prescriberId: string;
    }
  | { error: string }
> {
  const { data: rx, error: rxErr } = await admin
    .from("prescriptions")
    .select(
      "id, patient_id, prescriber_id, medication, quantity, refills, sig, pharmacy_notes, dispense_as_written, submitted_at, updated_at, has_custom_address, custom_address",
    )
    .eq("id", prescriptionId)
    .single();

  if (rxErr || !rx) {
    return { error: "Prescription not found" };
  }

  const { data: patient } = await admin
    .from("patients")
    .select("first_name, last_name, date_of_birth, phone, physical_address")
    .eq("id", rx.patient_id)
    .maybeSingle();

  const { data: provider } = await admin
    .from("providers")
    .select(
      "prefix, first_name, last_name, npi_number, dea_number, phone_number, signature_url, physical_address, company_name",
    )
    .eq("user_id", rx.prescriber_id)
    .maybeSingle();

  const patientAddr = (
    rx.has_custom_address && rx.custom_address
      ? rx.custom_address
      : patient?.physical_address
  ) as AddressShape | null;
  const providerAddr = provider?.physical_address as AddressShape | null;
  const dateWritten = (rx.submitted_at || rx.updated_at || new Date().toISOString())
    .toString()
    .split("T")[0];

  const { blob, filename } = await generatePrescriptionPdf({
    patient: {
      firstName: patient?.first_name || "",
      lastName: patient?.last_name || "",
      dob: patient?.date_of_birth || "",
      sex: "",
      street: patientAddr?.street,
      city: patientAddr?.city,
      state: patientAddr?.state,
      zip: patientAddr?.zipCode,
      phone: patient?.phone || undefined,
    },
    doctor: {
      prefix: provider?.prefix || undefined,
      firstName: provider?.first_name || "Provider",
      lastName: provider?.last_name || "User",
      npi: provider?.npi_number || "",
      dea: provider?.dea_number || undefined,
      street: providerAddr?.street,
      city: providerAddr?.city,
      state: providerAddr?.state,
      zip: providerAddr?.zipCode,
      phone: provider?.phone_number || undefined,
      companyName: provider?.company_name || undefined,
    },
    rx: {
      drugName: rx.medication || "",
      qty: rx.quantity != null ? String(rx.quantity) : "",
      dateWritten,
      refills: rx.refills != null ? String(rx.refills) : "0",
      instructions: rx.sig || undefined,
      notes: rx.pharmacy_notes || undefined,
      daw: rx.dispense_as_written ? "Y" : "N",
      pon: String(rx.id).slice(-8).toUpperCase(),
    },
    signatureUrl: provider?.signature_url || undefined,
  });

  const arrayBuffer = await blob.arrayBuffer();

  if (arrayBuffer.byteLength < MIN_PDF_BYTES) {
    console.error(
      `PRESCRIPTION_PDF_TOO_SMALL: ${arrayBuffer.byteLength} bytes for prescription ${prescriptionId}`,
    );
    return { error: "Generated PDF is invalid (too small)" };
  }

  return {
    arrayBuffer,
    filename,
    patientId: rx.patient_id,
    prescriberId: rx.prescriber_id,
  };
}

export async function generateAndStorePrescriptionPdf(
  admin: SupabaseClient,
  prescriptionId: string,
): Promise<{ url?: string; storagePath?: string; error?: string }> {
  // Idempotency guard: if a PDF is already stored (e.g. the submit-time
  // background store finished first, or another request beat us), don't
  // regenerate — just hand back a fresh signed URL. This prevents duplicate
  // generated PDFs from the submit-time-background vs on-demand-GET race.
  const { data: existing } = await admin
    .from("prescriptions")
    .select("pdf_storage_path")
    .eq("id", prescriptionId)
    .single();

  if (existing?.pdf_storage_path) {
    const signed = await getPrescriptionPdfUrl(admin, existing.pdf_storage_path);
    if (signed.error || !signed.url) {
      return {
        storagePath: existing.pdf_storage_path,
        error: signed.error || "Failed to sign existing PDF URL",
      };
    }
    return { url: signed.url, storagePath: existing.pdf_storage_path };
  }

  const rendered = await renderPrescriptionPdf(admin, prescriptionId);
  if ("error" in rendered) {
    return { error: rendered.error };
  }

  const file = new File([rendered.arrayBuffer], rendered.filename, {
    type: "application/pdf",
  });

  const result = await uploadPrescriptionPdf(
    admin,
    file,
    rendered.patientId,
    prescriptionId,
    rendered.prescriberId,
  );

  if (!result.success) {
    return { error: result.error };
  }

  return { url: result.signedUrl, storagePath: result.storagePath };
}

/**
 * Generate the Electronic Rx PDF and return it as base64 WITHOUT persisting it.
 *
 * Used on the synchronous pharmacy-submission path (e.g. pay-on-terms, which
 * pushes to the pharmacy before the PDF is stored) so the pharmacy always
 * receives a valid PDF. Crucially it leaves `pdf_storage_path` untouched, so:
 *   - storage stays OFF the order-submit critical path (PDF-reliability
 *     invariant), and
 *   - a provider's own custom upload (stored fire-and-forget by the client
 *     after submit) is not blocked/overwritten by a server-generated PDF.
 */
export async function generatePrescriptionPdfBase64(
  admin: SupabaseClient,
  prescriptionId: string,
): Promise<{ base64?: string; error?: string }> {
  const rendered = await renderPrescriptionPdf(admin, prescriptionId);
  if ("error" in rendered) {
    return { error: rendered.error };
  }
  return { base64: Buffer.from(rendered.arrayBuffer).toString("base64") };
}
