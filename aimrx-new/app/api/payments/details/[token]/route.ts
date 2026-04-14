import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

/**
 * GET /api/payments/details/[token]
 * Get payment details by token (for patient magic link)
 * No authentication required - uses secure token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Payment token is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: payment, error } = await supabase
      .from("payment_transactions")
      .select("*, pharmacy:pharmacies(logo_url, primary_color, phone)")
      .eq("payment_token", token)
      .single();

    if (error || !payment) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment not found or link is invalid"
        },
        { status: 404 }
      );
    }

    // Check if payment link has expired
    const expiresAt = payment.payment_link_expires_at
      ? new Date(payment.payment_link_expires_at)
      : null;
    const now = new Date();

    if (expiresAt && expiresAt < now) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment link has expired",
        },
        { status: 410 }
      );
    }

    const pharmacy = Array.isArray(payment.pharmacy)
      ? payment.pharmacy[0]
      : payment.pharmacy;

    // Fetch prescriptions linked to this payment
    const { data: linkedRx } = await supabase
      .from("prescriptions")
      .select("id, medication, quantity, patient_price, shipping_fee_cents, profit_cents, status, payment_status")
      .eq("payment_transaction_id", payment.id);

    let prescriptions = linkedRx || [];

    // If no linked Rx found, try by prescription_id
    if (prescriptions.length === 0 && payment.prescription_id) {
      const { data: singleRx } = await supabase
        .from("prescriptions")
        .select("id, medication, quantity, patient_price, shipping_fee_cents, profit_cents, status, payment_status")
        .eq("id", payment.prescription_id);
      if (singleRx) prescriptions = singleRx;
    }

    // Group Rx lookup
    if (prescriptions.length > 0) {
      try {
        const { data: probe } = await (supabase.from("prescriptions") as any)
          .select("order_group_id")
          .eq("id", prescriptions[0].id)
          .single();
        if (probe?.order_group_id) {
          const existingIds = prescriptions.map((rx: any) => rx.id);
          const { data: groupRxs } = await (supabase.from("prescriptions") as any)
            .select("id, medication, quantity, patient_price, shipping_fee_cents, profit_cents, status, payment_status")
            .eq("order_group_id", probe.order_group_id);
          if (groupRxs) {
            for (const grx of groupRxs) {
              if (!existingIds.includes(grx.id)) {
                prescriptions.push(grx);
              }
            }
          }
        }
      } catch { /* order_group_id may not exist */ }
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        totalAmountCents: payment.total_amount_cents,
        consultationFeeCents: payment.consultation_fee_cents,
        medicationCostCents: payment.medication_cost_cents,
        shippingFeeCents: payment.shipping_fee_cents,
        patientName: payment.patient_name,
        patientEmail: payment.patient_email,
        providerName: payment.provider_name,
        pharmacyName: payment.pharmacy_name,
        description: payment.description,
        paymentLinkUrl: payment.payment_link_url,
        paymentStatus: payment.payment_status,
        orderProgress: payment.order_progress,
        deliveryMethod: payment.delivery_method || "pickup",
        paymentGateway: payment.payment_gateway || "authorizenet",
        expiresAt: payment.payment_link_expires_at,
        pharmacyLogoUrl: pharmacy?.logo_url || null,
        pharmacyColor: pharmacy?.primary_color || null,
        pharmacyPhone: pharmacy?.phone || null,
        prescriptions: prescriptions.map((rx: any) => ({
          id: rx.id,
          medication: rx.medication,
          quantity: rx.quantity,
          patientPrice: rx.patient_price,
          shippingFeeCents: rx.shipping_fee_cents,
          profitCents: rx.profit_cents,
          status: rx.status,
          paymentStatus: rx.payment_status,
        })),
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load payment details",
      },
      { status: 500 }
    );
  }
}
