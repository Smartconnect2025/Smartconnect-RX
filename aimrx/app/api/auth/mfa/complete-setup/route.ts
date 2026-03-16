import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    } catch {}

    let recoveryCodes: string[] = [];
    try {
      const body = await request.json();
      recoveryCodes = body.recoveryCodes || [];
    } catch {
    }

    if (user && recoveryCodes.length > 0) {
      try {
        const adminClient = createAdminClient();
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            mfa_recovery_codes: recoveryCodes,
          },
        });
      } catch (e) {
        console.error("Failed to save recovery codes:", e);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "MFA setup complete, session started",
    });

    response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
    response.cookies.set("totp_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role_cache", "", { path: "/", maxAge: 0 });
    response.cookies.set("user_role", "", { path: "/", maxAge: 0 });
    response.cookies.set("user_role_uid", "", { path: "/", maxAge: 0 });
    response.cookies.set("intake_complete_cache", "", { path: "/", maxAge: 0 });
    response.cookies.set("provider_active_cache", "", { path: "/", maxAge: 0 });
    await setSessionStarted(response);

    return response;
  } catch (error) {
    console.error("Error in complete-setup:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete MFA setup" },
      { status: 500 }
    );
  }
}
