import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import { getPaymentConfigById } from "@/core/services/pharmacyPaymentConfigService";

const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

export async function POST(request: NextRequest) {
  let claimedTransactionId: string | null = null;
  const supabase = createAdminClient();

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["provider", "admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Provider access required" },
        { status: 403 },
      );
    }

    const { data: providerProfile } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!providerProfile && userRole === "provider") {
      return NextResponse.json(
        { success: false, error: "Provider profile not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { paymentToken, opaqueData } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    if (!opaqueData?.dataDescriptor || !opaqueData?.dataValue) {
      return NextResponse.json(
        { success: false, error: "Card token (opaqueData) is required" },
        { status: 400 },
      );
    }

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

    if (transaction.payment_gateway !== "authorizenet") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authorize.Net payments have been retired. This transaction uses RedSail Pay.",
        },
        { status: 410 },
      );
    }

    if (userRole === "provider" && providerProfile && transaction.provider_id !== providerProfile.id) {
      return NextResponse.json(
        { success: false, error: "You are not authorized for this transaction" },
        { status: 403 },
      );
    }

    if (transaction.payment_status === "completed") {
      return NextResponse.json(
        { success: false, error: "Payment has already been completed" },
        { status: 400 },
      );
    }

    if (
      transaction.payment_link_expires_at &&
      new Date(transaction.payment_link_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: "Payment link has expired" },
        { status: 400 },
      );
    }

    const { data: claimedRows } = await supabase
      .from("payment_transactions")
      .update({ payment_status: "processing" })
      .eq("id", transaction.id)
      .eq("payment_status", transaction.payment_status)
      .select("id");

    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "This payment is already being processed" },
        { status: 409 },
      );
    }

    claimedTransactionId = transaction.id;

    let authnetLoginId: string | undefined;
    let authnetTransKey: string | undefined;
    let authnetEnvironment: "sandbox" | "production" = envConfig.AUTHNET_ENVIRONMENT;

    if (transaction.payment_config_id) {
      const pharmacyConfig = await getPaymentConfigById(transaction.payment_config_id);
      if (pharmacyConfig?.authnetApiLoginId && pharmacyConfig?.authnetTransactionKey) {
        authnetLoginId = pharmacyConfig.authnetApiLoginId;
        authnetTransKey = pharmacyConfig.authnetTransactionKey;
        authnetEnvironment = pharmacyConfig.environment as "sandbox" | "production";
      }
    }

    if (!authnetLoginId || !authnetTransKey) {
      authnetLoginId = envConfig.AUTHNET_API_LOGIN_ID;
      authnetTransKey = envConfig.AUTHNET_TRANSACTION_KEY;
    }

    if (!authnetLoginId || !authnetTransKey) {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 },
      );
    }

    const totalAmountDollars = (transaction.total_amount_cents / 100).toFixed(2);
    const apiUrl = AUTHNET_API_URLS[authnetEnvironment];

    const chargeRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: authnetLoginId,
          transactionKey: authnetTransKey,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let authnetResponse;
    try {
      authnetResponse = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chargeRequest),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Payment gateway timeout — please verify if the charge went through",
            requiresVerification: true,
            paymentToken,
          },
          { status: 502 },
        );
      }
      throw err;
    }
    clearTimeout(timeout);

    const authnetData = await authnetResponse.json();

    const transactionResponse = authnetData.transactionResponse;
    const responseCode = transactionResponse?.responseCode;
    const authnetTransactionId = transactionResponse?.transId;
    const cardLastFour = transactionResponse?.accountNumber?.slice(-4);
    const cardType = transactionResponse?.accountType;

    if (responseCode === "2") {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;

      const declineMessage =
        transactionResponse?.errors?.[0]?.errorText ||
        "Card was declined. Please check details or use a different card.";
      return NextResponse.json(
        { success: false, error: declineMessage },
        { status: 402 },
      );
    }

    if (responseCode !== "1") {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;

      const errorMessage =
        transactionResponse?.errors?.[0]?.errorText ||
        authnetData.messages?.message?.[0]?.text ||
        "Payment could not be processed. Please verify card details.";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const { error: updateTxError } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "completed",
        order_progress: "payment_received",
        authnet_transaction_id: authnetTransactionId,
        card_last_four: cardLastFour,
        card_type: cardType,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", transaction.id);

    if (updateTxError) {
      console.error("[CHARGE-NONCE] CRITICAL: Card charged but DB update failed. TX ID:", authnetTransactionId);
      return NextResponse.json(
        {
          success: false,
          error: "Payment was charged but we failed to update the record. Please contact support with this transaction ID.",
          charged: true,
          transactionId: authnetTransactionId,
        },
        { status: 500 },
      );
    }

    claimedTransactionId = null;

    const { data: linkedRx } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("payment_transaction_id", transaction.id);

    const allRxIds: string[] = linkedRx?.map((rx: { id: string }) => rx.id) || [];

    if (transaction.prescription_id && !allRxIds.includes(transaction.prescription_id)) {
      allRxIds.push(transaction.prescription_id);
    }

    try {
      const { data: probe } = await (supabase.from("prescriptions") as any)
        .select("order_group_id")
        .eq("id", allRxIds[0])
        .single();
      if (probe?.order_group_id) {
        const { data: groupRxs } = await (supabase.from("prescriptions") as any)
          .select("id")
          .eq("order_group_id", probe.order_group_id);
        if (groupRxs) {
          for (const grx of groupRxs) {
            if (!allRxIds.includes(grx.id)) allRxIds.push(grx.id);
          }
        }
      }
    } catch { /* order_group_id may not exist */ }

    if (allRxIds.length > 0) {
      await supabase
        .from("prescriptions")
        .update({
          payment_status: "paid",
          status: "payment_received",
          payment_transaction_id: transaction.id,
          updated_at: now,
        })
        .in("id", allRxIds);
    }

    let pharmacySubmitted = true;
    let pharmacyWarning: string | null = null;
    const pharmacyErrors: string[] = [];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internalSecret = process.env.INTERNAL_API_SECRET || "";

    for (const rxId of allRxIds) {
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
        if (!submitResponse.ok) {
          const errorBody = await submitResponse.text().catch(() => "unknown");
          pharmacyErrors.push(`${rxId}: ${errorBody}`);
        }
      } catch (err) {
        pharmacyErrors.push(`${rxId}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (pharmacyErrors.length > 0) {
      pharmacySubmitted = pharmacyErrors.length < allRxIds.length;
      pharmacyWarning = `${pharmacyErrors.length}/${allRxIds.length} pharmacy submissions failed`;

      const orderProgress = pharmacyErrors.length === allRxIds.length
        ? "pharmacy_submission_failed"
        : "pharmacy_partial_failure";

      await supabase
        .from("payment_transactions")
        .update({ order_progress: orderProgress })
        .eq("id", transaction.id);

      await supabase.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email || "unknown",
        user_name: "System",
        action: "PHARMACY_SUBMISSION_FAILED",
        details: `charge-nonce: ${pharmacyErrors.join("; ")}`,
        status: "error",
      });
    } else if (allRxIds.length > 0) {
      await supabase
        .from("payment_transactions")
        .update({ order_progress: "pharmacy_processing" })
        .eq("id", transaction.id);
    }

    let emailSent = false;
    if (transaction.patient_email) {
      try {
        const internalApiKey = process.env.INTERNAL_API_KEY || "";

        const { data: allRxDetails } = allRxIds.length > 1
          ? await supabase
              .from("prescriptions")
              .select("medication, patient_price, shipping_fee_cents, profit_cents")
              .in("id", allRxIds)
          : { data: null };

        const medications: { name: string; price: string; shippingFee?: string }[] = [];
        let emailOversightCents = 0;
        let groupTotalCents = 0;

        if (allRxDetails && allRxDetails.length > 0) {
          for (const grx of allRxDetails) {
            const price = parseFloat(grx.patient_price) || 0;
            const ship = grx.shipping_fee_cents || 0;
            const oversight = grx.profit_cents || 0;
            medications.push({
              name: grx.medication,
              price: price.toFixed(2),
              shippingFee: ship > 0 ? (ship / 100).toFixed(2) : undefined,
            });
            emailOversightCents += oversight;
            groupTotalCents += Math.round(price * 100) + ship + oversight;
          }
        }

        await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalApiKey,
          },
          body: JSON.stringify({
            patientEmail: transaction.patient_email,
            patientName: transaction.patient_name,
            providerName: transaction.provider_name,
            medication: transaction.description,
            medications: medications.length > 0 ? medications : undefined,
            oversightFee: emailOversightCents > 0 ? (emailOversightCents / 100).toFixed(2) : undefined,
            totalAmount: (transaction.total_amount_cents / 100).toFixed(2),
            transactionId: authnetTransactionId,
            paymentMethod: "Credit Card",
            pharmacyName: transaction.pharmacy_name,
            pharmacyId: transaction.pharmacy_id,
            prescriptionId: transaction.prescription_id,
          }),
        });
        emailSent = true;
      } catch (err) {
        console.error("[CHARGE-NONCE] Email error:", err instanceof Error ? err.message : "Unknown");
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: authnetTransactionId,
      cardLastFour,
      cardType,
      prescriptionUpdated: allRxIds.length > 0,
      pharmacySubmitted,
      emailSent,
      pharmacyWarning,
    });
  } catch (error) {
    console.error("[CHARGE-NONCE] Error:", error instanceof Error ? error.message : "Unknown");
    console.error("[CHARGE-NONCE] Stack:", error instanceof Error ? error.stack : "No stack");

    if (claimedTransactionId) {
      try {
        await supabase
          .from("payment_transactions")
          .update({ payment_status: "pending" })
          .eq("id", claimedTransactionId);
      } catch { /* best effort */ }
    }

    return NextResponse.json(
      { success: false, error: "Payment processing failed" },
      { status: 500 },
    );
  }
}
