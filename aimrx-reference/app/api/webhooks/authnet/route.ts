import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const { eventType, payload } = body;

    const signatureKey = envConfig.AUTHNET_SIGNATURE_KEY;
    const signature = request.headers.get("x-anet-signature");

    if (!signatureKey) {
      console.error("[WEBHOOK] AUTHNET_SIGNATURE_KEY not configured — rejecting all webhook requests");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    if (!signature) {
      console.error(`[WEBHOOK] Missing x-anet-signature header for event ${eventType} — rejecting`);
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const isValid = validateWebhookSignature(rawBody, signature, signatureKey);
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

  let paymentTransaction = null;

  const { data: alreadyLinked } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("authnet_transaction_id", authnetTransactionId)
    .single();

  if (alreadyLinked) {
    paymentTransaction = alreadyLinked;
  }

  if (!paymentTransaction && invoiceNumber) {
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
    const retryRxIds: string[] = [];

    const allLinkedIds: string[] = [];
    if (paymentTransaction.prescription_id) {
      allLinkedIds.push(paymentTransaction.prescription_id);
    }
    const { data: linkedRetryRxs } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", paymentTransaction.id);
    if (linkedRetryRxs) {
      for (const rx of linkedRetryRxs) {
        if (!allLinkedIds.includes(rx.id)) allLinkedIds.push(rx.id);
      }
    }

    for (const rxId of allLinkedIds) {
      const { data: rxCheck } = await supabase
        .from("prescriptions")
        .select("queue_id")
        .eq("id", rxId)
        .single();
      if (!rxCheck?.queue_id) retryRxIds.push(rxId);
    }

    if (retryRxIds.length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "";

      for (const rxId of retryRxIds) {
        try {
          console.log(`[WEBHOOK] Retrying pharmacy submission for ${rxId}...`);
          const submitResponse = await fetch(
            `${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": internalSecret,
              },
            },
          );
          if (submitResponse.ok) {
            console.log(`[WEBHOOK] Retry pharmacy submission succeeded for ${rxId}`);
          } else {
            const errorBody = await submitResponse.text().catch(() => "unable to read");
            console.error(`[WEBHOOK] Retry pharmacy submission failed for ${rxId}: HTTP ${submitResponse.status} — ${errorBody}`);
          }
        } catch (err) {
          console.error(`[WEBHOOK] Retry pharmacy submission error for ${rxId}:`, err instanceof Error ? err.message : "Unknown");
        }
      }

      await supabase
        .from("payment_transactions")
        .update({ order_progress: "pharmacy_processing" })
        .eq("id", paymentTransaction.id);
    }

    console.log(`[WEBHOOK] Payment transaction ${paymentTransaction.id} already completed — done`);
    return;
  }

  // Amount check — compare integer cents to avoid float-tolerance ambiguity.
  // Authnet sends authAmount in dollars; we store cents. Math.round handles
  // the IEEE-754 round-trip cleanly for any sane currency value.
  if (authAmount !== undefined) {
    const actualCents = Math.round(authAmount * 100);
    const expectedCents = paymentTransaction.total_amount_cents;
    if (actualCents !== expectedCents) {
      console.error(`[WEBHOOK] Amount mismatch for transaction ${paymentTransaction.id}: expected ${expectedCents} cents, got ${actualCents} cents (authAmount=$${authAmount}) — rejecting`);
      return;
    }
  }

  // CAS guard on the finalize transition. Only flip to 'completed' if the row
  // is in a recoverable state. This closes three failure modes:
  //   1. Webhook + verify-and-complete race — only one wins the CAS, only one
  //      fires pharmacy + email side-effects.
  //   2. Authnet replay of a signed past 'authcapture' event after a refund
  //      or void — the CAS rejects it instead of resurrecting 'completed'.
  //   3. The row's status drifted between SELECT (line ~112) and UPDATE — we
  //      no longer trust the in-memory copy for the transition.
  // Allowlist matches JANITOR_RECOVERABLE_STATUSES used by the cron jobs so
  // the system has one consistent definition of "safe to mark completed".
  const cardLastFour = accountNumber?.slice(-4);
  const { data: casRows, error: updateError } = await supabase
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
    .eq("id", paymentTransaction.id)
    .in("payment_status", ["pending", "processing", "expired"])
    .select("id");

  if (updateError) {
    console.error(`[WEBHOOK] Failed to update payment transaction ${paymentTransaction.id}:`, updateError.message);
    return;
  }

  if (!casRows || casRows.length === 0) {
    console.log(`[WEBHOOK] CAS lost for ${paymentTransaction.id} — verify-and-complete may have raced us, or row is in a terminal state (refunded/voided/cancelled). Skipping pharmacy + email side-effects to prevent duplicates.`);
    return;
  }

  console.log(`[WEBHOOK] Payment transaction ${paymentTransaction.id} marked as completed (CAS won)`);

  const prescriptionIdsToProcess: string[] = [];

  if (paymentTransaction.prescription_id) {
    prescriptionIdsToProcess.push(paymentTransaction.prescription_id);
  }

  const { data: linkedRxs } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("payment_transaction_id", paymentTransaction.id);

  if (linkedRxs) {
    for (const rx of linkedRxs) {
      if (!prescriptionIdsToProcess.includes(rx.id)) {
        prescriptionIdsToProcess.push(rx.id);
      }
    }
  }

  // INTEGRITY FIX (Greenwich/Rahmany incident, May 2026): do NOT fan out by
  // order_group_id here. The webhook must mark paid ONLY the prescriptions
  // explicitly linked to this payment_transaction (via prescription_id or
  // payment_transaction_id linkage above). Fan-out by order_group_id caused
  // a $120 partial Pinealon-only payment to silently mark a $569.50 6-rx
  // group fully paid. Server-side guard in /api/payments/generate-link now
  // enforces full-group billing or rejects with 422.

  if (prescriptionIdsToProcess.length > 0) {
    for (const rxId of prescriptionIdsToProcess) {
      const { error: rxUpdateError } = await supabase
        .from("prescriptions")
        .update({
          payment_status: "paid",
          status: "payment_received",
          order_progress: "payment_received",
        })
        .eq("id", rxId);

      if (rxUpdateError) {
        console.error(`[WEBHOOK] Failed to update prescription ${rxId} payment status:`, rxUpdateError.message);
      }
    }

    const firstRxId = prescriptionIdsToProcess[0];
    const { data: rxData } = await supabase
      .from("prescriptions")
      .select("id, queue_id, prescriber_id, patients(first_name, last_name)")
      .eq("id", firstRxId)
      .single();

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
        firstRxId,
      ).catch((err) => console.error("[WEBHOOK] Notification error:", err));
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    const submittedRxIds: string[] = [];
    const failedRxIds: string[] = [];

    for (const rxId of prescriptionIdsToProcess) {
      try {
        console.log(`[WEBHOOK] Auto-submitting prescription ${rxId} to pharmacy...`);
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

        if (submitResponse.ok) {
          submittedRxIds.push(rxId);
          console.log(`[WEBHOOK] Prescription ${rxId} submitted to pharmacy successfully`);
        } else {
          failedRxIds.push(rxId);
          const errorBody = await submitResponse.text().catch(() => "unable to read response");
          console.error(`[WEBHOOK] Pharmacy submission failed for prescription ${rxId}: HTTP ${submitResponse.status} — ${errorBody}`);
        }
      } catch (err) {
        failedRxIds.push(rxId);
        console.error(`[WEBHOOK] Pharmacy submission error for prescription ${rxId}:`, err instanceof Error ? err.message : "Unknown");
      }
    }

    const totalRx = prescriptionIdsToProcess.length;
    if (submittedRxIds.length > 0) {
      const progressNote = failedRxIds.length > 0
        ? `Partial pharmacy submission: ${submittedRxIds.length}/${totalRx} succeeded. Failed: ${failedRxIds.join(", ")}`
        : undefined;

      await supabase
        .from("payment_transactions")
        .update({
          order_progress: failedRxIds.length > 0 ? "pharmacy_partial_failure" : "pharmacy_processing",
          ...(progressNote ? { notes: progressNote } : {}),
        })
        .eq("id", paymentTransaction.id);

      if (failedRxIds.length > 0) {
        console.error(`[WEBHOOK] PARTIAL FAILURE: ${failedRxIds.length}/${totalRx} prescriptions failed pharmacy submission for payment ${paymentTransaction.id}`);
      }
    } else if (totalRx > 0) {
      await supabase
        .from("payment_transactions")
        .update({
          order_progress: "pharmacy_submission_failed",
          notes: `All ${totalRx} pharmacy submissions failed`,
        })
        .eq("id", paymentTransaction.id);
      console.error(`[WEBHOOK] ALL FAILED: All ${totalRx} pharmacy submissions failed for payment ${paymentTransaction.id}`);
    }
  }

  if (paymentTransaction.patient_email && paymentTransaction.send_receipt_to_patient !== false) {
    try {
      const internalApiKey = process.env.INTERNAL_API_KEY || "webhook-auto-email";
      {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        let webhookMedications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
        let webhookOversightCents = 0;
        if (prescriptionIdsToProcess.length > 0) {
          const { data: medDetails } = await supabase
            .from("prescriptions")
            .select("medication, patient_price, shipping_fee_cents, profit_cents")
            .in("id", prescriptionIdsToProcess);
          if (medDetails && medDetails.length > 0) {
            webhookMedications = medDetails.map(m => ({
              name: m.medication || "Medication",
              price: m.patient_price ? parseFloat(m.patient_price).toFixed(2) : undefined,
              shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
            }));
            webhookOversightCents = medDetails.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
          }
        }

        const emailResponse = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            patientEmail: paymentTransaction.patient_email,
            patientPhone: paymentTransaction.patient_phone || undefined,
            patientName: paymentTransaction.patient_name,
            providerName: paymentTransaction.provider_name,
            medication: paymentTransaction.description,
            ...(webhookMedications.length > 0 ? { medications: webhookMedications } : {}),
            ...(webhookOversightCents > 0 ? { oversightFee: (webhookOversightCents / 100).toFixed(2) } : {}),
            totalAmount: (paymentTransaction.total_amount_cents / 100).toFixed(2),
            transactionId: authnetTransactionId,
            pharmacyName: paymentTransaction.pharmacy_name,
          }),
        });

        if (!emailResponse.ok) {
          console.error(`[WEBHOOK] Confirmation email failed for ${paymentTransaction.patient_email}: HTTP ${emailResponse.status}`);
        }
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
  // CAS guard — only transition recoverable states to 'completed'. Without
  // this guard, Authnet's webhook retry behavior would let a replayed capture
  // event flip a row that's already been refunded or cancelled back to
  // 'completed' and re-fire pharmacy submission + confirmation email.
  // Using maybeSingle() because zero matched rows is a normal idempotency
  // outcome here, not an error.
  const { data: tx, error } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
    })
    .eq("authnet_transaction_id", payload.id)
    .in("payment_status", ["pending", "processing", "expired"])
    .select("id, prescription_id")
    .maybeSingle();

  if (error) {
    console.error(`[WEBHOOK] Failed to handle capture for transaction ${payload.id}:`, error.message);
    return;
  }

  if (!tx) {
    console.log(`[WEBHOOK-CAPTURE] No recoverable row for ${payload.id} — already 'completed' or in terminal state (refunded/voided/cancelled). Skipping side-effects.`);
    return;
  }

  const rxIds: string[] = [];
  if (tx.prescription_id) {
    rxIds.push(tx.prescription_id);
  }

  const { data: linkedCapRxs } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("payment_transaction_id", tx.id);

  if (linkedCapRxs) {
    for (const rx of linkedCapRxs) {
      if (!rxIds.includes(rx.id)) rxIds.push(rx.id);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // GREENWICH/RAHMANY INCIDENT REMEDIATION (May 2026)
  // ────────────────────────────────────────────────────────────────────
  // Previously handlePaymentCaptured fanned out by order_group_id with
  // NO payment_transaction_id filter, marking unpaid sibling rxs as
  // 'paid' even when the captured tx never billed for them. This was
  // the root cause of David Shans / Rahmany shipping unpaid rxs.
  // We now mark paid ONLY the rxs whose payment_transaction_id is
  // actually equal to the captured tx (already gathered above into rxIds
  // via tx.prescription_id + the linked-rx query L475-484).
  if (tx.prescription_id) {
    // Read-only check kept for audit/logging — never used to mutate state.
    const { data: primaryRx } = await supabase
      .from("prescriptions")
      .select("order_group_id")
      .eq("id", tx.prescription_id)
      .single();
    void primaryRx;
  }

  const now = new Date().toISOString();
  for (const rxId of rxIds) {
    await supabase
      .from("prescriptions")
      .update({ payment_status: "paid", status: "payment_received", order_progress: "payment_received", payment_transaction_id: tx.id, updated_at: now })
      .eq("id", rxId);
  }

  if (rxIds.length > 0) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internalApiKey = process.env.INTERNAL_API_KEY || "webhook-capture-auto";
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    let pharmacySuccessCount = 0;
    let pharmacyFailCount = 0;

    for (const rxId of rxIds) {
      try {
        const pharmaRes = await fetch(`${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
        });
        if (pharmaRes.ok) {
          pharmacySuccessCount++;
        } else {
          pharmacyFailCount++;
          console.error(`[WEBHOOK-CAPTURE] Pharmacy submission failed for ${rxId}: HTTP ${pharmaRes.status}`);
        }
      } catch (err) {
        pharmacyFailCount++;
        console.error(`[WEBHOOK-CAPTURE] Pharmacy submission error for ${rxId}:`, err instanceof Error ? err.message : "Unknown");
      }
    }

    const progressNote = pharmacyFailCount > 0
      ? `Capture webhook: ${pharmacySuccessCount}/${rxIds.length} submitted to pharmacy`
      : `Capture webhook: all ${rxIds.length} submitted to pharmacy`;

    await supabase
      .from("payment_transactions")
      .update({
        order_progress: pharmacyFailCount === rxIds.length
          ? "pharmacy_submission_failed"
          : pharmacyFailCount > 0
            ? "pharmacy_partial_failure"
            : "pharmacy_processing",
        notes: progressNote,
      })
      .eq("id", tx.id);

    console.log(`[WEBHOOK-CAPTURE] Pharmacy submissions: ${pharmacySuccessCount} success, ${pharmacyFailCount} failed for tx ${tx.id}`);
  }

  const { data: captureTxFull } = await supabase
    .from("payment_transactions")
    .select("patient_email, patient_phone, patient_name, provider_name, description, total_amount_cents, pharmacy_name, send_receipt_to_patient")
    .eq("id", tx.id)
    .single();

  if (captureTxFull?.patient_email && captureTxFull.send_receipt_to_patient !== false) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalApiKey = process.env.INTERNAL_API_KEY || "webhook-capture-email";

      let captureMedications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
      let captureOversightCents = 0;
      if (rxIds.length > 0) {
        const { data: medDetails } = await supabase
          .from("prescriptions")
          .select("medication, patient_price, shipping_fee_cents, profit_cents")
          .in("id", rxIds);
        if (medDetails && medDetails.length > 0) {
          captureMedications = medDetails.map(m => ({
            name: m.medication || "Medication",
            price: m.patient_price ? parseFloat(m.patient_price).toFixed(2) : undefined,
            shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
          }));
          captureOversightCents = medDetails.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
        }
      }

      const emailResponse = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        body: JSON.stringify({
          patientEmail: captureTxFull.patient_email,
          patientPhone: captureTxFull.patient_phone || undefined,
          patientName: captureTxFull.patient_name,
          providerName: captureTxFull.provider_name,
          medication: captureTxFull.description,
          ...(captureMedications.length > 0 ? { medications: captureMedications } : {}),
          ...(captureOversightCents > 0 ? { oversightFee: (captureOversightCents / 100).toFixed(2) } : {}),
          totalAmount: (captureTxFull.total_amount_cents / 100).toFixed(2),
          transactionId: payload.id,
          pharmacyName: captureTxFull.pharmacy_name,
        }),
      });

      if (!emailResponse.ok) {
        console.error(`[WEBHOOK-CAPTURE] Confirmation email failed for ${captureTxFull.patient_email}: HTTP ${emailResponse.status}`);
      } else {
        console.log(`[WEBHOOK-CAPTURE] Confirmation email sent to ${captureTxFull.patient_email}`);
      }
    } catch (err) {
      console.error(`[WEBHOOK-CAPTURE] Email error:`, err instanceof Error ? err.message : "Unknown");
    }
  }
}

async function handlePaymentVoided(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { id: string }
) {
  // CAS guard — voids are valid against pending/processing/expired/completed
  // (Authnet voids an authorized-or-captured transaction before settlement).
  // Voids must NOT overwrite refunded / partially_refunded states (which
  // would lose the refund record) and must NOT spuriously re-process a row
  // already marked cancelled/voided. This protects against retry storms
  // where the webhook delivery order does not match the merchant action
  // order.
  const { data: tx, error } = await supabase
    .from("payment_transactions")
    .update({ payment_status: "cancelled" })
    .eq("authnet_transaction_id", payload.id)
    .in("payment_status", ["pending", "processing", "expired", "completed"])
    .select("id, prescription_id")
    .maybeSingle();

  if (error) {
    console.error(`[WEBHOOK] Failed to handle void for transaction ${payload.id}:`, error.message);
    return;
  }

  if (!tx) {
    console.log(`[WEBHOOK-VOID] No voidable row for ${payload.id} — already terminal (refunded / partially_refunded / cancelled) or not found. Skipping.`);
    return;
  }

  const rxIds: string[] = [];
  if (tx.prescription_id) {
    rxIds.push(tx.prescription_id);
  }

  const { data: linkedVoidRxs } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("payment_transaction_id", tx.id);

  if (linkedVoidRxs) {
    for (const rx of linkedVoidRxs) {
      if (!rxIds.includes(rx.id)) rxIds.push(rx.id);
    }
  }

  if (tx.prescription_id) {
    const { data: primaryRx } = await supabase
      .from("prescriptions")
      .select("order_group_id")
      .eq("id", tx.prescription_id)
      .single();

    if (primaryRx?.order_group_id) {
      const { data: groupRxs } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("order_group_id", primaryRx.order_group_id)
        .eq("payment_transaction_id", tx.id);

      if (groupRxs) {
        for (const rx of groupRxs) {
          if (!rxIds.includes(rx.id)) rxIds.push(rx.id);
        }
      }
    }
  }

  const now = new Date().toISOString();
  for (const rxId of rxIds) {
    await supabase
      .from("prescriptions")
      .update({ payment_status: "pending", payment_transaction_id: null, updated_at: now })
      .eq("id", rxId);
  }
}

async function handlePaymentRefunded(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { id: string; refundAmount?: number }
) {
  const { data: existing } = await supabase
    .from("payment_transactions")
    .select("id, total_amount_cents, refund_amount_cents, payment_status, refunded_at")
    .eq("authnet_transaction_id", payload.id)
    .single();

  if (!existing) {
    console.error(`[WEBHOOK] No payment transaction found for authnet ID ${payload.id} — cannot process refund`);
    return;
  }

  const refundCents = payload.refundAmount ? Math.round(payload.refundAmount * 100) : null;
  const currentRefunded = existing.refund_amount_cents || 0;

  if (refundCents && currentRefunded >= refundCents) {
    console.log(`[WEBHOOK] Refund already recorded for ${payload.id}: DB has ${currentRefunded} cents, webhook reports ${refundCents} cents — skipping to avoid double-count`);

    const isFullRefund = currentRefunded >= existing.total_amount_cents;
    const expectedStatus = isFullRefund ? "refunded" : "partially_refunded";
    if (existing.payment_status !== expectedStatus) {
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: expectedStatus,
          refunded_at: existing.refunded_at || new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return;
  }

  const totalRefunded = refundCents ? Math.max(currentRefunded, refundCents) : currentRefunded;
  const isFullRefund = totalRefunded >= existing.total_amount_cents;

  // refunded_at is first-write-wins — preserve the original refund timestamp
  // across partial → full transitions instead of overwriting it on each event.
  const casQuery = supabase
    .from("payment_transactions")
    .update({
      payment_status: isFullRefund ? "refunded" : "partially_refunded",
      refund_amount_cents: totalRefunded,
      refunded_at: existing.refunded_at || new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (currentRefunded === 0) {
    casQuery.or("refund_amount_cents.eq.0,refund_amount_cents.is.null");
  } else {
    casQuery.eq("refund_amount_cents", currentRefunded);
  }

  const { data: casResult } = await casQuery.select("id");

  if (!casResult || casResult.length === 0) {
    console.warn(`[WEBHOOK] Refund CAS failed for ${payload.id} — concurrent update detected, skipping`);
    return;
  }

  console.log(`[WEBHOOK] Refund recorded for ${payload.id}: ${totalRefunded} cents (${isFullRefund ? "full" : "partial"})`);

  if (isFullRefund) {
    const rxIds: string[] = [];
    const { data: txFull } = await supabase
      .from("payment_transactions")
      .select("prescription_id")
      .eq("id", existing.id)
      .single();

    if (txFull?.prescription_id) {
      rxIds.push(txFull.prescription_id);
    }

    const { data: linkedRefundRxs } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", existing.id);

    if (linkedRefundRxs) {
      for (const rx of linkedRefundRxs) {
        if (!rxIds.includes(rx.id)) rxIds.push(rx.id);
      }
    }

    if (txFull?.prescription_id) {
      const { data: primaryRx } = await supabase
        .from("prescriptions")
        .select("order_group_id")
        .eq("id", txFull.prescription_id)
        .single();

      if (primaryRx?.order_group_id) {
        const { data: groupRxs } = await supabase
          .from("prescriptions")
          .select("id")
          .eq("order_group_id", primaryRx.order_group_id)
          .eq("payment_transaction_id", existing.id);

        if (groupRxs) {
          for (const rx of groupRxs) {
            if (!rxIds.includes(rx.id)) rxIds.push(rx.id);
          }
        }
      }
    }

    const now = new Date().toISOString();
    for (const rxId of rxIds) {
      await supabase
        .from("prescriptions")
        .update({ payment_status: "refunded", updated_at: now })
        .eq("id", rxId);
    }
  }
}
