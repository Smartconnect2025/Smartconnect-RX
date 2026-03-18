import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getPaymentConfigById } from "@/core/services/pharmacyPaymentConfigService";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import Stripe from "stripe";

async function resolveStripeCredentials(
  supabase: ReturnType<typeof createAdminClient>,
  rawBody: string,
  signature: string,
): Promise<{ event: Stripe.Event; stripe: Stripe } | { error: string; status: number }> {
  const { data: configs } = await supabase
    .from("pharmacy_payment_configs")
    .select("id, stripe_secret_key_encrypted, stripe_webhook_secret_encrypted")
    .eq("gateway", "stripe")
    .eq("is_active", true);

  const candidates: Array<{ secretKey: string; webhookSecret: string }> = [];

  if (configs && configs.length > 0) {
    for (const cfg of configs) {
      if (cfg.stripe_webhook_secret_encrypted) {
        try {
          const fullConfig = await getPaymentConfigById(cfg.id);
          if (fullConfig?.stripeSecretKey && fullConfig?.stripeWebhookSecret) {
            candidates.push({
              secretKey: fullConfig.stripeSecretKey,
              webhookSecret: fullConfig.stripeWebhookSecret,
            });
          }
        } catch { /* skip */ }
      }
    }
  }

  if (envConfig.STRIPE_SECRET_KEY && envConfig.STRIPE_WEBHOOK_SECRET) {
    candidates.push({
      secretKey: envConfig.STRIPE_SECRET_KEY,
      webhookSecret: envConfig.STRIPE_WEBHOOK_SECRET,
    });
  }

  if (candidates.length === 0) {
    return { error: "No Stripe webhook secrets configured", status: 503 };
  }

  for (const candidate of candidates) {
    try {
      const stripe = new Stripe(candidate.secretKey);
      const event = stripe.webhooks.constructEvent(rawBody, signature, candidate.webhookSecret);
      return { event, stripe };
    } catch { /* try next */ }
  }

  return { error: "Invalid signature", status: 401 };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const result = await resolveStripeCredentials(supabase, rawBody, signature);
    if ("error" in result) {
      console.error(`[STRIPE-WEBHOOK] ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { event, stripe } = result;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
) {
  const paymentToken = session.metadata?.payment_token;
  const transactionId = session.metadata?.transaction_id;

  if (!paymentToken && !transactionId) {
    console.error("[STRIPE-WEBHOOK] No payment_token or transaction_id in session metadata");
    return;
  }

  let paymentTransaction = null;

  if (transactionId) {
    const result = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();
    paymentTransaction = result.data;
  }

  if (!paymentTransaction && paymentToken) {
    const result = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", paymentToken)
      .single();
    paymentTransaction = result.data;
  }

  if (!paymentTransaction) {
    console.error(`[STRIPE-WEBHOOK] No matching payment transaction found for session ${session.id}`);
    return;
  }

  if (paymentTransaction.payment_status === "completed") {
    console.log(`[STRIPE-WEBHOOK] Payment ${paymentTransaction.id} already completed — skipping`);
    return;
  }

  let cardLastFour: string | undefined;
  let cardBrand: string | undefined;
  let stripePaymentIntentId: string | undefined;

  if (session.payment_intent) {
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    stripePaymentIntentId = piId;

    try {
      const pi = await stripe.paymentIntents.retrieve(piId, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      if (charge?.payment_method_details?.card) {
        cardLastFour = charge.payment_method_details.card.last4 || undefined;
        cardBrand = charge.payment_method_details.card.brand || undefined;
      }
    } catch {
      console.warn("[STRIPE-WEBHOOK] Could not retrieve payment intent details");
    }
  }

  const updateResult = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
      stripe_payment_intent_id: stripePaymentIntentId,
      stripe_session_id: session.id,
      card_last_four: cardLastFour,
      card_type: cardBrand,
      paid_at: new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
      webhook_payload: session as unknown as Record<string, unknown>,
    })
    .eq("id", paymentTransaction.id)
    .eq("payment_status", "pending")
    .select("id");

  if (updateResult.error) {
    console.error(`[STRIPE-WEBHOOK] Failed to update payment ${paymentTransaction.id}:`, updateResult.error.message);
    return;
  }

  if (!updateResult.data || updateResult.data.length === 0) {
    console.log(`[STRIPE-WEBHOOK] Payment ${paymentTransaction.id} already processed by another request — skipping`);
    return;
  }

  console.log(`[STRIPE-WEBHOOK] Payment ${paymentTransaction.id} marked as completed`);

  if (paymentTransaction.prescription_id) {
    const { data: rxData } = await supabase
      .from("prescriptions")
      .select("id, queue_id, prescriber_id, patients(first_name, last_name)")
      .eq("id", paymentTransaction.prescription_id)
      .single();

    const { error: rxUpdateError } = await supabase
      .from("prescriptions")
      .update({
        payment_status: "paid",
        order_progress: "payment_received",
        status: "payment_received",
      })
      .eq("id", paymentTransaction.prescription_id);

    if (rxUpdateError) {
      console.error(`[STRIPE-WEBHOOK] Failed to update prescription ${paymentTransaction.prescription_id}:`, rxUpdateError.message);
    }

    if (rxData?.prescriber_id) {
      const patient = rxData.patients as { first_name?: string; last_name?: string } | null;
      const patientName = patient
        ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim()
        : "Patient";
      notifyPrescriptionStatusChange(
        rxData.prescriber_id,
        rxData.queue_id || rxData.id,
        patientName,
        "payment_received",
        paymentTransaction.prescription_id,
      ).catch((err) => console.error("[STRIPE-WEBHOOK] Notification error:", err));
    }

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "";

      console.log(`[STRIPE-WEBHOOK] Auto-submitting prescription ${paymentTransaction.prescription_id} to pharmacy...`);
      const submitResponse = await fetch(
        `${siteUrl}/api/prescriptions/${paymentTransaction.prescription_id}/submit-to-pharmacy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
        },
      );

      if (submitResponse.ok) {
        await supabase
          .from("payment_transactions")
          .update({ order_progress: "pharmacy_processing" })
          .eq("id", paymentTransaction.id);
        console.log(`[STRIPE-WEBHOOK] Prescription ${paymentTransaction.prescription_id} submitted to pharmacy`);
      } else {
        const errorBody = await submitResponse.text().catch(() => "unable to read response");
        console.error(`[STRIPE-WEBHOOK] Pharmacy submission failed: HTTP ${submitResponse.status} — ${errorBody}`);
      }
    } catch (err) {
      console.error(`[STRIPE-WEBHOOK] Pharmacy submission error:`, err instanceof Error ? err.message : "Unknown");
    }
  }

  if (paymentTransaction.patient_email) {
    try {
      const internalApiKey = process.env.INTERNAL_API_KEY || "webhook-auto-email";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      let pharmacyLogoUrl: string | undefined;
      if (paymentTransaction.pharmacy_id) {
        const { data: pharmacy } = await supabase
          .from("pharmacies")
          .select("logo_url")
          .eq("id", paymentTransaction.pharmacy_id)
          .single();
        pharmacyLogoUrl = pharmacy?.logo_url || undefined;
      }

      const emailResponse = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        body: JSON.stringify({
          patientEmail: paymentTransaction.patient_email,
          patientName: paymentTransaction.patient_name,
          providerName: paymentTransaction.provider_name,
          medication: paymentTransaction.description,
          totalAmount: (paymentTransaction.total_amount_cents / 100).toFixed(2),
          transactionId: stripePaymentIntentId || session.id,
          pharmacyName: paymentTransaction.pharmacy_name,
          deliveryMethod: paymentTransaction.delivery_method,
          pharmacyLogoUrl,
        }),
      });

      if (!emailResponse.ok) {
        console.error(`[STRIPE-WEBHOOK] Confirmation email failed: HTTP ${emailResponse.status}`);
      }
    } catch (err) {
      console.error(`[STRIPE-WEBHOOK] Email error:`, err instanceof Error ? err.message : "Unknown");
    }
  }
}

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent,
) {
  const { data: existing } = await supabase
    .from("payment_transactions")
    .select("id, payment_status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (existing?.payment_status === "completed") {
    console.log(`[STRIPE-WEBHOOK] PaymentIntent ${paymentIntent.id} already processed via checkout.session.completed`);
    return;
  }

  if (existing) {
    await supabase
      .from("payment_transactions")
      .update({
        payment_status: "completed",
        order_progress: "payment_received",
        paid_at: new Date().toISOString(),
        webhook_received_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof createAdminClient>,
  charge: Stripe.Charge,
) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.error("[STRIPE-WEBHOOK] No payment_intent on refunded charge");
    return;
  }

  const refundAmountCents = charge.amount_refunded || 0;

  const { error } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "refunded",
      refund_amount_cents: refundAmountCents,
      refunded_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (error) {
    console.error(`[STRIPE-WEBHOOK] Failed to handle refund for ${paymentIntentId}:`, error.message);
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: Stripe.PaymentIntent,
) {
  const paymentToken = paymentIntent.metadata?.payment_token;

  if (paymentToken) {
    const { error } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "failed",
        stripe_payment_intent_id: paymentIntent.id,
        webhook_received_at: new Date().toISOString(),
      })
      .eq("payment_token", paymentToken);

    if (error) {
      console.error(`[STRIPE-WEBHOOK] Failed to handle payment failure:`, error.message);
    }
  }
}
