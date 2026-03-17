import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

export async function GET() {
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

    return NextResponse.json({
      success: true,
      mfaEnabled: !!meta?.totp_enabled,
      hasSecret: !!meta?.totp_secret,
    });
  } catch (error) {
    console.error("MFA status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check MFA status" },
      { status: 500 },
    );
  }
}
