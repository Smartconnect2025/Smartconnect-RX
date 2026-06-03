import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import {
  getRedsailConfigsForPharmacy,
  type DecryptedRedsailConfig,
} from "@/core/services/redsailPaymentConfigService";
import { getRedsailClient } from "@/core/services/redsail/client";
import type { RedsailWebhookEvent } from "@/core/services/redsail/types";

/**
 * Inbound RedSail (Emporos) webhook receiver.
 *
 * Inert unless REDSAIL_ENABLED is on. When active it:
 *  1. Verifies the bearer token against a connected pharmacy's connector and
 *     keeps track of WHICH config validated it.
 *  2. Enforces tenant isolation: a validated bearer may only act on a
 *     transaction belonging to that same config's pharmacy.
 *  3. Enforces idempotency via the redsail_webhook_events ledger (unique
 *     event_id), while still allowing a previously-failed event to be retried.
 *  4. On a successful-payment event, marks the matching transaction completed,
 *     flips the prescriptions to paid, and auto-submits them to the pharmacy —
 *     mirroring the Stripe webhook's post-payment flow.
 */
export async function POST(request: NextRequest) {
  if (!envConfig.REDSAIL_ENABLED) {
    return NextResponse.json(
      { error: "RedSail Pay is not enabled" },
      { status: 503 },
    );
  }

  try {
    const rawBody = await request.text();
    const authHeader = request.headers.get("authorization");
    const supabase = createAdminClient();

    const verification = await verifyAgainstConnectedConfigs(
      supabase,
      authHeader,
      rawBody,
    );

    if (!verification) {
      console.error("[REDSAIL-WEBHOOK] No connected configuration to verify against");
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    if (!verification.valid || !verification.event || !verification.config) {
      console.error(`[REDSAIL-WEBHOOK] Rejected: ${verification.reason}`);
      return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
    }

    const { event, config } = verification;

    // Idempotency: claim the event_id. A duplicate means we've seen it before —
    // but a previously FAILED attempt is allowed to retry so a transient error
    // does not permanently drop a real payment.
    const { error: ledgerError } = await supabase
      .from("redsail_webhook_events")
      .insert({
        event_id: event.eventId,
        event_type: event.eventType,
        payload: event.payload as Record<string, unknown>,
        status: "received",
      });

    if (ledgerError) {
      const isDuplicate =
        ledgerError.code === "23505" ||
        /duplicate|already exists|unique/i.test(ledgerError.message);

      if (!isDuplicate) {
        console.error("[REDSAIL-WEBHOOK] Ledger insert failed:", ledgerError.message);
        return NextResponse.json({ error: "Ledger error" }, { status: 500 });
      }

      const { data: existing } = await supabase
        .from("redsail_webhook_events")
        .select("status")
        .eq("event_id", event.eventId)
        .single();

      // Already handled to a terminal state → safe to ack and stop.
      if (existing?.status === "processed" || existing?.status === "ignored") {
        console.log(`[REDSAIL-WEBHOOK] Duplicate event ${event.eventId} (${existing.status}) — skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Otherwise (received/error) fall through and re-attempt processing.
    }

    let status: "processed" | "ignored" = "ignored";
    let processError: string | null = null;
    let httpStatus = 200;

    try {
      if (isPaymentSuccessEvent(event.eventType)) {
        const completed = await completeTransactionForEvent(
          supabase,
          event,
          config,
        );
        status = completed ? "processed" : "ignored";
      }
    } catch (err) {
      processError = err instanceof Error ? err.message : "Unknown";
      httpStatus = 500; // signal RedSail to retry a transient failure
      console.error("[REDSAIL-WEBHOOK] Processing error:", processError);
    }

    await supabase
      .from("redsail_webhook_events")
      .update({
        status: processError ? "error" : status,
        error: processError,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", event.eventId);

    if (httpStatus !== 200) {
      return NextResponse.json({ error: "Processing failed" }, { status: httpStatus });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "[REDSAIL-WEBHOOK] Error:",
      error instanceof Error ? error.message : "Unknown",
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

function isPaymentSuccessEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return (
    t.includes("payment.success") ||
    t.includes("payment.completed") ||
    t.includes("fully_paid") ||
    t.includes("link_to_pay.completed")
  );
}

interface VerifyResult {
  valid: boolean;
  reason?: string;
  event?: RedsailWebhookEvent;
  config?: DecryptedRedsailConfig;
}

async function verifyAgainstConnectedConfigs(
  supabase: ReturnType<typeof createAdminClient>,
  authHeader: string | null,
  rawBody: string,
): Promise<VerifyResult | null> {
  // Collect active + connected configs across pharmacies. The webhook bearer is
  // per-config, so we try each until one validates and remember which one did.
  const { data: rows } = await supabase
    .from("redsail_payment_configs")
    .select("pharmacy_id")
    .eq("is_active", true)
    .eq("is_connected", true);

  if (!rows || rows.length === 0) return null;

  const pharmacyIds = Array.from(
    new Set(rows.map((r: { pharmacy_id: string }) => r.pharmacy_id)),
  );

  const configs: DecryptedRedsailConfig[] = [];
  for (const pid of pharmacyIds) {
    const list = await getRedsailConfigsForPharmacy(pid);
    configs.push(...list.filter((c) => c.isActive && c.isConnected));
  }

  for (const config of configs) {
    const client = getRedsailClient(config);
    const result = await client.verifyAndParseWebhook(authHeader, rawBody);
    if (result.valid) {
      return { valid: true, event: result.event, config };
    }
  }

  return { valid: false, reason: "No configuration accepted the bearer token" };
}

/**
 * Returns true when a transaction was completed by this call, false when the
 * event is not applicable (no matching transaction, already completed, or a
 * tenant mismatch). Throws only on unexpected/transient errors so the caller
 * can signal a retry.
 */
async function completeTransactionForEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: RedsailWebhookEvent,
  config: DecryptedRedsailConfig,
): Promise<boolean> {
  let txn = null;

  if (event.redsailTransactionId) {
    const { data } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("redsail_transaction_id", event.redsailTransactionId)
      .single();
    txn = data;
  }

  if (!txn && event.linkCode) {
    const { data } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("redsail_link_code", event.linkCode)
      .single();
    txn = data;
  }

  if (!txn) {
    console.error("[REDSAIL-WEBHOOK] No matching transaction for event", event.eventId);
    return false;
  }

  // Tenant isolation: the validated bearer belongs to `config.pharmacyId`; it may
  // only act on that pharmacy's transactions. Refuse cross-pharmacy correlation.
  if (txn.pharmacy_id !== config.pharmacyId) {
    console.error(
      `[REDSAIL-WEBHOOK] Tenant mismatch: event validated for pharmacy ${config.pharmacyId} ` +
        `but transaction ${txn.id} belongs to ${txn.pharmacy_id} — refusing`,
    );
    return false;
  }

  if (txn.payment_status === "completed") {
    console.log(`[REDSAIL-WEBHOOK] Transaction ${txn.id} already completed — skipping`);
    return false;
  }

  // Atomic guard: only the request that flips pending→completed proceeds.
  const { data: updated, error: updateError } = await supabase
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
      redsail_last_event_id: event.eventId,
      paid_at: new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
      webhook_payload: event.payload as Record<string, unknown>,
    })
    .eq("id", txn.id)
    .eq("payment_status", "pending")
    .select("id");

  if (updateError) {
    // Unexpected DB failure — let the caller retry.
    throw new Error(`Failed to complete transaction ${txn.id}: ${updateError.message}`);
  }

  if (!updated || updated.length === 0) {
    console.log(`[REDSAIL-WEBHOOK] Transaction ${txn.id} already processed — skipping`);
    return false;
  }

  const { data: linkedRxList } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("payment_transaction_id", txn.id);

  const rxIds = linkedRxList?.map((rx: { id: string }) => rx.id) || [];
  if (rxIds.length === 0 && txn.prescription_id) rxIds.push(txn.prescription_id);

  if (rxIds.length === 0) return true;

  await supabase
    .from("prescriptions")
    .update({
      payment_status: "paid",
      order_progress: "payment_received",
      status: "payment_received",
    })
    .in("id", rxIds);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const internalSecret = process.env.INTERNAL_API_SECRET || "";
  let anySubmitted = false;

  for (const rxId of rxIds) {
    try {
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
      if (submitResponse.ok) anySubmitted = true;
      else {
        const body = await submitResponse.text().catch(() => "");
        console.error(
          `[REDSAIL-WEBHOOK] Pharmacy submission failed for ${rxId}: HTTP ${submitResponse.status} — ${body}`,
        );
      }
    } catch (err) {
      console.error(
        `[REDSAIL-WEBHOOK] Pharmacy submission error for ${rxId}:`,
        err instanceof Error ? err.message : "Unknown",
      );
    }
  }

  if (anySubmitted) {
    await supabase
      .from("payment_transactions")
      .update({ order_progress: "pharmacy_processing" })
      .eq("id", txn.id);
  }

  return true;
}
