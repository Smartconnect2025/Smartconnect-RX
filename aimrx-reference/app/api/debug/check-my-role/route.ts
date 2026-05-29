import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";

export async function GET(_request: NextRequest) {
  const { user, userRole } = await getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    role: userRole,
  });
}
