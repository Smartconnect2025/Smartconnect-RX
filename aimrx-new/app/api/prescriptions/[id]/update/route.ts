import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

/**
 * PATCH /api/prescriptions/[id]/update
 * Updates prescription fields (step 2 fields only)
 * Only allowed when prescription status is "pending_payment"
 */

interface UpdatePrescriptionRequest {
  medication?: string;
  vialSize?: string;
  dosageAmount?: string;
  dosageUnit?: string;
  form?: string;
  quantity?: number;
  refills?: number;
  sig?: string;
  dispenseAsWritten?: boolean;
  pharmacyNotes?: string;
  patientPrice?: string;
  shippingFeeCents?: number;
  profitCents?: number;
  consultationReason?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: prescriptionId } = await params;
    const body: UpdatePrescriptionRequest = await request.json();

    const supabaseAdmin = createAdminClient();

    // Verify prescription exists and belongs to user
    const { data: prescription, error } = await supabaseAdmin
      .from("prescriptions")
      .select("id, prescriber_id, status")
      .eq("id", prescriptionId)
      .single();

    if (error || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Only allow edits when status is pending_payment
    if (prescription.status !== "pending_payment") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot edit prescription — status is not pending_payment",
        },
        { status: 400 },
      );
    }

    // Build update payload mapping camelCase to snake_case
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.medication !== undefined) {
      updateData.medication = body.medication;
    }
    if (body.vialSize !== undefined) {
      updateData.vial_size = body.vialSize;
    }
    if (body.dosageAmount !== undefined) {
      updateData.dosage_amount = body.dosageAmount;
    }
    if (body.dosageUnit !== undefined) {
      updateData.dosage_unit = body.dosageUnit;
    }
    // Update legacy dosage field when amount or unit change
    if (body.dosageAmount !== undefined || body.dosageUnit !== undefined) {
      const amount = body.dosageAmount ?? "";
      const unit = body.dosageUnit ?? "";
      if (amount && unit) {
        updateData.dosage = `${amount}${unit}`;
      }
    }
    if (body.form !== undefined) {
      updateData.form = body.form;
    }
    if (body.quantity !== undefined) {
      updateData.quantity = body.quantity;
    }
    if (body.refills !== undefined) {
      updateData.refills = body.refills;
    }
    if (body.sig !== undefined) {
      updateData.sig = body.sig;
    }
    if (body.dispenseAsWritten !== undefined) {
      updateData.dispense_as_written = body.dispenseAsWritten;
    }
    if (body.pharmacyNotes !== undefined) {
      updateData.pharmacy_notes = body.pharmacyNotes;
    }
    if (body.patientPrice !== undefined) {
      updateData.patient_price = body.patientPrice;
    }
    if (body.shippingFeeCents !== undefined) {
      updateData.shipping_fee_cents = body.shippingFeeCents;
    }
    if (body.profitCents !== undefined) {
      updateData.profit_cents = body.profitCents;
    }
    if (body.consultationReason !== undefined) {
      updateData.consultation_reason = body.consultationReason;
    }

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update(updateData)
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("Error updating prescription:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update prescription" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error updating prescription:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
