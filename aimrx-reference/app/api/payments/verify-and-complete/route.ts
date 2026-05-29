import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { STALE_PROCESSING_MS } from "@/app/api/payments/_lib/constants";

const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

interface AuthnetTransaction {
  transId: string;
  invoiceNumber?: string;
  amount?: number;
  accountNumber?: string;
  accountType?: string;
}

function extractTransactions(data: Record<string, unknown>): AuthnetTransaction[] {
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

function extractBatchList(data: Record<string, unknown>): Array<{ batchId: string }> {
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

function getResultCode(data: Record<string, unknown>): string {
  if (data.messages && typeof data.messages === "object") {
    return (data.messages as Record<string, unknown>).resultCode as string || "";
  }
  const inner = Object.values(data).find(v => typeof v === "object" && v !== null && "messages" in (v as object));
  if (inner) {
    return ((inner as Record<string, unknown>).messages as Record<string, unknown>)?.resultCode as string || "";
  }
  return "";
}

type FindResult = {
  transaction: AuthnetTransaction | null;
  // True ONLY when we have a positive answer from Authorize.Net
  // (Ok response on either the unsettled or the settled lookup, with a
  // clean walk through their batches). False means we could not get a
  // trustworthy "no match" — the gateway might be down, throttling, or
  // returning errors, so we MUST NOT treat this as proof the charge
  // never happened. The caller distinguishes these two outcomes when
  // deciding what to write back to the row.
  searchedSuccessfully: boolean;
  gatewayErrorMessage: string | null;
};

async function findTransactionByInvoice(
  apiUrl: string,
  loginId: string,
  transactionKey: string,
  invoiceNumber: string,
): Promise<FindResult> {
  const merchantAuthentication = { name: loginId, transactionKey };
  let unsettledOk = false;
  let settledOk = false;
  let gatewayErrorMessage: string | null = null;

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

    console.log(`[VERIFY] Unsettled list: resultCode=${resultCode}, txnCount=${txns.length}`);

    if (resultCode === "Ok") {
      unsettledOk = true;
      if (txns.length > 0) {
        const match = txns.find((t) => t.invoiceNumber === invoiceNumber);
        if (match) {
          return {
            transaction: match,
            searchedSuccessfully: true,
            gatewayErrorMessage: null,
          };
        }
      }
    } else {
      gatewayErrorMessage =
        (unsettledData.messages?.message?.[0]?.text as string) ||
        "Unsettled lookup returned non-Ok";
    }
  } catch (err) {
    gatewayErrorMessage = err instanceof Error ? err.message : "Unknown";
    console.error(
      "[VERIFY] Unsettled list fetch error:",
      gatewayErrorMessage,
    );
  }

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

    console.log(`[VERIFY] Settled batches: resultCode=${batchResultCode}, batchCount=${batches.length}`);

    if (batchResultCode === "Ok") {
      settledOk = true;
      if (batches.length === 0) {
        // Confirmed no settled batches — clean negative.
        return {
          transaction: null,
          searchedSuccessfully: unsettledOk || settledOk,
          gatewayErrorMessage: null,
        };
      }
      let allBatchListsOk = true;
      for (const batch of batches) {
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

        if (listResultCode !== "Ok") {
          allBatchListsOk = false;
          gatewayErrorMessage =
            (listData.messages?.message?.[0]?.text as string) ||
            `Batch ${batch.batchId} returned non-Ok`;
          continue;
        }

        if (batchTxns.length > 0) {
          const match = batchTxns.find((t) => t.invoiceNumber === invoiceNumber);
          if (match) {
            return {
              transaction: match,
              searchedSuccessfully: true,
              gatewayErrorMessage: null,
            };
          }
        }
      }

      // We walked all batches successfully without a match.
      return {
        transaction: null,
        searchedSuccessfully: allBatchListsOk,
        gatewayErrorMessage: allBatchListsOk ? null : gatewayErrorMessage,
      };
    } else {
      gatewayErrorMessage =
        (batchData.messages?.message?.[0]?.text as string) ||
        "Settled batch lookup returned non-Ok";
    }
  } catch (err) {
    gatewayErrorMessage = err instanceof Error ? err.message : "Unknown";
    console.error("[VERIFY] Settled batch search error:", gatewayErrorMessage);
  }

  // If unsettled succeeded with zero matches AND settled errored, we
  // still have partial trust (a same-day charge would appear in
  // unsettled). Treat that as a clean negative; otherwise return
  // searchedSuccessfully=false so the caller does NOT mark the row
  // expired or pending.
  return {
    transaction: null,
    searchedSuccessfully: unsettledOk && !settledOk
      ? true
      : (unsettledOk || settledOk),
    gatewayErrorMessage,
  };
}

export async function POST(request: NextRequest) {
  const supabaseOuter = createAdminClient();
  let claimedTransactionId: string | null = null;

  try {
    const body = await request.json();
    const { paymentToken } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", paymentToken)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Payment transaction not found" },
        { status: 404 },
      );
    }

    if (transaction.payment_status === "completed") {
      const retryRxIds: string[] = [];

      const allLinkedIds: string[] = [];
      if (transaction.prescription_id) {
        allLinkedIds.push(transaction.prescription_id);
      }
      const { data: linkedRetryRxs } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("payment_transaction_id", transaction.id);
      if (linkedRetryRxs) {
        for (const rx of linkedRetryRxs) {
          if (!allLinkedIds.includes(rx.id)) allLinkedIds.push(rx.id);
        }
      }

      for (const rxId of allLinkedIds) {
        const { data: rx } = await supabase
          .from("prescriptions")
          .select("queue_id")
          .eq("id", rxId)
          .single();
        if (!rx?.queue_id) retryRxIds.push(rxId);
      }

      if (retryRxIds.length > 0) {
        let pharmacySubmitted = false;
        let pharmacyError: string | null = null;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const internalSecret = process.env.INTERNAL_API_SECRET || "";

        for (const rxId of retryRxIds) {
          try {
            console.log(`[VERIFY] Retrying pharmacy submission for ${rxId}...`);
            const submitResponse = await fetch(
              `${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
              },
            );
            if (submitResponse.ok) {
              pharmacySubmitted = true;
              await supabase.from("payment_transactions").update({ order_progress: "pharmacy_processing" }).eq("id", transaction.id);
            } else {
              const errorBody = await submitResponse.text().catch(() => "");
              pharmacyError = `Pharmacy retry failed for ${rxId}: HTTP ${submitResponse.status}`;
              console.error(`[VERIFY] ${pharmacyError} — ${errorBody}`);
            }
          } catch (err) {
            pharmacyError = `Pharmacy retry error for ${rxId}: ${err instanceof Error ? err.message : "Unknown"}`;
            console.error(`[VERIFY] ${pharmacyError}`);
          }
        }

        return NextResponse.json({
          success: true,
          alreadyCompleted: true,
          message: "Payment already completed",
          pharmacySubmitted,
          pharmacyRetried: true,
          ...(pharmacyError && { pharmacyWarning: pharmacyError }),
        });
      }

      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        message: "Payment already completed",
        pharmacySubmitted: true,
      });
    }

    if (!transaction.authnet_ref_id) {
      return NextResponse.json({
        success: false,
        error: "No reference ID to verify",
      });
    }

    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_TRANSACTION_KEY) {
      console.error("[VERIFY] Authorize.net credentials not configured");
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 },
      );
    }

    if (transaction.payment_status === "pending") {
      const { data: claimedRows } = await supabase
        .from("payment_transactions")
        .update({ payment_status: "processing", updated_at: new Date().toISOString() })
        .eq("id", transaction.id)
        .eq("payment_status", "pending")
        .select("id");

      if (!claimedRows || claimedRows.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Payment is already being processed or completed",
          pending: true,
        });
      }
    }

    claimedTransactionId = transaction.id;

    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];

    const findResult = await findTransactionByInvoice(
      apiUrl,
      envConfig.AUTHNET_API_LOGIN_ID,
      envConfig.AUTHNET_TRANSACTION_KEY,
      transaction.authnet_ref_id,
    );
    const matchedTransaction = findResult.transaction;

    if (!matchedTransaction) {
      console.log(
        `[VERIFY] No matching transaction found for ref ${transaction.authnet_ref_id} (searchedSuccessfully=${findResult.searchedSuccessfully})`,
      );

      // Decision tree for the "no match" outcome. Pre-incident this branch
      // unconditionally re-wrote payment_status='processing' for any row
      // that started this verify cycle in 'processing' — that is what
      // perpetuated the stuck-processing rows in the Apr 22-23 incident.
      //
      // Branches:
      //   (a) Gateway lookup itself failed (network, non-Ok, missing
      //       batches we couldn't enumerate). We do NOT know whether a
      //       charge happened. Leave the row as-is, write a verify_required_at
      //       breadcrumb so the janitor will retry, and return a code the
      //       caller can surface for manual reconciliation. NEVER expire
      //       in this branch.
      //   (b) Lookup succeeded and we have proof the charge is not at
      //       the gateway, AND the row's processing claim is RECENT
      //       (within STALE_PROCESSING_MS). Roll the row back to
      //       'pending' so the patient can retry — pre-incident we'd
      //       have left it stuck.
      //   (c) Lookup succeeded with no match AND the row's processing
      //       claim is OLD (beyond STALE_PROCESSING_MS). The patient
      //       has effectively walked away; mark the row 'expired' with
      //       a reconciliation_note so the janitor and runbook can see
      //       this row was decided here.
      const now = new Date().toISOString();

      if (!findResult.searchedSuccessfully) {
        await supabase
          .from("payment_transactions")
          .update({
            verify_required_at: now,
            last_gateway_error_code: "GATEWAY_VERIFY_FAILED",
            last_gateway_error_at: now,
            updated_at: now,
          })
          .eq("id", transaction.id);
        return NextResponse.json({
          success: false,
          error:
            findResult.gatewayErrorMessage ||
            "Could not reach payment gateway to verify status. Will retry automatically.",
          code: "GATEWAY_VERIFY_FAILED",
          pending: true,
        });
      }

      const startedFromProcessing = transaction.payment_status === "processing";
      const ageMs = transaction.updated_at
        ? Date.now() - new Date(transaction.updated_at).getTime()
        : 0;
      const isOldProcessing =
        startedFromProcessing && ageMs > STALE_PROCESSING_MS;

      if (isOldProcessing) {
        // CAS guard (Phase 3d hotfix): only flip to 'expired' if the row
        // is STILL 'processing'. A webhook (refund / void / late capture)
        // that landed between the SELECT at line ~247 and this UPDATE
        // would otherwise be clobbered, re-opening a terminal row to
        // potentially issue another hosted token / capture.
        await supabase
          .from("payment_transactions")
          .update({
            payment_status: "expired",
            reconciliation_note: "verify_no_match_expired",
            updated_at: now,
          })
          .eq("id", transaction.id)
          .eq("payment_status", "processing");
        return NextResponse.json({
          success: false,
          error:
            "Payment was not found at processor and the attempt has expired.",
          code: "EXPIRED_NO_MATCH",
        });
      }

      // Recent processing → safe to roll back to pending so the patient
      // can retry without staff intervention.
      // CAS guard (Phase 3d hotfix): only revert if STILL 'processing'.
      // Without this, a webhook that landed during the verify (e.g. the
      // capture webhook fired while we were querying Authnet) could be
      // clobbered back to 'pending', re-opening the row for a new
      // hosted token and a duplicate capture.
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "pending",
          updated_at: now,
        })
        .eq("id", transaction.id)
        .eq("payment_status", "processing");
      claimedTransactionId = null;
      return NextResponse.json({
        success: false,
        error: "Payment not found at processor — may still be processing",
        pending: true,
      });
    }

    if (matchedTransaction.amount !== undefined) {
      const expectedAmount = transaction.total_amount_cents / 100;
      const diff = Math.abs(matchedTransaction.amount - expectedAmount);
      if (diff > 0.01) {
        console.error(
          `[VERIFY] Amount mismatch: expected $${expectedAmount}, got $${matchedTransaction.amount}`,
        );
        // CAS guard (Phase 3d hotfix): only revert to 'pending' if the
        // row is STILL 'processing'. If a webhook (refund/void/late
        // capture) raced us to terminal during the gateway lookup, do
        // NOT clobber it back to pending — that re-opens the row for a
        // brand-new hosted token / capture, the exact double-charge
        // primitive we are closing.
        await supabase
          .from("payment_transactions")
          .update({ payment_status: "pending", updated_at: new Date().toISOString() })
          .eq("id", transaction.id)
          .eq("payment_status", "processing");
        return NextResponse.json(
          { success: false, error: "Payment amount mismatch" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const cardLastFour = matchedTransaction.accountNumber?.slice(-4);

    // CAS guard on the finalize transition — mirrors the webhook handler's
    // hardening. Only flip to 'completed' if the row is in a recoverable
    // state. Closes three failure modes:
    //   1. Webhook + verify race — only one wins, only one fires side-effects.
    //   2. Late/stray verify call (e.g. a stale success-page tab kept open
    //      across a refund) cannot resurrect a terminal row to 'completed'.
    //   3. The row's status drifted between SELECT (line ~248) and UPDATE.
    // Allowlist matches JANITOR_RECOVERABLE_STATUSES used by the cron jobs
    // and the webhook CAS so the system has one consistent definition of
    // "safe to mark completed".
    const { data: casVerifyRows, error: updateTxError } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "completed",
        order_progress: "payment_received",
        authnet_transaction_id: matchedTransaction.transId,
        card_last_four: cardLastFour,
        card_type: matchedTransaction.accountType,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", transaction.id)
      .in("payment_status", ["pending", "processing", "expired"])
      .select("id");

    claimedTransactionId = null;

    if (updateTxError) {
      console.error("[VERIFY] Failed to update payment transaction:", updateTxError.message);
      return NextResponse.json(
        { success: false, error: "Failed to update payment record" },
        { status: 500 },
      );
    }

    if (!casVerifyRows || casVerifyRows.length === 0) {
      // Lost the race to the webhook OR row drifted to a terminal state
      // (refunded/voided/cancelled) since we read it. Don't fire side-effects;
      // whoever won the CAS will (or already did) handle pharmacy + email.
      // Return success so the success-page polling loop stops.
      console.log(`[VERIFY] CAS lost for ${transaction.id} — webhook may have raced us, or row is in a terminal state. Skipping pharmacy + email side-effects to prevent duplicates.`);
      return NextResponse.json({
        success: true,
        status: "completed",
        transactionId: matchedTransaction.transId,
        casLost: true,
      });
    }

    let prescriptionUpdated = false;
    let pharmacySubmitted = false;
    let pharmacyError: string | null = null;

    const prescriptionIdsToProcess: string[] = [];

    if (transaction.prescription_id) {
      prescriptionIdsToProcess.push(transaction.prescription_id);
    }

    const { data: linkedVerifyRxs } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", transaction.id);

    if (linkedVerifyRxs) {
      for (const rx of linkedVerifyRxs) {
        if (!prescriptionIdsToProcess.includes(rx.id)) {
          prescriptionIdsToProcess.push(rx.id);
        }
      }
    }

    if (transaction.prescription_id) {
      const { data: primaryRx } = await supabase
        .from("prescriptions")
        .select("order_group_id")
        .eq("id", transaction.prescription_id)
        .single();

      // INTEGRITY FIX (Greenwich/Rahmany incident, May 2026): do NOT fan out
      // by order_group_id. Mark paid ONLY prescriptions linked via
      // payment_transaction_id or transaction.prescription_id. Server-side
      // guard in /api/payments/generate-link prevents partial-group bills.
      void primaryRx;
    }

    if (prescriptionIdsToProcess.length > 0) {
      for (const rxId of prescriptionIdsToProcess) {
        const { error: rxError } = await supabase
          .from("prescriptions")
          .update({
            payment_status: "paid",
            status: "payment_received",
            order_progress: "payment_received",
            updated_at: now,
          })
          .eq("id", rxId);

        if (rxError) {
          console.error(`[VERIFY] Failed to update prescription ${rxId}:`, rxError.message);
        }
      }

      prescriptionUpdated = true;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "";
      let allSubmitted = true;
      const pharmacyErrors: string[] = [];

      for (const rxId of prescriptionIdsToProcess) {
        try {
          console.log(`[VERIFY] Auto-submitting prescription ${rxId} to pharmacy...`);
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
            const submitData = await submitResponse.json();
            console.log(`[VERIFY] Prescription ${rxId} submitted to pharmacy:`, submitData);
          } else {
            const errorBody = await submitResponse.text().catch(() => "unable to read");
            console.error(`[VERIFY] Pharmacy submission failed for ${rxId}: HTTP ${submitResponse.status} — ${errorBody}`);
            pharmacyErrors.push(`${rxId}: HTTP ${submitResponse.status}`);
            allSubmitted = false;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown";
          console.error(`[VERIFY] Pharmacy submission error for ${rxId}:`, msg);
          pharmacyErrors.push(`${rxId}: ${msg}`);
          allSubmitted = false;
        }
      }

      pharmacySubmitted = allSubmitted || pharmacyErrors.length < prescriptionIdsToProcess.length;
      if (pharmacyErrors.length > 0) {
        pharmacyError = `Pharmacy submission issues: ${pharmacyErrors.join("; ")}`;
      }

      const totalRx = prescriptionIdsToProcess.length;
      const succeededCount = totalRx - pharmacyErrors.length;
      const progressNote = pharmacyErrors.length > 0
        ? `Partial pharmacy submission: ${succeededCount}/${totalRx} succeeded. Failed: ${pharmacyErrors.join("; ")}`
        : undefined;

      await supabase
        .from("payment_transactions")
        .update({
          order_progress: pharmacyErrors.length === totalRx
            ? "pharmacy_submission_failed"
            : pharmacyErrors.length > 0
              ? "pharmacy_partial_failure"
              : "pharmacy_processing",
          ...(progressNote ? { notes: progressNote } : {}),
        })
        .eq("id", transaction.id);
    }

    if (transaction.patient_email && transaction.send_receipt_to_patient !== false) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        let verifyMedications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
        let verifyOversightCents = 0;
        if (prescriptionIdsToProcess.length > 0) {
          const { data: medDetails } = await supabase
            .from("prescriptions")
            .select("medication, patient_price, shipping_fee_cents, profit_cents")
            .in("id", prescriptionIdsToProcess);
          if (medDetails && medDetails.length > 0) {
            verifyMedications = medDetails.map(m => ({
              name: m.medication || "Medication",
              price: m.patient_price ? parseFloat(m.patient_price).toFixed(2) : undefined,
              shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
            }));
            verifyOversightCents = medDetails.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
          }
        }

        await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "verify-auto-email",
          },
          body: JSON.stringify({
            patientEmail: transaction.patient_email,
            patientPhone: transaction.patient_phone || undefined,
            patientName: transaction.patient_name,
            providerName: transaction.provider_name,
            medication: transaction.description,
            ...(verifyMedications.length > 0 ? { medications: verifyMedications } : {}),
            ...(verifyOversightCents > 0 ? { oversightFee: (verifyOversightCents / 100).toFixed(2) } : {}),
            totalAmount: (transaction.total_amount_cents / 100).toFixed(2),
            transactionId: matchedTransaction.transId,
            pharmacyName: transaction.pharmacy_name,
          }),
        });
      } catch (err) {
        console.error("[VERIFY] Email error:", err instanceof Error ? err.message : "Unknown");
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and completed",
      transactionId: matchedTransaction.transId,
      prescriptionUpdated,
      pharmacySubmitted,
      ...(pharmacyError && { pharmacyWarning: pharmacyError }),
    });
  } catch (error) {
    console.error("[VERIFY] Error:", error instanceof Error ? error.message : "Unknown");

    if (claimedTransactionId) {
      try {
        // CAS guard (Phase 3d hotfix — CRITICAL).
        // Without `.eq("payment_status", "processing")` this catch-block
        // can silently downgrade a row that was already finalized to
        // 'completed' (or 'refunded' / 'voided' / 'cancelled') by a
        // webhook that landed during this verify call. That regression
        // re-opens the row to issue a fresh hosted token, which is a
        // direct duplicate-charge primitive — exactly the multi-capture
        // pattern observed in the Apr 25 incident.
        await supabaseOuter
          .from("payment_transactions")
          .update({ payment_status: "pending", updated_at: new Date().toISOString() })
          .eq("id", claimedTransactionId)
          .eq("payment_status", "processing");
      } catch (revertErr) {
        console.error("[VERIFY] CRITICAL: Failed to revert processing status:", revertErr instanceof Error ? revertErr.message : "Unknown");
      }
    }

    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}
