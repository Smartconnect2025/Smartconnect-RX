import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function POST() {
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

    const admin = createAdminClient();
    const { data: userData } = await admin.auth.admin.getUserById(user.id);

    if (userData?.user?.user_metadata?.totp_enabled) {
      return NextResponse.json(
        { success: false, error: "MFA is already enabled" },
        { status: 400 },
      );
    }

    const secret = generateSecret();
    const issuer = "SmartConnect RX";
    const label = user.email || user.id;
    const otpauth = generateURI({
      secret,
      issuer,
      label,
      strategy: "totp",
    });

    const qrCode = await QRCode.toDataURL(otpauth);

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...userData?.user?.user_metadata,
        totp_secret: secret,
      },
    });

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      otpauth,
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to set up MFA" },
      { status: 500 },
    );
  }
}
