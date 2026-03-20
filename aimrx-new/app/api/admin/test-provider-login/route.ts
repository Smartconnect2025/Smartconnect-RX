import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

/**
 * Test provider login credentials (admin access)
 * POST /api/admin/test-provider-login
 * Body: { email: string, password: string }
 */
export async function POST(request: Request) {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  const supabase = await createServerClient();
  const supabaseAdmin = await createAdminClient();

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

    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || !userRole || !["admin", "super_admin"].includes(userRole.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email: testEmail, password: testPassword } = body;

    if (!testEmail || !testPassword) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }


    const { data: provider } = await supabaseAdmin
      .from("providers")
      .select("user_id")
      .eq("email", testEmail)
      .single();

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: "Provider not found in database",
      });
    }

    // Get full auth user details
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(provider.user_id);

    if (authError || !authUser.user) {
      return NextResponse.json({
        success: false,
        error: "Auth user not found",
        details: authError?.message,
      });
    }


    // Try to sign in using admin client (this should bypass any restrictions)
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error("❌ Sign in error:", signInError);
      return NextResponse.json({
        success: false,
        error: "Login failed",
        signInError: {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        },
        authUser: {
          id: authUser.user.id,
          email: authUser.user.email,
          email_confirmed_at: authUser.user.email_confirmed_at,
        },
      });
    }


    return NextResponse.json({
      success: true,
      message: "Login test successful",
      user: {
        id: signInData.user?.id,
        email: signInData.user?.email,
      },
    });
  } catch (error) {
    console.error("Error in test provider login:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test login",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
