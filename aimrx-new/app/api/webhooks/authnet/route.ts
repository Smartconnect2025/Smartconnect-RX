import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getPaymentConfigById } from "@/core/services/pharmacyPaymentConfigService";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import crypto from "crypto";

async function collectSignatureKeys(): Promise<string[]> {
  const keys: string[] = [];

  try {
    const supabase = createAdminClient();
    const { data: configs } = await supabase
      .from("pharmacy_payment_configs")
      .select("id")
      .eq("gateway", "authorizenet")
      .eq("is_active", true);

    if (configs) {
      for (const cfg of configs) {
        try {
          const fullConfig = await getPaymentConfigById(cfg.id);
          if (fullConfig?.authnetSignatureKey) {
            keys.push(fullConfig.authnetSignatureKey);
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  if (envConfig.AUTHNET_SIGNATURE_KEY) {
    keys.push(envConfig.AUTHNET_SIGNATURE_KEY);
  }

  return keys;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const { eventType, payload } = body;

    const signature = request.headers.get("x-anet-signature");

    if (!signature) {
      console.error(`[WEBHOOK] Missing x-anet-signature header for event ${eventType} — rejecting`);
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const signatureKeys = await collectSignatureKeys();
    if (signatureKeys.length === 0) {
      console.error("[WEBHOOK] No AuthNet signature keys configured — rejecting");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    let isValid = false;
    for (const key of signatureKeys) {
      if (validateWebhookSignature(rawBody, signature, key)) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      console.error(`[WEBHOOK] Invalid signature for event ${eventType} — rejecting`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const transactionId = payload?.id;
    if (!transactionId) {
      console.error(`[WEBHOOK] Missing transaction ID in payload for event ${eventType}`);
      return NextResponse.json({ error: "No transaction ID" }, { status: 400 });
    }

    const supabase = createAdminClient();

    switch (eventType) {
      case "net.authorize.payment.authorization.created":
      case "net.authorize.payment.authcapture.created":
        await handlePaymentSuccess(supabase, payload);
        break;

      case "net.authorize.payment.capture.created":
        await handlePaymentCaptured(supabase, payload);
        break;

      case "net.authorize.payment.void.created":
        await handlePaymentVoided(supabase, payload);
        break;

      case "net.authorize.payment.refund.created":
        await handlePaymentRefunded(supabase, payload);
        break;

      default:
        console.warn(`[WEBHOOK] Unhandled event type: ${eventType}`);
        break;
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error("[WEBHOOK] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function validateWebhookSignature(rawPayload: string, signature: string, signatureKey: string): boolean {
  try {
    let providedSignature = signature;
    if (providedSignature.toLowerCase().startsWith("sha512=")) {
      providedSignature = providedSignature.substring(7);
    }

    const keyBuffer = Buffer.from(signatureKey, "hex");
    const computed = crypto
      .createHmac("sha512", keyBuffer)
      .update(rawPayload)
      .digest("hex")
      .toUpperCase();

    providedSignature = providedSignature.toUpperCase();

    if (computed.length !== providedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(providedSignature));
  } catch (err) {
    console.error("[WEBHOOK] Signature validation error:", err instanceof Error ? err.message : "Unknown");
    return false;
  }
}

async function handlePaymentSuccess(
  supabase: ReturnType<typeof createAdminClient>,
  payload: {
    id: string;
    invoiceNumber?: string;
    refId?: string;
    authAmount?: number;
    accountNumber?: string;
    accountType?: string;
  }
) {
  const { id: authnetTransactionId, invoiceNumber, refId, authAmount, accountNumber } = payload;

  const { data: alreadyProcessed } = await supabase
    .from("payment_transactions")
    .select("id, payment_status")
    .eq("authnet_transaction_id", authnetTransactionId)
    .single();

  if (alreadyProcessed) {
    console.log(`[WEBHOOK] Transaction ${authnetTransactionId} already processed — skipping`);
    return;
  }

  let paymentTransaction = null;

  if (invoiceNumber) {
    const result = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("authnet_ref_id", invoiceNumber)
      .single();
    paymentTransaction = result.data;
  }

  if (!paymentTransaction && refId) {
    const result = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("authnet_ref_id", refId)
      .single();
    paymentTransaction = result.data;
  }

  if (!paymentTransaction) {
    console.error(`[WEBHOOK] No matching payment transaction found for authnet ID ${authnetTransactionId}, invoiceNumber=${invoiceNumber}, refId=${refId}`);
    return;
  }

  if (paymentTransaction.payment_status === "completed") {
    console.log(`[WEBHOOK] Payment transaction ${paymentTransaction.id} already completed — skipping`);
    return;
  }

  if (authAmount !== undefined) {
    const expectedAmountDollars = paymentTransaction.total_amount_cents / 100;
    const amountDifference = Math.abs(authAmount - expectedAmountDollars);

    if (amountDifference > 1) {
      console.error(`[WEBHOOK] Amount mismatch for transaction ${paymentTransaction.id}: expected $${expectedAmountDollars}, got $${authAmount} — rejecting`);
      return;
    }
  }

  const cardLastFour = accountNumber?.slice(-4);
  const { error: updateError } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
      authnet_transaction_id: authnetTransactionId,
      card_last_four: cardLastFour,
      card_type: payload.accountType,
      paid_at: new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
      webhook_payload: payload,
    })
    .eq("id", paymentTransaction.id);

  if (updateError) {
    console.error(`[WEBHOOK] Failed to update payment transaction ${paymentTransaction.id}:`, updateError.message);
    return;
  }

  console.log(`[WEBHOOK] Payment transaction ${paymentTransaction.id} marked as completed`);

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
      console.error(`[WEBHOOK] Failed to update prescription ${paymentTransaction.prescription_id} payment status:`, rxUpdateError.message);
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
      ).catch((err) => console.error("[WEBHOOK] Notification error:", err));
    }

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "";
      const submitHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      };

      console.log(`[WEBHOOK] Auto-submitting prescription ${paymentTransaction.prescription_id} to pharmacy...`);
      const submitResponse = await fetch(
        `${siteUrl}/api/prescriptions/${paymentTransaction.prescription_id}/submit-to-pharmacy`,
        {
          method: "POST",
          headers: submitHeaders,
        }
      );

      if (submitResponse.ok) {
        await supabase
          .from("payment_transactions")
          .update({ order_progress: "pharmacy_processing" })
          .eq("id", paymentTransaction.id);
        console.log(`[WEBHOOK] Prescription ${paymentTransaction.prescription_id} submitted to pharmacy successfully`);
      } else {
        const errorBody = await submitResponse.text().catch(() => "unable to read response");
        console.error(`[WEBHOOK] Pharmacy submission failed for prescription ${paymentTransaction.prescription_id}: HTTP ${submitResponse.status} — ${errorBody}`);
      }
    } catch (err) {
      console.error(`[WEBHOOK] Pharmacy submission error for prescription ${paymentTransaction.prescription_id}:`, err instanceof Error ? err.message : "Unknown");
    }
  }

  if (paymentTransaction.patient_email) {
    try {
      const internalApiKey = process.env.INTERNAL_API_KEY || "";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      let pharmacyLogoUrl: string | undefined;
      let pharmacyColor: string | undefined;
      if (paymentTransaction.pharmacy_id) {
        const { data: pharmacy } = await supabase
          .from("pharmacies")
          .select("logo_url, primary_color")
          .eq("id", paymentTransaction.pharmacy_id)
          .single();
        pharmacyLogoUrl = pharmacy?.logo_url || undefined;
        pharmacyColor = pharmacy?.primary_color || undefined;
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
          transactionId: authnetTransactionId,
          pharmacyName: paymentTransaction.pharmacy_name,
          deliveryMethod: paymentTransaction.delivery_method,
          pharmacyLogoUrl,
          pharmacyColor,
        }),
      });

      if (!emailResponse.ok) {
        console.error(`[WEBHOOK] Confirmation email failed for ${paymentTransaction.patient_email}: HTTP ${emailResponse.status}`);
      }
    } catch (err) {
      console.error(`[WEBHOOK] Email sending error for ${paymentTransaction.patient_email}:`, err instanceof Error ? err.message : "Unknown");
    }
  }
}

async function handlePaymentCaptured(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { id: string }
) {
  const { error } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
    })
    .eq("authnet_transaction_id", payload.id);

  if (error) {
    console.error(`[WEBHOOK] Failed to handle capture for transaction ${payload.id}:`, error.message);
  }
}

async function handlePaymentVoided(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { id: string }
) {
  const { error } = await supabase
    .from("payment_transactions")
    .update({ payment_status: "cancelled" })
    .eq("authnet_transaction_id", payload.id);

  if (error) {
    console.error(`[WEBHOOK] Failed to handle void for transaction ${payload.id}:`, error.message);
  }
}

async function handlePaymentRefunded(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { id: string; refundAmount?: number }
) {
  const { error } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "refunded",
      refund_amount_cents: payload.refundAmount ? Math.round(payload.refundAmount * 100) : null,
      refunded_at: new Date().toISOString(),
    })
    .eq("authnet_transaction_id", payload.id);

  if (error) {
    console.error(`[WEBHOOK] Failed to handle refund for transaction ${payload.id}:`, error.message);
  }
}
