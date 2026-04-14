import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";
import { getActivePaymentConfig } from "@/core/services/pharmacyPaymentConfigService";
import Stripe from "stripe";

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
    const { paymentToken, paymentMethodId, paymentIntentId } = body;

    if (!paymentToken) {
      return NextResponse.json(
        { success: false, error: "Payment token is required" },
        { status: 400 },
      );
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "Payment method ID is required" },
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
      .in("payment_status", paymentIntentId ? ["pending", "processing"] : [transaction.payment_status])
      .select("id");

    if (!claimedRows || claimedRows.length === 0) {
      if (paymentIntentId && transaction.payment_status === "completed") {
        const cardLast4 = undefined;
        return NextResponse.json({
          success: true,
          transactionId: paymentIntentId,
          cardLastFour: cardLast4,
          message: "Payment already processed",
        });
      }
      return NextResponse.json(
        { success: false, error: "This payment is already being processed" },
        { status: 409 },
      );
    }

    claimedTransactionId = transaction.id;

    let stripeSecretKey: string | undefined;
    if (transaction.pharmacy_id) {
      const pharmacyConfig = await getActivePaymentConfig(transaction.pharmacy_id);
      if (pharmacyConfig?.stripeSecretKey) {
        stripeSecretKey = pharmacyConfig.stripeSecretKey;
      }
    }
    if (!stripeSecretKey) {
      stripeSecretKey = envConfig.STRIPE_SECRET_KEY;
    }

    if (!stripeSecretKey) {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;
      return NextResponse.json(
        { success: false, error: "Stripe is not configured" },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const totalAmountCents = transaction.total_amount_cents;

    if (paymentIntentId) {
      console.log(`[CHARGE-STRIPE] SCA finalization for PI ${paymentIntentId}`);
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== "succeeded") {
        await supabase
          .from("payment_transactions")
          .update({ payment_status: "pending" })
          .eq("id", claimedTransactionId);
        claimedTransactionId = null;
        return NextResponse.json(
          { success: false, error: `Payment not completed (status: ${pi.status})` },
          { status: 400 },
        );
      }

      if (transaction.payment_status === "completed") {
        claimedTransactionId = null;
        const cardLast4 = typeof pi.latest_charge === "object" && pi.latest_charge
          ? (pi.latest_charge as Stripe.Charge).payment_method_details?.card?.last4
          : undefined;
        return NextResponse.json({
          success: true,
          transactionId: pi.id,
          cardLastFour: cardLast4,
          message: "Payment already processed",
        });
      }

      const now = new Date().toISOString();
      const cardLast4 = typeof pi.latest_charge === "object" && pi.latest_charge
        ? (pi.latest_charge as Stripe.Charge).payment_method_details?.card?.last4
        : undefined;
      const cardBrand = typeof pi.latest_charge === "object" && pi.latest_charge
        ? (pi.latest_charge as Stripe.Charge).payment_method_details?.card?.brand
        : undefined;

      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "completed",
          order_progress: "payment_received",
          authnet_transaction_id: pi.id,
          card_last_four: cardLast4,
          card_type: cardBrand,
          paid_at: now,
        })
        .eq("id", transaction.id);

      const { data: linkedRxList } = await supabase
        .from("prescriptions")
        .select("id")
        .eq("payment_transaction_id", transaction.id);

      const rxIds = linkedRxList?.map((rx: { id: string }) => rx.id) || [];
      if (rxIds.length === 0 && transaction.prescription_id) {
        rxIds.push(transaction.prescription_id);
      }

      if (rxIds.length > 0) {
        await supabase
          .from("prescriptions")
          .update({
            payment_status: "paid",
            order_progress: "payment_received",
            status: "payment_received",
          })
          .in("id", rxIds);

        for (const rxId of rxIds) {
          try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
            await fetch(`${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": process.env.INTERNAL_API_SECRET || "",
              },
            });
          } catch (err) {
            console.error(`[CHARGE-STRIPE] SCA finalize - pharmacy submit error for ${rxId}:`, err instanceof Error ? err.message : "Unknown");
          }
        }
      }

      claimedTransactionId = null;
      return NextResponse.json({
        success: true,
        transactionId: pi.id,
        cardLastFour: cardLast4,
        message: "Payment finalized after 3D Secure",
      });
    }

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: "usd",
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        metadata: {
          payment_token: paymentToken,
          transaction_id: transaction.id,
          prescription_id: transaction.prescription_id || "",
        },
        receipt_email: transaction.patient_email || undefined,
        description: transaction.description || "Prescription Payment",
      });
    } catch (stripeErr: unknown) {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;

      const msg = stripeErr instanceof Stripe.errors.StripeCardError
        ? stripeErr.message
        : stripeErr instanceof Error
          ? stripeErr.message
          : "Card payment failed";

      console.error("[CHARGE-STRIPE] PaymentIntent error:", msg);
      return NextResponse.json(
        { success: false, error: msg },
        { status: 402 },
      );
    }

    if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending", authnet_transaction_id: paymentIntent.id })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;

      return NextResponse.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        error: "Additional authentication required",
      });
    }

    if (paymentIntent.status !== "succeeded") {
      await supabase
        .from("payment_transactions")
        .update({ payment_status: "pending" })
        .eq("id", claimedTransactionId);
      claimedTransactionId = null;

      return NextResponse.json(
        { success: false, error: `Payment not completed. Status: ${paymentIntent.status}` },
        { status: 422 },
      );
    }

    let cardLastFour: string | undefined;
    let cardBrand: string | undefined;

    try {
      const charge = paymentIntent.latest_charge;
      if (typeof charge === "string") {
        const chargeObj = await stripe.charges.retrieve(charge);
        cardLastFour = chargeObj.payment_method_details?.card?.last4 || undefined;
        cardBrand = chargeObj.payment_method_details?.card?.brand || undefined;
      } else if (charge && typeof charge === "object") {
        cardLastFour = (charge as Stripe.Charge).payment_method_details?.card?.last4 || undefined;
        cardBrand = (charge as Stripe.Charge).payment_method_details?.card?.brand || undefined;
      }
    } catch {
      console.warn("[CHARGE-STRIPE] Could not retrieve card details");
    }

    const now = new Date().toISOString();
    const { error: updateTxError } = await supabase
      .from("payment_transactions")
      .update({
        payment_status: "completed",
        order_progress: "payment_received",
        authnet_transaction_id: paymentIntent.id,
        card_last_four: cardLastFour,
        card_type: cardBrand,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", transaction.id);

    if (updateTxError) {
      console.error("[CHARGE-STRIPE] CRITICAL: Card charged but DB update failed. PI:", paymentIntent.id);
      return NextResponse.json(
        {
          success: false,
          error: "Payment was charged but we failed to update the record. Please contact support.",
          charged: true,
          transactionId: paymentIntent.id,
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
        details: `charge-stripe: ${pharmacyErrors.join("; ")}`,
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
            transactionId: paymentIntent.id,
            paymentMethod: "Credit Card (Stripe)",
            pharmacyName: transaction.pharmacy_name,
            pharmacyId: transaction.pharmacy_id,
            prescriptionId: transaction.prescription_id,
          }),
        });
        emailSent = true;
      } catch (err) {
        console.error("[CHARGE-STRIPE] Email error:", err instanceof Error ? err.message : "Unknown");
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: paymentIntent.id,
      cardLastFour,
      cardType: cardBrand,
      prescriptionUpdated: allRxIds.length > 0,
      pharmacySubmitted,
      emailSent,
      pharmacyWarning,
    });
  } catch (error) {
    console.error("[CHARGE-STRIPE] Error:", error instanceof Error ? error.message : "Unknown");

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
