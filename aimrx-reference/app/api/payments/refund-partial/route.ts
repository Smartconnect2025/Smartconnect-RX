import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getUser } from "@/core/auth/get-user";

const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY);

    let isAdmin = false;
    let userId: string | null = null;

    if (isInternalCall) {
      isAdmin = true;
    } else {
      const { user, userRole } = await getUser();
      if (!user || (userRole !== "admin" && userRole !== "provider" && userRole !== "super_admin")) {
        return NextResponse.json(
          { success: false, error: "Unauthorized — admin or provider role required" },
          { status: 403 }
        );
      }
      userId = user.id;
      isAdmin = userRole === "admin" || userRole === "super_admin";
    }

    const body = await request.json();
    const { transactionId, prescriptionId, refundAmountCents, reason } = body;

    if (!transactionId || !prescriptionId || !refundAmountCents) {
      return NextResponse.json(
        { success: false, error: "transactionId, prescriptionId, and refundAmountCents are required" },
        { status: 400 }
      );
    }

    if (typeof refundAmountCents !== "number" || refundAmountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "Refund amount must be a positive number" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Payment transaction not found" },
        { status: 404 }
      );
    }

    if (!isAdmin && userId) {
      const { data: provider } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!provider || transaction.provider_id !== provider.id) {
        return NextResponse.json(
          { success: false, error: "You do not have permission to refund this transaction" },
          { status: 403 }
        );
      }
    }

    if (transaction.payment_status !== "completed" && transaction.payment_status !== "partially_refunded") {
      return NextResponse.json(
        { success: false, error: `Cannot refund a transaction with status: ${transaction.payment_status}` },
        { status: 400 }
      );
    }

    if (!transaction.authnet_transaction_id) {
      return NextResponse.json(
        { success: false, error: "No Authorize.Net transaction ID found for refund" },
        { status: 400 }
      );
    }

    const { data: prescription, error: rxError } = await supabase
      .from("prescriptions")
      .select("id, medication, status, payment_transaction_id, payment_status")
      .eq("id", prescriptionId)
      .single();

    if (rxError || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.payment_status === "refunded" || prescription.payment_status === "rejected_refunded") {
      return NextResponse.json(
        { success: true, message: "Prescription already refunded — no action taken", alreadyRefunded: true },
        { status: 200 }
      );
    }

    const belongsToTransaction =
      prescription.payment_transaction_id === transactionId;

    if (!belongsToTransaction) {
      return NextResponse.json(
        { success: false, error: "Prescription does not belong to this payment transaction" },
        { status: 400 }
      );
    }

    const { data: freshTx } = await supabase
      .from("payment_transactions")
      .select("refund_amount_cents, total_amount_cents, payment_status")
      .eq("id", transactionId)
      .single();

    const currentRefunded = freshTx?.refund_amount_cents ?? transaction.refund_amount_cents ?? 0;
    const maxRefundable = (freshTx?.total_amount_cents || transaction.total_amount_cents) - currentRefunded;

    if (refundAmountCents > maxRefundable) {
      return NextResponse.json(
        { success: false, error: `Refund amount ($${(refundAmountCents / 100).toFixed(2)}) exceeds remaining refundable amount ($${(maxRefundable / 100).toFixed(2)})` },
        { status: 400 }
      );
    }

    const newRefundTotal = currentRefunded + refundAmountCents;
    const casQuery = supabase
      .from("payment_transactions")
      .update({
        refund_amount_cents: newRefundTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (currentRefunded === 0) {
      casQuery.or("refund_amount_cents.eq.0,refund_amount_cents.is.null");
    } else {
      casQuery.eq("refund_amount_cents", currentRefunded);
    }

    const { data: casResult, error: casError } = await casQuery
      .select("id")
      .single();

    if (casError || !casResult) {
      console.error(`[REFUND] Compare-and-set failed for transaction ${transactionId} — concurrent refund in progress`);
      return NextResponse.json(
        { success: false, error: "Concurrent refund detected — please retry" },
        { status: 409 }
      );
    }

    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_TRANSACTION_KEY) {
      await supabase
        .from("payment_transactions")
        .update({ refund_amount_cents: currentRefunded })
        .eq("id", transactionId);
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 }
      );
    }

    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];
    const refundAmount = (refundAmountCents / 100).toFixed(2);

    const refundPayload = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: envConfig.AUTHNET_API_LOGIN_ID,
          transactionKey: envConfig.AUTHNET_TRANSACTION_KEY,
        },
        transactionRequest: {
          transactionType: "refundTransaction",
          amount: refundAmount,
          refTransId: transaction.authnet_transaction_id,
          payment: {
            creditCard: {
              cardNumber: transaction.card_last_four ? `XXXX${transaction.card_last_four}` : "XXXX0000",
              expirationDate: "XXXX",
            },
          },
        },
      },
    };

    console.log(`[REFUND] ${isInternalCall ? "Internal/webhook" : `User ${userId}`} issuing partial refund of $${refundAmount} for prescription ${prescriptionId}`);

    const refundResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refundPayload),
    });

    const refundData = await refundResponse.json();
    const transactionResponse = refundData.createTransactionResponse || refundData;
    const messages = transactionResponse?.messages || refundData?.messages;
    const resultCode = messages?.resultCode;

    if (resultCode !== "Ok") {
      const errorMessage = messages?.message?.[0]?.text ||
        transactionResponse?.transactionResponse?.errors?.error?.[0]?.errorText ||
        "Refund failed at processor";
      console.error(`[REFUND] Failed:`, errorMessage);

      await supabase
        .from("payment_transactions")
        .update({ refund_amount_cents: currentRefunded })
        .eq("id", transactionId);

      return NextResponse.json(
        { success: false, error: `Refund failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    const refundTransId = transactionResponse?.transactionResponse?.transId;
    console.log(`[REFUND] Success: refund transaction ${refundTransId}`);

    const now = new Date().toISOString();

    await supabase
      .from("prescriptions")
      .update({
        status: "rejected",
        payment_status: "refunded",
        updated_at: now,
      })
      .eq("id", prescriptionId);

    const totalRefundedSoFar = currentRefunded + refundAmountCents;
    const isFullRefund = totalRefundedSoFar >= transaction.total_amount_cents;

    await supabase
      .from("payment_transactions")
      .update({
        payment_status: isFullRefund ? "refunded" : "partially_refunded",
        refund_amount_cents: totalRefundedSoFar,
        refunded_at: now,
        updated_at: now,
      })
      .eq("id", transactionId);

    return NextResponse.json({
      success: true,
      message: `Partial refund of $${refundAmount} processed successfully`,
      refundTransactionId: refundTransId,
      prescriptionId,
      refundAmountCents,
      reason: reason || null,
      newPaymentStatus: isFullRefund ? "refunded" : "partially_refunded",
    });
  } catch (error) {
    console.error("[REFUND] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      { success: false, error: "Refund processing failed" },
      { status: 500 }
    );
  }
}
