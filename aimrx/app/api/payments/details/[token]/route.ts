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

    // Get payment transaction by token
    const { data: payment, error } = await supabase
      .from("payment_transactions")
      .select("*")
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

    // Return payment details (without sensitive info)
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
        expiresAt: payment.payment_link_expires_at,
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
