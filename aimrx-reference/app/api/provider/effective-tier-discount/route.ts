import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getEffectiveTierDiscountForUser } from "@core/services/pricing/tierDiscountService";

/**
 * GET /api/provider/effective-tier-discount
 *
 * Returns the tier discount that should be displayed to the currently
 * authenticated user when previewing prescription pricing. The same value
 * is what gets applied at checkout, so the catalog and the wizard step 3
 * display always match the bill.
 *
 * Resolution (in getEffectiveTierDiscountForUser):
 *   1. The caller's own `providers.tier_level` — for regular providers,
 *      AND for assistants whose admin/supervising provider has set a
 *      per-assistant override.
 *   2. If the caller is an active delegate AND has no own tier set,
 *      falls back to the SUPERVISING provider's tier.
 *   3. Otherwise the 0% default.
 *
 * Shape: { discountPercentage: number, tierName: string|null, tierCode: string|null }
 */
export async function GET() {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const result = await getEffectiveTierDiscountForUser(supabase, user.id);
  return NextResponse.json(result);
}
