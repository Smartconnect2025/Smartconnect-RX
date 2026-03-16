/**
 * Admin Patient Update API
 *
 * Endpoint for admin users to update patient data
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const body = await request.json();

    const supabase = createAdminClient();

    // Update patient
    const { error } = await supabase.from("patients").update(body).eq("id", id);

    if (error) {
      console.error("Error updating patient:", error);
      return NextResponse.json(
        { error: "Failed to update patient" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating patient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
