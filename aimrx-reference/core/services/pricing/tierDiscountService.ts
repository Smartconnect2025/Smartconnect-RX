/**
 * Tier Discount Service
 *
 * Fetches the tier-based discount percentage for a provider.
 * Accepts a SupabaseClient instance so it works in both server (API routes)
 * and client (React components) contexts.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@core/database/client";

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

/**
 * Get the EFFECTIVE tier discount for a user — the rate that should actually
 * be applied at checkout. Resolution order:
 *
 *   1. The user's OWN tier_level on their `providers` row (if set). This is
 *      how a regular provider gets their tier, AND how a Provider Assistance
 *      assistant gets their per-assistant override (set by admin or by their
 *      supervising provider on the Provider Assistance tab).
 *   2. If the user is an active delegate (assistant) AND has no own tier,
 *      fall back to the SUPERVISING provider's tier — same behavior as
 *      before per-assistant overrides existed, so existing assistants
 *      continue to work.
 *   3. Otherwise the 0% default.
 *
 * Use this for ALL pricing decisions (catalog display, wizard step 3,
 * checkout, refill submit) so the price the patient sees and the price
 * actually charged are identical.
 */
export async function getEffectiveTierDiscountForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<TierDiscountResult> {
  // 1. Own tier wins. Looked up via the supplied client so existing RLS
  //    assumptions of the caller are preserved.
  const own = await getProviderTierDiscount(supabase, userId);
  if (own.tierCode) return own;

  // 2. If this user is an active delegate, fall back to supervisor's tier.
  //
  //    We INTENTIONALLY do NOT use `resolveActingProvider` here. That
  //    helper short-circuits and returns the assistant's OWN providers
  //    row the moment one exists — and a `providers` row IS provisioned
  //    for every assistant at admin approval (used to store her clinic
  //    assignment AND her per-assistant tier override). The result is
  //    that for every newly-approved assistant, `resolveActingProvider`
  //    classifies her as a non-delegate and the supervisor fallback
  //    never runs. Doing the delegations lookup directly here keeps the
  //    contract simple: the caller's own tier (when set) wins; otherwise
  //    if she's an active delegate we charge the supervisor's tier;
  //    otherwise 0%.
  //
  //    Use the admin client so the fallback works regardless of which
  //    client the caller passed in, and so RLS on `delegations` /
  //    `providers` cannot suppress the lookup.
  const adminClient = createAdminClient();
  // The schema permits a single delegate to be active under multiple
  // supervising providers (uniqueness is per provider+email, not per
  // delegate). Fetch ALL active rows ordered by most-recent and take
  // the first deterministically — `.maybeSingle()` would error out and
  // collapse to 0%, which would silently misprice every checkout for
  // multi-delegated assistants.
  const { data: delegations } = await adminClient
    .from("delegations")
    .select("created_at, providers:provider_id(user_id)")
    .eq("delegate_user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const first = Array.isArray(delegations) ? delegations[0] : null;
  const linked = first?.providers as
    | { user_id?: string | null }
    | { user_id?: string | null }[]
    | null
    | undefined;
  const supervisorUserId = Array.isArray(linked)
    ? linked[0]?.user_id
    : linked?.user_id;

  if (supervisorUserId && supervisorUserId !== userId) {
    return await getProviderTierDiscount(supabase, supervisorUserId);
  }

  // 3. Default (0%).
  return own;
}
