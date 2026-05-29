/* eslint-disable no-console */
import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { envConfig } from "@core/config";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import { uploadPrescriptionPdf } from "@core/services/storage/prescriptionPdfStorage";
import {
  isGreenwichPharmacy,
  GREENWICH_CLINIC_NAME,
  formatBillToNote,
  quantityInMl,
  daysSupplyFromVialCount,
  classifyDosageForm,
  quantityForOral,
  daysSupplyForOral,
} from "@core/utils/digitalrx-format";

export async function checkRefills() {
  console.log("[refill-check] Starting refill check...");
  const run = await logCronRun("refill-check");

  try {
    const supabase = createCronClient();

    const lookAheadMs = 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() + lookAheadMs).toISOString();
    console.log("[refill-check] Querying prescriptions with next_refill_date <=", cutoff, "(24h look-ahead)");

    const { data, error } = await supabase
      .from("prescriptions")
      .select("*")
      .lte("next_refill_date", cutoff)
      .eq("prescription_type", "prescription")
      .not("next_refill_date", "is", null);

    if (error) {
      console.error("[refill-check] Query error:", error.message);
      await run.error(error.message);
      return;
    }

    console.log("[refill-check] Found", data?.length ?? 0, "prescriptions with past next_refill_date");

    const eligible = (data ?? []).filter(
      (rx) => (rx.total_refills_to_date ?? 0) < (rx.refills ?? 0),
    );

    console.log("[refill-check] Eligible for refill:", eligible.length, "of", data?.length ?? 0);

    for (const rx of eligible) {
      console.log(`[refill-check] Processing rx ${rx.id} — ${rx.medication} (refill ${(rx.total_refills_to_date || 0) + 1}/${rx.refills})`);

      const { data: existingRefills } = await supabase
        .from("prescriptions")
        .select("id, status")
        .eq("parent_prescription_id", rx.id)
        .eq("prescription_type", "refill")
        .in("status", ["pending_payment", "pending", "submitted", "processing"]);

      if (existingRefills && existingRefills.length > 0) {
        console.log(`[refill-check] Skipping rx ${rx.id} — active refill ${existingRefills[0].id} (status: ${existingRefills[0].status}) already exists`);
        continue;
      }

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
        console.error(`[refill-check] Failed to update parent rx ${rx.id}:`, updateError.message);
        run.trackFailure({ rxId: rx.id, step: "update_parent", error: updateError.message });
        continue;
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.warn(`[refill-check] Skipping rx ${rx.id} — lock conflict (already processed by another run)`);
        continue;
      }

      console.log(`[refill-check] Updated parent rx ${rx.id} — refills: ${newTotalRefills}/${rx.refills}, next_refill_date: ${newRefillDate}`);

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
          profit_cents: rx.profit_cents,
          consultation_reason: rx.consultation_reason,
          shipping_fee_cents: rx.shipping_fee_cents,
          total_paid_cents: rx.total_paid_cents,
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
          // Manning-incident fix (May 9 2026, Task #64): propagate the
          // delegation linkage so downstream PDF regen / submit-to-pharmacy
          // can resolve the AUTHORIZING provider on the refill row too.
          submitted_by_delegation_id: rx.submitted_by_delegation_id ?? null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`[refill-check] Failed to create refill for rx ${rx.id} — rolling back parent:`, insertError.message);
        await supabase
          .from("prescriptions")
          .update({
            total_refills_to_date: rx.total_refills_to_date ?? 0,
            next_refill_date: rx.next_refill_date,
          })
          .eq("id", rx.id)
          .eq("total_refills_to_date", newTotalRefills);
        run.trackFailure({ rxId: rx.id, step: "insert", error: insertError.message });
        continue;
      }

      console.log(`[refill-check] Created refill prescription ${refill?.id} for original ${rx.id}`);

      if (!refill) continue;

      let pdfOk = false;
      try {
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("first_name, last_name, date_of_birth, data, physical_address, phone")
          .eq("id", rx.patient_id)
          .single();

        if (patientError || !patient) {
          console.error(`[refill-check] Failed to fetch patient ${rx.patient_id} for PDF:`, patientError?.message);
          run.trackFailure({ rxId: rx.id, refillId: refill.id, step: "pdf_patient_fetch", error: patientError?.message || "Patient not found" });
        } else {
          // Manning-incident fix (May 9 2026, Task #64): refill PDFs
          // for delegate-submitted originals must render the AUTHORIZING
          // provider's NPI / DEA / signature, not the assistant's empty
          // row. Resolve via shared helper.
          const { resolveAuthorizingProvider } = await import(
            "@core/services/authorizing-provider"
          );
          const authResolved = await resolveAuthorizingProvider(supabase, {
            prescriberId: rx.prescriber_id,
            delegationId: (rx as { submitted_by_delegation_id?: string | null }).submitted_by_delegation_id,
          });
          const provider = authResolved?.provider ?? null;
          if (!authResolved) {
            console.warn(`[refill-check] Authorizing provider not resolved for refill (rxId: ${rx.id}, prescriberId: ${rx.prescriber_id}, delegationId: ${(rx as { submitted_by_delegation_id?: string | null }).submitted_by_delegation_id || "none"})`);
          } else if (authResolved.viaDelegation) {
            console.log(`[refill-check] Resolved authorizing provider via delegation ${authResolved.delegationId} for refill ${refill.id}`);
          }

          const patientAddress = patient.physical_address && typeof patient.physical_address === "object" ? patient.physical_address as Record<string, string> : {};
          const providerAddress = provider?.physical_address && typeof provider.physical_address === "object" ? provider.physical_address as Record<string, string> : {};
          const patientData = patient.data && typeof patient.data === "object" ? patient.data as Record<string, string> : {};

          // ── Greenwich-aware PDF formatting ────────────────────────
          // Mirrors the wizard logic in app/(features)/prescriptions/new/step3/page.tsx
          // so refill PDFs render the same drug-name string, mL Qty, computed
          // Days Supply, NDC, and "Bill to ..." Notes line that the
          // submit-to-pharmacy route ships in the API payload.
          const isGreenwich = isGreenwichPharmacy(rx.pharmacy_id);
          let catalogDrugName: string | undefined = undefined;
          let catalogNdc: string | undefined = undefined;
          let greenwichQty: string | undefined = undefined;
          let greenwichDaysSupply: string | undefined = undefined;
          let greenwichNotes: string | undefined = undefined;
          if (isGreenwich && rx.medication_id) {
            try {
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
                  // Branch by dosage form: injection → mL; capsule/tablet → unit count.
                  let formBucket: "injection" | "capsule" | "tablet" = "injection";
                  try {
                    formBucket = classifyDosageForm(med.form);
                  } catch (formErr) {
                    console.warn(`[refill-check] Greenwich classifyDosageForm failed for refill ${refill.id}; defaulting to injection`, formErr);
                  }
                  try {
                    greenwichQty = formBucket === "injection"
                      ? quantityInMl(vialCount, med.vial_size).toString()
                      : quantityForOral(vialCount, med.vial_size).toString();
                  } catch (qtyErr) {
                    console.warn(`[refill-check] Greenwich qty computation failed for refill ${refill.id}:`, qtyErr);
                  }
                  try {
                    greenwichDaysSupply = formBucket === "injection"
                      ? String(daysSupplyFromVialCount(vialCount))
                      : String(daysSupplyForOral(vialCount));
                  } catch (dsErr) {
                    console.warn(`[refill-check] Greenwich daysSupply computation failed for refill ${refill.id}:`, dsErr);
                  }
                }
                const billToLine = formatBillToNote(GREENWICH_CLINIC_NAME);
                const existingNotes = (rx.pharmacy_notes || "").trim();
                greenwichNotes = existingNotes
                  ? `${existingNotes}\n${billToLine}`
                  : billToLine;
              }
            } catch (catalogErr) {
              console.warn(`[refill-check] Greenwich catalog fetch failed for refill ${refill.id}; PDF will use legacy values:`, catalogErr);
            }
          }

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
              prefix: (provider as { prefix?: string | null } | null)?.prefix || "Dr.",
              firstName: provider?.first_name || "",
              lastName: provider?.last_name || "",
              npi: provider?.npi_number || "",
              dea: (provider as { dea_number?: string | null } | null)?.dea_number || undefined,
              companyName: (provider as { company_name?: string | null } | null)?.company_name || undefined,
              street: providerAddress.street,
              city: providerAddress.city,
              state: providerAddress.state,
              zip: providerAddress.zipCode || providerAddress.zip,
              phone: provider?.phone_number || undefined,
            },
            rx: {
              drugName: rx.medication || "",
              useGreenwichFormat: isGreenwich && !!catalogDrugName,
              catalogDrugName,
              ndc: catalogNdc,
              qty: greenwichQty || String(rx.quantity || ""),
              daysSupply: greenwichDaysSupply,
              dateWritten: new Date().toISOString().split("T")[0],
              refills: String(rx.refills || "0"),
              instructions: rx.sig || undefined,
              notes: greenwichNotes || rx.pharmacy_notes || undefined,
              daw: rx.dispense_as_written ? "Y" : "N",
              pon: refill.id ? String(refill.id).slice(-8).toUpperCase() : undefined,
            },
            signatureUrl: provider?.signature_url || undefined,
          });

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

      if (pdfOk) {
        run.trackSuccess({ rxId: rx.id, refillId: refill.id });
      }

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
