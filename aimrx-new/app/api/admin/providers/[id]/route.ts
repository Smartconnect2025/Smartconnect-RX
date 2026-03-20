/**
 * Admin Provider Update API
 *
 * Endpoint for admin users to update provider data
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireNonDemo, createGuardErrorResponse, requirePlatformAdmin } from "@core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  try {
    // Check if the current user is an admin
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

    const demoCheck = await requireNonDemo();
    if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

    const { id } = await params;
    const body = await request.json();

    if (body.group_id === "") {
      body.group_id = null;
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("providers")
      .update(body)
      .eq("id", id);

    if (error) {
      console.error("Error updating provider:", error);
      return NextResponse.json(
        { error: "Failed to update provider" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
