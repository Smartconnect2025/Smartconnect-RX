import { NextRequest, NextResponse } from "next/server";
import { verifyMFACode } from "@/core/services/mfa/mfaService";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { userId, code } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { success: false, error: "Missing userId or code" },
        { status: 400 }
      );
    }

    if (user && user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "User mismatch" },
        { status: 403 }
      );
    }

    const result = await verifyMFACode(userId, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, locked: result.locked || false },
        { status: result.locked ? 429 : 400 }
      );
    }

    const admin = createAdminClient();
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const response = NextResponse.json({
      success: true,
      message: "Code verified successfully",
      role: roleData?.role || "user",
    });

    response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
    response.cookies.set("totp_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    await setSessionStarted(response);

    const role = roleData?.role || "user";
    response.cookies.set("user_role_cache", role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role", role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role_uid", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in verify-code API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
