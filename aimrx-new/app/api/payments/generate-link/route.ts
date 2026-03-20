import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import { getActivePaymentConfig } from "@/core/services/pharmacyPaymentConfigService";
import crypto from "crypto";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY);

    let userId: string | null = null;

    if (isInternalCall) {
      // Internal call — no user session needed, prescriber_id comes from prescription
    } else {
      const { user, userRole } = await getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      if (userRole !== "provider") {
        return NextResponse.json(
          { error: "Provider access required" },
          { status: 403 },
        );
      }

      userId = user.id;
    }

    const body = await request.json();
    const {
      prescriptionId,
      consultationFeeCents,
      medicationCostCents,
      shippingFeeCents,
      description,
      patientEmail,
      sendEmail,
    } = body;

    // Validate required fields
    if (
      !prescriptionId ||
      consultationFeeCents === undefined ||
      medicationCostCents === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: prescriptionId, consultationFeeCents, medicationCostCents",
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Get prescription details
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        patient_id,
        prescriber_id,
        pharmacy_id,
        medication,
        quantity,
        payment_status,
        patient:patients(id, first_name, last_name, email, phone),
        pharmacy:pharmacies(id, name, logo_url, primary_color)
      `,
      )
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 },
      );
    }

    // CHECK 1: If prescription is already paid, reject
    if (prescription.payment_status === "paid") {
      return NextResponse.json(
        { error: "This prescription has already been paid" },
        { status: 400 },
      );
    }

    // Verify the provider owns this prescription (skip for internal calls)
    if (!isInternalCall && prescription.prescriber_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to bill for this prescription" },
        { status: 403 },
      );
    }

    // CHECK 2: Look for existing payment_transaction for this prescription
    const { data: existingPayment } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("prescription_id", prescriptionId)
      .eq("payment_status", "pending")
      .single();

    if (existingPayment) {
      const isExpired =
        existingPayment.payment_link_expires_at &&
        new Date(existingPayment.payment_link_expires_at) < new Date();

      if (isExpired) {
        await supabase
          .from("payment_transactions")
          .delete()
          .eq("id", existingPayment.id);
      } else {
        // Payment link still valid - return existing link and resend email
        const patient = Array.isArray(prescription.patient)
          ? prescription.patient[0]
          : prescription.patient;
        const existingPharmacy = Array.isArray(prescription.pharmacy)
          ? prescription.pharmacy[0]
          : prescription.pharmacy;

        const { data: provider } = await supabase
          .from("providers")
          .select("id, first_name, last_name")
          .eq("user_id", userId || prescription.prescriber_id)
          .single();

        // Resend email to patient
        let emailSent = false;
        const appUrl =
          envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

        if (sendEmail && (patientEmail || patient?.email)) {
          try {
            const emailController = new AbortController();
            const emailTimeout = setTimeout(
              () => emailController.abort(),
              10000,
            ); // 10s timeout

            const emailResponse = await fetch(
              `${appUrl}/api/payments/send-payment-email`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-internal-api-key": INTERNAL_API_KEY || "",
                },
                body: JSON.stringify({
                  patientEmail: patientEmail || patient?.email,
                  patientName: patient
                    ? `${patient.first_name} ${patient.last_name}`
                    : "Valued Patient",
                  providerName: provider
                    ? `${provider.first_name} ${provider.last_name}`
                    : "Your Provider",
                  medication: prescription.medication,
                  totalAmount: (
                    existingPayment.total_amount_cents / 100
                  ).toFixed(2),
                  paymentUrl: existingPayment.payment_link_url,
                  paymentToken: existingPayment.payment_token,
                  pharmacyName: existingPharmacy?.name,
                  pharmacyLogoUrl: existingPharmacy?.logo_url,
                  pharmacyColor: existingPharmacy?.primary_color,
                }),
                signal: emailController.signal,
              },
            );
            clearTimeout(emailTimeout);

            const emailData = await emailResponse.json();
            emailSent = emailData.success || false;
          } catch {
            // Email failed silently
          }
        }

        return NextResponse.json({
          success: true,
          existing: true,
          message:
            "A payment link was already generated for this prescription. Email has been resent.",
          paymentUrl: existingPayment.payment_link_url,
          paymentToken: existingPayment.payment_token,
          transactionId: existingPayment.id,
          expiresAt: existingPayment.payment_link_expires_at,
          emailSent,
          paymentGateway: existingPayment.payment_gateway || "authorizenet",
        });
      }
    }

    // Get provider details
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, first_name, last_name")
      .eq("user_id", userId || prescription.prescriber_id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider profile not found" },
        { status: 404 },
      );
    }

    const pharmacyConfig = prescription.pharmacy_id
      ? await getActivePaymentConfig(prescription.pharmacy_id)
      : null;

    let paymentGateway: "stripe" | "authorizenet";
    if (pharmacyConfig) {
      paymentGateway = pharmacyConfig.gateway;
    } else {
      const rawGateway = body.paymentGateway || "authorizenet";
      paymentGateway = rawGateway === "stripe" ? "stripe" : "authorizenet";
    }

    if (paymentGateway === "authorizenet") {
      const hasPharmacyAuthnet = pharmacyConfig?.gateway === "authorizenet" && pharmacyConfig.authnetApiLoginId && pharmacyConfig.authnetTransactionKey;
      const hasSystemAuthnet = envConfig.AUTHNET_API_LOGIN_ID && envConfig.AUTHNET_TRANSACTION_KEY;
      if (!hasPharmacyAuthnet && !hasSystemAuthnet) {
        return NextResponse.json(
          { error: "Authorize.Net is not configured. Please contact administrator." },
          { status: 500 },
        );
      }
    } else if (paymentGateway === "stripe") {
      const hasPharmacyStripe = pharmacyConfig?.gateway === "stripe" && pharmacyConfig.stripeSecretKey;
      const hasSystemStripe = envConfig.STRIPE_SECRET_KEY;
      if (!hasPharmacyStripe && !hasSystemStripe) {
        return NextResponse.json(
          { error: "Stripe is not configured. Please contact administrator." },
          { status: 500 },
        );
      }
    }

    const totalAmountCents = consultationFeeCents + medicationCostCents + (shippingFeeCents || 0);
    const totalAmountDollars = (totalAmountCents / 100).toFixed(2);

    const paymentToken = crypto.randomBytes(32).toString("hex");

    const authnetRefId = paymentGateway === "authorizenet"
      ? `PAY${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.substring(0, 20)
      : null;

    // Create payment transaction record
    const patient = Array.isArray(prescription.patient)
      ? prescription.patient[0]
      : prescription.patient;
    const pharmacy = Array.isArray(prescription.pharmacy)
      ? prescription.pharmacy[0]
      : prescription.pharmacy;

    const { data: paymentTransaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        prescription_id: prescriptionId,
        total_amount_cents: totalAmountCents,
        consultation_fee_cents: consultationFeeCents,
        medication_cost_cents: medicationCostCents,
        shipping_fee_cents: shippingFeeCents || 0,
        patient_id: prescription.patient_id,
        patient_email: patient?.email,
        patient_phone: patient?.phone,
        patient_name: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown",
        provider_id: provider.id,
        provider_name: `${provider.first_name} ${provider.last_name}`,
        pharmacy_id: prescription.pharmacy_id,
        pharmacy_name: pharmacy?.name,
        payment_token: paymentToken,
        payment_gateway: paymentGateway,
        payment_config_id: pharmacyConfig?.id || null,
        authnet_ref_id: authnetRefId,
        payment_status: "pending",
        order_progress: "payment_pending",
        description:
          description ||
          `Payment for ${prescription.medication} - ${patient?.first_name} ${patient?.last_name}`,
        payment_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .select()
      .single();

    if (transactionError) {
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 },
      );
    }

    // Use the hosted payment flow - redirect to our payment overview page
    // which will then redirect to Authorize.Net's hosted payment page
    const appUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";
    const fullPaymentUrl = `${appUrl}/payment/${paymentToken}`;

    // Update payment transaction with the payment URL
    await supabase
      .from("payment_transactions")
      .update({
        payment_link_url: fullPaymentUrl,
      })
      .eq("id", paymentTransaction.id);

    // Update prescription payment status
    await supabase
      .from("prescriptions")
      .update({
        payment_status: "pending",
        payment_transaction_id: paymentTransaction.id,
      })
      .eq("id", prescriptionId);

    // Send email to patient if requested
    let emailSent = false;
    if (sendEmail && (patientEmail || patient?.email)) {
      try {
        const emailController = new AbortController();
        const emailTimeout = setTimeout(() => emailController.abort(), 10000); // 10s timeout

        const emailResponse = await fetch(
          `${appUrl}/api/payments/send-payment-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-api-key": INTERNAL_API_KEY || "",
            },
            body: JSON.stringify({
              patientEmail: patientEmail || patient?.email,
              patientName: patient
                ? `${patient.first_name} ${patient.last_name}`
                : "Valued Patient",
              providerName: `${provider.first_name} ${provider.last_name}`,
              medication: prescription.medication,
              totalAmount: totalAmountDollars,
              paymentUrl: fullPaymentUrl,
              paymentToken,
              pharmacyName: pharmacy?.name,
              pharmacyLogoUrl: pharmacy?.logo_url,
              pharmacyColor: pharmacy?.primary_color,
            }),
            signal: emailController.signal,
          },
        );
        clearTimeout(emailTimeout);

        const emailData = await emailResponse.json();
        emailSent = emailData.success || false;
      } catch {
        // Email failed silently
      }
    }

    return NextResponse.json({
      success: true,
      paymentUrl: fullPaymentUrl,
      paymentToken,
      transactionId: paymentTransaction.id,
      expiresAt: paymentTransaction.payment_link_expires_at,
      emailSent,
      paymentGateway,
    });
  } catch (error) {
    console.error("[GENERATE-LINK] ========== FATAL ERROR ==========");
    console.error(
      "[GENERATE-LINK] Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "[GENERATE-LINK] Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "[GENERATE-LINK] Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate payment link",
      },
      { status: 500 },
    );
  }
}
