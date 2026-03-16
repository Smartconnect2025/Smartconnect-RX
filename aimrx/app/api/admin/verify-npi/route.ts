import { NextRequest, NextResponse } from "next/server";
import { envConfig } from "@core/config/envConfig";
import { getUser } from "@/core/auth/get-user";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(request.url);
    const npiNumber = searchParams.get("npi");
    if (!npiNumber) {
      return NextResponse.json(
        { error: "NPI number is required" },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(npiNumber)) {
      return NextResponse.json(
        { error: "NPI must be exactly 10 digits" },
        { status: 400 },
      );
    }

    // Call CMS NPI Registry API from server-side (no CORS issues)
    const response = await fetch(
      `${envConfig.NPI_REGISTRY_API_URL}&number=${npiNumber}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      console.error(
        "NPI Registry API error:",
        response.status,
        response.statusText,
      );
      return NextResponse.json(
        { error: "Failed to contact NPI Registry" },
        { status: 502 },
      );
    }

    const data = await response.json();
    if (data.result_count > 0 && data.results && data.results.length > 0) {
      const provider = data.results[0];
      const firstName = provider.basic?.first_name || "";
      const lastName = provider.basic?.last_name || "";
      const providerName = `${firstName} ${lastName}`.trim();

      return NextResponse.json({
        valid: true,
        providerName: providerName || "Provider name not available",
        message: "NPI is valid and active",
      });
    } else {
      return NextResponse.json({
        valid: false,
        message: "NPI not found in CMS registry",
      });
    }
  } catch (error) {
    console.error("Error verifying NPI:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
