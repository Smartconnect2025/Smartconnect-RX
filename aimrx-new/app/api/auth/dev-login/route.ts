import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email") || "joseph+200@smartconnects.com";
  const password = request.nextUrl.searchParams.get("password") || "Admin123!";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || "Login failed" }, { status: 401 });
  }

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/(.+)\.supabase\.co/)?.[1] || "";

  const cookieValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
    expires_in: data.session.expires_in,
    token_type: "bearer",
    type: "access",
    user: data.user,
  });

  const html = `<!DOCTYPE html>
<html><head><title>Logging in...</title></head>
<body>
<p>Signing in... redirecting to admin dashboard.</p>
<script>
document.cookie = "sb-${projectRef}-auth-token=" + encodeURIComponent(${JSON.stringify(cookieValue)}) + ";path=/;max-age=${data.session.expires_in};samesite=lax";
document.cookie = "totp_verified=true;path=/;max-age=28800;samesite=lax";
document.cookie = "mfa_pending=;path=/;max-age=0";
setTimeout(function() { window.location.href = "/admin"; }, 300);
</script>
</body></html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });

  response.cookies.set(`sb-${projectRef}-auth-token`, cookieValue, {
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: data.session.expires_in,
  });

  response.cookies.set("totp_verified", "true", {
    path: "/",
    maxAge: 28800,
    sameSite: "lax",
  });

  response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });

  return response;
}
