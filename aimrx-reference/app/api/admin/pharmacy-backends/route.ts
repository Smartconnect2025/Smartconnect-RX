import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

/**
 * Get all pharmacy backends with API key info
 * GET /api/admin/pharmacy-backends
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

    // Check if user is admin or platform owner
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Fetch all pharmacy backends with pharmacy info
    const { data: backends, error } = await supabase
      .from("pharmacy_backends")
      .select(`
        *,
        pharmacy:pharmacies (
          id,
          name,
          slug,
          primary_color
        )
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pharmacy backends:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pharmacy backends" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      backends,
    });
  } catch (error) {
    console.error("Error in get pharmacy backends:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pharmacy backends",
      },
      { status: 500 }
    );
  }
}
