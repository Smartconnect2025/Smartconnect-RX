import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

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

    const { data: order, error } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("payment_token", token)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found or tracking link is invalid" },
        { status: 404 }
      );
    }

    let prescriptions: Array<{
      id: string;
      medication: string;
      status: string;
      paymentStatus: string | null;
      patientPrice: number | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
    }> = [];

    const { data: linkedRxs } = await supabase
      .from("prescriptions")
      .select("id, medication, status, payment_status, patient_price, tracking_number, tracking_url")
      .eq("payment_transaction_id", order.id);

    if (linkedRxs && linkedRxs.length > 0) {
      prescriptions = linkedRxs.map((rx) => ({
        id: rx.id,
        medication: rx.medication || "Unknown",
        status: rx.status || "pending",
        paymentStatus: rx.payment_status || null,
        patientPrice: rx.patient_price ? Number(rx.patient_price) : null,
        trackingNumber: rx.tracking_number || null,
        trackingUrl: rx.tracking_url || null,
      }));
    } else if (order.prescription_id) {
      const { data: rx } = await supabase
        .from("prescriptions")
        .select("id, medication, status, payment_status, patient_price, tracking_number, tracking_url, order_group_id")
        .eq("id", order.prescription_id)
        .single();

      if (rx) {
        prescriptions = [{
          id: rx.id,
          medication: rx.medication || "Unknown",
          status: rx.status || "pending",
          paymentStatus: rx.payment_status || null,
          patientPrice: rx.patient_price ? Number(rx.patient_price) : null,
          trackingNumber: rx.tracking_number || null,
          trackingUrl: rx.tracking_url || null,
        }];

        if (rx.order_group_id) {
          const { data: groupRxs } = await supabase
            .from("prescriptions")
            .select("id, medication, status, payment_status, patient_price, tracking_number, tracking_url")
            .eq("order_group_id", rx.order_group_id)
            .neq("id", rx.id);

          if (groupRxs) {
            for (const grx of groupRxs) {
              prescriptions.push({
                id: grx.id,
                medication: grx.medication || "Unknown",
                status: grx.status || "pending",
                paymentStatus: grx.payment_status || null,
                patientPrice: grx.patient_price ? Number(grx.patient_price) : null,
                trackingNumber: grx.tracking_number || null,
                trackingUrl: grx.tracking_url || null,
              });
            }
          }
        }
      }
    }

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
        refundAmountCents: order.refund_amount_cents || 0,
        prescriptions,
      },
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load order status" },
      { status: 500 }
    );
  }
}
