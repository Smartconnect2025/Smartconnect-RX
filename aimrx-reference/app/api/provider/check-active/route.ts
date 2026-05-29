import { NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { checkProviderActive } from "@/core/auth/check-provider-active";
import { createAdminClient } from "@core/database/client";

/**
 * Check if the current user is allowed to act as a prescriber.
 *
 * - For role="provider": their own is_active flag.
 * - For role="delegate" (Provider Assistance): the AUTHORIZING provider's
 *   is_active flag. The assistant is allowed to use the terminal as long
 *   as the provider she is authorized for is still active.
 *
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

    if (userRole !== "provider" && userRole !== "delegate") {
      return NextResponse.json(
        { success: false, error: "Not a provider" },
        { status: 403 }
      );
    }

    if (userRole === "delegate") {
      const supabase = createAdminClient();
      const { data: delegation } = await supabase
        .from("delegations")
        .select("provider_id, providers:provider_id(user_id, is_active)")
        .eq("delegate_user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!delegation) {
        return NextResponse.json({ success: true, is_active: false });
      }

      const providerRow = Array.isArray(delegation.providers)
        ? delegation.providers[0]
        : (delegation.providers as { user_id?: string | null; is_active?: boolean | null } | null);

      const providerActive = providerRow?.is_active === true;
      return NextResponse.json({ success: true, is_active: providerActive });
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
