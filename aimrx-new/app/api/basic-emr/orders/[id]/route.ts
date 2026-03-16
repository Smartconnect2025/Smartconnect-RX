import { NextRequest, NextResponse } from "next/server";

import { orderService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";

// PATCH /api/basic-emr/orders/[id]
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
  const orderId = id;
  const updates = await req.json();

  const result = await orderService.updateOrder(orderId, user.id, updates);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
