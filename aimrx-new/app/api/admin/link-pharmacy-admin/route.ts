import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

/**
 * Link a pharmacy admin user to their pharmacy (platform admin only)
 * POST /api/admin/link-pharmacy-admin
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();

  try {
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

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { success: false, error: "This action is restricted to platform administrators" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { admin_user_id, pharmacy_slug } = body;

    if (!admin_user_id || !pharmacy_slug) {
      return NextResponse.json(
        { success: false, error: "admin_user_id and pharmacy_slug are required" },
        { status: 400 }
      );
    }

    // Get pharmacy by slug
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id, name, slug")
      .eq("slug", pharmacy_slug)
      .single();

    if (pharmacyError || !pharmacy) {
      console.error("Error finding pharmacy:", pharmacyError);
      return NextResponse.json(
        { success: false, error: `Pharmacy with slug "${pharmacy_slug}" not found` },
        { status: 404 }
      );
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from("pharmacy_admins")
      .select("*")
      .eq("user_id", admin_user_id)
      .eq("pharmacy_id", pharmacy.id)
      .single();

    if (existingLink) {
      return NextResponse.json({
        success: true,
        message: "Admin is already linked to this pharmacy",
        link: existingLink,
      });
    }

    // Ensure user has admin role in user_roles
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", admin_user_id)
      .single();

    if (!existingRole) {
      await supabase.from("user_roles").insert({
        user_id: admin_user_id,
        role: "admin",
      });
    } else if (existingRole.role === "user") {
      await supabase
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", admin_user_id);
    }

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from("pharmacy_admins")
      .insert({
        user_id: admin_user_id,
        pharmacy_id: pharmacy.id,
      })
      .select()
      .single();

    if (linkError) {
      console.error("Error creating link:", linkError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to link admin to pharmacy",
          details: linkError.message,
        },
        { status: 500 }
      );
    }

    // Get medication count for this pharmacy
    const { data: medications } = await supabase
      .from("pharmacy_medications")
      .select("id")
      .eq("pharmacy_id", pharmacy.id);

    const medicationCount = medications?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Successfully linked admin to ${pharmacy.name}`,
      link,
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        slug: pharmacy.slug,
        medication_count: medicationCount,
      },
    });
  } catch (error) {
    console.error("Error in link pharmacy admin:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to link pharmacy admin",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
