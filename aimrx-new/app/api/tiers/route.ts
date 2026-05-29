/**
 * Public Tiers API (auth-only — no admin gate)
 *
 * Returns the list of pricing tiers so non-admin authenticated users (e.g.
 * a provider assigning a per-assistant tier from the Provider Assistance
 * tab) can populate a dropdown. Tier metadata (code, name, %) is not
 * sensitive — patients effectively see the discount at checkout.
 *
 * Read-only.
 */

import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";

export async function GET() {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const supabase = await createServerClient();
    const { data: tiers, error } = await supabase
      .from("tiers")
      .select("tier_code, tier_name, discount_percentage, description")
      .order("discount_percentage", { ascending: true });

    if (error) {
      console.error("[/api/tiers GET] DB error", error);
      return NextResponse.json(
        { error: "Failed to load tiers." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tiers: tiers ?? [],
      total: tiers?.length ?? 0,
    });
  } catch (err) {
    console.error("[/api/tiers GET] unexpected", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
