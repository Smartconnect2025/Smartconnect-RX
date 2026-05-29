import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_roles")
      .select("mfa_method")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mfa_method: data?.mfa_method || "email" });
  } catch (error) {
    console.error("Error fetching MFA preference:", error);
    return NextResponse.json({ error: "Failed to fetch MFA preference" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && !origin.includes(host.split(":")[0])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mfa_method } = await request.json();
    if (!mfa_method || !["email", "totp"].includes(mfa_method)) {
      return NextResponse.json({ error: "Invalid mfa_method. Must be 'email' or 'totp'" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("user_roles")
      .update({ mfa_method })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, mfa_method });
    response.cookies.set("mfa_method", mfa_method, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error updating MFA preference:", error);
    return NextResponse.json({ error: "Failed to update MFA preference" }, { status: 500 });
  }
}
