import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import type { NextRequest } from "next/server";

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
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: prescriptionId } = await params;
    const supabaseAdmin = createAdminClient();

    // Fetch prescription
    const { data: prescription, error } = await supabaseAdmin
      .from("prescriptions")
      .select(
        "id, prescriber_id, status, payment_status, payment_transaction_id, patient_id, patient_price, profit_cents, shipping_fee_cents, total_paid_cents",
      )
      .eq("id", prescriptionId)
      .single();

    if (error || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    if (prescription.status !== "pending_payment") {
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

    const profitCents = prescription.profit_cents || 0;
    const shippingFeeCents = prescription.shipping_fee_cents || 0;

    const parsedPrice = prescription.patient_price
      ? parseFloat(prescription.patient_price)
      : 0;
    const medicationCostCents = Number.isFinite(parsedPrice)
      ? Math.round(parsedPrice * 100)
      : 0;

    const totalAmountCents = prescription.total_paid_cents != null
      ? prescription.total_paid_cents
      : medicationCostCents + profitCents + shippingFeeCents;

    let allLinkedRxIds: string[] = [prescriptionId];

    if (paymentTransactionId) {
      const { data: linkedRxList } = await supabaseAdmin
        .from("prescriptions")
        .select("id, patient_price, profit_cents, shipping_fee_cents, total_paid_cents")
        .eq("payment_transaction_id", paymentTransactionId);

      if (linkedRxList && linkedRxList.length > 0) {
        allLinkedRxIds = linkedRxList.map((rx: { id: string }) => rx.id);
        const combinedMedCents = linkedRxList.reduce((sum: number, rx: { patient_price?: string | null }) => {
          const p = rx.patient_price ? parseFloat(rx.patient_price as string) : 0;
          return sum + (Number.isFinite(p) ? Math.round(p * 100) : 0);
        }, 0);
        const combinedProfitCents = linkedRxList.reduce((sum: number, rx: { profit_cents?: number | null }) => sum + (rx.profit_cents || 0), 0);
        const combinedShippingCents = linkedRxList.reduce((sum: number, rx: { shipping_fee_cents?: number | null }) => sum + (rx.shipping_fee_cents || 0), 0);
        const combinedTotal = combinedMedCents + combinedProfitCents + combinedShippingCents;

        const { error: ptError } = await supabaseAdmin
          .from("payment_transactions")
          .update({
            payment_status: "completed",
            order_progress: "payment_received",
            paid_at: now,
            card_type: "manual-payment",
            updated_at: now,
            total_amount_cents: combinedTotal,
            medication_cost_cents: combinedMedCents,
            consultation_fee_cents: combinedProfitCents,
            shipping_fee_cents: combinedShippingCents,
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
        const { error: ptError } = await supabaseAdmin
          .from("payment_transactions")
          .update({
            payment_status: "completed",
            order_progress: "payment_received",
            paid_at: now,
            card_type: "manual-payment",
            updated_at: now,
            total_amount_cents: totalAmountCents,
            medication_cost_cents: medicationCostCents,
            consultation_fee_cents: profitCents,
            shipping_fee_cents: shippingFeeCents,
          })
          .eq("id", paymentTransactionId);

        if (ptError) {
          console.error("Error updating payment_transaction:", ptError);
          return NextResponse.json(
            { success: false, error: "Failed to update payment transaction" },
            { status: 500 },
          );
        }
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
          medication_cost_cents: medicationCostCents,
          consultation_fee_cents: profitCents,
          shipping_fee_cents: shippingFeeCents,
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

    const { error: rxError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        payment_status: "paid",
        order_progress: "payment_received",
        status: "payment_received",
        payment_transaction_id: paymentTransactionId,
        updated_at: now,
      })
      .in("id", allLinkedRxIds);

    if (rxError) {
      console.error("Error updating prescriptions:", rxError);
      return NextResponse.json(
        { success: false, error: "Failed to update prescriptions" },
        { status: 500 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    let anySubmitFailed = false;

    for (const rxId of allLinkedRxIds) {
      try {
        const submitResponse = await fetch(
          `${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret,
            },
          }
        );

        if (!submitResponse.ok) {
          const errorData = await submitResponse.json().catch(() => ({}));
          console.error(
            `⚠️ [mark-paid] Failed to submit ${rxId} to pharmacy:`,
            submitResponse.status,
            errorData
          );
          anySubmitFailed = true;
        } else {
          console.log(`✅ [mark-paid] Prescription ${rxId} submitted to pharmacy`);
        }
      } catch (submitError) {
        console.error(`⚠️ [mark-paid] Error submitting ${rxId}:`, submitError);
        anySubmitFailed = true;
      }
    }

    if (anySubmitFailed) {
      await supabaseAdmin.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email || "unknown",
        user_name: "System",
        action: "PHARMACY_SUBMISSION_FAILED",
        details: `Some prescriptions in order ${paymentTransactionId} failed to submit to pharmacy after mark-paid. Manual submission may be required.`,
        status: "error",
      }).then(({ error: logErr }) => {
        if (logErr) console.error("Failed to log pharmacy submission failure:", logErr);
      });

      return NextResponse.json({
        success: true,
        warning: "Marked as paid but some prescriptions failed to submit to pharmacy.",
      });
    }

    return NextResponse.json({
      success: true,
      message: allLinkedRxIds.length > 1
        ? `${allLinkedRxIds.length} prescriptions marked as paid and submitted to pharmacy`
        : "Prescription marked as paid and submitted to pharmacy",
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
