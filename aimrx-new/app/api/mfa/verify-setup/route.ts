import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { verifySync, NobleCryptoPlugin as NobleCryptoClass } from "otplib";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { setSessionStarted } from "@core/auth/cache-helpers";

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

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

    const admin = createAdminClient();
    const { data: userData } = await admin.auth.admin.getUserById(user.id);
    const secret = userData?.user?.user_metadata?.totp_secret;

    if (!secret) {
      return NextResponse.json(
        { success: false, error: "MFA setup not started. Call /api/mfa/setup first." },
        { status: 400 },
      );
    }

    const cleanCode = code.replace(/\s/g, "");
    const cryptoPlugin = new NobleCryptoClass();
    const result = verifySync({
      token: cleanCode,
      secret,
      crypto: cryptoPlugin,
      window: 1,
    });

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: "Invalid code. Open your authenticator app and try again with a fresh code." },
        { status: 400 },
      );
    }

    const recoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      recoveryCodes.push(randomUUID().substring(0, 8).toUpperCase());
    }

    const hashedCodes = recoveryCodes.map(hashRecoveryCode);

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...userData?.user?.user_metadata,
        totp_enabled: true,
        totp_recovery_codes: hashedCodes,
        totp_verified_at: new Date().toISOString(),
      },
    });

    const response = NextResponse.json({
      success: true,
      recoveryCodes,
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
    console.error("MFA verify-setup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify MFA code" },
      { status: 500 },
    );
  }
}
