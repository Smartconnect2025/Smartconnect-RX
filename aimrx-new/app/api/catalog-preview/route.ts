import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: allMedications, error: medsError } = await supabase
      .from("pharmacy_medications")
      .select(
        `
        *,
        pharmacy:pharmacies!inner(
          id,
          name,
          slug,
          primary_color,
          tagline
        )
      `
      )
      .eq("is_active", true)
      .eq("pharmacy.is_active", true)
      .order("name", { ascending: true });

    if (medsError) {
      console.error("Error fetching medications:", medsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch catalog" },
        { status: 500 }
      );
    }

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, name, slug, description, image_url, color, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    const medicationsTransformed = (allMedications || []).map((med: Record<string, unknown>) => {
      const basePrice =
        (med.aimrx_site_pricing_cents as number) ||
        (med.notes ? parseInt(med.notes as string) : (med.retail_price_cents as number));

      const {
        retail_price_cents: _retail,
        notes: _notes,
        ...providerFields
      } = med;

      return {
        ...providerFields,
        pharmacy: med.pharmacy,
        aimrx_site_pricing_cents: basePrice,
      };
    });

    return NextResponse.json({
      success: true,
      medications: medicationsTransformed,
      categories: categoriesData || [],
    });
  } catch (error) {
    console.error("Error fetching catalog preview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}
