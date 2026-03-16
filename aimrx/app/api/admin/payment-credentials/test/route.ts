import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";

/**
 * POST /api/admin/payment-credentials/test
 * Test Authorize.Net credentials by making a simple API call
 * This does NOT save the credentials - just validates them
 */
export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { apiLoginId, transactionKey, environment } = body;

    if (!apiLoginId || !transactionKey) {
      return NextResponse.json(
        { error: "API Login ID and Transaction Key are required" },
        { status: 400 }
      );
    }

    // Determine Authorize.Net API endpoint based on environment
    const apiUrl =
      environment === "live"
        ? "https://api.authorize.net/xml/v1/request.api"
        : "https://apitest.authorize.net/xml/v1/request.api";

    // Make a simple API call to test credentials
    // We'll use getMerchantDetailsRequest which just returns merchant info
    const testPayload = {
      getMerchantDetailsRequest: {
        merchantAuthentication: {
          name: apiLoginId,
          transactionKey: transactionKey,
        },
      },
    };


    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const data = await response.json();


    // Check if the response indicates success
    if (data.messages?.resultCode === "Ok") {
      return NextResponse.json({
        success: true,
        message: "Credentials are valid",
        merchantName: data.merchantName || "AMRX",
      });
    } else {
      // Authentication failed or other error
      const errorMessage =
        data.messages?.message?.[0]?.text || "Invalid credentials or API error";

      console.error("❌ Authorize.Net test failed:", errorMessage);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: data.messages?.message?.[0]?.code,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error testing Authorize.Net credentials:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to test credentials",
      },
      { status: 500 }
    );
  }
}
