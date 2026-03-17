import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@core/database/client";
import {
  getPaymentConfigsForPharmacy,
  upsertPaymentConfig,
  maskCredential,
} from "@/core/services/pharmacyPaymentConfigService";
import Stripe from "stripe";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const pharmacyId = request.nextUrl.searchParams.get("pharmacyId");

    if (!pharmacyId) {
      return NextResponse.json(
        { error: "pharmacyId is required" },
        { status: 400 },
      );
    }

    if (userRole?.role !== "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("pharmacy_id", pharmacyId)
        .single();

      if (!pharmacyAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const configs = await getPaymentConfigsForPharmacy(pharmacyId);

    const maskedConfigs = configs.map((config) => ({
      id: config.id,
      pharmacyId: config.pharmacyId,
      gateway: config.gateway,
      isActive: config.isActive,
      environment: config.environment,
      label: config.label,
      stripePublishableKey: config.stripePublishableKey || undefined,
      stripeSecretKeyMasked: maskCredential(config.stripeSecretKey),
      stripeWebhookSecretMasked: maskCredential(config.stripeWebhookSecret),
      authnetApiLoginIdMasked: maskCredential(config.authnetApiLoginId),
      authnetTransactionKeyMasked: maskCredential(config.authnetTransactionKey),
      authnetSignatureKeyMasked: maskCredential(config.authnetSignatureKey),
      hasStripeKeys: !!(config.stripeSecretKey && config.stripePublishableKey),
      hasAuthnetKeys: !!(config.authnetApiLoginId && config.authnetTransactionKey),
    }));

    return NextResponse.json({ success: true, configs: maskedConfigs });
  } catch (error) {
    console.error("[PHARMACY-PAYMENT-CONFIG] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pharmacyId, gateway, environment, label } = body;

    if (!pharmacyId || !gateway) {
      return NextResponse.json(
        { error: "pharmacyId and gateway are required" },
        { status: 400 },
      );
    }

    if (!["stripe", "authorizenet"].includes(gateway)) {
      return NextResponse.json(
        { error: "gateway must be 'stripe' or 'authorizenet'" },
        { status: 400 },
      );
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("pharmacy_id", pharmacyId)
        .single();

      if (!pharmacyAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (gateway === "stripe") {
      if (!body.stripeSecretKey || !body.stripePublishableKey) {
        return NextResponse.json(
          { error: "Stripe Secret Key and Publishable Key are required" },
          { status: 400 },
        );
      }
    } else {
      if (!body.authnetApiLoginId || !body.authnetTransactionKey) {
        return NextResponse.json(
          { error: "Authorize.Net API Login ID and Transaction Key are required" },
          { status: 400 },
        );
      }
    }

    const result = await upsertPaymentConfig({
      pharmacyId,
      gateway,
      environment: environment || "sandbox",
      label,
      stripeSecretKey: body.stripeSecretKey,
      stripePublishableKey: body.stripePublishableKey,
      stripeWebhookSecret: body.stripeWebhookSecret,
      authnetApiLoginId: body.authnetApiLoginId,
      authnetTransactionKey: body.authnetTransactionKey,
      authnetSignatureKey: body.authnetSignatureKey,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save payment config" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      configId: result.configId,
      message: `${gateway === "stripe" ? "Stripe" : "Authorize.Net"} payment configuration saved successfully`,
    });
  } catch (error) {
    console.error("[PHARMACY-PAYMENT-CONFIG] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pharmacyId, gateway, action } = body;

    if (!pharmacyId) {
      return NextResponse.json({ error: "pharmacyId is required" }, { status: 400 });
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("pharmacy_id", pharmacyId)
        .single();

      if (!pharmacyAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (action === "test") {
      if (gateway === "stripe") {
        if (!body.stripeSecretKey) {
          return NextResponse.json(
            { error: "Stripe Secret Key is required for testing" },
            { status: 400 },
          );
        }
        try {
          const stripe = new Stripe(body.stripeSecretKey);
          const account = await stripe.accounts.retrieve();
          return NextResponse.json({
            success: true,
            message: "Stripe connection successful",
            accountId: account.id,
          });
        } catch (err) {
          return NextResponse.json(
            {
              success: false,
              error: `Stripe test failed: ${err instanceof Error ? err.message : "Invalid credentials"}`,
            },
            { status: 400 },
          );
        }
      } else if (gateway === "authorizenet") {
        if (!body.authnetApiLoginId || !body.authnetTransactionKey) {
          return NextResponse.json(
            { error: "API Login ID and Transaction Key are required for testing" },
            { status: 400 },
          );
        }
        try {
          const isProduction = body.environment === "production";
          const apiUrl = isProduction
            ? "https://api.authorize.net/xml/v1/request.api"
            : "https://apitest.authorize.net/xml/v1/request.api";

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              authenticateTestRequest: {
                merchantAuthentication: {
                  name: body.authnetApiLoginId,
                  transactionKey: body.authnetTransactionKey,
                },
              },
            }),
          });

          const text = await response.text();
          const cleanText = text.replace(/^\uFEFF/, "");
          const data = JSON.parse(cleanText);

          if (data.messages?.resultCode === "Ok") {
            return NextResponse.json({
              success: true,
              message: "Authorize.Net connection successful",
            });
          } else {
            return NextResponse.json(
              {
                success: false,
                error: `Authorize.Net test failed: ${data.messages?.message?.[0]?.text || "Invalid credentials"}`,
              },
              { status: 400 },
            );
          }
        } catch (err) {
          return NextResponse.json(
            {
              success: false,
              error: `Authorize.Net test failed: ${err instanceof Error ? err.message : "Connection error"}`,
            },
            { status: 400 },
          );
        }
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[PHARMACY-PAYMENT-CONFIG] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
