import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * Seed ExperienceCare pharmacy with test medication
 * POST /api/admin/seed-experiencecare
 */
export async function POST() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

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
