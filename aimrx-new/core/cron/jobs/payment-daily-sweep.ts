import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { envConfig } from "@/core/config/envConfig";
import {
  AUTHNET_API_URLS,
  AuthnetTransaction,
  extractTransactions,
  extractBatchList,
  getResultCode,
} from "./payment-reconcile";

// Inlined from payment-janitor (deferred — submission-engine coupled). This
// is the strict allow-list of recoverable payment_status values the daily
// sweep re-drives. Keep in sync if the janitor is later merged.
const JANITOR_RECOVERABLE_STATUSES = ["pending", "processing", "expired"] as const;

/**
 * payment-daily-sweep
 *
 * Pure idempotent safety net. Runs once per day at 3 AM America/New_York
 * (off-peak) to catch anything the 15-minute janitor + the synchronous
 * verify path may have missed over the prior week.
 *
 * Strategy:
 *   1. Pull Authnet's full unsettled transaction list (everything not yet
 *      batched out).
 *   2. Walk the last SWEEP_LOOKBACK_DAYS of settled batches; for each
 *      batch, pull its transaction list.
 *   3. For every Authnet transaction whose invoiceNumber matches a row
 *      in payment_transactions.authnet_ref_id, decide:
 *        - row in COHORT_RECOVERABLE_STATUSES ('pending','processing',
 *          'expired') → drive /api/payments/verify-and-complete (the
 *          canonical handler — idempotent, will resurrect 'expired' rows
 *          that have a real Authnet match).
 *        - row already 'completed' → counted as already_complete, no
 *          action (verify-and-complete is a no-op anyway, but skipping
 *          the HTTP call cuts cost and log noise).
 *        - row in any terminal non-completed state ('refunded',
 *          'partially_refunded', 'voided', 'reversed', 'declined',
 *          'failed', 'cancelled') → counted as terminal_skipped, no
 *          action. We MUST NOT re-drive verify on those because that
 *          can flip them back to 'completed' and retrigger pharmacy /
 *          notification side-effects.
 *        - no row in payment_transactions → counted as orphan_no_row;
 *          surfaced in system_logs but otherwise left alone (a real
 *          orphan would mean a charge happened with no app context —
 *          investigate manually via the runbook).
 *
 * Bounding:
 *   * SWEEP_LOOKBACK_DAYS=7 — anything older is reconcile/janitor turf.
 *   * SWEEP_MAX_BATCHES=50 — hard cap on settled-batch traversal so a
 *     high-volume merchant cannot blow up the daily run.
 *   * Bulk DB lookup (single .in('authnet_ref_id', […])) per chunk so
 *     we don't N+1 against Supabase.
 *   * verify-and-complete calls are sequential to keep gateway load
 *     predictable; a daily run with hundreds of matches still finishes
 *     in well under our 5-minute Render request budget.
 *
 * Env gate:
 *   * PAYMENT_DAILY_SWEEP_ENABLED — same precedence rules as the janitor:
 *     explicit 'false'/'0'/'no'/'off' disables; explicit 'true'/'1'/'yes'/'on'
 *     enables; unset defaults ON in production (NODE_ENV==='production' ||
 *     RENDER) with a loud console.warn, OFF elsewhere.
 */

const SWEEP_LOOKBACK_DAYS = 7;
const SWEEP_MAX_BATCHES = 50;
const DB_LOOKUP_CHUNK = 100;

// Recoverable-status allowlist is imported from payment-janitor as the
// single source of truth — see JANITOR_RECOVERABLE_STATUSES. Daily sweep
// and 15-min janitor MUST agree on which states are safe to re-drive.

export type DailySweepSummary = {
  startedAt: string;
  finishedAt: string;
  unsettledCount: number;
  settledBatchesScanned: number;
  settledBatchesAvailable: number;
  authnetTxnsSeen: number;
  matched: number;
  verifiedCompleted: number;
  verifiedAlreadyCompleted: number;
  verifiedFailed: number;
  alreadyComplete: number;
  terminalSkipped: number;
  orphanNoRow: number;
  // Phase 3d hotfix: explicit duplicate-capture detection. When the
  // same invoiceNumber (== payment_transactions.authnet_ref_id) appears
  // on more than one Authnet transaction within the lookback window,
  // that is a duplicate-charge for the same row — exactly the Apr 25
  // multi-capture pattern. Pre-3d this was silently collapsed by a
  // first-write-wins Map, so the multi-capture signal never reached
  // operators or the system_logs runbook.
  duplicateCapturesDetected: number;
  duplicateCaptures: Array<{
    invoiceNumber: string;
    count: number;
    transIds: string[];
  }>;
};

export function isDailySweepEnabled(): boolean {
  // Same case- and whitespace-insensitive precedence as the janitor.
  // See payment-janitor.ts for the rationale (Apr 24 misconfig).
  const v = (process.env.PAYMENT_DAILY_SWEEP_ENABLED || "").trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;

  // Mirror core/cron/index.ts production predicate so the gate and the
  // scheduler can never disagree on what "production" means.
  const isProd =
    process.env.NODE_ENV === "production" || !!process.env.RENDER;
  if (isProd) {
    console.warn(
      "[payment-daily-sweep] PAYMENT_DAILY_SWEEP_ENABLED is unset; " +
        "DEFAULTING TO ON in production. Set PAYMENT_DAILY_SWEEP_ENABLED='false' " +
        "explicitly to disable.",
    );
    return true;
  }
  return false;
}

async function driveVerify(
  siteUrl: string,
  paymentToken: string,
): Promise<{ ok: boolean; alreadyCompleted: boolean; result: string }> {
  try {
    const res = await fetch(`${siteUrl}/api/payments/verify-and-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentToken }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && body.success) {
      return {
        ok: true,
        alreadyCompleted: body.alreadyCompleted === true,
        result: body.alreadyCompleted ? "already_completed" : "completed",
      };
    }
    if (typeof body.code === "string") {
      return { ok: false, alreadyCompleted: false, result: `verify_${body.code.toLowerCase()}` };
    }
    if (body.pending) {
      return { ok: false, alreadyCompleted: false, result: "still_pending" };
    }
    return { ok: false, alreadyCompleted: false, result: `verify_http_${res.status}` };
  } catch (err) {
    return {
      ok: false,
      alreadyCompleted: false,
      result: `verify_error_${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

/**
 * Fetch all Authnet transactions over the lookback window. Returns a
 * Map keyed by invoiceNumber (== payment_transactions.authnet_ref_id).
 *
 * Returns an empty map if Authnet credentials are missing or any fetch
 * fails — daily sweep treats that as "nothing to reconcile this run"
 * rather than crashing the cron tick.
 */
async function fetchRecentAuthnetTxns(
  diagnostics: string[],
): Promise<{
  byInvoice: Map<string, AuthnetTransaction>;
  // Phase 3d hotfix: parallel ALL-captures map. Pre-3d the function only
  // kept first-write-wins per invoiceNumber, which silently collapsed
  // duplicate captures into one entry. The duplicate signal is exactly
  // what tonight's incident needs surfaced. We keep `byInvoice` for the
  // verify-driving loop (which only needs one match per row) and use
  // `allByInvoice` only for duplicate detection / metrics.
  allByInvoice: Map<string, AuthnetTransaction[]>;
  unsettledCount: number;
  settledBatchesScanned: number;
  settledBatchesAvailable: number;
  totalSeen: number;
}> {
  const byInvoice = new Map<string, AuthnetTransaction>();
  const allByInvoice = new Map<string, AuthnetTransaction[]>();
  let unsettledCount = 0;
  let settledBatchesScanned = 0;
  let settledBatchesAvailable = 0;
  let totalSeen = 0;

  const recordTxn = (txn: AuthnetTransaction) => {
    if (!txn.invoiceNumber) return;
    if (!byInvoice.has(txn.invoiceNumber)) {
      byInvoice.set(txn.invoiceNumber, txn);
    }
    const list = allByInvoice.get(txn.invoiceNumber);
    if (list) list.push(txn);
    else allByInvoice.set(txn.invoiceNumber, [txn]);
  };

  const loginId = envConfig.AUTHNET_API_LOGIN_ID;
  const transactionKey = envConfig.AUTHNET_TRANSACTION_KEY;
  if (!loginId || !transactionKey) {
    diagnostics.push("Authorize.net credentials not configured — skipping sweep");
    return { byInvoice, allByInvoice, unsettledCount, settledBatchesScanned, settledBatchesAvailable, totalSeen };
  }

  const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];
  const merchantAuthentication = { name: loginId, transactionKey };

  // 1. Unsettled list.
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        getUnsettledTransactionListRequest: { merchantAuthentication },
      }),
    });
    const data = await res.json();
    const txns = extractTransactions(data);
    unsettledCount = txns.length;
    totalSeen += txns.length;
    for (const txn of txns) recordTxn(txn);
    diagnostics.push(`Unsettled: ${txns.length} txns (resultCode=${getResultCode(data)})`);
  } catch (err) {
    diagnostics.push(
      `Unsettled fetch error: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  // 2. Settled batches over the lookback window.
  try {
    const now = new Date();
    const firstSettlementDate = new Date(now);
    firstSettlementDate.setDate(now.getDate() - SWEEP_LOOKBACK_DAYS);

    const batchRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        getSettledBatchListRequest: {
          merchantAuthentication,
          firstSettlementDate: firstSettlementDate.toISOString(),
          lastSettlementDate: now.toISOString(),
        },
      }),
    });
    const batchData = await batchRes.json();
    if (getResultCode(batchData) !== "Ok") {
      diagnostics.push("Settled batch list resultCode != Ok — skipping settled traversal");
      return { byInvoice, allByInvoice, unsettledCount, settledBatchesScanned, settledBatchesAvailable, totalSeen };
    }

    const batches = extractBatchList(batchData);
    settledBatchesAvailable = batches.length;
    diagnostics.push(`Settled batches available in last ${SWEEP_LOOKBACK_DAYS}d: ${batches.length}`);

    for (const batch of batches) {
      if (settledBatchesScanned >= SWEEP_MAX_BATCHES) {
        diagnostics.push(
          `WARN: hit SWEEP_MAX_BATCHES=${SWEEP_MAX_BATCHES}; remaining ${batches.length - settledBatchesScanned} batches skipped`,
        );
        break;
      }
      try {
        const listRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            getTransactionListRequest: {
              merchantAuthentication,
              batchId: batch.batchId,
            },
          }),
        });
        const listData = await listRes.json();
        if (getResultCode(listData) !== "Ok") continue;
        const batchTxns = extractTransactions(listData);
        totalSeen += batchTxns.length;
        for (const txn of batchTxns) recordTxn(txn);
      } catch (err) {
        diagnostics.push(
          `Batch ${batch.batchId} fetch error: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
      settledBatchesScanned++;
    }
  } catch (err) {
    diagnostics.push(
      `Settled batch list error: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  return { byInvoice, allByInvoice, unsettledCount, settledBatchesScanned, settledBatchesAvailable, totalSeen };
}

/** Run the daily sweep. Throws on fatal error; otherwise returns summary. */
export async function runPaymentDailySweep(): Promise<DailySweepSummary> {
  const supabase = createCronClient();
  const startedAt = new Date().toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const diagnostics: string[] = [];

  const fetched = await fetchRecentAuthnetTxns(diagnostics);
  const refIds = [...fetched.byInvoice.keys()];

  let matched = 0;
  let verifiedCompleted = 0;
  let verifiedAlreadyCompleted = 0;
  let verifiedFailed = 0;
  let alreadyComplete = 0;
  let terminalSkipped = 0;

  // Bulk-load matching payment_transactions in chunks so we don't blow
  // up the IN clause for high-volume days.
  for (let i = 0; i < refIds.length; i += DB_LOOKUP_CHUNK) {
    const chunk = refIds.slice(i, i + DB_LOOKUP_CHUNK);
    const { data: rows, error } = await supabase
      .from("payment_transactions")
      .select("id, payment_token, payment_status, authnet_ref_id, authnet_transaction_id")
      .in("authnet_ref_id", chunk);

    if (error) {
      diagnostics.push(`DB chunk lookup error: ${error.message}`);
      continue;
    }

    for (const row of rows || []) {
      if (!row.authnet_ref_id) continue;
      matched++;
      const status = (row.payment_status || "").toLowerCase();

      if (status === "completed") {
        // Webhook or earlier verify already finished the row. No-op.
        alreadyComplete++;
        continue;
      }

      if (!JANITOR_RECOVERABLE_STATUSES.includes(status as (typeof JANITOR_RECOVERABLE_STATUSES)[number])) {
        // refunded, voided, cancelled, declined, failed, partially_refunded,
        // reversed — terminal and intentionally NOT recoverable.
        terminalSkipped++;
        diagnostics.push(`  terminal_skipped: ${row.id} status=${status}`);
        continue;
      }

      if (!row.payment_token) {
        diagnostics.push(`  matched_but_no_token: ${row.id} status=${status}`);
        verifiedFailed++;
        continue;
      }

      const result = await driveVerify(siteUrl, row.payment_token);
      if (result.ok) {
        if (result.alreadyCompleted) verifiedAlreadyCompleted++;
        else verifiedCompleted++;
      } else {
        verifiedFailed++;
        diagnostics.push(`  verify_failed: ${row.id} → ${result.result}`);
      }
    }
  }

  const orphanNoRow = fetched.byInvoice.size - matched;
  if (orphanNoRow > 0) {
    diagnostics.push(
      `Orphans: ${orphanNoRow} Authnet txn(s) with no payment_transactions row — investigate via runbook`,
    );
  }

  // Phase 3d hotfix: explicit duplicate-capture detection.
  // For every invoiceNumber (== payment_transactions.authnet_ref_id)
  // that appears on more than one Authnet transaction within the
  // lookback window, surface it loudly. This is the multi-capture
  // signal — the exact pattern that produced 6 captures of $29 against
  // one row in the Apr 25 incident.
  const duplicateCaptures: DailySweepSummary["duplicateCaptures"] = [];
  for (const [invoiceNumber, txns] of fetched.allByInvoice) {
    if (txns.length > 1) {
      duplicateCaptures.push({
        invoiceNumber,
        count: txns.length,
        transIds: txns.map((t) => t.transId).filter(Boolean),
      });
    }
  }
  if (duplicateCaptures.length > 0) {
    diagnostics.push(
      `DUPLICATE CAPTURES DETECTED: ${duplicateCaptures.length} invoice(s) ` +
        `had multiple Authnet captures in last ${SWEEP_LOOKBACK_DAYS}d — ` +
        `INVESTIGATE IMMEDIATELY. Details below:`,
    );
    for (const dup of duplicateCaptures) {
      diagnostics.push(
        `  invoice=${dup.invoiceNumber} count=${dup.count} transIds=[${dup.transIds.join(",")}]`,
      );
    }
  }

  const summary: DailySweepSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    unsettledCount: fetched.unsettledCount,
    settledBatchesScanned: fetched.settledBatchesScanned,
    settledBatchesAvailable: fetched.settledBatchesAvailable,
    authnetTxnsSeen: fetched.totalSeen,
    matched,
    verifiedCompleted,
    verifiedAlreadyCompleted,
    verifiedFailed,
    alreadyComplete,
    terminalSkipped,
    orphanNoRow,
    duplicateCapturesDetected: duplicateCaptures.length,
    duplicateCaptures,
  };

  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "Payment Daily Sweep",
    action: "CRON_PAYMENT_DAILY_SWEEP",
    details: [
      `unsettled=${summary.unsettledCount} batches=${summary.settledBatchesScanned}/${summary.settledBatchesAvailable}`,
      `seen=${summary.authnetTxnsSeen} matched=${summary.matched}`,
      `verified=${summary.verifiedCompleted} already=${summary.alreadyComplete}`,
      `verified_already=${summary.verifiedAlreadyCompleted} failed=${summary.verifiedFailed}`,
      `terminal_skipped=${summary.terminalSkipped} orphan=${summary.orphanNoRow}`,
      "",
      ...diagnostics,
    ].join("\n").slice(0, 4000),
    status: summary.verifiedFailed > 0 ? "warning" : "success",
  });

  return summary;
}

/**
 * Wrapper for the in-process scheduler. Refuses to run if the env gate
 * is explicitly disabled. Logs failures to system_logs and to the cron
 * run tracker; never throws to the scheduler (which would crash
 * node-cron's tick loop).
 */
export async function paymentDailySweepTick(): Promise<void> {
  if (!isDailySweepEnabled()) {
    console.log(
      "[payment-daily-sweep] Skipping tick — PAYMENT_DAILY_SWEEP_ENABLED is explicitly disabled",
    );
    return;
  }

  console.log("[payment-daily-sweep] Tick starting...");
  const run = await logCronRun("payment-daily-sweep");

  try {
    const summary = await runPaymentDailySweep();
    console.log(
      `[payment-daily-sweep] Done. seen=${summary.authnetTxnsSeen} matched=${summary.matched} ` +
        `verified=${summary.verifiedCompleted} already=${summary.alreadyComplete} ` +
        `terminal=${summary.terminalSkipped} orphan=${summary.orphanNoRow} failed=${summary.verifiedFailed}`,
    );
    await run.success(summary.matched);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payment-daily-sweep] Fatal error:", msg);
    try {
      const supabase = createCronClient();
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "system@aimrx.com",
        user_name: "Payment Daily Sweep",
        action: "CRON_PAYMENT_DAILY_SWEEP",
        details: `Fatal: ${msg}`,
        status: "failure",
      });
    } catch {
      // best effort
    }
    await run.error(msg);
  }
}
