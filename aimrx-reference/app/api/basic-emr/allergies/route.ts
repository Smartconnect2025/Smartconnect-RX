import { NextRequest, NextResponse } from "next/server";

import { allergyService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// GET /api/basic-emr/allergies?patientId=
export async function GET(req: NextRequest) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  
  if (!patientId) {
    return NextResponse.json(
      { success: false, error: "patientId is required" },
      { status: 400 }
    );
  }
  
  const result = await allergyService.getAllergies(patientId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// POST /api/basic-emr/allergies
export async function POST(req: NextRequest) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const body = await req.json();
  const result = await allergyService.createAllergy(user.id, body);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
