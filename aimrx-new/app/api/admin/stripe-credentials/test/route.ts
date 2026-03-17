import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { secretKey } = body;

    if (!secretKey) {
      return NextResponse.json(
        { error: "Stripe Secret Key is required" },
        { status: 400 },
      );
    }

    const stripe = new Stripe(secretKey);

    const account = await stripe.accounts.retrieve();

    return NextResponse.json({
      success: true,
      message: "Stripe credentials are valid",
      accountName: account.business_profile?.name || account.settings?.dashboard?.display_name || "Stripe Account",
      accountId: account.id,
    });
  } catch (error) {
    console.error("Stripe credentials test failed:", error instanceof Error ? error.message : "Unknown");

    const isAuthError = error instanceof Error && error.message.includes("Invalid API Key");

    return NextResponse.json(
      {
        success: false,
        error: isAuthError
          ? "Invalid Stripe API key"
          : error instanceof Error ? error.message : "Failed to verify Stripe credentials",
      },
      { status: 400 },
    );
  }
}
