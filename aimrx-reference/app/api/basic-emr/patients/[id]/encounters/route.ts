import { NextRequest, NextResponse } from "next/server";

import { encounterService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// GET /api/basic-emr/patients/[id]/encounters
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const patientId = id;
  const result = await encounterService.getEncounters(patientId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}

// POST /api/basic-emr/patients/[id]/encounters
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const patientId = id;
  const body = await req.json();
  // Merge patientId into the body for createEncounter
  const result = await encounterService.createEncounter(user.id, {
    ...body,
    patientId,
  });
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
