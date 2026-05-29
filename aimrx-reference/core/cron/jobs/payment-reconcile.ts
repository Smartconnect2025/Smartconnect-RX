import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { envConfig } from "@/core/config/envConfig";

// Exported so payment-janitor.ts (cohort D) can reuse the same Authnet
// list-fetch + match logic without forking it. Both jobs need to look up
// recent transactions by invoiceNumber===authnet_ref_id; payment-reconcile
// then inlines the completion side-effects, while the janitor delegates
// to verify-and-complete.
export const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

export interface AuthnetTransaction {
  transId: string;
  invoiceNumber?: string;
  amount?: number;
  accountNumber?: string;
  accountType?: string;
  submitTimeUTC?: string;
  transactionStatus?: string;
}

export function extractTransactions(data: Record<string, unknown>): AuthnetTransaction[] {
  if (Array.isArray(data.transactions)) return data.transactions;

  const response = data.getUnsettledTransactionListResponse ||
    data.getTransactionListResponse ||
    data.transactionList;
  if (response && Array.isArray((response as Record<string, unknown>).transactions)) {
    return (response as Record<string, unknown>).transactions as AuthnetTransaction[];
  }

  if (data.transactions && typeof data.transactions === "object" && !Array.isArray(data.transactions)) {
    const txObj = data.transactions as Record<string, unknown>;
    if (Array.isArray(txObj.transaction)) return txObj.transaction as AuthnetTransaction[];
    if (txObj.transId) return [txObj as unknown as AuthnetTransaction];
  }

  return [];
}

export function extractBatchList(data: Record<string, unknown>): Array<{ batchId: string }> {
  if (Array.isArray(data.batchList)) return data.batchList;

  const response = data.getSettledBatchListResponse;
  if (response && Array.isArray((response as Record<string, unknown>).batchList)) {
    return (response as Record<string, unknown>).batchList as Array<{ batchId: string }>;
  }

  if (data.batchList && typeof data.batchList === "object" && !Array.isArray(data.batchList)) {
    const obj = data.batchList as Record<string, unknown>;
    if (Array.isArray(obj.batch)) return obj.batch as Array<{ batchId: string }>;
    if (obj.batchId) return [obj as unknown as { batchId: string }];
  }

  return [];
}

export function getResultCode(data: Record<string, unknown>): string {
  if (data.messages && typeof data.messages === "object") {
    return (data.messages as Record<string, unknown>).resultCode as string || "";
  }
  const inner = Object.values(data).find(v => typeof v === "object" && v !== null && "messages" in (v as object));
  if (inner) {
    return ((inner as Record<string, unknown>).messages as Record<string, unknown>)?.resultCode as string || "";
  }
  return "";
}

// Re-entrancy guard. The job is scheduled every 1 minute (May 7 2026
// change), and a slow AuthNet response or a chatty 50-row scan can
// occasionally exceed 60 seconds. We must never let two reconcile ticks
// run concurrently — overlapping AuthNet list-fetches would double our
// API rate, double our DB write attempts, and double the system_logs
// noise. CAS guards on the completion UPDATE prevent any actual double-
// completion of a row, but skipping the overlap is still the right move.
let isRunning = false;

export async function reconcilePayments() {
  if (isRunning) {
    console.log("[payment-reconcile] Previous tick still running — skipping");
    return;
  }
  isRunning = true;
  const run = await logCronRun("payment-reconcile");
  const diagnostics: string[] = [];

  try {
    const loginId = envConfig.AUTHNET_API_LOGIN_ID;
    const transactionKey = envConfig.AUTHNET_TRANSACTION_KEY;

    if (!loginId || !transactionKey) {
      // Don't write a system_logs row every 60s for missing creds.
      console.log("[payment-reconcile] Authorize.net credentials not configured — skipping");
      await run.success(0);
      return;
    }

    const supabase = createCronClient();
    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];
    const merchantAuthentication = { name: loginId, transactionKey };

    // Note (May 7 2026): the previous filter excluded rows where
    // authnet_ref_id was NULL/empty. That mirrored the old "ref_id is
    // always populated" assumption — but the Keith Robinson incident
    // proved a row can legitimately reach AuthNet with an empty invoice
    // (support reset, legacy generate-link bug, race during re-issue).
    // We now scan ALL pending/processing rows. Rows with a ref_id are
    // matched by invoiceNumber (fast path, exact key); rows without one
    // fall through to the amount + recent-time fallback below.
    const { data: stuckPayments, error } = await supabase
      .from("payment_transactions")
      .select("id, prescription_id, payment_status, authnet_ref_id, authnet_transaction_id, total_amount_cents, patient_name, patient_email, patient_phone, provider_name, pharmacy_name, description, created_at")
      .in("payment_status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      // Real DB errors are worth logging.
      diagnostics.push(`Query error: ${error.message}`);
      await logDiagnostics(diagnostics, 0, 0);
      await run.error(error.message);
      return;
    }

    if (!stuckPayments || stuckPayments.length === 0) {
      // No stuck rows = healthy idle state. Don't log every 60s.
      await run.success(0);
      return;
    }

    diagnostics.push(`Found ${stuckPayments.length} stuck payment transactions to check`);

    const refIdMap = new Map<string, typeof stuckPayments[0]>();
    for (const tx of stuckPayments) {
      refIdMap.set(tx.authnet_ref_id!, tx);
      diagnostics.push(`  ${tx.patient_name} | ${tx.description} | $${(tx.total_amount_cents / 100).toFixed(2)} | status: ${tx.payment_status} | ref: ${tx.authnet_ref_id}`);
    }

    const matchedTransactions = new Map<string, AuthnetTransaction>();

    try {
      const unsettledResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          getUnsettledTransactionListRequest: { merchantAuthentication },
        }),
      });
      const unsettledData = await unsettledResponse.json();
      const resultCode = getResultCode(unsettledData);
      const txns = extractTransactions(unsettledData);

      diagnostics.push(`Unsettled transactions: resultCode=${resultCode}, count=${txns.length}`);

      for (const txn of txns) {
        if (txn.invoiceNumber && refIdMap.has(txn.invoiceNumber)) {
          matchedTransactions.set(txn.invoiceNumber, txn);
        }
      }
    } catch (err) {
      diagnostics.push(`Unsettled list error: ${err instanceof Error ? err.message : "Unknown"}`);
    }

    const remainingRefs = [...refIdMap.keys()].filter(ref => !matchedTransactions.has(ref));

    if (remainingRefs.length > 0) {
      try {
        const now = new Date();
        const firstSettlementDate = new Date(now);
        firstSettlementDate.setDate(now.getDate() - 30);

        const batchResponse = await fetch(apiUrl, {
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

        const batchData = await batchResponse.json();
        const batchResultCode = getResultCode(batchData);
        const batches = extractBatchList(batchData);

        diagnostics.push(`Settled batches: resultCode=${batchResultCode}, batchCount=${batches.length}`);

        if (batchResultCode === "Ok" && batches.length > 0) {
          for (const batch of batches) {
            if (remainingRefs.every(ref => matchedTransactions.has(ref))) break;

            const listResponse = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                getTransactionListRequest: {
                  merchantAuthentication,
                  batchId: batch.batchId,
                },
              }),
            });

            const listData = await listResponse.json();
            const listResultCode = getResultCode(listData);
            const batchTxns = extractTransactions(listData);

            if (listResultCode === "Ok") {
              for (const txn of batchTxns) {
                if (txn.invoiceNumber && refIdMap.has(txn.invoiceNumber) && !matchedTransactions.has(txn.invoiceNumber)) {
                  matchedTransactions.set(txn.invoiceNumber, txn);
                }
              }
            }
          }
        }
      } catch (err) {
        diagnostics.push(`Settled batch search error: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // FALLBACK MATCHER (May 7 2026): for any stuck row that has NO
    // authnet_ref_id at all (legacy rows, support reset before the
    // get-hosted-token backfill shipped), try matching by AMOUNT +
    // recent submit time. Deliberately scoped to ref_id-less rows ONLY
    // — rows with a ref_id MUST match via the exact-invoice path or
    // not at all, because amount+time matching is too loose to risk
    // binding a charge to the wrong patient when an invoice is
    // available as ground truth. Safety constraints:
    //   1. AuthNet txn amount must match row total to the cent.
    //      Amount is parsed via Number() because AuthNet's JSON often
    //      returns numeric fields as strings.
    //   2. AuthNet txn must have submitTimeUTC within the last 24 hours
    //      AND after the row was created (charges cannot precede their
    //      own payment intent).
    //   3. Each AuthNet txn matches AT MOST ONE row (greedy by row
    //      insertion order). Prevents one txn binding to multiple rows.
    //   4. AuthNet txn must not already be matched by the invoice path.
    const fallbackEligible = stuckPayments.filter(
      (p) => !p.authnet_ref_id || p.authnet_ref_id === "",
    );

    if (fallbackEligible.length > 0) {
      const matchedAuthnetTransIds = new Set<string>();
      for (const t of matchedTransactions.values()) {
        if (t.transId) matchedAuthnetTransIds.add(t.transId);
      }

      // Skip the extra AuthNet API call entirely when no row needs the
      // fallback. Only re-fetch unsettled list when there's actual work
      // to do — keeps the cron's per-minute API cost minimal in steady
      // state.
      let fallbackCandidates: AuthnetTransaction[] = [];
      try {
        const fallbackResp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            getUnsettledTransactionListRequest: { merchantAuthentication },
          }),
        });
        const fallbackData = await fallbackResp.json();
        fallbackCandidates = extractTransactions(fallbackData);
      } catch (err) {
        diagnostics.push(`Fallback unsettled fetch error: ${err instanceof Error ? err.message : "Unknown"}`);
      }

      const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
      const nowMs = Date.now();

      for (const paymentTx of fallbackEligible) {
        const rowCreatedMs = paymentTx.created_at ? new Date(paymentTx.created_at).getTime() : 0;
        const expectedAmount = paymentTx.total_amount_cents / 100;

        const candidate = fallbackCandidates.find((t) => {
          if (!t.transId) return false;
          if (matchedAuthnetTransIds.has(t.transId)) return false;
          // AuthNet returns amount as either number or numeric string —
          // normalize via Number() and reject non-finite results.
          const amountNum = typeof t.amount === "number" ? t.amount : Number(t.amount);
          if (!Number.isFinite(amountNum)) return false;
          if (Math.abs(amountNum - expectedAmount) > 0.01) return false;
          if (!t.submitTimeUTC) return false;
          const submittedMs = new Date(t.submitTimeUTC).getTime();
          if (Number.isNaN(submittedMs)) return false;
          if (submittedMs < rowCreatedMs) return false;
          if (nowMs - submittedMs > FALLBACK_WINDOW_MS) return false;
          return true;
        });

        if (candidate) {
          const matchKey = `__fallback__${paymentTx.id}`;
          const patched: AuthnetTransaction = {
            ...candidate,
            invoiceNumber: matchKey,
          };
          matchedTransactions.set(matchKey, patched);
          refIdMap.set(matchKey, paymentTx);
          matchedAuthnetTransIds.add(candidate.transId);
          diagnostics.push(`  FALLBACK MATCH (amount+time): ${paymentTx.patient_name} | $${expectedAmount} | authnet TX: ${candidate.transId}`);
        }
      }
    }

    diagnostics.push(`Matched ${matchedTransactions.size} of ${stuckPayments.length} transactions at Authorize.net`);

    let updated = 0;
    let failed = 0;

    for (const [refId, authnetTxn] of matchedTransactions) {
      const paymentTx = refIdMap.get(refId)!;

      try {
        if (authnetTxn.amount !== undefined) {
          const expectedAmount = paymentTx.total_amount_cents / 100;
          const diff = Math.abs(authnetTxn.amount - expectedAmount);
          if (diff > 0.01) {
            diagnostics.push(`  SKIP ${paymentTx.patient_name} (ref: ${refId}): amount mismatch expected $${expectedAmount}, got $${authnetTxn.amount}`);
            continue;
          }
        }

        const now = new Date().toISOString();
        const cardLastFour = authnetTxn.accountNumber?.slice(-4);

        // CAS guard against webhook race (May 7 2026 fix): the AuthNet
        // webhook at /api/webhooks/authnet flips the same row to
        // 'completed' as soon as it fires. With this cron now running
        // every 60s, both paths can target the same row simultaneously.
        // Restricting the UPDATE to status IN (pending, processing) +
        // selecting the affected rows means: the SECOND writer affects
        // 0 rows, returns an empty array, and we skip ALL side-effects
        // (pharmacy submission, notifications, prescription updates)
        // for this row in this tick. Without this, the cron and the
        // webhook would both fire pharmacy submission for the same
        // payment.
        const { data: updatedRows, error: updateTxError } = await supabase
          .from("payment_transactions")
          .update({
            payment_status: "completed",
            order_progress: "payment_received",
            authnet_transaction_id: authnetTxn.transId,
            card_last_four: cardLastFour,
            card_type: authnetTxn.accountType,
            paid_at: now,
            updated_at: now,
          })
          .eq("id", paymentTx.id)
          .in("payment_status", ["pending", "processing"])
          .select("id");

        if (updateTxError) {
          diagnostics.push(`  FAIL updating payment ${paymentTx.id}: ${updateTxError.message}`);
          failed++;
          continue;
        }

        if (!updatedRows || updatedRows.length === 0) {
          // Webhook (or another concurrent path) already completed this
          // row. Side-effects ran there. Nothing to do.
          diagnostics.push(`  RACE-LOST (already completed): ${paymentTx.patient_name} | tx ${authnetTxn.transId}`);
          continue;
        }

        diagnostics.push(`  PAYMENT MATCHED: ${paymentTx.patient_name} | ${paymentTx.description} | authnet TX: ${authnetTxn.transId} | card: ****${cardLastFour || "?"}`);

        await runPaymentSideEffects(supabase, paymentTx, now, diagnostics);

        updated++;
        run.trackSuccess({
          paymentId: paymentTx.id,
          prescriptionId: paymentTx.prescription_id,
          authnetTransId: authnetTxn.transId,
          patient: paymentTx.patient_name,
        });
      } catch (err) {
        diagnostics.push(`  ERROR processing ${refId}: ${err instanceof Error ? err.message : "Unknown"}`);
        failed++;
        run.trackFailure({
          paymentId: paymentTx.id,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }

    const unmatched = [...refIdMap.keys()].filter(ref => !matchedTransactions.has(ref));
    if (unmatched.length > 0) {
      diagnostics.push(`Unmatched (${unmatched.length} — no Authorize.net record found):`);
      for (const ref of unmatched) {
        const tx = refIdMap.get(ref)!;
        diagnostics.push(`  ${tx.patient_name} | ${tx.description} | ref: ${ref}`);
      }
    }

    // ORPHAN COMPLETION PASS (May 7 2026 — Keith Robinson follow-up):
    // Catches rows where payment_transactions.payment_status='completed'
    // but the linked prescription was NEVER pushed to pharmacy. This
    // happens when the payment row was flipped to completed by something
    // OTHER than the normal verify/webhook path — e.g. a manual DB UPDATE
    // by support, a server crash mid-flow between the payment UPDATE and
    // the pharmacy submission, or a CAS race where neither path actually
    // ran the side-effect. The cron is the safety net — if a paid order
    // is sitting without a queue_id, it gets pushed here automatically.
    // Scope: last 7 days, paid_at is set, prescription_id is set.
    let orphansHealed = 0;
    try {
      const orphanCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: completedRecent } = await supabase
        .from("payment_transactions")
        .select("id, prescription_id, payment_status, authnet_ref_id, authnet_transaction_id, total_amount_cents, patient_name, patient_email, patient_phone, provider_name, pharmacy_name, description, created_at")
        .eq("payment_status", "completed")
        .not("prescription_id", "is", null)
        .gte("paid_at", orphanCutoff)
        .order("paid_at", { ascending: false })
        .limit(50);

      for (const pt of completedRecent || []) {
        const linkedIds = new Set<string>();
        if (pt.prescription_id) linkedIds.add(pt.prescription_id);
        const { data: extraLinked } = await supabase
          .from("prescriptions")
          .select("id")
          .eq("payment_transaction_id", pt.id);
        for (const r of extraLinked || []) linkedIds.add(r.id);

        let needsHeal = false;
        for (const rxId of linkedIds) {
          const { data: rx } = await supabase
            .from("prescriptions")
            .select("status, payment_status, queue_id, submitted_to_pharmacy_at, tracking_number")
            .eq("id", rxId)
            .single();
          if (!rx) continue;
          const stuck = (
            !rx.queue_id &&
            !rx.submitted_to_pharmacy_at &&
            !rx.tracking_number &&
            (rx.payment_status !== "paid" || (rx.status || "").toLowerCase() === "pending_payment")
          );
          if (stuck) { needsHeal = true; break; }
        }

        if (!needsHeal) continue;

        diagnostics.push(`\nORPHAN HEAL: ${pt.patient_name} | ${pt.description} | payment ${pt.id} completed but rx never submitted`);
        await runPaymentSideEffects(supabase, pt, new Date().toISOString(), diagnostics);
        orphansHealed++;
      }
    } catch (orphanErr) {
      diagnostics.push(`Orphan healing error: ${orphanErr instanceof Error ? orphanErr.message : "Unknown"}`);
    }

    // TTL Recovery DISABLED (May 11 2026, Jessica Carroll incident).
    // Joseph rule: "cancell the expiration of all payment links across the
    // app". Time-based row expiration silently killed 41 valid payment
    // rows in 60 days while the email link still said valid (Jessica
    // Carroll, Moises Navarrete, Francesco Lascari, Jessica Demeo, Keith
    // Robinson, Sandra Santana, et al). Patients hit a 409 "another
    // payment pending" wall they could not get past.
    //
    // Payment links never expire. Rows only move to 'expired' through
    // explicit admin action (regenerate-link cleanup, refund, cancel).
    // The shipped variable is kept so the summary log shape doesn't break.
    const expired = 0;

    // Only emit a system_logs row when something actually happened.
    // Running every 60 seconds means 1,440 ticks/day; logging every
    // empty tick would drown the audit trail.
    if (updated > 0 || failed > 0 || expired > 0 || orphansHealed > 0) {
      await logDiagnostics(diagnostics, updated, failed);
      console.log(`[payment-reconcile] Done. Updated ${updated}/${stuckPayments.length}, failed ${failed}, expired ${expired}, orphansHealed ${orphansHealed}`);
    }
    await run.success(stuckPayments.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[payment-reconcile] Fatal error:", msg);
    diagnostics.push(`FATAL: ${msg}`);
    try {
      await logDiagnostics(diagnostics, 0, 0);
    } catch (_) {}
    await run.error(msg);
  } finally {
    isRunning = false;
  }
}

// Extracted May 7 2026 (Keith Robinson follow-up). Runs the prescription-
// side effects after a payment is known to be completed: builds the rx
// list (direct prescription_id, payment_transaction_id linkage, and
// order_group_id fan-out), updates each rx, calls submit-to-pharmacy,
// and writes the order_progress summary back. Called from BOTH the main
// pending->completed path AND the orphan-heal pass (so manual DB flips
// or crashed-mid-flow rows still get healed within 60 seconds).
type ReconciledPaymentTx = {
  id: string;
  prescription_id: string | null;
  patient_name: string | null;
  patient_email?: string | null;
  patient_phone?: string | null;
  provider_name?: string | null;
  pharmacy_name?: string | null;
  description: string | null;
  total_amount_cents?: number | null;
  authnet_transaction_id?: string | null;
  authnet_ref_id?: string | null;
};

async function runPaymentSideEffects(
  supabase: ReturnType<typeof createCronClient>,
  paymentTx: ReconciledPaymentTx,
  now: string,
  diagnostics: string[],
) {
  const prescriptionIdsToProcess: string[] = [];

  if (paymentTx.prescription_id) {
    prescriptionIdsToProcess.push(paymentTx.prescription_id);
  }

  const { data: linkedByTx } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("payment_transaction_id", paymentTx.id);

  if (linkedByTx) {
    for (const rx of linkedByTx) {
      if (!prescriptionIdsToProcess.includes(rx.id)) {
        prescriptionIdsToProcess.push(rx.id);
      }
    }
  }

  if (paymentTx.prescription_id) {
    const { data: primaryRx } = await supabase
      .from("prescriptions")
      .select("order_group_id")
      .eq("id", paymentTx.prescription_id)
      .single();

    if (primaryRx?.order_group_id) {
      const { data: groupRxs } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("order_group_id", primaryRx.order_group_id)
        .in("status", ["pending_payment", "pending", "payment_received"]);

      if (groupRxs) {
        for (const rx of groupRxs) {
          if (!prescriptionIdsToProcess.includes(rx.id)) {
            prescriptionIdsToProcess.push(rx.id);
          }
        }
      }

      diagnostics.push(`  Group found (${primaryRx.order_group_id}): processing ${prescriptionIdsToProcess.length} prescriptions`);
    }
  }

  if (prescriptionIdsToProcess.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const internalSecret = process.env.INTERNAL_API_SECRET || "";
  const submittedRxIds: string[] = [];
  const failedRxIds: string[] = [];

  for (const rxId of prescriptionIdsToProcess) {
    const { data: existingRx } = await supabase
      .from("prescriptions")
      .select("status, tracking_number, fedex_status, queue_id")
      .eq("id", rxId)
      .single();

    const rxStatus = (existingRx?.status || "").toLowerCase();
    const fedexStatus = (existingRx?.fedex_status || "").toLowerCase();
    const advancedStatuses = ["picked_up", "shipped", "in_transit", "delivered", "completed", "packed", "approved", "submitted"];
    const advancedFedexStatuses = ["delivered", "in transit", "in_transit", "out for delivery", "out_for_delivery"];

    const alreadyAdvanced = existingRx && (
      existingRx.tracking_number ||
      existingRx.queue_id ||
      advancedStatuses.includes(rxStatus) ||
      advancedFedexStatuses.includes(fedexStatus)
    );

    if (alreadyAdvanced) {
      diagnostics.push(`  SKIP prescription ${rxId} update — already at status: ${existingRx.status}, tracking: ${existingRx.tracking_number || "none"}, fedex: ${existingRx.fedex_status || "none"}`);
      const { error: payOnlyError } = await supabase
        .from("prescriptions")
        .update({ payment_status: "paid", updated_at: now })
        .eq("id", rxId);
      if (payOnlyError) {
        diagnostics.push(`  WARN: payment_status update failed for ${rxId}: ${payOnlyError.message}`);
      }

      if (existingRx.queue_id && !existingRx.tracking_number && !["delivered", "picked_up"].includes(rxStatus)) {
        try {
          await notifyPharmacyPaymentConfirmed(
            supabase,
            rxId,
            existingRx.queue_id,
            paymentTx.patient_name || "Patient",
            paymentTx.description || "",
            diagnostics,
          );
        } catch (notifyErr) {
          diagnostics.push(`  WARN: Pharmacy notification error for ${rxId}: ${notifyErr instanceof Error ? notifyErr.message : "Unknown"}`);
        }
      }
      submittedRxIds.push(rxId);
    } else {
      const { error: rxError } = await supabase
        .from("prescriptions")
        .update({
          payment_status: "paid",
          status: "payment_received",
          payment_transaction_id: paymentTx.id,
          updated_at: now,
        })
        .eq("id", rxId);

      if (rxError) {
        diagnostics.push(`  WARN: Payment updated but prescription ${rxId} update failed: ${rxError.message}`);
      } else {
        diagnostics.push(`  Prescription ${rxId} → payment_received (linked to tx ${paymentTx.id})`);
      }

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

        if (submitResponse.ok) {
          diagnostics.push(`  Auto-submitted to pharmacy for ${rxId}`);
          submittedRxIds.push(rxId);
        } else {
          const errorBody = await submitResponse.text().catch(() => "unable to read");
          diagnostics.push(`  WARN: Pharmacy submission failed for ${rxId}: HTTP ${submitResponse.status} — ${errorBody}`);
          failedRxIds.push(rxId);
        }
      } catch (err) {
        diagnostics.push(`  WARN: Pharmacy submission error for ${rxId}: ${err instanceof Error ? err.message : "Unknown"}`);
        failedRxIds.push(rxId);
      }
    }
  }

  // Patient-facing confirmation email + SMS. Mirrors verify-and-complete
  // so the sweeper-driven path is indistinguishable from a webhook-driven
  // confirmation. Without this, orphan-healed payments (Keith Robinson
  // incident, May 7 2026) would silently complete behind the patient's
  // back. The send-confirmation-email endpoint is internally idempotent
  // (checkEmailDedup keyed on transactionId) so re-runs are safe.
  if (paymentTx.patient_email && submittedRxIds.length > 0) {
    try {
      let medications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
      let oversightCents = 0;
      const { data: medDetails } = await supabase
        .from("prescriptions")
        .select("medication, patient_price, shipping_fee_cents, profit_cents")
        .in("id", prescriptionIdsToProcess);
      if (medDetails && medDetails.length > 0) {
        medications = medDetails.map(m => ({
          name: m.medication || "Medication",
          price: m.patient_price ? parseFloat(m.patient_price).toFixed(2) : undefined,
          shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
        }));
        oversightCents = medDetails.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
      }

      const internalApiKey = process.env.INTERNAL_API_KEY || "";
      const totalAmountStr = paymentTx.total_amount_cents != null
        ? (paymentTx.total_amount_cents / 100).toFixed(2)
        : "0.00";
      const txIdForEmail = paymentTx.authnet_transaction_id || paymentTx.authnet_ref_id || paymentTx.id;

      const emailRes = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        body: JSON.stringify({
          patientEmail: paymentTx.patient_email,
          patientPhone: paymentTx.patient_phone || undefined,
          patientName: paymentTx.patient_name,
          providerName: paymentTx.provider_name,
          medication: paymentTx.description,
          ...(medications.length > 0 ? { medications } : {}),
          ...(oversightCents > 0 ? { oversightFee: (oversightCents / 100).toFixed(2) } : {}),
          totalAmount: totalAmountStr,
          transactionId: txIdForEmail,
          pharmacyName: paymentTx.pharmacy_name,
        }),
      });

      if (emailRes.ok) {
        diagnostics.push(`  PATIENT NOTIFIED: confirmation email queued for ${paymentTx.patient_email} (tx ${txIdForEmail})`);
      } else {
        const errBody = await emailRes.text().catch(() => "unable to read");
        diagnostics.push(`  WARN: patient confirmation email failed: HTTP ${emailRes.status} — ${errBody.slice(0, 200)}`);
      }
    } catch (err) {
      diagnostics.push(`  WARN: patient confirmation email error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  } else if (!paymentTx.patient_email && submittedRxIds.length > 0) {
    diagnostics.push(`  SKIP patient confirmation — no patient_email on payment ${paymentTx.id}`);
  }

  const progressNote = failedRxIds.length > 0
    ? `Partial pharmacy submission: ${submittedRxIds.length}/${prescriptionIdsToProcess.length} succeeded. Failed: ${failedRxIds.join(", ")}`
    : undefined;

  await supabase
    .from("payment_transactions")
    .update({
      order_progress: failedRxIds.length === prescriptionIdsToProcess.length
        ? "pharmacy_submission_failed"
        : failedRxIds.length > 0
          ? "pharmacy_partial_failure"
          : "pharmacy_processing",
      ...(progressNote ? { notes: progressNote } : {}),
    })
    .eq("id", paymentTx.id);
}

async function logDiagnostics(
  diagnostics: string[],
  updated: number,
  failed: number,
) {
  const supabase = createCronClient();
  const details = diagnostics.join("\n");
  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "Payment Reconcile",
    action: "CRON_PAYMENT_RECONCILE",
    details: details.slice(0, 4000),
    status: failed > 0 ? "error" : updated > 0 ? "success" : "info",
  });
}

async function notifyPharmacyPaymentConfirmed(
  supabase: ReturnType<typeof createCronClient>,
  prescriptionId: string,
  queueId: string,
  patientName: string,
  description: string,
  diagnostics: string[],
) {
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("pharmacy_id, medication, dosage, quantity")
    .eq("id", prescriptionId)
    .single();

  if (!rx?.pharmacy_id) {
    diagnostics.push(`  SKIP pharmacy notification — no pharmacy linked`);
    return;
  }

  const pharmacyEmails: Record<string, string> = {
    "59623278-013e-407f-96af-b164144bdbc7": "ley@greenwichrx.org",
  };

  const pharmacyEmail = pharmacyEmails[rx.pharmacy_id];
  if (!pharmacyEmail) {
    diagnostics.push(`  SKIP pharmacy notification — no contact email for pharmacy ${rx.pharmacy_id}`);
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const internalApiKey = process.env.INTERNAL_API_KEY || "";

  const emailBody = {
    to: pharmacyEmail,
    subject: `Payment Confirmed — Order #${queueId} — ${patientName}`,
    text: [
      `Hello,`,
      ``,
      `This is an automated notification from AIM Rx.`,
      ``,
      `Payment has been confirmed for the following order that was previously placed on hold:`,
      ``,
      `Order #: ${queueId}`,
      `Patient: ${patientName}`,
      `Medication: ${rx.medication || description}`,
      `Quantity: ${rx.quantity || 1}`,
      ``,
      `Please proceed with processing this order.`,
      ``,
      `Thank you,`,
      `AIM Rx Automated System`,
    ].join("\n"),
  };

  try {
    const sgApiKey = process.env.SENDGRID_API_KEY;
    if (!sgApiKey) {
      diagnostics.push(`  SKIP pharmacy notification — SendGrid not configured`);
      return;
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
    const fromName = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";

    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sgApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: pharmacyEmail }] }],
        from: { email: fromEmail, name: fromName },
        subject: emailBody.subject,
        content: [
          { type: "text/plain", value: emailBody.text },
          {
            type: "text/html",
            value: `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="padding: 30px 40px 15px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
          <h1 style="margin: 0; color: #fff; font-size: 24px;">Payment Confirmed</h1>
        </td></tr>
        <tr><td style="padding: 30px 40px;">
          <p style="font-size: 16px; color: #333;">Hello,</p>
          <p style="font-size: 16px; color: #333;">Payment has been confirmed for the following order that was previously placed on hold. <strong>Please proceed with processing.</strong></p>
          <table width="100%" style="margin: 20px 0; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #10B981;">
            <tr><td style="padding: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Order #:</p>
              <p style="margin: 0 0 15px; font-size: 18px; font-weight: 700; color: #333;">${queueId}</p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Patient:</p>
              <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #1E3A8A;">${patientName}</p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Medication:</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">${rx.medication || description}</p>
            </td></tr>
          </table>
          <p style="font-size: 14px; color: #666;">This is an automated notification from AIM Rx.</p>
        </td></tr>
        <tr><td style="padding: 20px 40px; background: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} AIM Medical Technologies</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
          },
        ],
      }),
    });

    if (sgResponse.ok || sgResponse.status === 202) {
      diagnostics.push(`  PHARMACY NOTIFIED: Sent payment confirmation email to ${pharmacyEmail} for Order #${queueId}`);

      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "system@aimrx.com",
        user_name: "Payment Reconcile",
        action: "PHARMACY_PAYMENT_NOTIFICATION",
        details: `Auto-emailed ${pharmacyEmail}: Payment confirmed for Order #${queueId}, patient ${patientName}, medication ${rx.medication || description}`,
        status: "success",
      });
    } else {
      const errText = await sgResponse.text().catch(() => "unable to read");
      diagnostics.push(`  WARN: Pharmacy email failed: HTTP ${sgResponse.status} — ${errText}`);
    }
  } catch (err) {
    diagnostics.push(`  WARN: Pharmacy email error: ${err instanceof Error ? err.message : "Unknown"}`);
  }
}
