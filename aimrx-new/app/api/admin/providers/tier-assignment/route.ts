import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";
import { requireAnyAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAnyAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { providerId, tierCode } = body;

    if (!providerId || !tierCode) {
      return NextResponse.json(
        { error: "Missing providerId or tierCode" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from("providers")
      .update({ tier_level: tierCode })
      .eq("id", providerId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update tier assignment. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tier assignment updated successfully"
    });
  } catch (error) {
    console.error("Error updating tier assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
