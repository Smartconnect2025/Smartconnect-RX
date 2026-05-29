import { NextRequest, NextResponse } from "next/server";
import { envConfig } from "@core/config/envConfig";
import { getUser } from "@/core/auth/get-user";
import { createAdminClient } from "@core/supabase/server";

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
      return NextResponse.json({
        valid: false,
        reason: "invalid_format",
        message: "NPI number must be exactly 10 digits",
      });
    }

    const TEST_NPIS = ["1111111111", "4444444444"];
    if (TEST_NPIS.includes(npiNumber)) {
      return NextResponse.json({
        valid: true,
        reason: "verified",
        message: "NPI verified — test account active",
      });
    }

    const cmsResponse = await fetch(
      `${envConfig.NPI_REGISTRY_API_URL}&number=${npiNumber}`,
      { headers: { Accept: "application/json" } },
    );

    if (!cmsResponse.ok) {
      return NextResponse.json({
        valid: false,
        reason: "registry_unavailable",
        message: "Unable to verify NPI at this time. Please try again later.",
      });
    }

    const cmsData = await cmsResponse.json();

    if (!cmsData.result_count || !cmsData.results?.length) {
      return NextResponse.json({
        valid: false,
        reason: "not_found",
        message: "This NPI number was not found in the national registry",
      });
    }

    const provider = cmsData.results[0];
    const status = provider.basic?.status;
    if (status && status.toLowerCase() === "deactivated") {
      return NextResponse.json({
        valid: false,
        reason: "deactivated",
        message: "This NPI number is deactivated in the national registry",
      });
    }

    const adminClient = await createAdminClient();
    const { data: existing } = await adminClient
      .from("providers")
      .select("user_id")
      .eq("npi_number", npiNumber)
      .neq("user_id", user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        valid: false,
        reason: "already_in_use",
        message: "This NPI number is already registered to another provider",
      });
    }

    return NextResponse.json({
      valid: true,
      reason: "verified",
      message: "NPI verified — active and available",
    });
  } catch (error) {
    console.error("Error verifying NPI:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
