import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { validateDelegatedAction } from "@/core/lib/delegations/validate";

/**
 * GET /api/delegate/providers/[providerId]/patients/[patientId]/refillable
 *
 * Returns the patient's prescriptions that still have refills remaining,
 * scoped to the provider the delegate is authorized for. Used by the
 * delegate dashboard to show "Submit Refill" actions.
 */
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ providerId: string; patientId: string }> },
) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  const { providerId, patientId } = await params;

  const validation = await validateDelegatedAction({
    delegateUserId: user.id,
    providerId,
    action: "submit_refill",
  });
  if (!validation.allowed) {
    return NextResponse.json({ error: validation.reason }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Confirm the patient is on the provider's panel before showing anything.
  const { data: mapping } = await supabase
    .from("provider_patient_mappings")
    .select("id")
    .eq("provider_id", providerId)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!mapping) {
    return NextResponse.json(
      { error: "Patient is not on this provider's panel" },
      { status: 403 },
    );
  }

  // Refillable = original prescription (not a refill itself), prescribed by
  // THIS provider, with refills > 0. We intentionally only surface Rx that
  // belong to this provider so the delegate cannot trigger refills written
  // by some other doctor.
  const { data, error } = await supabase
    .from("prescriptions")
    .select(
      `id, medication, dosage, dosage_amount, dosage_unit, vial_size, form,
       quantity, refills, sig, dispense_as_written, pharmacy_notes,
       pharmacy_id, medication_id, profit_cents, consultation_reason,
       shipping_fee_cents, refill_frequency_days, total_refills_to_date,
       submitted_at`,
    )
    .eq("prescriber_id", validation.providerUserId)
    .eq("patient_id", patientId)
    .eq("prescription_type", "prescription")
    .gt("refills", 0)
    .neq("status", "cancelled")
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load refillable prescriptions", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ prescriptions: data ?? [] });
}
