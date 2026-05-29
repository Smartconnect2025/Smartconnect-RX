import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { JANITOR_STALE_PROCESSING_MS } from "@/app/api/payments/_lib/constants";
import { envConfig } from "@/core/config/envConfig";
import {
  submitPrescriptionToPharmacy,
  newRequestId,
} from "@/app/api/prescriptions/_shared/submit-to-pharmacy-core";
import {
  AUTHNET_API_URLS,
  AuthnetTransaction,
  extractTransactions,
  extractBatchList,
  getResultCode,
} from "./payment-reconcile";

/**
 * payment-janitor
 *
 * In-process cron job that closes the loop for the Apr 22-23, 2026 stuck-row
 * incident AND the Apr 25, 2026 triple-charge / orphan-completion incident.
 * Walks five cohorts of payment_transactions rows that the synchronous
 * payment routes can leave behind, and drives each row to a clean terminal
 * state.
 *
 * This module is the single source of truth for janitor behavior.
 * It is invoked from two places:
 *   1. core/cron/index.ts — scheduled every 15 minutes by node-cron.
 *   2. app/api/cron/payment-janitor/route.ts — HTTP endpoint for
 *      on-demand triggering and monitoring.
 *
 * Cohorts:
 *   A. STALE_PROCESSING — payment_status='processing' AND updated_at older
 *      than JANITOR_STALE_PROCESSING_MS. Drives verify-and-complete.
 *   B. VERIFY_REQUIRED — any non-terminal row with verify_required_at
 *      breadcrumb set by charge-nonce or verify-and-complete. Retries.
 *   C. EXPIRED_PENDING_LINKS — payment_status='pending' AND payment_link_
 *      expires_at < now() AND no reconciliation_note / verify_required_at
 *      breadcrumb (so we never trample a runbook hold). Soft-marks expired.
 *   D. AUTHNET_GAP_RECENT — payment_status IN ('pending','processing',
 *      'expired') AND created_at > now() - 24h AND authnet_transaction_id
 *      IS NULL AND authnet_ref_id IS NOT NULL. Pulls Authnet's settled +
 *      unsettled transaction lists, matches on invoiceNumber===authnet_ref_id,
 *      and routes matches to verify-and-complete. Catches anything that
 *      slipped past the success-page polling — including rows we wrongly
 *      marked 'expired' that actually have a real Authnet charge.
 *   E. WEBHOOK_INCOMPLETE — authnet_transaction_id IS NOT NULL AND
 *      payment_status <> 'completed'. The webhook fired and stamped the
 *      transId, but verify-and-complete didn't finish cleanly. Re-drives
 *      verify-and-complete to push the row to terminal.
 *
 * Safety:
 *   * ENV GATE — `isPaymentJanitorEnabled()` defaults to ON in production
 *     so a missing/unset Render env var cannot silently disable janitor
 *     coverage (the original Apr 22-23 failure mode). To OPT OUT (e.g.,
 *     while a runbook is mid-flight against a frozen snapshot) the operator
 *     must explicitly set PAYMENT_JANITOR_ENABLED='false' (or '0'/'no'/'off').
 *     Non-production defaults to OFF so dev/preview don't accidentally hit
 *     the live Authnet API. A loud console.warn fires whenever the prod
 *     default kicks in so we can grep deploy logs to confirm coverage.
 *   * COHORT_LIMIT 50 per run — a runaway sweep cannot blow up the
 *     gateway or our DB. Cohort D additionally caps Authnet API calls by
 *     looking back only 24h and at most SETTLED_LOOKBACK_DAYS of batches.
 *   * DEDUP — each row is verified at most once per tick, even if it
 *     qualifies for multiple cohorts (handledIds set).
 *   * AUDIT — every run writes a CRON_PAYMENT_JANITOR row to system_logs
 *     with per-cohort sizes.
 */

const COHORT_LIMIT = 50;
const COHORT_D_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const SETTLED_LOOKBACK_DAYS = 30;
// Hard cap on Authnet batch traversals per tick. Without this, a high-volume
// merchant's 30-day settled-batch list could trigger dozens of
// getTransactionListRequest calls per tick; we cap so cost and latency stay
// bounded regardless of merchant volume. If a needle isn't in the most
// recent batches, the next tick (15 min later) will keep walking.
const COHORT_D_MAX_SETTLED_BATCHES = 10;
// Single source of truth for "which payment_status values are safe to
// re-drive through verify-and-complete." Exported so payment-daily-sweep
// shares this exact definition. Excludes 'completed' (no-op), 'refunded',
// 'partially_refunded', 'voided', 'reversed', 'declined', 'failed',
// 'cancelled' — any of those would be a regression to flip back to
// 'completed' or to retrigger downstream side-effects.
//
// Used by cohorts B, D, E here, and by the daily sweep. If you add a
// new payment_status to the schema, this list is the deliberate-decision
// boundary that controls whether the janitor / sweep can recover it.
export const JANITOR_RECOVERABLE_STATUSES = [
  "pending",
  "processing",
  "expired",
] as const;

export type CohortOutcome = {
  id: string;
  paymentToken?: string;
  result: string;
};

export type JanitorSummary = {
  startedAt: string;
  finishedAt: string;
  cohortA: { size: number; outcomes: CohortOutcome[] };
  cohortB: { size: number; outcomes: CohortOutcome[] };
  cohortC: { size: number; outcomes: CohortOutcome[] };
  cohortD: { size: number; outcomes: CohortOutcome[] };
  cohortE: { size: number; outcomes: CohortOutcome[] };
  cohortF: { size: number; outcomes: CohortOutcome[] };
  cohortG: { size: number; outcomes: CohortOutcome[] };
};

/**
 * Cohort G threshold — paid prescriptions that were rolled back to
 * `payment_received` by the Greenwich PDF hard-gate (May 8 2026,
 * Joseph "always sent and always correct" rule). The hard-gate refuses
 * to ship a Greenwich order whose PDF fails any of the 3 pillars
 * (size, race, content). The order is held — never lost — and this
 * cohort retries it every minute until the underlying issue resolves
 * (PDF upload finally lands, regen produces a healthy file, admin
 * links the missing catalog medication, etc.).
 *
 * 60s is intentionally short: most holds are upload-race victims that
 * resolve within seconds. Too long here = "stuck for days" which is
 * the bug Joseph is rejecting.
 */
const COHORT_G_HOLD_MS = 60 * 1000;

/**
 * Cohort F threshold — a prescription stuck in `submitting_to_pharmacy`
 * for at least this long is presumed to belong to a Render-SIGKILLed
 * invocation that died before it could revert the claim. The Felicia
 * Rafeal incident showed entry log at 21:38:43 with no follow-up — the
 * row sat for ~30 min before manual intervention. 6 minutes is well
 * past the 25s mark-paid deadline + cron skew tolerance.
 */
const COHORT_F_STUCK_MS = 6 * 60 * 1000;

/**
 * Cohort F retry cap. When a DigitalRx submit times out client-side,
 * DigitalRx may STILL accept and process the request server-side.
 * Auto-retrying a timed-out submission risks DUPLICATE pharmacy
 * orders. We bound that risk by counting prior PRESCRIPTION_SUBMIT_
 * TIMEOUT entries for this Rx in the last 24h. After 2 timeouts we
 * stop auto-retrying and require human reconciliation via
 * PRESCRIPTION_SUBMIT_NEEDS_MANUAL_DEDUP.
 *
 * 2 attempts is enough to recover from one transient SIGKILL while
 * still containing duplicate-submit blast radius if DigitalRx is the
 * actual hung dependency.
 */
const COHORT_F_MAX_TIMEOUT_RETRIES = 2;
const COHORT_F_TIMEOUT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export function isPaymentJanitorEnabled(): boolean {
  // Case- and whitespace-insensitive on purpose. The Render dashboard
  // does not warn operators about case, and we caught a real production
  // misconfig (`TRUE` saved instead of `true`) on April 24, 2026 that
  // silently closed the gate for ~4 hours after the deploy.
  const v = (process.env.PAYMENT_JANITOR_ENABLED || "").trim().toLowerCase();

  // Explicit OFF — operator opt-out (e.g., during runbook execution
  // against a frozen snapshot). Honored in BOTH prod and non-prod.
  if (v === "false" || v === "0" || v === "no" || v === "off") {
    return false;
  }

  // Explicit ON — works in any environment. Required form before the
  // Apr 25 2026 incident, still supported for clarity in deploy diffs.
  if (v === "true" || v === "1" || v === "yes" || v === "on") {
    return true;
  }

  // Unset / unrecognized value: default-ON in production, OFF elsewhere.
  // Production-default-ON is the post-incident decision: a missing env
  // var must not silently disable janitor coverage (that was the Apr 22
  // failure mode). Non-prod default-OFF prevents dev/CI from accidentally
  // hammering the live Authnet API.
  //
  // IMPORTANT: production detection mirrors core/cron/index.ts so the
  // janitor's "prod" predicate cannot disagree with the scheduler's "prod"
  // predicate. On Render, NODE_ENV is sometimes left at 'development' even
  // on the prod service, so we ALSO treat the RENDER env var as a prod
  // signal — otherwise the scheduler would tick the janitor while the
  // gate silently kept it OFF.
  const isProd =
    process.env.NODE_ENV === "production" || !!process.env.RENDER;
  if (isProd) {
    console.warn(
      "[payment-janitor] PAYMENT_JANITOR_ENABLED is unset; DEFAULTING TO ON " +
        "in production. Set PAYMENT_JANITOR_ENABLED='false' explicitly to " +
        "disable (e.g., during runbook execution against a frozen snapshot).",
    );
    return true;
  }
  return false;
}

async function driveVerify(
  siteUrl: string,
  paymentToken: string,
): Promise<string> {
  try {
    const res = await fetch(`${siteUrl}/api/payments/verify-and-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentToken }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && body.success) {
      if (body.alreadyCompleted) return "already_completed";
      return "completed";
    }
    if (typeof body.code === "string") return `verify_${body.code.toLowerCase()}`;
    if (body.pending) return "still_pending";
    return `verify_http_${res.status}`;
  } catch (err) {
    return `verify_error_${err instanceof Error ? err.message : "unknown"}`;
  }
}

/**
 * Cohort D helper — fetch the unsettled list and (if needed) the recent
 * settled batches from Authnet, and return a Map of authnet_ref_id → txn.
 *
 * Returns an empty Map if Authnet credentials are missing or any fetch
 * throws — the caller treats that as "no matches this tick" rather than
 * a fatal janitor error, so cohorts A/B/C/E still run.
 */
async function fetchAuthnetMatches(
  refIds: string[],
): Promise<Map<string, AuthnetTransaction>> {
  const matched = new Map<string, AuthnetTransaction>();
  if (refIds.length === 0) return matched;

  const loginId = envConfig.AUTHNET_API_LOGIN_ID;
  const transactionKey = envConfig.AUTHNET_TRANSACTION_KEY;
  if (!loginId || !transactionKey) return matched;

  const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];
  const merchantAuthentication = { name: loginId, transactionKey };
  const refSet = new Set(refIds);

  // 1. Unsettled list — captures auth/captures still in the current batch.
  try {
    const unsettledRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        getUnsettledTransactionListRequest: { merchantAuthentication },
      }),
    });
    const unsettledData = await unsettledRes.json();
    for (const txn of extractTransactions(unsettledData)) {
      if (txn.invoiceNumber && refSet.has(txn.invoiceNumber)) {
        matched.set(txn.invoiceNumber, txn);
      }
    }
  } catch (err) {
    console.error(
      "[payment-janitor] cohortD unsettled fetch error:",
      err instanceof Error ? err.message : err,
    );
  }

  // 2. If any refs are still unmatched, walk the recent settled batches.
  const remaining = refIds.filter((r) => !matched.has(r));
  if (remaining.length === 0) return matched;

  try {
    const now = new Date();
    const firstSettlementDate = new Date(now);
    firstSettlementDate.setDate(now.getDate() - SETTLED_LOOKBACK_DAYS);

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
    if (getResultCode(batchData) !== "Ok") return matched;

    const remainingSet = new Set(remaining);
    let batchesWalked = 0;
    for (const batch of extractBatchList(batchData)) {
      if (remainingSet.size === 0) break;
      if (batchesWalked >= COHORT_D_MAX_SETTLED_BATCHES) {
        console.warn(
          `[payment-janitor] cohortD reached batch cap (${COHORT_D_MAX_SETTLED_BATCHES}); ` +
            `${remainingSet.size} ref(s) still unmatched, will retry next tick`,
        );
        break;
      }
      batchesWalked++;
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
      for (const txn of extractTransactions(listData)) {
        if (
          txn.invoiceNumber &&
          remainingSet.has(txn.invoiceNumber) &&
          !matched.has(txn.invoiceNumber)
        ) {
          matched.set(txn.invoiceNumber, txn);
          remainingSet.delete(txn.invoiceNumber);
        }
      }
    }
  } catch (err) {
    console.error(
      "[payment-janitor] cohortD settled fetch error:",
      err instanceof Error ? err.message : err,
    );
  }

  return matched;
}

/**
 * Run a single janitor sweep. Returns the cohort summary on success;
 * throws on fatal error.
 */
export async function runPaymentJanitor(): Promise<JanitorSummary> {
  const supabase = createCronClient();
  const startedAt = new Date().toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const cohortA: CohortOutcome[] = [];
  const cohortB: CohortOutcome[] = [];
  const cohortC: CohortOutcome[] = [];
  const cohortD: CohortOutcome[] = [];
  const cohortE: CohortOutcome[] = [];
  const cohortF: CohortOutcome[] = [];
  const cohortG: CohortOutcome[] = [];

  // Track every row id we've already routed to verify-and-complete this
  // tick, so a row matching multiple cohort filters gets verified exactly
  // once. verify-and-complete is idempotent, but a duplicate call wastes
  // an HTTP round-trip and clutters the run log.
  const handledIds = new Set<string>();

  // -- COHORT A: stuck processing rows --
  const staleCutoff = new Date(
    Date.now() - JANITOR_STALE_PROCESSING_MS,
  ).toISOString();
  const { data: stuckProcessing } = await supabase
    .from("payment_transactions")
    .select("id, payment_token")
    .eq("payment_status", "processing")
    .lt("updated_at", staleCutoff)
    .order("updated_at", { ascending: true })
    .limit(COHORT_LIMIT);

  for (const row of stuckProcessing || []) {
    handledIds.add(row.id);
    if (!row.payment_token) {
      cohortA.push({ id: row.id, result: "skipped_no_token" });
      continue;
    }
    const result = await driveVerify(siteUrl, row.payment_token);
    cohortA.push({ id: row.id, paymentToken: row.payment_token, result });
  }

  // -- COHORT B: verify_required_at breadcrumb (skip ids already handled) --
  // SAFETY: status filter uses JANITOR_RECOVERABLE_STATUSES — a strict
  // allowlist — instead of the prior `!= 'completed' AND != 'expired'`
  // pattern. The old filter let cancelled / refunded / voided rows with
  // a stale verify_required_at breadcrumb get re-driven through verify
  // and risk being flipped back to 'completed'. The allowlist closes
  // that gap and matches cohorts D, E, and the daily sweep.
  const { data: verifyRequired } = await supabase
    .from("payment_transactions")
    .select("id, payment_token")
    .not("verify_required_at", "is", null)
    .in("payment_status", [...JANITOR_RECOVERABLE_STATUSES])
    .order("verify_required_at", { ascending: true })
    .limit(COHORT_LIMIT);

  for (const row of verifyRequired || []) {
    if (handledIds.has(row.id)) continue;
    handledIds.add(row.id);
    if (!row.payment_token) {
      cohortB.push({ id: row.id, result: "skipped_no_token" });
      continue;
    }
    const result = await driveVerify(siteUrl, row.payment_token);
    cohortB.push({ id: row.id, paymentToken: row.payment_token, result });
  }

  // -- COHORT C: DISABLED (May 11 2026, Jessica Carroll incident) --
  // Joseph rule: "cancell the expiration of all payment links across the
  // app". Payment links no longer expire by time. Rows only move to
  // 'expired' through explicit admin action (regenerate-link cleanup,
  // refund, cancel). cohortC array is kept (empty) so the summary log
  // shape and counters don't break.

  // -- COHORT D: recent rows missing authnet_transaction_id but with a
  // ref_id we can match against Authnet's settled/unsettled lists. This
  // is the catch-all for "patient closed the tab before the success page
  // polled enough times" and "row was wrongly marked expired but a real
  // charge actually settled". Keep the lookback to 24h so we don't pay
  // for an Authnet sweep across weeks of stale rows on every tick.
  const cohortDCutoff = new Date(
    Date.now() - COHORT_D_LOOKBACK_MS,
  ).toISOString();
  const { data: authnetGap } = await supabase
    .from("payment_transactions")
    .select("id, payment_token, authnet_ref_id, payment_status")
    .in("payment_status", ["pending", "processing", "expired"])
    .gt("created_at", cohortDCutoff)
    .is("authnet_transaction_id", null)
    .not("authnet_ref_id", "is", null)
    .neq("authnet_ref_id", "")
    .order("created_at", { ascending: true })
    .limit(COHORT_LIMIT);

  const candidatesD = (authnetGap || []).filter(
    (row) => !handledIds.has(row.id) && row.authnet_ref_id,
  );

  if (candidatesD.length > 0) {
    const refIds = candidatesD
      .map((r) => r.authnet_ref_id)
      .filter((r): r is string => !!r);
    const matches = await fetchAuthnetMatches(refIds);

    for (const row of candidatesD) {
      const matched = row.authnet_ref_id
        ? matches.get(row.authnet_ref_id)
        : undefined;
      if (!matched) {
        cohortD.push({
          id: row.id,
          paymentToken: row.payment_token || undefined,
          result: "no_authnet_match",
        });
        continue;
      }
      handledIds.add(row.id);
      if (!row.payment_token) {
        cohortD.push({ id: row.id, result: "matched_but_no_token" });
        continue;
      }
      const result = await driveVerify(siteUrl, row.payment_token);
      cohortD.push({
        id: row.id,
        paymentToken: row.payment_token,
        result: `matched_${result}`,
      });
    }
  }

  // -- COHORT E: webhook stamped authnet_transaction_id but row never
  // reached 'completed'. Rare — happens when verify-and-complete crashed
  // mid-flight or the webhook handler raced the success-page poll. Just
  // re-drive verify; it's idempotent and will push the row terminal.
  //
  // SAFETY: filter is a STRICT ALLOWLIST of recoverable statuses (see
  // JANITOR_RECOVERABLE_STATUSES at top of file). A naive `<> 'completed'`
  // filter would sweep up rows in terminal states like 'refunded',
  // 'voided', 'cancelled', 'declined', 'failed' — and re-driving verify
  // on those could flip them back to 'completed' and retrigger pharmacy /
  // notification side-effects.
  const { data: webhookIncomplete } = await supabase
    .from("payment_transactions")
    .select("id, payment_token")
    .not("authnet_transaction_id", "is", null)
    .neq("authnet_transaction_id", "")
    .in("payment_status", [...JANITOR_RECOVERABLE_STATUSES])
    .order("updated_at", { ascending: true })
    .limit(COHORT_LIMIT);

  for (const row of webhookIncomplete || []) {
    if (handledIds.has(row.id)) continue;
    handledIds.add(row.id);
    if (!row.payment_token) {
      cohortE.push({ id: row.id, result: "skipped_no_token" });
      continue;
    }
    const result = await driveVerify(siteUrl, row.payment_token);
    cohortE.push({ id: row.id, paymentToken: row.payment_token, result });
  }

  // -- COHORT F: prescriptions stuck in `submitting_to_pharmacy` --
  // Pattern caught by the May 4 2026 Felicia Rafeal silent-fail incident:
  // mark-paid invoked submit-to-pharmacy via internal HTTP, the submit
  // process was SIGKILLed by Render mid-await on a hung DigitalRx fetch,
  // and the row sat indefinitely in `submitting_to_pharmacy` (NULL
  // queue_id, no error log) blocking the order from ever shipping.
  //
  // Recovery procedure:
  //   1. SELECT prescriptions WHERE status='submitting_to_pharmacy'
  //      AND updated_at < now() - 6 minutes (well past mark-paid's
  //      22s deadline + cron skew tolerance).
  //   2. For each, atomically revert status -> 'payment_received'
  //      (the same status mark-paid sets right before submission), so
  //      the retry sees a clean precondition.
  //   3. Immediately invoke submitPrescriptionToPharmacy directly
  //      (in-process, NOT via HTTP — the bug was caused by HTTP self-call
  //      cascading-timeouts; the cron tick has its own execution budget).
  //   4. Log PRESCRIPTION_SUBMIT_TO_PHARMACY_RECOVERED with the result.
  const cohortFCutoff = new Date(Date.now() - COHORT_F_STUCK_MS).toISOString();
  // Select patient + medication so the recovery log identifies which
  // order recovered without forcing operators to re-query by uuid.
  const { data: stuckSubmitting } = await supabase
    .from("prescriptions")
    .select(
      "id, status, updated_at, payment_status, medication, patient_id, patients(first_name, last_name)",
    )
    .eq("status", "submitting_to_pharmacy")
    .lt("updated_at", cohortFCutoff)
    .order("updated_at", { ascending: true })
    .limit(COHORT_LIMIT);

  const cohortFTimeoutLookback = new Date(
    Date.now() - COHORT_F_TIMEOUT_LOOKBACK_MS,
  ).toISOString();

  // Helper to render the runbook-friendly identity blurb for cohort F
  // logs. Falls back gracefully when the patient join is missing.
  type PatientLite = {
    first_name?: string | null;
    last_name?: string | null;
  };
  const cohortFIdentity = (row: {
    id: string;
    medication?: string | null;
    // Supabase typegen renders foreign-key joins as arrays even for
    // 1-to-1 relations; accept either shape so this helper survives
    // both the runtime payload (single object) and TS's view (array).
    patients?: PatientLite | PatientLite[] | null;
  }): string => {
    const p: PatientLite | null | undefined = Array.isArray(row.patients)
      ? row.patients[0]
      : row.patients;
    const first = (p?.first_name ?? "").toString().trim();
    const last = (p?.last_name ?? "").toString().trim();
    const patientName = `${first} ${last}`.trim() || "<unknown patient>";
    const med = (row.medication ?? "").toString().trim() || "<unknown medication>";
    return `prescriptionId=${row.id} patient="${patientName}" medication="${med}"`;
  };

  for (const row of stuckSubmitting || []) {
    // ─── Retry cap ──────────────────────────────────────────────────
    // Count prior timeout entries for this prescription in the last 24h.
    // If >= COHORT_F_MAX_TIMEOUT_RETRIES, do NOT auto-retry — DigitalRx
    // may have actually accepted the prior submissions and a third
    // attempt could create duplicate pharmacy orders. Skip + log for
    // human reconciliation.
    const { count: priorTimeoutCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PRESCRIPTION_SUBMIT_TIMEOUT")
      .ilike("details", `%prescriptionId=${row.id}%`)
      .gt("created_at", cohortFTimeoutLookback);

    if ((priorTimeoutCount || 0) >= COHORT_F_MAX_TIMEOUT_RETRIES) {
      // Don't revert either — leave the row in submitting_to_pharmacy
      // so it stands out on operator dashboards and isn't auto-touched.
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "system@aimrx.com",
        user_name: "Payment Janitor (Cohort F)",
        action: "PRESCRIPTION_SUBMIT_NEEDS_MANUAL_DEDUP",
        details:
          `${cohortFIdentity(row)} has had ${priorTimeoutCount} DigitalRx submit timeout(s) in the last 24h. ` +
          `Auto-retry HALTED to avoid duplicate pharmacy orders. Operator must manually verify with DigitalRx ` +
          `(check Greenwich queue for matching DrugName + Patient + DateWritten) and either: ` +
          `(a) update prescription with the existing queue_id and set status='submitted', or ` +
          `(b) reset status='payment_received' to allow another attempt after confirming no duplicate.`,
        status: "error",
      });
      cohortF.push({
        id: row.id,
        result: `halt_retry_cap_reached_${priorTimeoutCount}_timeouts_24h`,
      });
      continue;
    }

    // Atomic revert with status precondition — ensures we don't trample
    // a concurrent legitimate submission that just claimed the row.
    const { data: reverted } = await supabase
      .from("prescriptions")
      .update({
        status: "payment_received",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "submitting_to_pharmacy")
      .lt("updated_at", cohortFCutoff)
      .select("id");

    if (!reverted || reverted.length === 0) {
      cohortF.push({ id: row.id, result: "skipped_concurrent_change" });
      continue;
    }

    // Audit-log the recovery attempt BEFORE the retry, so even if the
    // retry itself dies the recovery action is on the record.
    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: "system@aimrx.com",
      user_name: "Payment Janitor (Cohort F)",
      action: "PRESCRIPTION_SUBMIT_TO_PHARMACY_RECOVERED",
      details:
        `Reverted stuck submitting_to_pharmacy claim for ${cohortFIdentity(row)} ` +
        `(was stale since ${row.updated_at}; priorTimeouts24h=${priorTimeoutCount || 0}); now retrying submission.`,
      status: "info",
    });

    // Direct in-process retry — no HTTP hop. The shared core has its own
    // bounded timeouts for PDF + DigitalRx + parse, so this call cannot
    // hang the cron tick.
    try {
      const result = await submitPrescriptionToPharmacy(supabase, row.id, {
        isInternalCall: true,
        isAdmin: true,
        authenticatedUserId: null,
        requestId: newRequestId(),
        callerLabel: "janitor-cohortF",
      });
      cohortF.push({
        id: row.id,
        result: result.ok
          ? `recovered_${result.code}_queueId=${result.queueId || "n/a"}`
          : `retry_failed_${result.code}_${result.error?.slice(0, 80) || ""}`,
      });
    } catch (err) {
      cohortF.push({
        id: row.id,
        result: `retry_threw_${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`,
      });
    }
  }

  // ── Cohort G: PDF-HOLD retry ──────────────────────────────────────
  // Greenwich PDF hard-gate rolled these back to payment_received with
  // a SUBMIT_PDF_HOLD audit log. Reattempt every tick until the gate
  // passes (PDF upload landed, regen succeeded, validation cleared).
  // Atomic claim via .eq("status","payment_received") so concurrent
  // legitimate flows can't double-submit.
  const cohortGCutoff = new Date(Date.now() - COHORT_G_HOLD_MS).toISOString();
  const { data: heldRows } = await supabase
    .from("prescriptions")
    .select("id, updated_at")
    .eq("status", "payment_received")
    .eq("payment_status", "paid")
    .lt("updated_at", cohortGCutoff)
    .order("updated_at", { ascending: true })
    .limit(50);

  for (const row of heldRows || []) {
    if (handledIds.has(row.id)) continue;
    handledIds.add(row.id);
    try {
      const result = await submitPrescriptionToPharmacy(supabase, row.id, {
        isInternalCall: true,
        isAdmin: true,
        authenticatedUserId: null,
        requestId: newRequestId(),
        callerLabel: "janitor-cohortG",
      });
      cohortG.push({
        id: row.id,
        result: result.ok
          ? `recovered_${result.code}_queueId=${result.queueId || "n/a"}`
          : `still_held_${result.code}`,
      });
    } catch (err) {
      cohortG.push({
        id: row.id,
        result: `retry_threw_${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`,
      });
    }
  }

  const summary: JanitorSummary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    cohortA: { size: cohortA.length, outcomes: cohortA },
    cohortB: { size: cohortB.length, outcomes: cohortB },
    cohortC: { size: cohortC.length, outcomes: cohortC },
    cohortD: { size: cohortD.length, outcomes: cohortD },
    cohortE: { size: cohortE.length, outcomes: cohortE },
    cohortF: { size: cohortF.length, outcomes: cohortF },
    cohortG: { size: cohortG.length, outcomes: cohortG },
  };

  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "Payment Janitor",
    action: "CRON_PAYMENT_JANITOR",
    details:
      `A=${cohortA.length} B=${cohortB.length} C=${cohortC.length} ` +
      `D=${cohortD.length} E=${cohortE.length} F=${cohortF.length} G=${cohortG.length}`,
    status: "success",
  });

  return summary;
}

/**
 * Wrapper for the in-process scheduler in core/cron/index.ts.
 * Refuses to run unless the env gate (see isPaymentJanitorEnabled) allows
 * it. Logs failures to system_logs and to the cron run tracker; never
 * throws to the scheduler (which would crash node-cron's tick loop).
 */
export async function paymentJanitorTick(): Promise<void> {
  if (!isPaymentJanitorEnabled()) {
    console.log(
      "[payment-janitor] Skipping tick — PAYMENT_JANITOR_ENABLED is explicitly disabled",
    );
    return;
  }

  console.log("[payment-janitor] Tick starting...");
  const run = await logCronRun("payment-janitor");

  try {
    const summary = await runPaymentJanitor();
    console.log(
      `[payment-janitor] Done. A=${summary.cohortA.size} B=${summary.cohortB.size} ` +
        `C=${summary.cohortC.size} D=${summary.cohortD.size} E=${summary.cohortE.size} ` +
        `F=${summary.cohortF.size} G=${summary.cohortG.size}`,
    );
    await run.success(
      summary.cohortA.size +
        summary.cohortB.size +
        summary.cohortC.size +
        summary.cohortD.size +
        summary.cohortE.size +
        summary.cohortF.size +
        summary.cohortG.size,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payment-janitor] Fatal error:", msg);

    try {
      const supabase = createCronClient();
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "system@aimrx.com",
        user_name: "Payment Janitor",
        action: "CRON_PAYMENT_JANITOR",
        details: `Fatal: ${msg}`,
        status: "failure",
      });
    } catch {
      // best effort
    }
    await run.error(msg);
  }
}
