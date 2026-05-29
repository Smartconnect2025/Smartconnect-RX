import { NextRequest, NextResponse } from "next/server";

import { orderService } from "@/features/basic-emr/services";
import { getUser } from "@/core/auth/get-user";
import { checkProviderActive } from "@/core/auth/check-provider-active";

// GET /api/basic-emr/orders?encounterId=
export async function GET(req: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check if provider is active
  if (userRole === "provider") {
    const isActive = await checkProviderActive(user.id);
    if (!isActive) {
      return NextResponse.json(
        { success: false, error: "Account inactive. Please contact administrator." },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(req.url);
  const encounterId = searchParams.get("encounterId");

  if (!encounterId) {
    return NextResponse.json(
      { success: false, error: "encounterId is required" },
      { status: 400 }
    );
  }

  const result = await orderService.getOrders(encounterId, user.id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// POST /api/basic-emr/orders
export async function POST(req: NextRequest) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check if provider is active before allowing order creation
  if (userRole === "provider") {
    const isActive = await checkProviderActive(user.id);
    if (!isActive) {
      return NextResponse.json(
        { success: false, error: "Account inactive. Please contact administrator." },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  const result = await orderService.createOrder(user.id, body);
  return NextResponse.json(result, { status: result.success ? 201 : 400 });
}
