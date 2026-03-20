import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

/**
 * GET /api/auth/me
 * Returns the current user and their role
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, role: null });
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role, is_demo")
    .eq("user_id", user.id)
    .single();

  let resolvedRole = userRole?.role || null;

  if (!resolvedRole || resolvedRole === "user") {
    const { data: pharmAdmin } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pharmAdmin) {
      resolvedRole = "admin";
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    role: resolvedRole,
    isDemo: userRole?.is_demo || false,
  });
}
