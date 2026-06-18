/**
 * Server-side on-demand prescription PDF generation.
 *
 * Older prescriptions (and any whose client-side upload failed) have no stored
 * PDF. This rebuilds the Electronic Rx PDF from the prescription/patient/provider
 * data, uploads it to the patient-files bucket, and links it back to the
 * prescription — so the "View Prescription PDF" button always has something to
 * open.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import { uploadPrescriptionPdf } from "@core/services/storage/prescriptionPdfStorage";

interface AddressShape {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export async function generateAndStorePrescriptionPdf(
  admin: SupabaseClient,
  prescriptionId: string,
): Promise<{ url?: string; storagePath?: string; error?: string }> {
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
    },
    signatureUrl: provider?.signature_url || undefined,
  });

  const arrayBuffer = await blob.arrayBuffer();

  // Sanity guard: a real Electronic Rx is vector text (plus, usually, a
  // signature image). Anything near-empty means generation produced junk —
  // don't store a placeholder PDF over a (future) good one.
  const MIN_PDF_BYTES = 1000;
  if (arrayBuffer.byteLength < MIN_PDF_BYTES) {
    console.error(
      `PRESCRIPTION_PDF_TOO_SMALL: ${arrayBuffer.byteLength} bytes for prescription ${prescriptionId}`,
    );
    return { error: "Generated PDF is invalid (too small)" };
  }

  const file = new File([arrayBuffer], filename, { type: "application/pdf" });

  const result = await uploadPrescriptionPdf(
    admin,
    file,
    rx.patient_id,
    prescriptionId,
    rx.prescriber_id,
  );

  if (!result.success) {
    return { error: result.error };
  }

  return { url: result.signedUrl, storagePath: result.storagePath };
}
