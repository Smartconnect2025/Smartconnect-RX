/* eslint-disable no-console */
import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { getPharmacyFeeFlags, PLATFORM_FEE_CENTS } from "@core/services/pharmacy-fee-flags";
import { envConfig } from "@core/config";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import { uploadPrescriptionPdf } from "@core/services/storage/prescriptionPdfStorage";

/**
 * Checks prescriptions eligible for refill.
 * A prescription is eligible when:
 *   - next_refill_date <= now
 *   - total_refills_to_date < refills (total authorized)
 *   - prescription_type = 'prescription' (original, not already a refill)
 */
export async function checkRefills() {
  console.log("[refill-check] Starting refill check...");
  const run = await logCronRun("refill-check");

  try {
    const supabase = createCronClient();

    const now = new Date().toISOString();
    console.log("[refill-check] Querying prescriptions with next_refill_date <=", now);

    const { data, error } = await supabase
      .from("prescriptions")
      .select("*")
      .lte("next_refill_date", now)
      .eq("prescription_type", "prescription")
      .not("next_refill_date", "is", null);

    if (error) {
      console.error("[refill-check] Query error:", error.message);
      await run.error(error.message);
      return;
    }

    console.log("[refill-check] Found", data?.length ?? 0, "prescriptions with past next_refill_date");

    // Filter eligible: total_refills_to_date < refills
    const eligible = (data ?? []).filter(
      (rx) => (rx.total_refills_to_date ?? 0) < (rx.refills ?? 0),
    );

    console.log("[refill-check] Eligible for refill:", eligible.length, "of", data?.length ?? 0);

    for (const rx of eligible) {
      console.log(`[refill-check] Processing rx ${rx.id} — ${rx.medication} (refill ${(rx.total_refills_to_date || 0) + 1}/${rx.refills})`);

      // Duplicate guard: skip if there's already an active refill in progress
      const { data: existingRefills } = await supabase
        .from("prescriptions")
        .select("id, status")
        .eq("parent_prescription_id", rx.id)
        .eq("prescription_type", "refill")
        .in("status", ["pending_payment", "pending", "submitted", "processing"]);

      if (existingRefills && existingRefills.length > 0) {
        console.log(`[refill-check] Skipping rx ${rx.id} — active refill already exists (${existingRefills[0].id}, status: ${existingRefills[0].status})`);
        continue;
      }

      // Update original prescription counters with optimistic locking
      const newTotalRefills = (rx.total_refills_to_date || 0) + 1;
      const isLastRefill = newTotalRefills >= (rx.refills ?? 0);
      const newRefillDate = isLastRefill
        ? null
        : new Date(
            new Date(rx.next_refill_date).getTime() +
              (rx.refill_frequency_days ?? 0) * 86400000,
          ).toISOString();

      const { data: updatedRows, error: updateError } = await supabase
        .from("prescriptions")
        .update({
          total_refills_to_date: newTotalRefills,
          next_refill_date: newRefillDate,
        })
        .eq("id", rx.id)
        .eq("total_refills_to_date", rx.total_refills_to_date ?? 0)
        .select("id");

      if (updateError) {
        console.error(`[refill-check] Failed to update original rx ${rx.id}:`, updateError.message);
        run.trackFailure({ rxId: rx.id, step: "update_parent", error: updateError.message });
        continue;
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.log(`[refill-check] Skipping rx ${rx.id} — optimistic lock failed (already processed by another instance)`);
        continue;
      }

      console.log(`[refill-check] Updated original rx ${rx.id} — next_refill_date: ${newRefillDate}`);

      // Per-pharmacy patient-fee flags (admin-controlled). An OFF flag forces
      // that fee to $0 on the cloned refill; defaults fail OPEN (charge).
      const feeFlags = await getPharmacyFeeFlags(supabase, rx.pharmacy_id);
      const medCents = rx.patient_price
        ? Math.round(parseFloat(String(rx.patient_price)) * 100)
        : 0;
      const enforcedShippingCents = feeFlags.showDeliveryFee
        ? rx.shipping_fee_cents || 0
        : 0;
      const enforcedProfitCents = feeFlags.showProviderFee
        ? rx.profit_cents || 0
        : 0;
      const enforcedPlatformCents =
        feeFlags.showTechnologyFee && rx.platform_fee_cents
          ? PLATFORM_FEE_CENTS
          : 0;
      const enforcedTotalCents =
        medCents +
        enforcedProfitCents +
        enforcedShippingCents +
        enforcedPlatformCents;

      // Create refill prescription clone
      const { data: refill, error: insertError } = await supabase
        .from("prescriptions")
        .insert({
          prescription_type: "refill",
          parent_prescription_id: rx.id,
          medication: rx.medication,
          dosage: rx.dosage,
          dosage_amount: rx.dosage_amount,
          dosage_unit: rx.dosage_unit,
          vial_size: rx.vial_size,
          form: rx.form,
          quantity: rx.quantity,
          refills: rx.refills,
          sig: rx.sig,
          dispense_as_written: rx.dispense_as_written,
          pharmacy_notes: rx.pharmacy_notes,
          patient_price: rx.patient_price,
          pharmacy_id: rx.pharmacy_id,
          medication_id: rx.medication_id,
          profit_cents: enforcedProfitCents,
          consultation_reason: rx.consultation_reason,
          shipping_fee_cents: enforcedShippingCents,
          platform_fee_cents: enforcedPlatformCents,
          total_paid_cents: enforcedTotalCents,
          has_custom_address: rx.has_custom_address,
          custom_address: rx.custom_address,
          queue_id: null,
          status: "pending_payment",
          payment_status: "pending",
          backend_id: rx.backend_id,
          pdf_storage_path: null,
          pdf_document_id: null,
          prescriber_id: rx.prescriber_id,
          patient_id: rx.patient_id,
          encounter_id: rx.encounter_id,
          appointment_id: rx.appointment_id,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[refill-check] Failed to create refill for rx ${rx.id}:`, insertError.message);
        run.trackFailure({ rxId: rx.id, step: "insert", error: insertError.message });

        // Rollback parent counters since the refill row wasn't created
        await supabase
          .from("prescriptions")
          .update({
            total_refills_to_date: rx.total_refills_to_date ?? 0,
            next_refill_date: rx.next_refill_date,
          })
          .eq("id", rx.id)
          .eq("total_refills_to_date", newTotalRefills);

        console.log(`[refill-check] Rolled back parent counters for rx ${rx.id}`);
        continue;
      }

      console.log(`[refill-check] Created refill prescription ${refill?.id} for original ${rx.id}`);

      if (!refill) continue;

      // Generate PDF for the refill prescription
      let pdfOk = false;
      try {
        // Fetch patient data
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("first_name, last_name, date_of_birth, sex, address, phone")
          .eq("id", rx.patient_id)
          .single();

        if (patientError || !patient) {
          console.error(`[refill-check] Failed to fetch patient ${rx.patient_id} for PDF:`, patientError?.message);
          run.trackFailure({ rxId: rx.id, refillId: refill.id, step: "pdf_patient_fetch", error: patientError?.message || "Patient not found" });
        } else {
          // Fetch provider data
          const { data: provider, error: providerError } = await supabase
            .from("providers")
            .select("prefix, first_name, last_name, npi, physical_address, phone, signature_url, company_name")
            .eq("user_id", rx.prescriber_id)
            .single();

          if (providerError) {
            console.warn(`[refill-check] Provider not found for PDF (user_id: ${rx.prescriber_id}):`, providerError.message);
          }

          const patientAddress = patient.address && typeof patient.address === "object" ? patient.address as Record<string, string> : {};
          const providerAddress = provider?.physical_address && typeof provider.physical_address === "object" ? provider.physical_address as Record<string, string> : {};

          const { blob, filename } = await generatePrescriptionPdf({
            patient: {
              firstName: patient.first_name || "",
              lastName: patient.last_name || "",
              dob: patient.date_of_birth || "",
              sex: patient.sex || "U",
              street: patientAddress.street,
              city: patientAddress.city,
              state: patientAddress.state,
              zip: patientAddress.zipCode || patientAddress.zip,
              phone: patient.phone || undefined,
            },
            doctor: {
              prefix: provider?.prefix || undefined,
              firstName: provider?.first_name || "",
              lastName: provider?.last_name || "",
              npi: provider?.npi || "",
              street: providerAddress.street,
              city: providerAddress.city,
              state: providerAddress.state,
              zip: providerAddress.zipCode || providerAddress.zip,
              phone: provider?.phone || undefined,
              companyName: provider?.company_name || undefined,
            },
            rx: {
              drugName: rx.medication || "",
              qty: String(rx.quantity || ""),
              dateWritten: new Date().toISOString().split("T")[0],
              refills: String(rx.refills || "0"),
              instructions: rx.sig || undefined,
              notes: rx.pharmacy_notes || undefined,
              daw: rx.dispense_as_written ? "Y" : "N",
              pon: String(refill.id).slice(-8).toUpperCase(),
            },
            signatureUrl: provider?.signature_url || undefined,
          });

          // Convert Blob to File for upload
          // Use Object.assign to add `name` to Blob for Node 18 compatibility
          // (global File constructor is only available in Node 20+)
          const arrayBuffer = await blob.arrayBuffer();
          const file = Object.assign(
            new Blob([arrayBuffer], { type: "application/pdf" }),
            { name: filename },
          ) as File;

          const uploadResult = await uploadPrescriptionPdf(
            supabase,
            file,
            rx.patient_id,
            refill.id,
            rx.prescriber_id,
          );

          if (uploadResult.success) {
            console.log(`[refill-check] PDF uploaded for refill ${refill.id}: ${uploadResult.storagePath}`);
            pdfOk = true;
          } else {
            console.error(`[refill-check] PDF upload failed for refill ${refill.id}:`, uploadResult.error);
            run.trackFailure({ rxId: rx.id, refillId: refill.id, step: "pdf_upload", error: uploadResult.error });
          }
        }
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        console.error(`[refill-check] PDF generation error for refill ${refill.id}:`, msg);
        run.trackFailure({ rxId: rx.id, refillId: refill.id, step: "pdf_generation", error: msg });
      }

      // Track success for synchronous operations (insert + PDF)
      if (pdfOk) {
        run.trackSuccess({ rxId: rx.id, refillId: refill.id });
      }

      // Create payment transaction and send payment link to patient
      // Fire-and-forget to avoid deadlock with same-server fetch in dev mode
      // Payment link errors are logged to console only (async, runs after run.success)
      const appUrl = envConfig.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      console.log(`[refill-check] Firing generate-link for refill ${refill.id}...`);

      fetch(`${appUrl}/api/payments/generate-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          prescriptionId: refill.id,
          consultationFeeCents: rx.profit_cents || 0,
          medicationCostCents: Math.round(
            parseFloat(rx.patient_price || "0") * 100,
          ),
          shippingFeeCents: rx.shipping_fee_cents || 0,
          sendEmail: true,
        }),
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (res.ok) {
            console.log(`[refill-check] Payment link generated for refill ${refill.id}:`, body.paymentUrl);
          } else {
            console.error(`[refill-check] generate-link failed for refill ${refill.id}:`, body.error);
          }
        })
        .catch((err) => {
          console.error(`[refill-check] generate-link fetch error for refill ${refill.id}:`, err.message);
        });
    }

    console.log(`[refill-check] Done. Processed ${eligible.length} refills.`);
    await run.success(eligible.length);
  } catch (err) {
    console.error("[refill-check] Fatal error:", err instanceof Error ? err.message : String(err));
    await run.error(err instanceof Error ? err.message : String(err));
  }
}
