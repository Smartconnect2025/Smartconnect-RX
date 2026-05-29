import { NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { envConfig } from "@/core/config/envConfig";

export async function GET() {
  try {
    const { user, userRole } = await getUser();

    if (!user || (userRole !== "provider" && userRole !== "delegate")) {
      return NextResponse.json(
        { error: "Provider access required" },
        { status: 403 },
      );
    }

    if (!envConfig.AUTHNET_API_LOGIN_ID || !envConfig.AUTHNET_PUBLIC_KEY) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 500 },
      );
    }

    const isProduction = envConfig.AUTHNET_ENVIRONMENT === "production";

    return NextResponse.json({
      success: true,
      apiLoginId: envConfig.AUTHNET_API_LOGIN_ID,
      clientKey: envConfig.AUTHNET_PUBLIC_KEY,
      acceptJsUrl: isProduction
        ? "https://js.authorize.net/v1/Accept.js"
        : "https://jstest.authorize.net/v1/Accept.js",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load payment config" },
      { status: 500 },
    );
  }
}
