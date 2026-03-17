import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { verifySync, NobleCryptoPlugin as NobleCryptoClass } from "otplib";
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
    const meta = userData?.user?.user_metadata;

    if (!meta?.totp_enabled || !meta?.totp_secret) {
      return NextResponse.json(
        { success: false, error: "MFA is not enabled for this account" },
        { status: 400 },
      );
    }

    const cleanCode = code.replace(/\s/g, "");
    let isValid = false;

    const cryptoPlugin = new NobleCryptoClass();
    const totpResult = verifySync({
      token: cleanCode,
      secret: meta.totp_secret,
      crypto: cryptoPlugin,
      window: 1,
    });
    isValid = totpResult.valid;

    if (!isValid && meta.totp_recovery_codes?.length) {
      const inputHash = hashRecoveryCode(cleanCode);
      const recoveryIndex = meta.totp_recovery_codes.indexOf(inputHash);
      if (recoveryIndex !== -1) {
        const updatedCodes = [...meta.totp_recovery_codes];
        updatedCodes.splice(recoveryIndex, 1);
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...meta,
            totp_recovery_codes: updatedCodes,
          },
        });
        isValid = true;
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid code. Try again." },
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
      role: roleData?.role || "user",
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
    console.error("MFA verify error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code" },
      { status: 500 },
    );
  }
}
