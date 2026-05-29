import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user || (userRole !== "admin" && userRole !== "super_admin")) {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();

    const webhookSecret = process.env.DIGITALRX_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "DIGITALRX_WEBHOOK_SECRET not configured — cannot test webhook" },
        { status: 500 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${siteUrl}/api/webhook/digitalrx?token=${encodeURIComponent(webhookSecret)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[webhook/digitalrx/test] Error:", error);
    return NextResponse.json(
      { success: false, error: "Test failed" },
      { status: 500 },
    );
  }
}
