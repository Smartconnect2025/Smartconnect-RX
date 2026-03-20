import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { envConfig } from "@/core/config/envConfig";
import { getPaymentConfigById } from "@/core/services/pharmacyPaymentConfigService";

/**
 * Authorize.Net API endpoints
 */
const AUTHNET_API_URLS = {
  sandbox: "https://apitest.authorize.net/xml/v1/request.api",
  production: "https://api.authorize.net/xml/v1/request.api",
} as const;

const AUTHNET_HOSTED_URLS = {
  sandbox: "https://test.authorize.net/payment/payment",
  production: "https://accept.authorize.net/payment/payment",
} as const;

/**
 * POST /api/payments/get-hosted-token
 * Get an Accept Hosted form token from Authorize.Net
 * This token is used to redirect the user to Authorize.Net's hosted payment page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentToken, from } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("*, pharmacy:pharmacies(name)")
      .eq("payment_token", paymentToken)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
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

    if (transaction.payment_gateway !== "authorizenet") {
      return NextResponse.json(
        { success: false, error: "This payment is not configured for Authorize.Net" },
        { status: 400 },
      );
    }

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
      return NextResponse.json(
        { success: false, error: "Payment system not configured" },
        { status: 500 },
      );
    }

    const totalAmountDollars = (transaction.total_amount_cents / 100).toFixed(2);
    const siteUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

    const hostedPaymentRequest = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: authnetLoginId,
          transactionKey: authnetTransKey,
        },
        refId: transaction.authnet_ref_id,
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: totalAmountDollars,
          order: {
            invoiceNumber: transaction.authnet_ref_id,
            description: transaction.description || "Prescription Payment",
          },
          customer: {
            email: transaction.patient_email || "",
          },
        },
        hostedPaymentSettings: {
          setting: [
            {
              settingName: "hostedPaymentReturnOptions",
              settingValue: JSON.stringify({
                showReceipt: false,
                url: `${siteUrl}/payment/success/${paymentToken}?from=${from || "patient-link"}`,
                urlText: "Return to site",
                cancelUrl: siteUrl,
                cancelUrlText: "Cancel Payment",
              }),
            },
            {
              settingName: "hostedPaymentButtonOptions",
              settingValue: JSON.stringify({
                text: "Pay Now",
              }),
            },
            {
              settingName: "hostedPaymentOrderOptions",
              settingValue: JSON.stringify({
                show: true,
                merchantName: (() => {
                  const pharm = Array.isArray(transaction.pharmacy) ? transaction.pharmacy[0] : transaction.pharmacy;
                  return pharm?.name || transaction.pharmacy_name || "SmartConnect RX";
                })(),
              }),
            },
            {
              settingName: "hostedPaymentBillingAddressOptions",
              settingValue: JSON.stringify({
                show: true,
                required: true,
              }),
            },
            {
              settingName: "hostedPaymentCustomerOptions",
              settingValue: JSON.stringify({
                showEmail: true,
                requiredEmail: true,
              }),
            },

            {
              settingName: "hostedPaymentPaymentOptions",
              settingValue: JSON.stringify({
                cardCodeRequired: true,
                showCreditCard: true,
                showBankAccount: false,
              }),
            },
            {
              settingName: "hostedPaymentSecurityOptions",
              settingValue: JSON.stringify({
                captcha: false,
              }),
            },
          ],
        },
      },
    };

    const apiUrl = AUTHNET_API_URLS[authnetEnvironment];
    const hostedUrl = AUTHNET_HOSTED_URLS[authnetEnvironment];

    // Call Authorize.Net API
    const authnetResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(hostedPaymentRequest),
    });

    const authnetData = await authnetResponse.json();

    // Check for API errors
    if (authnetData.messages?.resultCode !== "Ok" || !authnetData.token) {
      const errorMessage =
        authnetData.messages?.message?.[0]?.text ||
        "Failed to get hosted payment token";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 },
      );
    }

    // Update transaction to mark that hosted token was requested
    await supabase
      .from("payment_transactions")
      .update({
        payment_link_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    return NextResponse.json({
      success: true,
      formToken: authnetData.token,
      paymentUrl: hostedUrl,
    });
  } catch (error) {
    console.error(
      "[HOSTED-TOKEN] Error:",
      error instanceof Error ? error.message : "Unknown",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize payment",
      },
      { status: 500 },
    );
  }
}
