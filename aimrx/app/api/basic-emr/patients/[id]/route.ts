import { NextRequest, NextResponse } from "next/server";

import { patientService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";
import { requireNonDemo, createGuardErrorResponse } from "@core/auth/api-guards";

// GET /api/basic-emr/patients/[id]
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
  const result = await patientService.getPatientById(patientId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}

// PATCH /api/basic-emr/patients/[id]
export async function PATCH(
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

  const demoCheck = await requireNonDemo();
  if (!demoCheck.success) return createGuardErrorResponse(demoCheck);

  const { id } = await params;
  const patientId = id;
  const updates = await req.json();
  const result = await patientService.updatePatient(
    patientId,
    user.id,
    updates,
  );
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
