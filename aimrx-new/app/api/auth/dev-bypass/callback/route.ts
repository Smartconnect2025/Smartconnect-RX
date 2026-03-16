import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { setSessionStarted } from "@core/auth/cache-helpers";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const role = request.nextUrl.searchParams.get("role") || "admin";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const supabase = await createServerClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  const dashboardUrl =
    role === "provider" ? "/provider/catalog" : "/admin/dashboard";

  const response = NextResponse.redirect(new URL(dashboardUrl, request.url));

  response.cookies.set("totp_verified", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  response.cookies.set("mfa_method", "email", {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  response.cookies.set("mfa_pending", "", {
    path: "/",
    maxAge: 0,
  });

  await setSessionStarted(response);

  return response;
}
