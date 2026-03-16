/**
 * Tier Discount Service
 *
 * Fetches the tier-based discount percentage for a provider.
 * Accepts a SupabaseClient instance so it works in both server (API routes)
 * and client (React components) contexts.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface TierDiscountResult {
  discountPercentage: number;
  tierName: string | null;
  tierCode: string | null;
}

/**
 * Get the tier discount for a provider based on their tier_level.
 *
 * @param supabase - Supabase client instance (browser or server)
 * @param userId - The auth user ID of the provider
 * @returns TierDiscountResult with discountPercentage (0 if no tier)
 */
export async function getProviderTierDiscount(
  supabase: SupabaseClient,
  userId: string,
): Promise<TierDiscountResult> {
  const defaultResult: TierDiscountResult = {
    discountPercentage: 0,
    tierName: null,
    tierCode: null,
  };

  const { data: provider } = await supabase
    .from("providers")
    .select("tier_level")
    .eq("user_id", userId)
    .single();

  if (!provider?.tier_level) {
    return defaultResult;
  }

  const { data: tier } = await supabase
    .from("tiers")
    .select("discount_percentage, tier_name, tier_code")
    .eq("tier_code", provider.tier_level)
    .single();

  if (!tier) {
    return defaultResult;
  }

  return {
    discountPercentage: parseFloat(tier.discount_percentage),
    tierName: tier.tier_name,
    tierCode: tier.tier_code,
  };
}
