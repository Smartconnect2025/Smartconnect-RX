import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
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

    let body: { prescriptionIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      // no body is fine for single-prescription mark-paid
    }

    const explicitIds: string[] =
      Array.isArray(body.prescriptionIds) && body.prescriptionIds.length > 0
        ? body.prescriptionIds
        : [prescriptionId];

    if (!explicitIds.includes(prescriptionId)) {
      explicitIds.unshift(prescriptionId);
    }

    const { data: rxList, error: rxFetchError } = await supabaseAdmin
      .from("prescriptions")
      .select(
        "id, prescriber_id, status, payment_status, payment_transaction_id, patient_id, patient_price, quantity, profit_cents, shipping_fee_cents, total_paid_cents",
      )
      .in("id", explicitIds);

    if (rxFetchError || !rxList || rxList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Prescriptions not found" },
        { status: 404 },
      );
    }

    if (rxList.length !== explicitIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more prescription IDs are invalid" },
        { status: 400 },
      );
    }

    const firstPatientId = rxList[0].patient_id;

    for (const rx of rxList) {
      if (rx.prescriber_id !== user.id) {
        return NextResponse.json(
          { success: false, error: `Forbidden: you do not own prescription ${rx.id}` },
          { status: 403 },
        );
      }
      if (rx.status !== "pending_payment") {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot mark prescription ${rx.id} as paid — status is not pending_payment`,
          },
          { status: 400 },
        );
      }
      if (rx.patient_id !== firstPatientId) {
        return NextResponse.json(
          { success: false, error: "All prescriptions must belong to the same patient" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const allRxIds = rxList.map((rx) => rx.id);

    const combinedMedCents = rxList.reduce((sum, rx) => {
      const p = rx.patient_price ? parseFloat(rx.patient_price) : 0;
      const qty = rx.quantity && rx.quantity > 0 ? rx.quantity : 1;
      return sum + (Number.isFinite(p) ? Math.round(p * 100) * qty : 0);
    }, 0);
    const combinedProfitCents = rxList.reduce((sum, rx) => sum + (rx.profit_cents || 0), 0);
    const combinedShippingCents = rxList.reduce((sum, rx) => sum + (rx.shipping_fee_cents || 0), 0);
    const combinedTotal = combinedMedCents + combinedProfitCents + combinedShippingCents;

    const existingTxId = rxList.find((rx) => rx.payment_transaction_id)?.payment_transaction_id;
    let paymentTransactionId: string;

    if (existingTxId) {
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
        .eq("id", existingTxId);

      if (ptError) {
        console.error("Error updating payment_transaction:", ptError);
        return NextResponse.json(
          { success: false, error: "Failed to update payment transaction" },
          { status: 500 },
        );
      }
      paymentTransactionId = existingTxId;
    } else {
      const { data: newTransaction, error: createError } = await supabaseAdmin
        .from("payment_transactions")
        .insert({
          prescription_id: prescriptionId,
          payment_status: "completed",
          order_progress: "payment_received",
          paid_at: now,
          card_type: "manual-payment",
          total_amount_cents: combinedTotal,
          medication_cost_cents: combinedMedCents,
          consultation_fee_cents: combinedProfitCents,
          shipping_fee_cents: combinedShippingCents,
          payment_token: `manual-${crypto.randomUUID()}`,
          patient_id: rxList[0].patient_id,
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
      .in("id", allRxIds);

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

    for (const rxId of allRxIds) {
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
          console.error(`⚠️ [mark-paid] Failed to submit ${rxId} to pharmacy`);
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
      try {
        await supabaseAdmin.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email || "unknown",
          user_name: "System",
          action: "PHARMACY_SUBMISSION_FAILED",
          details: `Some prescriptions in order ${paymentTransactionId} failed to submit to pharmacy after mark-paid. Manual submission may be required.`,
          status: "error",
        });
      } catch (_) {}

      return NextResponse.json({
        success: true,
        updatedIds: allRxIds,
        warning: "Marked as paid but some prescriptions failed to submit to pharmacy.",
      });
    }

    return NextResponse.json({
      success: true,
      updatedIds: allRxIds,
      message: allRxIds.length > 1
        ? `${allRxIds.length} prescriptions marked as paid and submitted to pharmacy`
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
