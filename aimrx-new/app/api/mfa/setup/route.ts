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
    const meta = userData?.user?.user_metadata;
    const alreadyEnabled = !!meta?.totp_enabled;

    let secret: string;
    if (alreadyEnabled && meta?.totp_secret) {
      secret = meta.totp_secret;
    } else {
      secret = generateSecret();
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          totp_secret: secret,
        },
      });
    }

    const issuer = "SmartConnect RX";
    const label = user.email || user.id;
    const otpauth = generateURI({
      secret,
      issuer,
      label,
      strategy: "totp",
    });

    const qrCode = await QRCode.toDataURL(otpauth);

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
      otpauth,
      alreadyEnabled,
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to set up MFA" },
      { status: 500 },
    );
  }
}
