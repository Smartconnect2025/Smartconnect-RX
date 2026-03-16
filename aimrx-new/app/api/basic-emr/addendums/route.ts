import { NextRequest, NextResponse } from "next/server";

import { addendumService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// GET /api/basic-emr/addendums?encounterId=
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

  const result = await addendumService.getAddendums(encounterId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// POST /api/basic-emr/addendums
export async function POST(req: NextRequest) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const body = await req.json();
  const { encounterId, content } = body;
  if (!encounterId || !content) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }
  const result = await addendumService.createAddendum(
    user.id,
    encounterId,
    content
  );
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
