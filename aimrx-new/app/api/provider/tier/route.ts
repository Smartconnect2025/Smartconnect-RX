import { NextResponse } from "next/server";
import { createServerClient } from "@/core/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerClient();

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the provider profile for this user including tier_level
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, tier_level")
      .eq("user_id", user.id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({
        tier_level: "Not set",
        tier_code: null,
      });
    }

    const tierCode = provider.tier_level;

    if (!tierCode) {
      return NextResponse.json({
        tier_level: "Not set",
        tier_code: null,
      });
    }

    // Get tier details from tiers table
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
