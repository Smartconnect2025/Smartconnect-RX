import { NextRequest, NextResponse } from "next/server";
import { sendMFACode } from "@/core/services/mfa/mfaService";
import { createAdminClient } from "@core/database/client";

const MFA_SEND_LIMIT = 5;
const MFA_SEND_WINDOW_MINUTES = 10;

function setMfaPendingCookie(response: NextResponse): NextResponse {
  response.cookies.set("mfa_pending", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}

function fakeSuccessResponse(): NextResponse {
  const response = NextResponse.json(
    { success: true, message: "Verification code sent to your email" },
    { status: 200 }
  );
  return setMfaPendingCookie(response);
}

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return setMfaPendingCookie(NextResponse.json(
        { success: false, error: "Missing userId or email" },
        { status: 400 }
      ));
    }

    if (typeof userId !== "string" || typeof email !== "string" || !email.includes("@")) {
      return fakeSuccessResponse();
    }

    const supabase = createAdminClient();

    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - MFA_SEND_WINDOW_MINUTES);

    const [userLookup, recentCodesLookup] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase
        .from("mfa_codes")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", windowStart.toISOString()),
    ]);

    const recentCodes = recentCodesLookup.data;

    if (recentCodes && recentCodes.length >= MFA_SEND_LIMIT) {
      return setMfaPendingCookie(NextResponse.json(
        { success: false, error: "Too many code requests. Please wait a few minutes before trying again." },
        { status: 429 }
      ));
    }

    const userRecord = userLookup.data;
    if (!userRecord?.user || userRecord.user.email !== email) {
      return fakeSuccessResponse();
    }

    const result = await sendMFACode(userId, email);

    const response = NextResponse.json(
      result.success
        ? { success: true, message: "Verification code sent to your email" }
        : { success: false, error: result.error },
      { status: result.success ? 200 : 500 }
    );

    return setMfaPendingCookie(response);
  } catch (error) {
    console.error("Error in send-code API:", error);
    return setMfaPendingCookie(NextResponse.json(
      { success: false, error: "Failed to send verification code" },
      { status: 500 }
    ));
  }
}
