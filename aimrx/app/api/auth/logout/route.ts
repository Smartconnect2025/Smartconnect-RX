import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

export async function POST() {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  } catch (e) {
    console.error("Server-side signOut error:", e);
  }

  const response = NextResponse.json({ success: true });

  const cookiesToClear = [
    "mfa_pending",
    "totp_verified",
    "session_started",
    "user_role_cache",
    "user_role",
    "user_role_uid",
    "intake_complete_cache",
    "provider_active_cache",
  ];

  cookiesToClear.forEach((name) => {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  });

  return response;
}
