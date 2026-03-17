import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

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

    if (!meta?.totp_enabled) {
      return NextResponse.json(
        { success: false, error: "MFA is not enabled" },
        { status: 400 },
      );
    }

    const { totp_secret, totp_enabled, totp_recovery_codes, totp_verified_at, ...restMeta } = meta;

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...restMeta,
        totp_secret: null,
        totp_enabled: false,
        totp_recovery_codes: null,
        totp_verified_at: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA disable error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disable MFA" },
      { status: 500 },
    );
  }
}
