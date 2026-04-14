import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/supabase/admin";
import { createServerClient } from "@core/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from("prescriptions")
      .select(
        `
        id,
        queue_id,
        submitted_at,
        medication,
        dosage,
        dosage_amount,
        dosage_unit,
        vial_size,
        form,
        quantity,
        refills,
        sig,
        dispense_as_written,
        pharmacy_notes,
        patient_price,
        profit_cents,
        consultation_reason,
        refill_frequency_days,
        shipping_fee_cents,
        total_paid_cents,
        status,
        payment_status,
        tracking_number,
        fedex_status,
        tracking_carrier,
        estimated_delivery,
        pharmacy_id,
        pdf_storage_path,
        order_group_id,
        patient_id,
        has_custom_address,
        custom_address,
        patient:patients(first_name, last_name, date_of_birth, email),
        pharmacy:pharmacies(name, primary_color, logo_url, address, phone),
        payment_transactions(id)
      `,
      )
      .eq("prescriber_id", user.id)
      .eq("prescription_type", "prescription")
      .neq("status", "cancelled")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error loading prescriptions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: providerData } = await supabaseAdmin
      .from("providers")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      prescriptions: data || [],
      provider: providerData,
    });
  } catch (err) {
    console.error("Error in prescriptions list:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
