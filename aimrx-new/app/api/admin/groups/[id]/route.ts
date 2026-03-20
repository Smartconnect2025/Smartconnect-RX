/**
 * Admin Group Management API
 *
 * Endpoint for admin users to update or delete specific groups
 * Only accessible to users with admin or super_admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse, getPharmacyAdminScope } from "@core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { error: "This action is restricted to platform administrators" },
        { status: 403 },
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();
    const { name, platformManagerId } = body;

    const supabase = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (platformManagerId !== undefined)
      updateData.platform_manager_id = platformManagerId || null;
    updateData.updated_at = new Date().toISOString();

    const { data: dbGroup, error: dbError } = await supabase
      .from("groups")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (dbError) {
      console.error("Error updating group:", dbError);
      if (dbError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to update group. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      group: dbGroup,
      message: "Group updated successfully",
    });
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const scope = await getPharmacyAdminScope(user.id);
    if (scope.isPharmacyAdmin) {
      return NextResponse.json(
        { error: "This action is restricted to platform administrators" },
        { status: 403 },
      );
    }

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const supabase = createAdminClient();

    const { error: fetchError } = await supabase
      .from("groups")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Group not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to delete group. Please try again." },
        { status: 500 },
      );
    }

    const { error: dbError } = await supabase
      .from("groups")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Error deleting group:", dbError);
      return NextResponse.json(
        { error: "Failed to delete group. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
