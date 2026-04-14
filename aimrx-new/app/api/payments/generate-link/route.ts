import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import { getActivePaymentConfig } from "@/core/services/pharmacyPaymentConfigService";
import crypto from "crypto";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  const claimedRxIds: string[] = [];
  const supabase = createAdminClient();

  try {
    const internalKey = request.headers.get("x-internal-api-key");
    const isInternalCall = !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY);

    let userId: string | null = null;
    let userRole: string | null = null;

    if (isInternalCall) {
      userRole = "internal";
    } else {
      const authResult = await getUser();

      if (!authResult.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      if (!authResult.userRole || !["provider", "admin", "super_admin"].includes(authResult.userRole)) {
        return NextResponse.json(
          { error: "Provider, admin, or super_admin access required" },
          { status: 403 },
        );
      }

      userId = authResult.user.id;
      userRole = authResult.userRole;
    }

    const body = await request.json();
    const {
      prescriptionId,
      prescriptionIds: rawPrescriptionIds,
      consultationFeeCents,
      medicationCostCents,
      shippingFeeCents,
      description,
      patientEmail,
      sendEmail,
    } = body;

    const prescriptionIds: string[] = Array.isArray(rawPrescriptionIds) && rawPrescriptionIds.length > 0
      ? rawPrescriptionIds
      : prescriptionId ? [prescriptionId] : [];

    const primaryPrescriptionId = prescriptionId || prescriptionIds[0];

    if (!primaryPrescriptionId) {
      return NextResponse.json(
        { error: "prescriptionId is required" },
        { status: 400 },
      );
    }

    if (!prescriptionIds.includes(primaryPrescriptionId)) {
      prescriptionIds.unshift(primaryPrescriptionId);
    }

    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select(
        `id, patient_id, prescriber_id, pharmacy_id, medication, quantity, payment_status, payment_transaction_id,
        patient:patients(id, first_name, last_name, email, phone),
        pharmacy:pharmacies(id, name, logo_url, primary_color)`,
      )
      .eq("id", primaryPrescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (prescription.payment_status === "paid") {
      return NextResponse.json(
        { error: "This prescription has already been paid" },
        { status: 400 },
      );
    }

    if (userRole === "provider" && prescription.prescriber_id !== userId) {
      return NextResponse.json(
        { error: "You do not have permission to bill for this prescription" },
        { status: 403 },
      );
    }

    if (prescriptionIds.length > 1) {
      const { data: otherRxList, error: otherRxError } = await supabase
        .from("prescriptions")
        .select("id, prescriber_id, patient_id, payment_status")
        .in("id", prescriptionIds);

      if (otherRxError || !otherRxList || otherRxList.length !== prescriptionIds.length) {
        return NextResponse.json(
          { error: "One or more prescription IDs are invalid" },
          { status: 400 },
        );
      }

      for (const rx of otherRxList) {
        if (userRole === "provider" && rx.prescriber_id !== userId) {
          return NextResponse.json(
            { error: `You do not have permission to bill for prescription ${rx.id}` },
            { status: 403 },
          );
        }
        if (rx.patient_id !== prescription.patient_id) {
          return NextResponse.json(
            { error: "All prescriptions must belong to the same patient" },
            { status: 400 },
          );
        }
        if (rx.payment_status === "paid") {
          return NextResponse.json(
            { error: `Prescription ${rx.id} has already been paid` },
            { status: 400 },
          );
        }
      }
    }

    // 3-level existing link lookup
    let existingPayment = null;

    // Level 1: by prescription_id
    const { data: byPrescription } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("prescription_id", primaryPrescriptionId)
      .in("payment_status", ["pending", "processing"])
      .single();
    if (byPrescription) existingPayment = byPrescription;

    // Level 2: by payment_transaction_id from any prescription in group
    if (!existingPayment && prescription.payment_transaction_id) {
      const { data: byTxId } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("id", prescription.payment_transaction_id)
        .in("payment_status", ["pending", "processing"])
        .single();
      if (byTxId) existingPayment = byTxId;
    }

    // Level 3: by order_group_id
    if (!existingPayment) {
      try {
        const { data: probe } = await (supabase.from("prescriptions") as any)
          .select("order_group_id")
          .eq("id", primaryPrescriptionId)
          .single();
        if (probe?.order_group_id) {
          const { data: groupRxs } = await (supabase.from("prescriptions") as any)
            .select("payment_transaction_id")
            .eq("order_group_id", probe.order_group_id)
            .not("payment_transaction_id", "is", null);
          if (groupRxs) {
            for (const grx of groupRxs) {
              const { data: byGroupTx } = await supabase
                .from("payment_transactions")
                .select("*")
                .eq("id", grx.payment_transaction_id)
                .in("payment_status", ["pending", "processing"])
                .single();
              if (byGroupTx) {
                existingPayment = byGroupTx;
                break;
              }
            }
          }
        }
      } catch { /* order_group_id may not exist */ }
    }

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

        let emailSentResult = false;
        const appUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

        if (sendEmail && (patientEmail || patient?.email)) {
          try {
            const emailController = new AbortController();
            const emailTimeout = setTimeout(() => emailController.abort(), 10000);

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
                  totalAmount: (existingPayment.total_amount_cents / 100).toFixed(2),
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
            emailSentResult = emailData.success || false;
          } catch { /* silent */ }
        }

        return NextResponse.json({
          success: true,
          existing: true,
          message: "A payment link was already generated for this prescription. Email has been resent.",
          paymentUrl: existingPayment.payment_link_url,
          paymentToken: existingPayment.payment_token,
          transactionId: existingPayment.id,
          expiresAt: existingPayment.payment_link_expires_at,
          emailSent: emailSentResult,
          paymentGateway: existingPayment.payment_gateway || "authorizenet",
        });
      }
    }

    // Race condition protection — claim prescriptions
    for (const rxId of prescriptionIds) {
      const { data: claimed } = await supabase
        .from("prescriptions")
        .update({ payment_status: "link_generating" })
        .eq("id", rxId)
        .eq("payment_status", "pending")
        .select("id");
      if (claimed && claimed.length > 0) claimedRxIds.push(rxId);
    }

    if (claimedRxIds.length !== prescriptionIds.length) {
      for (const rxId of claimedRxIds) {
        await supabase
          .from("prescriptions")
          .update({ payment_status: "pending" })
          .eq("id", rxId)
          .eq("payment_status", "link_generating");
      }
      claimedRxIds.length = 0;
      return NextResponse.json(
        { error: "One or more prescriptions are already being processed. Please try again." },
        { status: 409 },
      );
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, first_name, last_name")
      .eq("user_id", userId || prescription.prescriber_id)
      .single();

    async function revertClaimedRxIds() {
      for (const rxId of claimedRxIds) {
        try {
          await supabase
            .from("prescriptions")
            .update({ payment_status: "pending" })
            .eq("id", rxId)
            .eq("payment_status", "link_generating");
        } catch { /* best effort */ }
      }
      claimedRxIds.length = 0;
    }

    if (providerError || !provider) {
      await revertClaimedRxIds();
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
        await revertClaimedRxIds();
        return NextResponse.json(
          { error: "Authorize.Net is not configured. Please contact administrator." },
          { status: 500 },
        );
      }
    } else if (paymentGateway === "stripe") {
      const hasPharmacyStripe = pharmacyConfig?.gateway === "stripe" && pharmacyConfig.stripeSecretKey;
      const hasSystemStripe = envConfig.STRIPE_SECRET_KEY;
      if (!hasPharmacyStripe && !hasSystemStripe) {
        await revertClaimedRxIds();
        return NextResponse.json(
          { error: "Stripe is not configured. Please contact administrator." },
          { status: 500 },
        );
      }
    }

    // Server-authoritative price calculation
    const { data: dbRxPrices } = await supabase
      .from("prescriptions")
      .select("patient_price, shipping_fee_cents, profit_cents")
      .in("id", prescriptionIds);

    let serverTotalMedCents = 0;
    let serverTotalShipCents = 0;
    let serverTotalOversightCents = 0;

    if (dbRxPrices) {
      for (const rx of dbRxPrices) {
        serverTotalMedCents += Math.round(parseFloat(rx.patient_price || "0") * 100);
        serverTotalShipCents += rx.shipping_fee_cents || 0;
        serverTotalOversightCents += rx.profit_cents || 0;
      }
    }

    const serverTotalCents = serverTotalMedCents + serverTotalShipCents + serverTotalOversightCents;
    const clientTotalCents = (Number(consultationFeeCents) || 0) + (Number(medicationCostCents) || 0) + (Number(shippingFeeCents) || 0);

    const totalAmountCents = serverTotalCents > 0 ? serverTotalCents : clientTotalCents;
    const finalMedCents = serverTotalCents > 0 ? serverTotalMedCents : (Number(medicationCostCents) || 0);
    const finalShipCents = serverTotalCents > 0 ? serverTotalShipCents : (Number(shippingFeeCents) || 0);
    const finalOversightCents = serverTotalCents > 0 ? serverTotalOversightCents : (Number(consultationFeeCents) || 0);

    if (serverTotalCents > 0 && Math.abs(serverTotalCents - clientTotalCents) > 1) {
      console.warn(`[GENERATE-LINK] Price mismatch: server=${serverTotalCents}, client=${clientTotalCents}. Using server value.`);
    }

    const totalAmountDollars = (totalAmountCents / 100).toFixed(2);

    const paymentToken = crypto.randomBytes(32).toString("hex");
    const authnetRefId = paymentGateway === "authorizenet"
      ? `PAY${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.substring(0, 20)
      : null;

    const patient = Array.isArray(prescription.patient)
      ? prescription.patient[0]
      : prescription.patient;
    const pharmacy = Array.isArray(prescription.pharmacy)
      ? prescription.pharmacy[0]
      : prescription.pharmacy;

    const { data: paymentTransaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        prescription_id: primaryPrescriptionId,
        total_amount_cents: totalAmountCents,
        consultation_fee_cents: finalOversightCents,
        medication_cost_cents: finalMedCents,
        shipping_fee_cents: finalShipCents,
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
          (prescriptionIds.length > 1
            ? `Payment for ${prescriptionIds.length} medications - ${patient?.first_name} ${patient?.last_name}`
            : `Payment for ${prescription.medication} - ${patient?.first_name} ${patient?.last_name}`),
        payment_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .select()
      .single();

    if (transactionError) {
      await revertClaimedRxIds();
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 },
      );
    }

    const appUrl = envConfig.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";
    const fullPaymentUrl = `${appUrl}/payment/${paymentToken}`;

    await supabase
      .from("payment_transactions")
      .update({ payment_link_url: fullPaymentUrl })
      .eq("id", paymentTransaction.id);

    for (const rxId of prescriptionIds) {
      await supabase
        .from("prescriptions")
        .update({
          payment_status: "pending",
          payment_transaction_id: paymentTransaction.id,
        })
        .eq("id", rxId);
    }
    claimedRxIds.length = 0;

    let emailSent = false;
    if (sendEmail && (patientEmail || patient?.email)) {
      try {
        const emailController = new AbortController();
        const emailTimeout = setTimeout(() => emailController.abort(), 10000);

        const { data: allRxForEmail } = prescriptionIds.length > 1
          ? await supabase
              .from("prescriptions")
              .select("medication, patient_price, shipping_fee_cents")
              .in("id", prescriptionIds)
          : { data: null };

        const medications = allRxForEmail
          ? allRxForEmail.map((rx: any) => ({
              name: rx.medication,
              price: parseFloat(rx.patient_price || "0").toFixed(2),
              shippingFee: rx.shipping_fee_cents > 0 ? (rx.shipping_fee_cents / 100).toFixed(2) : undefined,
            }))
          : undefined;

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
              patientPhone: patient?.phone,
              patientName: patient
                ? `${patient.first_name} ${patient.last_name}`
                : "Valued Patient",
              providerName: `${provider.first_name} ${provider.last_name}`,
              medication: prescription.medication,
              medications,
              oversightFee: finalOversightCents > 0 ? (finalOversightCents / 100).toFixed(2) : undefined,
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
      } catch { /* silent */ }
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
    console.error("[GENERATE-LINK] Error:", error instanceof Error ? error.message : String(error));
    console.error("[GENERATE-LINK] Stack:", error instanceof Error ? error.stack : "No stack");

    for (const rxId of claimedRxIds) {
      try {
        await supabase
          .from("prescriptions")
          .update({ payment_status: "pending" })
          .eq("id", rxId)
          .eq("payment_status", "link_generating");
      } catch { /* best effort */ }
    }

    return NextResponse.json(
      { success: false, error: "Failed to generate payment link" },
      { status: 500 },
    );
  }
}
