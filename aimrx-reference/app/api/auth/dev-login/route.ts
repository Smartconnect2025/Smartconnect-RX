import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const token = request.nextUrl.searchParams.get("token");

  if (token !== "catalog-preview-2026") {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const admin = createAdminClient();

  const emailParam = request.nextUrl.searchParams.get("email");
  const email = emailParam || "joseph+101@smartconnects.com";

  const { data: userData } = await admin
    .from("providers")
    .select("user_id")
    .eq("email", email)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

  if (linkError || !linkData) {
    return NextResponse.json(
      { error: "Failed to generate link: " + (linkError?.message || "unknown") },
      { status: 500 }
    );
  }

  const hashedToken = linkData.properties?.hashed_token;
  if (!hashedToken) {
    return NextResponse.json({ error: "No token in link" }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${hashedToken}&type=magiclink&redirect_to=${encodeURIComponent(request.nextUrl.origin + "/api/auth/dev-login/callback")}`;

  return NextResponse.redirect(verifyUrl);
}
