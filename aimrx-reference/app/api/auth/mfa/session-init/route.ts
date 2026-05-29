import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";
import { getBaseUrl } from "@core/routing/get-base-url";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }

    const admin = createAdminClient();

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role, mfa_method")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = roleData?.role || "user";
    const mfaMethod = roleData?.mfa_method || "email";

    const redirect = request.nextUrl.searchParams.get("redirect") || "/";
    let safeRedirect = "/";
    if (redirect.startsWith("/") && !redirect.startsWith("//")) {
      safeRedirect = redirect;
    }

    let targetUrl: string;
    switch (userRole) {
      case "admin":
      case "super_admin":
      case "super-admin":
      case "pharmacy_admin":
      case "pharmacy-admin":
        targetUrl = safeRedirect !== "/" ? safeRedirect : "/admin";
        break;
      case "provider":
      case "delegate":
        targetUrl = safeRedirect !== "/" ? safeRedirect : "/prescriptions";
        break;
      default:
        targetUrl = safeRedirect !== "/" ? safeRedirect : "/";
    }

    const response = NextResponse.redirect(new URL(targetUrl, baseUrl));

    response.cookies.set("totp_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    response.cookies.set("mfa_method", mfaMethod, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });

    response.cookies.set("user_role_cache", userRole, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role", userRole, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role_uid", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    await setSessionStarted(response);

    return response;
  } catch (error) {
    console.error("Error in session-init:", error);
    return NextResponse.redirect(new URL("/auth/login", baseUrl));
  }
}
