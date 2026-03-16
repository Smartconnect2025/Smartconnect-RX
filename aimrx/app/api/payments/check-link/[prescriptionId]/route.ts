import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

/**
 * GET /api/payments/status/[prescriptionId]
 * Check if a payment link exists for a prescription
 * Returns existing link info if found, or null if no link exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ prescriptionId: string }> }
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (userRole !== "provider") {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 }
      );
    }

    const { prescriptionId } = await params;

    const supabase = createAdminClient();

    // Verify the provider owns this prescription
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id, prescriber_id, payment_status")
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to view this prescription" },
        { status: 403 }
      );
    }

    // Check if prescription is already paid
    if (prescription.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        hasExistingLink: false,
        isPaid: true,
      });
    }

    // Look for existing payment transaction
    const { data: existingPayment } = await supabase
      .from("payment_transactions")
      .select(
        "id, payment_link_url, payment_token, payment_link_expires_at, total_amount_cents, consultation_fee_cents, medication_cost_cents, shipping_fee_cents, description, patient_email"
      )
      .eq("prescription_id", prescriptionId)
      .eq("payment_status", "pending")
      .single();

    if (!existingPayment) {
      return NextResponse.json({
        success: true,
        hasExistingLink: false,
        isPaid: false,
      });
    }

    // Check if link is expired
    const isExpired =
      existingPayment.payment_link_expires_at &&
      new Date(existingPayment.payment_link_expires_at) < new Date();

    if (isExpired) {
      // Delete expired link
      await supabase
        .from("payment_transactions")
        .delete()
        .eq("id", existingPayment.id);

      return NextResponse.json({
        success: true,
        hasExistingLink: false,
        isPaid: false,
        expiredLinkDeleted: true,
      });
    }

    // Return existing link info
    return NextResponse.json({
      success: true,
      hasExistingLink: true,
      isPaid: false,
      existingLink: {
        paymentUrl: existingPayment.payment_link_url,
        paymentToken: existingPayment.payment_token,
        expiresAt: existingPayment.payment_link_expires_at,
        totalAmountCents: existingPayment.total_amount_cents,
        consultationFeeCents: existingPayment.consultation_fee_cents,
        medicationCostCents: existingPayment.medication_cost_cents,
        shippingFeeCents: existingPayment.shipping_fee_cents,
        description: existingPayment.description,
        patientEmail: existingPayment.patient_email,
      },
    });
  } catch (error) {
    console.error("[PAYMENT:status] Error:", error);
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/check-link/[prescriptionId]
 * Delete a pending payment link for a prescription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ prescriptionId: string }> }
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (userRole !== "provider") {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 }
      );
    }

    const { prescriptionId } = await params;

    const supabase = createAdminClient();

    // Verify the provider owns this prescription
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id, prescriber_id, payment_status")
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to modify this prescription" },
        { status: 403 }
      );
    }

    // Only allow deleting if payment is not already completed
    if (prescription.payment_status === "paid") {
      return NextResponse.json(
        { error: "Cannot delete a payment link for a paid prescription" },
        { status: 400 }
      );
    }

    // Delete pending payment transaction
    const { error: deleteError } = await supabase
      .from("payment_transactions")
      .delete()
      .eq("prescription_id", prescriptionId)
      .eq("payment_status", "pending");

    if (deleteError) {
      console.error("[PAYMENT:delete] Error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete payment link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PAYMENT:delete] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment link" },
      { status: 500 }
    );
  }
}
