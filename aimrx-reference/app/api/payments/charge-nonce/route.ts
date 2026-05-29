import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";

const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

const GATEWAY_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  let claimedTransactionId: string | null = null;

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (userRole !== "provider" && userRole !== "delegate") {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { paymentToken, opaqueData } = body;

    if (!paymentToken || !opaqueData?.dataDescriptor || !opaqueData?.dataValue) {
      return NextResponse.json(
        { error: "Missing required fields: paymentToken and opaqueData" },
        { status: 400 },
      );
    }

    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_TRANSACTION_KEY) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 500 },
      );
    }

    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!provider) {
      return NextResponse.json(
        { error: "Provider profile not found" },
        { status: 403 },
      );
    }

    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", paymentToken)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: "Payment transaction not found" },
        { status: 404 },
      );
    }

    if (transaction.provider_id !== provider.id) {
      return NextResponse.json(
        { error: "You do not have permission to charge this payment" },
        { status: 403 },
      );
    }

    if (transaction.payment_status === "completed") {
      return NextResponse.json(
        { error: "Payment has already been completed" },
        { status: 400 },
      );
    }

    if (transaction.payment_status === "processing") {
      return NextResponse.json(
        { error: "Payment is already being processed" },
        { status: 409 },
      );
    }

    // Time-based expiration removed (Joseph rule, May 11 2026 — Jessica
    // Carroll incident). The payment_link_expires_at < now() gate that
    // used to live here is gone. Status-based 'expired' (set by explicit
    // admin action) still blocks the charge below.

    if (transaction.payment_status === "expired") {
      return NextResponse.json(
        { error: "Payment transaction has been cancelled" },
        { status: 400 },
      );
    }

    // Guard: refuse to charge if the linked prescription(s) are already paid.
    // Protects against double-collection when an order was paid on terms or
    // marked paid through another path after this link was issued.
    {
      const linkedRxIds: string[] = [];
      if (transaction.prescription_id) linkedRxIds.push(transaction.prescription_id);
      if (Array.isArray(transaction.prescription_ids)) {
        for (const id of transaction.prescription_ids) {
          if (typeof id === "string" && !linkedRxIds.includes(id)) linkedRxIds.push(id);
        }
      }
      if (linkedRxIds.length > 0) {
        const { data: linkedRxs } = await supabase
          .from("prescriptions")
          .select("id, payment_status")
          .in("id", linkedRxIds);
        const alreadyPaid = (linkedRxs || []).filter((r) => r.payment_status === "paid");
        if (alreadyPaid.length > 0) {
          await supabase
            .from("payment_transactions")
            .update({
              payment_status: "expired",
              updated_at: new Date().toISOString(),
            })
            .eq("id", transaction.id);
          return NextResponse.json(
            {
              error: "This order has already been paid. No charge has been made.",
              alreadyPaid: alreadyPaid.map((r) => r.id),
            },
            { status: 409 },
          );
        }
      }
    }

    // Claim AND set charge_attempt_started_at in a single atomic write,
    // so by the time the next request reads this row it sees both the
    // 'processing' state and the in-flight breadcrumb. release-processing
    // and get-hosted-token use this breadcrumb to refuse mutations while
    // the gateway call is mid-flight, closing the residual double-charge
    // window that compare-and-swap alone could not.
    const claimNow = new Date().toISOString();
    const { data: claimedRows } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "processing",
        charge_attempt_started_at: claimNow,
        updated_at: claimNow,
      })
      .eq("id", transaction.id)
      .eq("payment_status", transaction.payment_status)
      .select("id");

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json(
        { error: "Payment is already being processed by another request" },
        { status: 409 },
      );
    }

    claimedTransactionId = transaction.id;

    const totalAmountDollars = (transaction.total_amount_cents / 100).toFixed(2);
    const apiUrl = AUTHNET_API_URLS[envConfig.AUTHNET_ENVIRONMENT];

    const chargeRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: envConfig.AUTHNET_API_LOGIN_ID,
          transactionKey: envConfig.AUTHNET_TRANSACTION_KEY,
        },
        refId: transaction.authnet_ref_id,
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: totalAmountDollars,
          payment: {
            opaqueData: {
              dataDescriptor: opaqueData.dataDescriptor,
              dataValue: opaqueData.dataValue,
            },
          },
          order: {
            invoiceNumber: transaction.authnet_ref_id,
            description: transaction.description || "Prescription Payment",
          },
          customer: {
            email: transaction.patient_email || "",
          },
        },
      },
    };

    console.log(`[CHARGE-NONCE] Charging $${totalAmountDollars} for ref ${transaction.authnet_ref_id}`);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), GATEWAY_TIMEOUT_MS);

    let authnetData;
    try {
      const authnetResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chargeRequest),
        signal: abortController.signal,
      });
      authnetData = await authnetResponse.json();
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      const errMsg = fetchErr instanceof Error ? fetchErr.message : "Unknown";
      console.error(`[CHARGE-NONCE] Gateway ${isTimeout ? "timeout" : "error"}:`, errMsg);

      // Forensic breadcrumb: the gateway call may or may not have
      // captured. Leave the row in 'processing' with charge_attempt_started_at
      // intact so the in-flight guard still applies, and write
      // verify_required_at + last_gateway_error_* so the payment-janitor
      // cron will pick it up and drive verify-and-complete. Without this,
      // a timed-out charge becomes invisible to the janitor and stays
      // stuck in 'processing' forever — exactly what happened during the
      // Apr 22-23 incident.
      const errNow = new Date().toISOString();
      try {
        await supabase
          .from("payment_transactions")
          .update({
            verify_required_at: errNow,
            last_gateway_error_code: isTimeout ? "GATEWAY_TIMEOUT" : "GATEWAY_UNREACHABLE",
            last_gateway_error_at: errNow,
            updated_at: errNow,
          })
          .eq("id", transaction.id);
      } catch (breadcrumbErr) {
        console.error(
          "[CHARGE-NONCE] Failed to write verify breadcrumb:",
          breadcrumbErr instanceof Error ? breadcrumbErr.message : "Unknown",
        );
      }
      // Intentionally do NOT clear claimedTransactionId — the catch-all
      // revert at the bottom would flip the row to 'pending' and
      // discard the breadcrumb. Set it to a sentinel so the catch
      // ignores this row.
      claimedTransactionId = null;

      return NextResponse.json(
        {
          success: false,
          error: isTimeout
            ? "Payment gateway timed out. Please use verify to check if payment was captured."
            : "Unable to reach payment gateway. Please use verify to check payment status.",
          requiresVerification: true,
        },
        { status: 502 },
      );
    }
    clearTimeout(timeoutId);

    const txResponse = authnetData.transactionResponse;
    const messages = authnetData.messages;

    if (messages?.resultCode !== "Ok" || !txResponse?.transId) {
      const errorMessage =
        txResponse?.errors?.[0]?.errorText ||
        messages?.message?.[0]?.text ||
        "Payment was declined";

      const errorCode =
        txResponse?.errors?.[0]?.errorCode ||
        messages?.message?.[0]?.code ||
        "UNKNOWN";

      console.error(`[CHARGE-NONCE] Payment failed: ${errorCode} - ${errorMessage}`);

      // Gateway responded with a definitive decline / validation error.
      // Clear the in-flight breadcrumb because the call is fully
      // resolved and another retry can be safely started.
      const declineNow = new Date().toISOString();
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "pending",
          charge_attempt_started_at: null,
          last_gateway_error_code: errorCode,
          last_gateway_error_at: declineNow,
          updated_at: declineNow,
        })
        .eq("id", transaction.id);
      claimedTransactionId = null;

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          errorCode,
          declined: txResponse?.responseCode === "2",
        },
        { status: txResponse?.responseCode === "2" ? 402 : 422 },
      );
    }

    const transId = txResponse.transId;
    const cardLastFour = txResponse.accountNumber?.slice(-4);
    const cardType = txResponse.accountType;
    const now = new Date().toISOString();

    console.log(`[CHARGE-NONCE] Payment successful: transId=${transId}, card=****${cardLastFour}`);

    const { error: updateTxError } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "completed",
        order_progress: "payment_received",
        authnet_transaction_id: transId,
        card_last_four: cardLastFour,
        card_type: cardType,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", transaction.id);

    claimedTransactionId = null;

    if (updateTxError) {
      console.error("[CHARGE-NONCE] CRITICAL: Payment captured but DB update failed:", updateTxError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Payment was charged but failed to record. Please contact support with this transaction ID for reconciliation.",
          transactionId: transId,
          cardLastFour,
          cardType,
          charged: true,
        },
        { status: 500 },
      );
    }

    let prescriptionUpdated = false;
    let pharmacySubmitted = false;
    let pharmacyError: string | null = null;

    const prescriptionIdsToProcess: string[] = [];

    if (transaction.prescription_id) {
      prescriptionIdsToProcess.push(transaction.prescription_id);
    }

    const { data: linkedRxs } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", transaction.id);

    if (linkedRxs) {
      for (const rx of linkedRxs) {
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

      if (primaryRx?.order_group_id) {
        const { data: groupRxs } = await supabase
          .from("prescriptions")
          .select("id")
          .eq("order_group_id", primaryRx.order_group_id);

        if (groupRxs) {
          for (const rx of groupRxs) {
            if (!prescriptionIdsToProcess.includes(rx.id)) {
              prescriptionIdsToProcess.push(rx.id);
            }
          }
        }
      }
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
          console.error(`[CHARGE-NONCE] Failed to update prescription ${rxId}:`, rxError.message);
        }
      }

      prescriptionUpdated = true;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_API_SECRET || "";
      const pharmacyErrors: string[] = [];

      for (const rxId of prescriptionIdsToProcess) {
        try {
          console.log(`[CHARGE-NONCE] Auto-submitting prescription ${rxId} to pharmacy...`);

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
            console.log(`[CHARGE-NONCE] Prescription ${rxId} submitted to pharmacy:`, submitData);
          } else {
            const errorBody = await submitResponse.text().catch(() => "unable to read");
            console.error(`[CHARGE-NONCE] Pharmacy submission failed for ${rxId}: HTTP ${submitResponse.status} — ${errorBody}`);
            pharmacyErrors.push(`${rxId}: HTTP ${submitResponse.status}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown";
          console.error(`[CHARGE-NONCE] Pharmacy submission error for ${rxId}:`, msg);
          pharmacyErrors.push(`${rxId}: ${msg}`);
        }
      }

      pharmacySubmitted = pharmacyErrors.length < prescriptionIdsToProcess.length;
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

    let emailSent = false;
    if (transaction.patient_email && transaction.send_receipt_to_patient !== false) {
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        let chargeMedications: Array<{ name: string; price?: string; shippingFee?: string }> = [];
        let chargeOversightCents = 0;
        if (prescriptionIdsToProcess.length > 0) {
          const { data: medDetails } = await supabase
            .from("prescriptions")
            .select("medication, patient_price, shipping_fee_cents, profit_cents")
            .in("id", prescriptionIdsToProcess);
          if (medDetails && medDetails.length > 0) {
            chargeMedications = medDetails.map(m => ({
              name: m.medication || "Medication",
              price: m.patient_price ? parseFloat(m.patient_price).toFixed(2) : undefined,
              shippingFee: m.shipping_fee_cents && m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
            }));
            chargeOversightCents = medDetails.reduce((sum, m) => sum + (m.profit_cents || 0), 0);
          }
        }

        const emailRes = await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "charge-nonce-auto",
          },
          body: JSON.stringify({
            patientEmail: transaction.patient_email,
            patientPhone: transaction.patient_phone || undefined,
            patientName: transaction.patient_name,
            providerName: transaction.provider_name,
            medication: transaction.description,
            ...(chargeMedications.length > 0 ? { medications: chargeMedications } : {}),
            ...(chargeOversightCents > 0 ? { oversightFee: (chargeOversightCents / 100).toFixed(2) } : {}),
            totalAmount: totalAmountDollars,
            transactionId: transId,
            pharmacyName: transaction.pharmacy_name,
          }),
        });
        emailSent = emailRes.ok;
      } catch (err) {
        console.error("[CHARGE-NONCE] Confirmation email error:", err instanceof Error ? err.message : "Unknown");
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      transactionId: transId,
      cardLastFour,
      cardType,
      prescriptionUpdated,
      pharmacySubmitted,
      emailSent,
      ...(pharmacyError && { pharmacyWarning: pharmacyError }),
    });
  } catch (error) {
    console.error("[CHARGE-NONCE] Fatal error:", error instanceof Error ? error.message : "Unknown");

    if (claimedTransactionId) {
      try {
        await supabase
          .from("payment_transactions")
          .update({ payment_status: "pending", updated_at: new Date().toISOString() })
          .eq("id", claimedTransactionId);
      } catch (revertErr) {
        console.error("[CHARGE-NONCE] CRITICAL: Failed to revert processing status:", revertErr instanceof Error ? revertErr.message : "Unknown");
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to process payment" },
      { status: 500 },
    );
  }
}
