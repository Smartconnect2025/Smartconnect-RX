import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

/**
 * GET /api/payments/status/[token]
 * Get order status by payment token (for tracking page)
 * No authentication required - uses secure token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: "Payment token is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get payment transaction with order progress
    const { data: order, error } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", token)
      .single();

    if (error || !order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found or tracking link is invalid",
        },
        { status: 404 }
      );
    }

    // Return order status (without sensitive payment details)
    return NextResponse.json({
      success: true,
      order: {
        orderProgress: order.order_progress,
        paymentStatus: order.payment_status,
        patientName: order.patient_name,
        description: order.description,
        totalAmountCents: order.total_amount_cents,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        trackingNumber: order.tracking_number,
        trackingUrl: order.tracking_url,
        providerName: order.provider_name,
        pharmacyName: order.pharmacy_name,
      },
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load order status",
      },
      { status: 500 }
    );
  }
}
