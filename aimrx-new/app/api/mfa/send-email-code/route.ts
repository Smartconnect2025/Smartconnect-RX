import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { sendMFACode } from "@core/services/mfa/mfaService";

const SEND_COOLDOWN_SECONDS = 60;

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

    if (!user.email) {
      return NextResponse.json(
        { success: false, error: "No email address on file" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: recentCode } = await admin
      .from("mfa_codes")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCode?.created_at) {
      const createdAt = new Date(recentCode.created_at).getTime();
      const elapsed = (Date.now() - createdAt) / 1000;
      if (elapsed < SEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(SEND_COOLDOWN_SECONDS - elapsed);
        return NextResponse.json(
          { success: false, error: `Please wait ${wait} seconds before requesting another code` },
          { status: 429 },
        );
      }
    }

    const result = await sendMFACode(user.id, user.email);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send code" },
        { status: 500 },
      );
    }

    const maskedEmail =
      user.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, "*") + c);

    return NextResponse.json({
      success: true,
      email: maskedEmail,
    });
  } catch (error) {
    console.error("Send email MFA code error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send verification code" },
      { status: 500 },
    );
  }
}
