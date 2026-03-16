import { NextRequest, NextResponse } from "next/server";

import { vitalsService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// GET /api/basic-emr/vitals?encounterId=
export async function GET(req: NextRequest) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const encounterId = searchParams.get("encounterId");

  if (!encounterId) {
    return NextResponse.json(
      { success: false, error: "encounterId is required" },
      { status: 400 }
    );
  }

  const result = await vitalsService.getVitals(encounterId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// POST /api/basic-emr/vitals
export async function POST(req: NextRequest) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const body = await req.json();
  const result = await vitalsService.createVitals(user.id, body);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
