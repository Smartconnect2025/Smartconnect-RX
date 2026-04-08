import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getProviderTierDiscount } from "@core/services/pricing/tierDiscountService";

/**
 * Get Provider's Pharmacy with Medications
 * GET /api/provider/pharmacy
 */
export async function GET() {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { data: userRoleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const isPlatformAdmin = userRoleData?.role === "admin" || userRoleData?.role === "super_admin";

    const { data: pharmacyAdminRows } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id);
    const isPharmacyAdmin = (pharmacyAdminRows || []).length > 0;
    const pharmacyAdminPharmacyId = pharmacyAdminRows?.[0]?.pharmacy_id || null;

    const { data: providerLinks } = await supabase
      .from("provider_pharmacy_links")
      .select("pharmacy_id")
      .eq("provider_id", user.id);
    const linkedPharmacyIds = (providerLinks || []).map((l) => l.pharmacy_id);

    let contextPharmacyId: string | null = null;
    if (isPlatformAdmin) {
      contextPharmacyId = null;
    } else if (isPharmacyAdmin) {
      contextPharmacyId = pharmacyAdminPharmacyId;
    } else if (linkedPharmacyIds.length > 0) {
      contextPharmacyId = linkedPharmacyIds[0];
    }

    let pharmacy = null;
    if (contextPharmacyId) {
      const { data: pharmacyData, error: pharmacyError } = await supabase
        .from("pharmacies")
        .select("*")
        .eq("id", contextPharmacyId)
        .single();

      if (pharmacyError) {
        console.error("Error fetching pharmacy:", pharmacyError);
      } else {
        pharmacy = pharmacyData;
      }
    }

    let discountPercentage = 0;
    if (!isPharmacyAdmin) {
      const tierInfo = await getProviderTierDiscount(supabase, user.id);
      discountPercentage = tierInfo.discountPercentage;
    }

    let medicationsQuery = supabase
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
      `,
      )
      .eq("is_active", true)
      .eq("pharmacy.is_active", true);

    if (isPlatformAdmin) {
      // Platform admins: no filter, see all medications (highest precedence)
    } else if (isPharmacyAdmin && pharmacyAdminPharmacyId) {
      medicationsQuery = medicationsQuery.eq("pharmacy_id", pharmacyAdminPharmacyId);
    } else if (linkedPharmacyIds.length > 0) {
      medicationsQuery = medicationsQuery.in("pharmacy_id", linkedPharmacyIds);
    } else {
      medicationsQuery = medicationsQuery.eq("pharmacy_id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: allMedications, error: medsError } =
      await medicationsQuery.order("name", { ascending: true });

    if (medsError) {
      console.error("Error fetching medications:", medsError);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medicationsTransformed = (allMedications || []).map((med: any) => {
      const basePrice =
        med.aimrx_site_pricing_cents ||
        (med.notes ? parseInt(med.notes) : med.retail_price_cents);

      const aimrx_site_pricing_cents =
        discountPercentage > 0
          ? Math.round(basePrice * (1 - discountPercentage / 100))
          : basePrice;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {
        retail_price_cents: _retail,
        notes: _notes,
        ...providerFields
      } = med;

      return {
        ...providerFields,
        pharmacy: med.pharmacy,
        aimrx_site_pricing_cents,
      };
    });

    return NextResponse.json({
      success: true,
      pharmacy,
      medications: medicationsTransformed,
      isPharmacyAdmin,
      tierDiscount: discountPercentage,
      hasPharmacyLinks: isPlatformAdmin || isPharmacyAdmin || linkedPharmacyIds.length > 0,
    });
  } catch (error) {
    console.error("Error fetching provider pharmacy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pharmacy",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
