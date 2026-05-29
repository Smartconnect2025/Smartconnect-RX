import { NextRequest, NextResponse } from "next/server";

import { encounterService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// GET /api/basic-emr/encounters/[id]
export async function GET() {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  // Placeholder implementation: not implemented
  return NextResponse.json(
    { success: false, error: "Not implemented" },
    { status: 404 },
  );
}

// PATCH /api/basic-emr/encounters/[id]
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
  const { id } = await params;
  const encounterId = id;
  const updates = await req.json();
  const result = await encounterService.updateEncounter(
    encounterId,
    user.id,
    updates,
  );
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// DELETE /api/basic-emr/encounters/[id]
export async function DELETE(
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
  const encounterId = id;
  const result = await encounterService.deleteEncounter(encounterId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
