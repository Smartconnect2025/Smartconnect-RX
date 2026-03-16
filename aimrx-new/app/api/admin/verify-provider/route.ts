import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * Verify a provider account exists and check its status
 * GET /api/admin/verify-provider?email=provider@example.com
 */
export async function GET(request: Request) {
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

    // Get email from query params
    const { searchParams } = new URL(request.url);
    const emailToVerify = searchParams.get("email");

    if (!emailToVerify) {
      return NextResponse.json(
        { success: false, error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const { data: providers, error: providerError } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("email", emailToVerify);

    if (providerError) {
      return NextResponse.json({
        success: false,
        error: "Error querying providers",
        details: providerError.message,
      });
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No provider found with this email",
      });
    }

    if (providers.length > 1) {
      return NextResponse.json({
        success: false,
        error: `Multiple providers found with email ${emailToVerify}`,
        count: providers.length,
        providers: providers.map(p => ({
          id: p.id,
          user_id: p.user_id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
        })),
      });
    }

    const provider = providers[0];

    // Check auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(provider.user_id);

    if (authError || !authUser.user) {
      return NextResponse.json({
        success: false,
        error: "Auth user not found",
        provider: provider,
        details: authError?.message,
      });
    }

    const { data: providerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", provider.user_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        user_id: provider.user_id,
        email: provider.email,
        first_name: provider.first_name,
        last_name: provider.last_name,
        is_active: provider.is_active,
      },
      auth: {
        id: authUser.user.id,
        email: authUser.user.email,
        email_confirmed_at: authUser.user.email_confirmed_at,
        created_at: authUser.user.created_at,
        last_sign_in_at: authUser.user.last_sign_in_at,
      },
      role: providerRole?.role || "No role found",
    });
  } catch (error) {
    console.error("Error verifying provider:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to verify provider",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
