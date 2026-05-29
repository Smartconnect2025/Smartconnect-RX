import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";
import {
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@core/auth/mfa-recovery-hash";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = body?.code;
    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json(
        { success: false, error: "Recovery code is required" },
        { status: 400 },
      );
    }

    const code = normalizeRecoveryCode(rawCode);
    if (code.length < 6) {
      return NextResponse.json(
        { success: false, error: "Invalid recovery code format" },
        { status: 400 },
      );
    }

    const codeHash = hashRecoveryCode(user.id, code);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ua = request.headers.get("user-agent") || null;

    const admin = createAdminClient();

    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "consume_mfa_recovery_code",
      {
        p_user_id: user.id,
        p_user_email: user.email ?? null,
        p_code_hash: codeHash,
        p_ip_address: ip,
        p_user_agent: ua,
        p_rate_limit: 5,
        p_window_minutes: 10,
      },
    );

    if (rpcError) {
      console.error("[verify-recovery-code] RPC error:", rpcError);
      return NextResponse.json(
        { success: false, error: "Failed to verify recovery code" },
        { status: 500 },
      );
    }

    const result = (rpcResult || {}) as {
      success?: boolean;
      reason?: string;
      remaining?: number;
    };

    if (!result.success) {
      if (result.reason === "rate_limited") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too many invalid attempts. Please wait a few minutes before trying again.",
          },
          { status: 429 },
        );
      }
      if (result.reason === "no_codes") {
        return NextResponse.json(
          {
            success: false,
            error:
              "No recovery codes are set up for this account. Use your authenticator app or email code instead.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { success: false, error: "Invalid recovery code" },
        { status: 401 },
      );
    }

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const response = NextResponse.json({
      success: true,
      message: "Recovery code accepted",
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

    return response;
  } catch (error) {
    console.error("Error in verify-recovery-code API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify recovery code" },
      { status: 500 },
    );
  }
}
