import { NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { checkProviderActive } from "@/core/auth/check-provider-active";

/**
 * Check if the current provider user is active
 * GET /api/provider/check-active
 */
export async function GET() {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (userRole !== "provider") {
      return NextResponse.json(
        { success: false, error: "Not a provider" },
        { status: 403 }
      );
    }

    const isActive = await checkProviderActive(user.id);

    return NextResponse.json({
      success: true,
      is_active: isActive,
    });
  } catch (error) {
    console.error("Error checking provider active status:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
