import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";

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

async function findTransactionByInvoice(
  apiUrl: string,
  loginId: string,
  transactionKey: string,
  invoiceNumber: string,
): Promise<AuthnetTransaction | null> {
  const merchantAuthentication = { name: loginId, transactionKey };

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

    if (resultCode === "Ok" && txns.length > 0) {
      const match = txns.find((t) => t.invoiceNumber === invoiceNumber);
      if (match) return match;
    }
  } catch (err) {
    console.error("[VERIFY] Unsettled list fetch error:", err instanceof Error ? err.message : "Unknown");
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

    if (batchResultCode !== "Ok" || batches.length === 0) {
      console.log("[VERIFY] No settled batches found:", batchData.messages?.message?.[0]?.text);
      return null;
    }

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

      if (listResultCode === "Ok" && batchTxns.length > 0) {
        const match = batchTxns.find((t) => t.invoiceNumber === invoiceNumber);
        if (match) return match;
      }
    }
  } catch (err) {
    console.error("[VERIFY] Settled batch search error:", err instanceof Error ? err.message : "Unknown");
  }

  return null;
}

export async function POST(request: NextRequest) {
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
      if (transaction.prescription_id) {
        const { data: rx } = await supabase
          .from("prescriptions")
          .select("queue_id, status")
          .eq("id", transaction.prescription_id)
          .single();

        if (!rx?.queue_id) {
          console.log(`[VERIFY] Payment completed but NO queue_id for prescription ${transaction.prescription_id} — retrying pharmacy submission...`);

          let pharmacySubmitted = false;
          let pharmacyError: string | null = null;
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
            const internalSecret = process.env.INTERNAL_API_SECRET || "";
            const submitResponse = await fetch(
              `${siteUrl}/api/prescriptions/${transaction.prescription_id}/submit-to-pharmacy`,
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
              console.log(`[VERIFY] Retry pharmacy submission succeeded:`, submitData);
              pharmacySubmitted = true;
              await supabase
                .from("payment_transactions")
                .update({ order_progress: "pharmacy_processing" })
                .eq("id", transaction.id);
            } else {
              const errorBody = await submitResponse.text().catch(() => "unable to read");
              console.error(`[VERIFY] Retry pharmacy submission failed: HTTP ${submitResponse.status} — ${errorBody}`);
              pharmacyError = `Pharmacy submission failed (HTTP ${submitResponse.status})`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown";
            console.error("[VERIFY] Retry pharmacy submission error:", msg);
            pharmacyError = `Pharmacy submission error: ${msg}`;
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

    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];

    const matchedTransaction = await findTransactionByInvoice(
      apiUrl,
      envConfig.AUTHNET_API_LOGIN_ID,
      envConfig.AUTHNET_TRANSACTION_KEY,
      transaction.authnet_ref_id,
    );

    if (!matchedTransaction) {
      console.log(
        `[VERIFY] No matching transaction found for ref ${transaction.authnet_ref_id}`,
      );
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
        return NextResponse.json(
          { success: false, error: "Payment amount mismatch" },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const cardLastFour = matchedTransaction.accountNumber?.slice(-4);

    const { error: updateTxError } = await supabase
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
      .eq("id", transaction.id);

    if (updateTxError) {
      console.error("[VERIFY] Failed to update payment transaction:", updateTxError.message);
      return NextResponse.json(
        { success: false, error: "Failed to update payment record" },
        { status: 500 },
      );
    }

    let prescriptionUpdated = false;
    let pharmacySubmitted = false;
    let pharmacyError: string | null = null;

    if (transaction.prescription_id) {
      const { error: rxError } = await supabase
        .from("prescriptions")
        .update({
          payment_status: "paid",
          order_progress: "payment_received",
          status: "payment_received",
          updated_at: now,
        })
        .eq("id", transaction.prescription_id);

      if (rxError) {
        console.error("[VERIFY] Failed to update prescription:", rxError.message);
        return NextResponse.json({
          success: false,
          error: "Payment verified but failed to update prescription. Contact support.",
          transactionId: matchedTransaction.transId,
        }, { status: 500 });
      }

      prescriptionUpdated = true;

      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const internalSecret = process.env.INTERNAL_API_SECRET || "";

        console.log(`[VERIFY] Auto-submitting prescription ${transaction.prescription_id} to pharmacy...`);
        const submitResponse = await fetch(
          `${siteUrl}/api/prescriptions/${transaction.prescription_id}/submit-to-pharmacy`,
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
          console.log(`[VERIFY] Prescription submitted to pharmacy successfully:`, submitData);
          pharmacySubmitted = true;

          await supabase
            .from("payment_transactions")
            .update({ order_progress: "pharmacy_processing" })
            .eq("id", transaction.id);
        } else {
          const errorBody = await submitResponse.text().catch(() => "unable to read");
          console.error(`[VERIFY] Pharmacy submission failed: HTTP ${submitResponse.status} — ${errorBody}`);
          pharmacyError = `Pharmacy submission failed (HTTP ${submitResponse.status})`;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        console.error("[VERIFY] Pharmacy submission error:", msg);
        pharmacyError = `Pharmacy submission error: ${msg}`;
      }
    }

    if (transaction.patient_email) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "verify-auto-email",
          },
          body: JSON.stringify({
            patientEmail: transaction.patient_email,
            patientName: transaction.patient_name,
            providerName: transaction.provider_name,
            medication: transaction.description,
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
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}
