import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import {
  submitPrescriptionToPharmacy,
  newRequestId,
} from "@/app/api/prescriptions/_shared/submit-to-pharmacy-core";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import { uploadPrescriptionPdf } from "@core/services/storage/prescriptionPdfStorage";
import {
  GREENWICH_PHARMACY_ID,
  GREENWICH_CLINIC_NAME,
  isGreenwichPharmacy,
  formatBillToNote,
  classifyDosageForm,
  quantityInMl,
  quantityForOral,
  daysSupplyFromVialCount,
  daysSupplyForOral,
} from "@core/utils/digitalrx-format";

/**
 * POST /api/prescriptions/[id]/resend-rejected
 *
 * One-shot operator endpoint to recover a prescription that was REJECTED by
 * DigitalRx (Greenwich) before the May 1 2026 PDF + clinic-prefix fix went
 * live. Used to clear the 9 Group-1 rejections from Lacy's 4.1–5.5 tracking
 * report (Brian Adams, Andrea Boehm, Erica Page, etc.).
 *
 * What it does (in order):
 *   1. Verifies INTERNAL_API_SECRET (admin-only, no UI exposure).
 *   2. Backfills backend_id from the pharmacy's active backend if missing.
 *      This is the field that flips the submit-to-pharmacy core into
 *      Greenwich-format mode (drug name with "AIM  " prefix, "Bill to"
 *      notes line, mL Qty, Days Supply).
 *   3. Generates a FRESH prescription PDF using the post-May-1 Greenwich
 *      template, embedding Dr. Whipps's signature image, and uploads it
 *      to the patient-files bucket. This replaces the stale pdf_storage_path
 *      that DigitalRx pharmacists couldn't read.
 *   4. Clears queue_id and resets status to 'payment_received' so the
 *      submit-to-pharmacy claim guard ("already_submitted") doesn't block.
 *      The dead DigitalRx queue_id stays in system_logs for audit; it is
 *      gone from the row because DigitalRx will issue a new one.
 *   5. Calls submitPrescriptionToPharmacy in-process (no HTTP hop).
 *   6. Logs every step to system_logs for replay/audit.
 *
 * Idempotency: safe to retry. If the prescription is already submitted with
 * a fresh queue_id (post-May-1), the inner submit core returns
 * already_submitted and this endpoint reports it without re-running.
 *
 * Auth: INTERNAL_API_SECRET only. There is no UI button — operators run
 * this from the resend-rejected.mjs CLI script. This is intentional: the
 * action mutates payment-confirmed orders and we want a paper trail.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: prescriptionId } = await params;

  // ─── Auth: INTERNAL_API_SECRET only ─────────────────────────────
  const internalSecret = request.headers.get("x-internal-secret");
  const configuredSecret = process.env.INTERNAL_API_SECRET;
  if (!configuredSecret || internalSecret !== configuredSecret) {
    return NextResponse.json(
      { success: false, error: "Forbidden — INTERNAL_API_SECRET required" },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();
  const requestId = newRequestId();
  const tag = `[resend-rejected ${requestId.slice(0, 8)} ${prescriptionId.slice(0, 8)}]`;

  // ─── Step 1: load prescription + related rows ───────────────────
  const { data: rx, error: rxErr } = await supabase
    .from("prescriptions")
    .select(`
      id, patient_id, prescriber_id, medication, medication_id,
      quantity, refills, sig, pharmacy_notes, dispense_as_written,
      pharmacy_id, backend_id, status, queue_id, pdf_storage_path,
      payment_status, total_paid_cents
    `)
    .eq("id", prescriptionId)
    .single();

  if (rxErr || !rx) {
    return NextResponse.json(
      { success: false, error: `Prescription not found: ${rxErr?.message || prescriptionId}` },
      { status: 404 },
    );
  }

  // Safety guards: only operate on paid Greenwich orders.
  if (rx.payment_status !== "paid" && rx.payment_status !== "completed") {
    return NextResponse.json(
      { success: false, error: `Refusing to resend — payment_status=${rx.payment_status}` },
      { status: 400 },
    );
  }
  if (!isGreenwichPharmacy(rx.pharmacy_id)) {
    return NextResponse.json(
      { success: false, error: `Refusing to resend — pharmacy_id ${rx.pharmacy_id} is not Greenwich` },
      { status: 400 },
    );
  }

  console.log(`${tag} step=load ok status=${rx.status} queue=${rx.queue_id} backend=${rx.backend_id} pdf=${!!rx.pdf_storage_path}`);

  await supabase.from("system_logs").insert({
    action: "PRESCRIPTION_RESEND_REJECTED_START",
    status: "info",
    details: `${tag} status=${rx.status} queue_id=${rx.queue_id} backend_id=${rx.backend_id} pdf_path=${rx.pdf_storage_path ?? "(none)"}`,
  });

  // ─── Step 2: backfill backend_id if missing ─────────────────────
  let backendIdToUse = rx.backend_id as string | null;
  if (!backendIdToUse) {
    const { data: backend, error: backendErr } = await supabase
      .from("pharmacy_backends")
      .select("id, store_id, is_active")
      .eq("pharmacy_id", GREENWICH_PHARMACY_ID)
      .eq("is_active", true)
      .maybeSingle();
    if (backendErr || !backend) {
      return NextResponse.json(
        { success: false, error: `No active Greenwich backend found: ${backendErr?.message ?? "missing row"}` },
        { status: 500 },
      );
    }
    backendIdToUse = backend.id;
    console.log(`${tag} step=backfill-backend backend_id=${backendIdToUse} store_id=${backend.store_id}`);
  }

  // ─── Step 3: load patient + provider for PDF ────────────────────
  const [{ data: patient }, { data: provider }] = await Promise.all([
    supabase.from("patients").select("first_name, last_name, date_of_birth, data, physical_address, phone").eq("id", rx.patient_id).single(),
    supabase.from("providers").select("prefix, first_name, last_name, npi_number, dea_number, company_name, physical_address, phone_number, signature_url").eq("user_id", rx.prescriber_id).single(),
  ]);
  if (!patient || !provider) {
    return NextResponse.json(
      { success: false, error: "Patient or provider record not found" },
      { status: 500 },
    );
  }

  const patientAddress = (patient.physical_address || {}) as Record<string, string | undefined>;
  const providerAddress = (provider.physical_address || {}) as Record<string, string | undefined>;
  const patientData = (patient.data || {}) as Record<string, string | undefined>;

  // Greenwich catalog lookup (drug-name, NDC, mL Qty, Days Supply, "Bill to" notes).
  let catalogDrugName: string | undefined;
  let catalogNdc: string | undefined;
  let greenwichQty: string | undefined;
  let greenwichDaysSupply: string | undefined;
  let greenwichNotes: string | undefined;
  if (rx.medication_id) {
    const { data: med } = await supabase
      .from("pharmacy_medications")
      .select("name, ndc, vial_size, form")
      .eq("id", rx.medication_id)
      .maybeSingle();
    if (med) {
      catalogDrugName = med.name ?? undefined;
      catalogNdc = med.ndc ?? undefined;
      const vialCount = Number(rx.quantity);
      if (med.vial_size && Number.isFinite(vialCount) && vialCount > 0) {
        let formBucket: "injection" | "capsule" | "tablet" = "injection";
        try { formBucket = classifyDosageForm(med.form); } catch { /* default */ }
        try {
          greenwichQty = formBucket === "injection"
            ? quantityInMl(vialCount, med.vial_size).toString()
            : quantityForOral(vialCount, med.vial_size).toString();
        } catch { /* fall through */ }
        try {
          greenwichDaysSupply = formBucket === "injection"
            ? String(daysSupplyFromVialCount(vialCount))
            : String(daysSupplyForOral(vialCount));
        } catch { /* fall through */ }
      }
      const billToLine = formatBillToNote(GREENWICH_CLINIC_NAME);
      const existingNotes = (rx.pharmacy_notes || "").trim();
      // Cross-reference line so DBS pharmacists tie the new queue ID to the
      // original Apr 30 rejection. Prepended (most prominent) so it's the
      // first thing read at intake. Format: "RESUBMISSION of Rx #2154470
      // — original rejected at intake (clinic identifier missing on Apr 30)".
      const resubmissionLine = rx.queue_id
        ? `RESUBMISSION of Rx #${rx.queue_id} — original rejected at intake (clinic identifier missing on Apr 30)`
        : null;
      const parts = [resubmissionLine, existingNotes || null, billToLine].filter(Boolean) as string[];
      greenwichNotes = parts.join("\n");
    }
  }

  // ─── Step 4: generate fresh PDF ─────────────────────────────────
  console.log(`${tag} step=pdf-generate useGreenwichFormat=${!!catalogDrugName}`);
  const { blob, filename } = await generatePrescriptionPdf({
    patient: {
      firstName: patient.first_name || "",
      lastName: patient.last_name || "",
      dob: patient.date_of_birth || "",
      sex: patientData.gender || "U",
      street: patientAddress.street,
      city: patientAddress.city,
      state: patientAddress.state,
      zip: patientAddress.zipCode || patientAddress.zip,
      phone: patient.phone || undefined,
    },
    doctor: {
      prefix: provider.prefix || "Dr.",
      firstName: provider.first_name || "",
      lastName: provider.last_name || "",
      npi: provider.npi_number || "",
      dea: provider.dea_number || undefined,
      companyName: provider.company_name || undefined,
      street: providerAddress.street,
      city: providerAddress.city,
      state: providerAddress.state,
      zip: providerAddress.zipCode || providerAddress.zip,
      phone: provider.phone_number || undefined,
    },
    rx: {
      drugName: rx.medication || "",
      useGreenwichFormat: !!catalogDrugName,
      catalogDrugName,
      ndc: catalogNdc,
      qty: greenwichQty || String(rx.quantity || ""),
      daysSupply: greenwichDaysSupply,
      dateWritten: new Date().toISOString().split("T")[0],
      refills: String(rx.refills || "0"),
      instructions: rx.sig || undefined,
      notes: greenwichNotes || rx.pharmacy_notes || undefined,
      daw: rx.dispense_as_written ? "Y" : "N",
      pon: rx.id.slice(-8).toUpperCase(),
    },
    signatureUrl: provider.signature_url || undefined,
  });

  const arrayBuffer = await blob.arrayBuffer();
  const file = Object.assign(
    new Blob([arrayBuffer], { type: "application/pdf" }),
    { name: filename },
  ) as File;

  const upload = await uploadPrescriptionPdf(
    supabase,
    file,
    rx.patient_id,
    rx.id,
    rx.prescriber_id,
  );
  if (!upload.success || !upload.storagePath) {
    return NextResponse.json(
      { success: false, error: `PDF upload failed: ${upload.error}` },
      { status: 500 },
    );
  }
  console.log(`${tag} step=pdf-uploaded path=${upload.storagePath}`);

  // ─── Step 5: clear queue_id + reset status, set new pdf path ────
  const oldQueueId = rx.queue_id;
  const { error: updErr } = await supabase
    .from("prescriptions")
    .update({
      backend_id: backendIdToUse,
      pdf_storage_path: upload.storagePath,
      queue_id: null,
      status: "payment_received",
      updated_at: new Date().toISOString(),
    })
    .eq("id", rx.id);
  if (updErr) {
    return NextResponse.json(
      { success: false, error: `DB reset failed: ${updErr.message}` },
      { status: 500 },
    );
  }

  await supabase.from("system_logs").insert({
    action: "PRESCRIPTION_RESEND_REJECTED_RESET",
    status: "info",
    details: `${tag} reset complete — old_queue_id=${oldQueueId} cleared, new pdf_path=${upload.storagePath}, backend_id=${backendIdToUse}`,
  });

  // ─── Step 6: re-submit through the production code path ────────
  console.log(`${tag} step=resubmit`);
  const result = await submitPrescriptionToPharmacy(supabase, rx.id, {
    isInternalCall: true,
    isAdmin: true,
    authenticatedUserId: null,
    requestId,
    callerLabel: "resend-rejected-cli",
  });

  await supabase.from("system_logs").insert({
    action: "PRESCRIPTION_RESEND_REJECTED_DONE",
    status: result.ok ? "info" : "error",
    details: `${tag} ok=${result.ok} code=${result.code} new_queue=${result.queueId ?? "(none)"} old_queue=${oldQueueId}`,
  });

  return NextResponse.json(
    {
      success: result.ok,
      old_queue_id: oldQueueId,
      new_queue_id: result.queueId ?? null,
      pdf_storage_path: upload.storagePath,
      backend_id: backendIdToUse,
      submit_code: result.code,
      submit_error: result.ok ? null : result.error,
    },
    { status: result.ok ? 200 : result.httpStatus },
  );
}
