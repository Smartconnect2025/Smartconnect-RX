import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

/**
 * Reset a provider's password (platform admin only)
 * POST /api/admin/reset-provider-password
 * Body: { email: string, newPassword: string }
 */
export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
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

    // Parse request body
    const body = await request.json();
    const { email: providerEmail, newPassword } = body;

    if (!providerEmail || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email and newPassword are required" },
        { status: 400 }
      );
    }

    // Validate password length
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Find the provider by email to get their user_id
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("user_id, first_name, last_name")
      .eq("email", providerEmail)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { success: false, error: `Provider with email ${providerEmail} not found` },
        { status: 404 }
      );
    }

    const userIdToUpdate = provider.user_id;

    // Update the user's password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userIdToUpdate,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update password", details: updateError.message },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: `Password successfully reset for Dr. ${provider.first_name} ${provider.last_name}`,
      email: providerEmail,
    });
  } catch (error) {
    console.error("Error in reset provider password:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
