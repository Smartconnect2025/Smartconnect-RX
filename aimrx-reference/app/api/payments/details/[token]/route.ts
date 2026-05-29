import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

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
      .select("*")
      .eq("payment_token", token)
      .single();

    if (error || !payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found or link is invalid" },
        { status: 404 }
      );
    }

    // Payment link expiration DISABLED (May 11 2026, Jessica Carroll
    // incident — Joseph rule "cancell the expiration of all payment links
    // across the app"). Links are evergreen until the row is explicitly
    // moved to a terminal status (paid / refunded / cancelled / expired
    // by admin regenerate). The page-level time check is intentionally
    // removed.

    let prescriptions: Array<{
      id: string;
      medication: string;
      dosage: string;
      form: string;
      quantity: number;
      patientPrice: number;
      status: string;
      queueId: string | null;
    }> = [];

    const { data: linkedRxs } = await supabase
      .from("prescriptions")
      .select("id, medication, dosage, form, quantity, patient_price, status, queue_id")
      .eq("payment_transaction_id", payment.id);

    if (linkedRxs && linkedRxs.length > 0) {
      prescriptions = linkedRxs.map((rx) => ({
        id: rx.id,
        medication: rx.medication || "Unknown",
        dosage: rx.dosage || "",
        form: rx.form || "",
        quantity: rx.quantity || 1,
        patientPrice: Number(rx.patient_price) || 0,
        status: rx.status || "pending",
        queueId: rx.queue_id || null,
      }));
    } else if (payment.prescription_id) {
      const { data: rx } = await supabase
        .from("prescriptions")
        .select("id, medication, dosage, form, quantity, patient_price, status, queue_id, order_group_id")
        .eq("id", payment.prescription_id)
        .single();

      if (rx) {
        prescriptions = [{
          id: rx.id,
          medication: rx.medication || "Unknown",
          dosage: rx.dosage || "",
          form: rx.form || "",
          quantity: rx.quantity || 1,
          patientPrice: Number(rx.patient_price) || 0,
          status: rx.status || "pending",
          queueId: rx.queue_id || null,
        }];

        if (rx.order_group_id) {
          const { data: groupRxs } = await supabase
            .from("prescriptions")
            .select("id, medication, dosage, form, quantity, patient_price, status, queue_id")
            .eq("order_group_id", rx.order_group_id)
            .neq("id", rx.id);

          if (groupRxs) {
            for (const grx of groupRxs) {
              prescriptions.push({
                id: grx.id,
                medication: grx.medication || "Unknown",
                dosage: grx.dosage || "",
                form: grx.form || "",
                quantity: grx.quantity || 1,
                patientPrice: Number(grx.patient_price) || 0,
                status: grx.status || "pending",
                queueId: grx.queue_id || null,
              });
            }
          }
        }
      }
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
        expiresAt: payment.payment_link_expires_at,
        prescriptions,
        queueId: prescriptions.length === 1 ? prescriptions[0].queueId : null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load payment details" },
      { status: 500 }
    );
  }
}
