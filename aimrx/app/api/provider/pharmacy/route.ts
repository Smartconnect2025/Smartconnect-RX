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
    // Get current user
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

    // Get provider's pharmacy link (first pharmacy if multiple)
    const { data: link } = await supabase
      .from("provider_pharmacy_links")
      .select("pharmacy_id")
      .eq("provider_id", user.id)
      .limit(1)
      .single();

    let pharmacyId: string | null = link?.pharmacy_id || null;

    if (!pharmacyId) {
      // Try pharmacy_admins table (if user is an admin)
      const { data: adminLink } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      pharmacyId = adminLink?.pharmacy_id || null;

      // FALLBACK: Auto-link based on email domain
      if (!pharmacyId && user.email) {
        let pharmacySlug: string | null = null;

        if (user.email.includes("@aimmedtech.com")) {
          pharmacySlug = "aim";
        } else if (user.email.includes("@grinethch.com")) {
          pharmacySlug = "grinethch";
        }

        if (pharmacySlug) {
          // Find pharmacy by slug
          const { data: foundPharmacy } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("slug", pharmacySlug)
            .single();

          if (foundPharmacy) {
            // Create pharmacy_admins link
            await supabase.from("pharmacy_admins").insert({
              user_id: user.id,
              pharmacy_id: foundPharmacy.id,
            });

            pharmacyId = foundPharmacy.id;
          }
        }
      }

      // If still no pharmacy link, user is a regular doctor (no pharmacy affiliation)
      // This is OK - they will see the global catalog
    }

    // Get pharmacy details if pharmacyId exists
    let pharmacy = null;
    if (pharmacyId) {
      const { data: pharmacyData, error: pharmacyError } = await supabase
        .from("pharmacies")
        .select("*")
        .eq("id", pharmacyId)
        .single();

      if (pharmacyError) {
        console.error("Error fetching pharmacy:", pharmacyError);
      } else {
        pharmacy = pharmacyData;
      }
    }

    // Check user role to determine medication filtering
    // Pharmacy admins: Show ONLY their pharmacy's medications
    // Regular doctors/providers: Show ALL medications from ALL pharmacies (global profit catalog)

    // Check if user is in pharmacy_admins table
    const { data: pharmacyAdminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .single();

    // User is a pharmacy admin ONLY if they have an entry in pharmacy_admins table
    // Note: Super admins (role="admin" in user_roles) are NOT pharmacy admins
    const isPharmacyAdmin = !!pharmacyAdminLink;

    // Fetch provider's tier discount (only for non-pharmacy-admins)
    let discountPercentage = 0;
    if (!isPharmacyAdmin) {
      const tierInfo = await getProviderTierDiscount(supabase, user.id);
      discountPercentage = tierInfo.discountPercentage;
    }

    // If pharmacy admin: show ONLY their pharmacy's medications
    // If regular doctor: show ALL medications from ALL pharmacies (global profit catalog)
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

    // Filter by pharmacy for admins only (if they have a pharmacy link)
    if (isPharmacyAdmin && pharmacyId) {
      medicationsQuery = medicationsQuery.eq("pharmacy_id", pharmacyId);
    }

    const { data: allMedications, error: medsError } =
      await medicationsQuery.order("name", { ascending: true });

    if (medsError) {
      console.error("Error fetching medications:", medsError);
    }

    // Transform: resolve aimrx_site_pricing_cents and exclude admin-only fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const medicationsTransformed = (allMedications || []).map((med: any) => {
      // Prefer actual column, then notes field (Supabase schema cache workaround), then retail_price_cents
      const basePrice =
        med.aimrx_site_pricing_cents ||
        (med.notes ? parseInt(med.notes) : med.retail_price_cents);

      // Apply tier discount for providers (not pharmacy admins)
      const aimrx_site_pricing_cents =
        discountPercentage > 0
          ? Math.round(basePrice * (1 - discountPercentage / 100))
          : basePrice;

      // Exclude admin-only fields (retail_price_cents, notes) from provider response
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
      pharmacy, // User's primary pharmacy (for context/header)
      medications: medicationsTransformed,
      isPharmacyAdmin, // Pass role info to frontend
      tierDiscount: discountPercentage, // Provider's tier discount percentage
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
