import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getActiveRedsailConfig } from "@/core/services/redsailPaymentConfigService";
import { getRedsailClient } from "@/core/services/redsail/client";
import {
  mapTransactionToLinkRequest,
  type PaymentTransactionLike,
  type PrescriptionLineLike,
} from "@/core/services/redsail/transactionMapper";

/**
 * Creates (or reuses) a RedSail "Link to Pay" for a patient and returns the
 * hosted URL to redirect to. Mirrors create-stripe-session.
 *
 * This route only does anything when REDSAIL_ENABLED is on; otherwise no
 * transaction is ever routed to RedSail, so it returns 404 / not-configured.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentToken, from } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    if (!envConfig.REDSAIL_ENABLED) {
      return NextResponse.json(
        { success: false, error: "RedSail Pay is not enabled" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", paymentToken)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (transaction.payment_status === "completed") {
      return NextResponse.json(
        { success: false, error: "Payment has already been completed" },
        { status: 400 },
      );
    }

    if (transaction.payment_gateway !== "redsail") {
      return NextResponse.json(
        { success: false, error: "This payment is not configured for RedSail" },
        { status: 400 },
      );
    }

    if (
      transaction.payment_link_expires_at &&
      new Date(transaction.payment_link_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: "Payment link has expired" },
        { status: 400 },
      );
    }

    const config = transaction.pharmacy_id
      ? await getActiveRedsailConfig(transaction.pharmacy_id)
      : null;

    if (!config || !config.isActive || !config.isConnected) {
      return NextResponse.json(
        { success: false, error: "RedSail is not connected for this pharmacy" },
        { status: 500 },
      );
    }

    const client = getRedsailClient(config);
    const siteUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

    const { data: linkedPrescriptions } = await supabase
      .from("prescriptions")
      .select("medication, quantity, patient_price, shipping_fee_cents")
      .eq("payment_transaction_id", transaction.id);

    const linkRequest = mapTransactionToLinkRequest({
      txn: transaction as PaymentTransactionLike,
      prescriptions: (linkedPrescriptions ?? []) as PrescriptionLineLike[],
      returnUrl: `${siteUrl}/payment/success/${paymentToken}?from=${from || "patient-link"}`,
      cancelUrl: `${siteUrl}/payment/cancelled/${paymentToken}`,
    });

    const result = await client.createLinkToPay(linkRequest);

    await supabase
      .from("payment_transactions")
      .update({
        redsail_transaction_id: result.redsailTransactionId,
        redsail_link_code: result.linkCode,
        redsail_payload: result.raw ?? null,
        payment_link_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return NextResponse.json({
      success: true,
      sessionUrl: result.url,
      sessionId: result.redsailTransactionId,
    });
  } catch (error) {
    console.error(
      "[REDSAIL-SESSION] Error:",
      error instanceof Error ? error.message : "Unknown",
    );
    return NextResponse.json(
      { success: false, error: "Failed to create RedSail payment session" },
      { status: 500 },
    );
  }
}
