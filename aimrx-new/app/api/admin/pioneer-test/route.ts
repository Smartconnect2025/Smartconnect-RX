import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import {
  testPioneerRxConnection,
  resolvePioneerRxBackend,
} from "@/app/api/prescriptions/_shared/pioneerrx-helpers";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function POST(request: NextRequest) {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { pharmacy_id } = body;

    if (!pharmacy_id) {
      return NextResponse.json(
        { success: false, error: "pharmacy_id is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const backend = await resolvePioneerRxBackend(supabaseAdmin, pharmacy_id);

    if (!backend) {
      return NextResponse.json(
        { success: false, error: "No PioneerRx backend configured for this pharmacy" },
        { status: 404 },
      );
    }

    const result = await testPioneerRxConnection(backend);

    return NextResponse.json({
      success: result.success,
      authenticated: result.authenticated,
      error: result.error,
      base_url: backend.baseUrl,
    });
  } catch (error) {
    console.error("[pioneer-test] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
