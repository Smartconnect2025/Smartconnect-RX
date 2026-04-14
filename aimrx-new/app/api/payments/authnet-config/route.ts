import { NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";

const ACCEPT_JS_URLS = {
  sandbox: "https://jstest.authorize.net/v1/Accept.js",
  production: "https://js.authorize.net/v1/Accept.js",
} as const;

export async function GET() {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    if (!userRole || !["provider", "admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Provider access required" },
        { status: 403 },
      );
    }

    const apiLoginId = envConfig.AUTHNET_API_LOGIN_ID;
    const clientKey = process.env.AUTHNET_CLIENT_KEY || "";
    const environment = envConfig.AUTHNET_ENVIRONMENT;

    if (!apiLoginId || !clientKey) {
      return NextResponse.json(
        { success: false, error: "Authorize.Net is not configured" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      apiLoginId,
      clientKey,
      acceptJsUrl: ACCEPT_JS_URLS[environment],
    });
  } catch (error) {
    console.error("[AUTHNET-CONFIG] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      { success: false, error: "Failed to load payment configuration" },
      { status: 500 },
    );
  }
}
