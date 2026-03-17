import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getPaymentConfigById } from "@/core/services/pharmacyPaymentConfigService";
import Stripe from "stripe";

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

    if (transaction.payment_gateway !== "stripe") {
      return NextResponse.json(
        { success: false, error: "This payment is not configured for Stripe" },
        { status: 400 },
      );
    }

    let stripeSecretKey: string | undefined;
    if (transaction.payment_config_id) {
      const pharmacyConfig = await getPaymentConfigById(transaction.payment_config_id);
      if (pharmacyConfig?.stripeSecretKey) {
        stripeSecretKey = pharmacyConfig.stripeSecretKey;
      }
    }
    if (!stripeSecretKey) {
      stripeSecretKey = envConfig.STRIPE_SECRET_KEY;
    }
    if (!stripeSecretKey) {
      return NextResponse.json(
        { success: false, error: "Stripe is not configured" },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    if (transaction.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(transaction.stripe_session_id);
        if (existingSession.status === "open" && existingSession.url) {
          return NextResponse.json({
            success: true,
            sessionUrl: existingSession.url,
            sessionId: existingSession.id,
          });
        }
      } catch {
        // Session expired or invalid, create a new one
      }
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

    const siteUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: transaction.patient_email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: transaction.total_amount_cents,
            product_data: {
              name: transaction.description || "Prescription Payment",
              description: `Patient: ${transaction.patient_name || "N/A"}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_token: paymentToken,
        transaction_id: transaction.id,
        prescription_id: transaction.prescription_id || "",
      },
      success_url: `${siteUrl}/payment/success/${paymentToken}?from=${from || "patient-link"}`,
      cancel_url: `${siteUrl}/payment/cancelled/${paymentToken}`,
    });

    await supabase
      .from("payment_transactions")
      .update({
        stripe_session_id: session.id,
        payment_link_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return NextResponse.json({
      success: true,
      sessionUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error(
      "[STRIPE-SESSION] Error:",
      error instanceof Error ? error.message : "Unknown",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Stripe checkout session",
      },
      { status: 500 },
    );
  }
}
