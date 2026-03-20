import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = createAdminClient();

  try {
    // Get ExperienceCare pharmacy
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("name", "ExperienceCare")
      .single();

    if (pharmacyError || !pharmacy) {
      return NextResponse.json(
        { success: false, error: "ExperienceCare pharmacy not found" },
        { status: 404 }
      );
    }

    // Check if medication already exists
    const { data: existing } = await supabase
      .from("pharmacy_medications")
      .select("id")
      .eq("pharmacy_id", pharmacy.id)
      .eq("name", "Smartconnect Test Medication2")
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Medication already exists",
        medication: existing,
      });
    }

    // Create test medication
    const { data: medication, error: medError } = await supabase
      .from("pharmacy_medications")
      .insert({
        pharmacy_id: pharmacy.id,
        name: "Smartconnect Test Medication2",
        description: "Test medication for ExperienceCare pharmacy",
        category: "supplements",
        dosage: "100mg",
        price: 29.99,
        stripe_price_id: null,
        inventory_count: 100,
        low_stock_threshold: 10,
        requires_prescription: true,
        is_active: true,
      })
      .select()
      .single();

    if (medError) {
      console.error("Error creating medication:", medError);
      return NextResponse.json(
        { success: false, error: medError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "ExperienceCare test medication created",
      pharmacy: { id: pharmacy.id, name: "ExperienceCare" },
      medication: medication,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
