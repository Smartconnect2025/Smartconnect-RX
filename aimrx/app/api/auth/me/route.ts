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

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    role: userRole?.role || null,
    isDemo: userRole?.is_demo || false,
  });
}
