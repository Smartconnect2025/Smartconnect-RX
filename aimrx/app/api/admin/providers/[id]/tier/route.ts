import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin", "provider"].includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const providerId = params.id;

    if (!providerId) {
      return NextResponse.json(
        { error: "Provider ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    if (userRole === "provider") {
      const { data: providerRecord } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!providerRecord || providerRecord.id !== providerId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("tier_level")
      .eq("id", providerId)
      .single();

    if (providerError) {
      if (providerError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch provider tier. Please try again." },
        { status: 500 }
      );
    }

    const tierCode = provider?.tier_level;

    if (!tierCode) {
      return NextResponse.json({
        tier_level: "Not set",
        tier_code: null,
      });
    }

    const { data: tier, error: tierError } = await supabase
      .from("tiers")
      .select("*")
      .eq("tier_code", tierCode)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({
        tier_level: "Not set",
        tier_code: tierCode,
      });
    }

    return NextResponse.json({
      tier_level: `${tier.tier_name} (${tier.discount_percentage}%)`,
      tier_code: tierCode,
      tier_details: tier,
    });
  } catch (error) {
    console.error("Error fetching provider tier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
