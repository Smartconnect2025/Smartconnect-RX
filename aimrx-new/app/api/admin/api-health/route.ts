import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";
import { getHealthChecks, runAllHealthChecks } from "@/core/services/health/runner";

export async function GET(request: NextRequest) {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  try {
    const runNow = request.nextUrl.searchParams.get("runNow") === "true";

    const result = runNow
      ? await runAllHealthChecks()
      : await getHealthChecks(false);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in API health check:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to perform health checks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
