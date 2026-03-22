/**
 * Admin Patient Update API
 *
 * Endpoint for admin users to update patient data
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requireAnyAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminCheck = await requireAnyAdmin();
    if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

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
