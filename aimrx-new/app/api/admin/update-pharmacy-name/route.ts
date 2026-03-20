import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

/**
 * Update Greenwich Pharmacy name in database
 * POST /api/admin/update-pharmacy-name
 */
export async function POST() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createAdminClient();

  try {
    // Update the pharmacy name where slug is "grinethch"
    const { data: pharmacy, error } = await supabase
      .from("pharmacies")
      .update({ name: "Greenwich Pharmacy" })
      .eq("slug", "grinethch")
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating pharmacy:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update pharmacy name",
          details: error,
        },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: "Pharmacy name updated successfully",
      pharmacy,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
