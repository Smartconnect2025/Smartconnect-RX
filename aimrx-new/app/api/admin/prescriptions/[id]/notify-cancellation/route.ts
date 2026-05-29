import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import { sendCancellationEmails } from "@/core/services/cancellation-emails";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (userRole !== "admin" && userRole !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

    const { id: prescriptionId } = await params;
    const body = await request.json().catch(() => ({}));

    const reason: string =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : "Admin cancellation";

    const refundedAmountCents: number | null =
      typeof body?.refundedAmountCents === "number" && body.refundedAmountCents > 0
        ? Math.round(body.refundedAmountCents)
        : null;

    const refundTxId: string | null =
      typeof body?.refundTxId === "string" && body.refundTxId.trim().length > 0
        ? body.refundTxId.trim()
        : null;

    const supabase = createAdminClient();

    // Multi-pharmacy: select pharmacy_id from the prescription so downstream
    // email rendering uses the correct per-pharmacy name lookup.
    const { data: rx, error: rxError } = await supabase
      .from("prescriptions")
      .select(
        "id, queue_id, medication, dosage, quantity, patient_id, prescriber_id, pharmacy_id, payment_transaction_id",
      )
      .eq("id", prescriptionId)
      .single();

    if (rxError || !rx) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    // Multi-pharmacy scope: a pharmacy-scoped admin may only notify
    // cancellations for prescriptions assigned to their own pharmacy.
    // Super-admins act globally. Mirrors /api/prescriptions/[id]/admin-override.
    if (userRole === "admin") {
      const { data: pharmacyAdmin } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .single();

      if (!pharmacyAdmin || pharmacyAdmin.pharmacy_id !== rx.pharmacy_id) {
        return NextResponse.json(
          { success: false, error: "Access denied — prescription not assigned to your pharmacy" },
          { status: 403 },
        );
      }
    }

    let paymentTx: Record<string, unknown> | null = null;
    if (rx.payment_transaction_id) {
      const { data: tx } = await supabase
        .from("payment_transactions")
        .select(
          "id, patient_email, patient_name, provider_name, pharmacy_name, authnet_transaction_id, card_type, card_last_four",
        )
        .eq("id", rx.payment_transaction_id)
        .maybeSingle();
      paymentTx = (tx as Record<string, unknown> | null) || null;
    }

    const result = await sendCancellationEmails({
      prescription: rx,
      paymentTx,
      reason,
      refundedAmountCents,
      adminUserEmail: user.email || "(unknown admin)",
      refundAuthnetTxId: refundTxId,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error("[notify-cancellation] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
