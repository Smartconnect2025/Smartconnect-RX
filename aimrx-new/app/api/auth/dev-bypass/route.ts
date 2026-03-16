import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";

const BYPASS_TOKEN = "scrx-dev-2026";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const role = request.nextUrl.searchParams.get("role") || "admin";

  if (token !== BYPASS_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const email =
    role === "provider"
      ? "joseph+201@smartconnects.com"
      : "joseph+200@smartconnects.com";

  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: new URL("/api/auth/dev-bypass/callback", request.url).toString() },
  });

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || "Failed to generate link" }, { status: 500 });
  }

  const callbackUrl = new URL("/api/auth/dev-bypass/callback", request.url);
  callbackUrl.searchParams.set("token_hash", data.properties.hashed_token);
  callbackUrl.searchParams.set("type", "magiclink");
  callbackUrl.searchParams.set("role", role);

  return NextResponse.redirect(callbackUrl);
}
