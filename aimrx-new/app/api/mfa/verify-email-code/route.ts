import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { verifyMFACode } from "@core/services/mfa/mfaService";
import { setSessionStarted } from "@core/auth/cache-helpers";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Code is required" },
        { status: 400 },
      );
    }

    const result = await verifyMFACode(user.id, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, locked: result.locked },
        { status: result.locked ? 429 : 401 },
      );
    }

    const admin = createAdminClient();

    const { data: userData } = await admin.auth.admin.getUserById(user.id);
    const meta = userData?.user?.user_metadata || {};
    if (!meta.totp_enabled) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          totp_enabled: true,
          mfa_method: "email",
          totp_verified_at: new Date().toISOString(),
        },
      });
    }

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    let resolvedRole = roleData?.role || "user";

    if (resolvedRole === "user") {
      const { data: pharmAdmin } = await admin
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (pharmAdmin) {
        resolvedRole = "admin";
      }
    }

    const response = NextResponse.json({
      success: true,
      role: resolvedRole,
    });

    response.cookies.set("totp_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
    await setSessionStarted(response);

    return response;
  } catch (error) {
    console.error("Verify email MFA code error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code" },
      { status: 500 },
    );
  }
}
