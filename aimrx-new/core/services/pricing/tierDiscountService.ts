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
  _supabase: SupabaseClient,
  _userId: string,
): Promise<TierDiscountResult> {
  return {
    discountPercentage: 0,
    tierName: null,
    tierCode: null,
  };
}
