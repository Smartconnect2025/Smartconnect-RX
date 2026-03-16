import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { encryptApiKey } from "@/core/security/encryption";

/**
 * Create a new pharmacy
 * POST /api/admin/pharmacies
 */
export async function POST(request: Request) {
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
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, slug, logo_url, primary_color, tagline, address, npi, dea_number, ncpdp_number, phone, system_type, api_url, api_key, store_id, location_id } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Validate backend system fields
    if (!system_type || !store_id || !api_key) {
      return NextResponse.json(
        { success: false, error: "System type, store ID, and API key are required" },
        { status: 400 }
      );
    }

    // Create pharmacy
    const { data: pharmacy, error: insertError } = await supabase
      .from("pharmacies")
      .insert({
        name,
        slug: slug.toLowerCase().trim(),
        logo_url: logo_url || null,
        primary_color: primary_color || "#00AEEF",
        tagline: tagline || null,
        address: address || null,
        npi: npi || null,
        dea_number: dea_number || null,
        ncpdp_number: ncpdp_number || null,
        phone: phone || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating pharmacy:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create pharmacy",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // Create pharmacy backend integration
    const { error: backendError } = await supabase
      .from("pharmacy_backends")
      .insert({
        pharmacy_id: pharmacy.id,
        system_type,
        api_url: api_url || null,
        api_key_encrypted: encryptApiKey(api_key),
        store_id,
        location_id: location_id || null,
        is_active: true,
      });

    if (backendError) {
      console.error("Error creating pharmacy backend:", backendError);
      // Rollback: delete the pharmacy
      await supabase.from("pharmacies").delete().eq("id", pharmacy.id);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create pharmacy backend integration",
          details: backendError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pharmacy "${name}" created successfully with ${system_type} integration`,
      pharmacy,
    });
  } catch (error) {
    console.error("Error in create pharmacy:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create pharmacy",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get all pharmacies (or just the pharmacy admin's pharmacy)
 * GET /api/admin/pharmacies
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
        { status: 401 }
      );
    }

    // Check if user is a pharmacy admin
    const { data: adminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .single();

    let pharmacies;
    let error;

    if (adminLink) {
      // User is a pharmacy admin - only return their pharmacy
      const result = await supabase
        .from("pharmacies")
        .select("*")
        .eq("id", adminLink.pharmacy_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      pharmacies = result.data;
      error = result.error;
    } else {
      // User is platform admin - return all active pharmacies
      const result = await supabase
        .from("pharmacies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      pharmacies = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error fetching pharmacies:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pharmacies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pharmacies,
    });
  } catch (error) {
    console.error("Error in get pharmacies:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pharmacies",
      },
      { status: 500 }
    );
  }
}
