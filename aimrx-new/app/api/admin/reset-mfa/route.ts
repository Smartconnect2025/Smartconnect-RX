import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requirePlatformAdmin, createGuardErrorResponse } from "@/core/auth/api-guards";

export async function POST(request: NextRequest) {
  try {
    const guardResult = await requirePlatformAdmin();
    if (!guardResult.success) {
      return createGuardErrorResponse(guardResult);
    }

    const { email, adminKey } = await request.json();

    if (adminKey !== process.env.SESSION_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users?.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: factors } = await adminClient.auth.admin.mfa.listFactors({ userId: user.id });

    if (factors?.factors && factors.factors.length > 0) {
      for (const factor of factors.factors) {
        await adminClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
      }
    }

    return NextResponse.json({
      success: true,
      message: `MFA reset for ${email}. Removed ${factors?.factors?.length || 0} factors.`,
    });
  } catch (error) {
    console.error("Error resetting MFA:", error);
    return NextResponse.json({ error: "Failed to reset MFA" }, { status: 500 });
  }
}
