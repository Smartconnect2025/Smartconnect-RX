import { NextRequest, NextResponse } from "next/server";

import { conditionService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// PATCH /api/basic-emr/conditions/[id]
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
  const conditionId = id;
  const updates = await req.json();

  const result = await conditionService.updateCondition(
    conditionId,
    user.id,
    updates,
  );
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
