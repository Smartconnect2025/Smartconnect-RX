import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { setSessionStarted } from "@core/auth/cache-helpers";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const redirectUrl = new URL("/provider/catalog", request.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("totp_verified", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  response.cookies.set("mfa_method", "email", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });

  await setSessionStarted(response);

  return response;
}
