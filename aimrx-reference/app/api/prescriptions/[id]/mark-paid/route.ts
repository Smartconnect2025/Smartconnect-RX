import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import type { NextRequest } from "next/server";
import {
  submitPrescriptionToPharmacy,
  newRequestId,
  withTimeout,
} from "@/app/api/prescriptions/_shared/submit-to-pharmacy-core";

/**
 * POST /api/prescriptions/[id]/mark-paid
 * Manually marks a prescription as paid (e.g., cash/external payment)
 * Only allowed when prescription status is "pending_payment"
 *
 * - If a payment_transaction exists, updates it
 * - If no payment_transaction exists, creates one
 * - Updates the prescription payment/status fields
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const internalKey = _request.headers.get("x-internal-api-key");
    const isInternalCall = !!(
      process.env.INTERNAL_API_KEY &&
      internalKey &&
      internalKey === process.env.INTERNAL_API_KEY
    );

    let user: { id: string; email?: string | null } | null = null;
    let userRole: string | null = null;

    if (isInternalCall) {
      user = { id: "00000000-0000-0000-0000-000000000000", email: "internal@aimrx" };
      userRole = "admin";
    } else {
      const auth = await getUser();
      user = auth.user;
      userRole = auth.userRole;
    }

    // Optional flag from caller to suppress the patient confirmation email
    // (used by the pay-on-terms bypass — the patient never paid, so no receipt).
    let suppressPatientEmail = false;
    try {
      const body = await _request.clone().json();
      if (body && body.suppressPatientEmail === true) suppressPatientEmail = true;
    } catch {
      // no body / not JSON — fine, default false
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: prescriptionId } = await params;
    const supabaseAdmin = createAdminClient();

    const { data: prescription, error } = await supabaseAdmin
      .from("prescriptions")
      .select(
        "id, prescriber_id, status, payment_status, payment_transaction_id, patient_id, patient_price, profit_cents, shipping_fee_cents, total_paid_cents, medication, dosage, order_group_id",
      )
      .eq("id", prescriptionId)
      .single();

    if (error || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    const isAdmin = userRole === "admin" || userRole === "super_admin";
    if (!isInternalCall && !isAdmin && prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (prescription.status === "payment_received" && prescription.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        message: "Prescription is already marked as paid",
      });
    }

    if (prescription.status !== "pending_payment" && prescription.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot mark as paid — status is not pending_payment",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    let paymentTransactionId = prescription.payment_transaction_id;

    // Patient total = patient_price + shipping + oversight fees (profit_cents).
    let groupMembersForTotal: Array<{ patient_price: string | null; shipping_fee_cents: number | null }> = [];

    if (prescription.order_group_id) {
      const { data: groupMembers } = await supabaseAdmin
        .from("prescriptions")
        .select("patient_price, shipping_fee_cents, profit_cents")
        .eq("order_group_id", prescription.order_group_id);
      if (groupMembers && groupMembers.length > 0) {
        groupMembersForTotal = groupMembers;
      }
    }

    let totalMedicationCostCents = 0;
    let totalShippingFeeCents = 0;
    let totalOversightFeeCents = 0;

    if (groupMembersForTotal.length > 0) {
      for (const m of groupMembersForTotal) {
        const p = m.patient_price ? parseFloat(m.patient_price) : 0;
        totalMedicationCostCents += Number.isFinite(p) ? Math.round(p * 100) : 0;
        totalShippingFeeCents += m.shipping_fee_cents || 0;
        totalOversightFeeCents += (m as any).profit_cents || 0;
      }
    } else {
      const parsedPrice = prescription.patient_price ? parseFloat(prescription.patient_price) : 0;
      totalMedicationCostCents = Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) : 0;
      totalShippingFeeCents = prescription.shipping_fee_cents || 0;
      totalOversightFeeCents = prescription.profit_cents || 0;
    }

    const computedTotalCents = totalMedicationCostCents + totalShippingFeeCents + totalOversightFeeCents;
    // Use computed group total when available; only trust total_paid_cents if it matches or exceeds computed
    const totalAmountCents = computedTotalCents > 0 ? computedTotalCents : (prescription.total_paid_cents || 0);

    if (paymentTransactionId) {
      const { data: existingTx } = await supabaseAdmin
        .from("payment_transactions")
        .select("total_amount_cents")
        .eq("id", paymentTransactionId)
        .single();

      const { error: ptError } = await supabaseAdmin
        .from("payment_transactions")
        .update({
          payment_status: "completed",
          order_progress: "payment_received",
          paid_at: now,
          card_type: "manual-payment",
          updated_at: now,
          total_amount_cents: totalAmountCents,
          medication_cost_cents: totalMedicationCostCents,
          consultation_fee_cents: totalOversightFeeCents,
          shipping_fee_cents: totalShippingFeeCents,
        })
        .eq("id", paymentTransactionId);

      if (ptError) {
        console.error("Error updating payment_transaction:", ptError);
        return NextResponse.json(
          { success: false, error: "Failed to update payment transaction" },
          { status: 500 },
        );
      }
    } else {

      const { data: newTransaction, error: createError } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          prescription_id: prescriptionId,
          payment_status: "completed",
          order_progress: "payment_received",
          paid_at: now,
          card_type: "manual-payment",
          total_amount_cents: totalAmountCents,
          medication_cost_cents: totalMedicationCostCents,
          consultation_fee_cents: totalOversightFeeCents,
          shipping_fee_cents: totalShippingFeeCents,
          payment_token: `manual-${crypto.randomUUID()}`,
          patient_id: prescription.patient_id,
        })
        .select("id")
        .single();

      if (createError || !newTransaction) {
        console.error("Error creating payment_transaction:", createError);
        return NextResponse.json(
          { success: false, error: "Failed to create payment transaction" },
          { status: 500 },
        );
      }

      paymentTransactionId = newTransaction.id;
    }

    const allRxIdsToUpdate: string[] = [prescriptionId];

    const { data: linkedRxs } = await supabaseAdmin
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", paymentTransactionId)
      .neq("id", prescriptionId);

    if (linkedRxs) {
      for (const rx of linkedRxs) {
        allRxIdsToUpdate.push(rx.id);
      }
    }

    if (prescription.order_group_id) {
      const { data: groupRxs } = await supabaseAdmin
        .from("prescriptions")
        .select("id")
        .eq("order_group_id", prescription.order_group_id)
        .neq("id", prescriptionId);

      if (groupRxs) {
        for (const rx of groupRxs) {
          if (!allRxIdsToUpdate.includes(rx.id)) {
            allRxIdsToUpdate.push(rx.id);
          }
        }
      }
    }

    for (const rxId of allRxIdsToUpdate) {
      const { error: rxError } = await supabaseAdmin
        .from("prescriptions")
        .update({
          payment_status: "paid",
          status: "payment_received",
          payment_transaction_id: paymentTransactionId,
          updated_at: now,
        })
        .eq("id", rxId);

      if (rxError) {
        console.error(`Error updating prescription ${rxId}:`, rxError);
      }
    }

    if (suppressPatientEmail) {
      console.log(`[mark-paid] suppressPatientEmail=true — skipping patient confirmation email for rx ${prescriptionId}`);
    }

    (async () => {
      if (suppressPatientEmail) return;
      try {
        const { data: patientData } = await supabaseAdmin
          .from("patients")
          .select("first_name, last_name, email, phone")
          .eq("id", prescription.patient_id)
          .single();

        if (!patientData?.email) return;

        let providerName = "Your Provider";
        if (prescription.prescriber_id) {
          const { data: providerData } = await supabaseAdmin
            .from("providers")
            .select("prefix, first_name, last_name")
            .eq("user_id", prescription.prescriber_id)
            .single();
          if (providerData) {
            providerName = `${(providerData as { prefix?: string | null }).prefix || "Dr."} ${providerData.first_name || ""} ${providerData.last_name || ""}`.trim();
          }
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const internalApiKey = process.env.INTERNAL_API_KEY || "";
        const patientName = `${patientData.first_name || ""} ${patientData.last_name || ""}`.trim() || "Patient";

        const allMedications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
        let groupTotalCents = 0;
        let emailOversightCents = 0;

        if (allRxIdsToUpdate.length > 1) {
          const { data: groupRxDetails } = await supabaseAdmin
            .from("prescriptions")
            .select("medication, patient_price, shipping_fee_cents, profit_cents")
            .in("id", allRxIdsToUpdate);

          if (groupRxDetails) {
            for (const grx of groupRxDetails) {
              const price = grx.patient_price ? parseFloat(grx.patient_price) : 0;
              const ship = grx.shipping_fee_cents || 0;
              const oversight = grx.profit_cents || 0;
              groupTotalCents += Math.round(price * 100) + ship + oversight;
              emailOversightCents += oversight;
              allMedications.push({
                name: grx.medication || "Medication",
                price: price.toFixed(2),
                shippingFee: ship > 0 ? (ship / 100).toFixed(2) : undefined,
              });
            }
          }
        }

        if (allMedications.length === 0) {
          const price = prescription.patient_price ? parseFloat(prescription.patient_price) : 0;
          const ship = prescription.shipping_fee_cents || 0;
          const oversight = prescription.profit_cents || 0;
          groupTotalCents = Math.round(price * 100) + ship + oversight;
          emailOversightCents = oversight;
          allMedications.push({
            name: prescription.medication || "Your Medication",
            price: price.toFixed(2),
            shippingFee: ship > 0 ? (ship / 100).toFixed(2) : undefined,
          });
        }

        const emailTotalCents = (allMedications.length > 1 && groupTotalCents > 0)
          ? groupTotalCents
          : (totalAmountCents > 0 ? totalAmountCents : groupTotalCents);
        const totalAmount = (emailTotalCents / 100).toFixed(2);

        const res = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            patientEmail: patientData.email,
            patientPhone: patientData.phone || undefined,
            patientName,
            medication: allMedications.length === 1 ? allMedications[0].name : allMedications.map(m => m.name).join(", "),
            medications: allMedications,
            oversightFee: emailOversightCents > 0 ? (emailOversightCents / 100).toFixed(2) : undefined,
            providerName,
            totalAmount,
            paymentMethod: "Manual Payment",
            transactionId: `MANUAL-${prescriptionId.slice(0, 8).toUpperCase()}`,
            prescriptionId,
          }),
        });

        if (res.ok) console.log(`✅ [mark-paid] Payment confirmation email sent to ${patientData.email}`);
        else console.error(`⚠️ [mark-paid] Confirmation email failed: ${res.status}`);
      } catch (err) {
        console.error(`⚠️ [mark-paid] Confirmation email error:`, err);
      }
    })();

    // ─── Submit each prescription to pharmacy via DIRECT in-process call ─
    // The previous implementation issued an internal HTTP self-call to
    // /api/prescriptions/[id]/submit-to-pharmacy. Both routes shared a
    // single Render serverless execution budget, so when the submit fetch
    // hung on DigitalRx the OUTER mark-paid invocation was SIGKILLed
    // before any catch could run — leaving rows stuck in
    // submitting_to_pharmacy with NO error log (May 4 2026 Felicia).
    //
    // Direct invocation removes the HTTP hop and makes the per-step
    // timeouts inside submit-to-pharmacy-core fully effective.
    //
    // Bounded parallelism: at most MAX_CONCURRENT prescriptions in flight
    // at once. Cohort total is also bounded by an overall deadline so a
    // single hung backend cannot blow the whole mark-paid budget.
    const pharmacyErrors: string[] = [];
    const submittedQueueIds: string[] = [];
    const MAX_CONCURRENT = 2;
    const OVERALL_DEADLINE_MS = 22000;
    const overallStart = Date.now();

    async function submitOne(rxId: string): Promise<void> {
      const remaining = OVERALL_DEADLINE_MS - (Date.now() - overallStart);
      if (remaining <= 1000) {
        pharmacyErrors.push(`${rxId}: cohort deadline reached before start`);
        return;
      }
      console.log(`✅ [mark-paid] Submitting prescription ${rxId} to pharmacy (direct)...`);
      try {
        const result = await withTimeout(
          `mark-paid:submit:${rxId}`,
          remaining,
          submitPrescriptionToPharmacy(supabaseAdmin, rxId, {
            isInternalCall: true,
            isAdmin: true,
            authenticatedUserId: null,
            requestId: newRequestId(),
            callerLabel: "mark-paid",
          }),
        );
        if (result.ok) {
          console.log(`✅ [mark-paid] Prescription ${rxId} submitted: queue_id=${result.queueId}`);
          if (result.queueId) submittedQueueIds.push(result.queueId);
        } else {
          console.error(
            `⚠️ [mark-paid] Submit failed ${rxId}: code=${result.code} http=${result.httpStatus} err=${result.error}`,
          );
          pharmacyErrors.push(`${rxId}: ${result.error || result.code}`);
        }
      } catch (submitError) {
        console.error(`⚠️ [mark-paid] Submit threw for ${rxId}:`, submitError);
        pharmacyErrors.push(
          `${rxId}: ${submitError instanceof Error ? submitError.message : "Unknown"}`,
        );
      }
    }

    // Drain a worker queue with bounded parallelism.
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT, allRxIdsToUpdate.length) },
      async () => {
        while (cursor < allRxIdsToUpdate.length) {
          const myIndex = cursor++;
          const rxId = allRxIdsToUpdate[myIndex];
          await submitOne(rxId);
        }
      },
    );
    await Promise.all(workers);

    if (pharmacyErrors.length > 0) {
      // user_id must be NULL (not the zero-UUID) when called internally —
      // system_logs.user_id has a FK to auth.users(id) which silently rejects
      // non-existent UUIDs and would lose the failure log entirely.
      await supabaseAdmin.from("system_logs").insert({
        user_id: isInternalCall ? null : user.id,
        user_email: isInternalCall ? "internal@aimrx" : (user.email || "unknown"),
        user_name: isInternalCall ? "System (Pay-on-Terms / internal)" : "System",
        action: "PHARMACY_SUBMISSION_FAILED",
        details: `${pharmacyErrors.length}/${allRxIdsToUpdate.length} prescriptions failed pharmacy submission. Errors: ${pharmacyErrors.join("; ")}`,
        status: "error",
      }).then(({ error: logErr }) => {
        if (logErr) console.error("Failed to log pharmacy submission failure:", logErr);
      });
    }

    if (pharmacyErrors.length === allRxIdsToUpdate.length) {
      return NextResponse.json({
        success: true,
        warning: "Marked as paid but failed to submit to pharmacy. Please submit manually.",
        pharmacyError: pharmacyErrors.join("; "),
      });
    }

    return NextResponse.json({
      success: true,
      queue_ids: submittedQueueIds,
      message: `${allRxIdsToUpdate.length} prescription(s) marked as paid and submitted to pharmacy`,
      ...(pharmacyErrors.length > 0 ? { pharmacyWarning: `${pharmacyErrors.length} failed: ${pharmacyErrors.join("; ")}` } : {}),
    });
  } catch (error) {
    console.error("Unexpected error marking prescription as paid:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
