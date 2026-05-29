/**
 * authorizing-provider.ts — single source of truth for "whose NPI / DEA /
 * signature goes on the outgoing Rx?"
 *
 * Background (Manning incident, May 9 2026 — Task #64):
 *   When a Provider Assistant (delegate) submits a prescription, the
 *   submit route creates the prescription row with `prescriber_id =
 *   <assistant.user_id>` and stamps `submitted_by_delegation_id =
 *   <delegation.id>`. The assistant's own providers row exists but has
 *   NPI / DEA / signature_url all NULL (per the Provider Assistance
 *   spec — those credentials belong to the AUTHORIZING provider).
 *
 *   Three downstream code paths were loading the provider via
 *   `providers.user_id == prescription.prescriber_id`:
 *     1. core/services/regenerate-stale-pdf.ts (Greenwich PDF regen)
 *     2. app/api/prescriptions/_shared/submit-to-pharmacy-core.ts
 *        (DigitalRx Doctor block)
 *     3. core/cron/jobs/refill-check.ts (refill PDF regen)
 *
 *   …which made all three render the assistant's empty row, producing
 *   tiny stub PDFs that hit the 200KB hard-gate, looped forever in
 *   cohort G, and never shipped.
 *
 *   This resolver always prefers the AUTHORIZING provider when a
 *   delegation id is present on the prescription, falling back to the
 *   prescriber_id lookup for direct provider submissions.
 *
 * NEVER edits this resolver to silently fall back to the assistant's
 * row when the authorizing provider can't be loaded — that's how the
 * Manning bug got into the wild. Fail loudly (return null) and let the
 * caller decide whether to block, log, or proceed with the prescriber
 * fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthorizingProviderRow {
  user_id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  npi_number: string | null;
  dea_number: string | null;
  company_name: string | null;
  phone_number: string | null;
  signature_url: string | null;
  physical_address: Record<string, unknown> | null;
  email: string | null;
  is_active: boolean | null;
}

const PROVIDER_COLUMNS =
  "user_id, prefix, first_name, last_name, npi_number, dea_number, company_name, phone_number, signature_url, physical_address, email, is_active";

export interface ResolveAuthorizingProviderInput {
  prescriberId: string;
  /** prescriptions.submitted_by_delegation_id — non-null on delegate submissions. */
  delegationId: string | null | undefined;
}

export interface ResolvedAuthorizingProvider {
  provider: AuthorizingProviderRow;
  /** True when the row was resolved through a delegation join (assistant
   * submission). False when we fell back to the direct prescriber lookup. */
  viaDelegation: boolean;
  /** prescriptions.submitted_by_delegation_id when viaDelegation === true. */
  delegationId: string | null;
}

/**
 * Resolve the authorizing provider for a given prescription.
 *
 * Resolution order:
 *   1. If submitted_by_delegation_id is set → JOIN delegations →
 *      providers and return the AUTHORIZING provider's row.
 *   2. Otherwise → load providers WHERE user_id = prescriber_id (the
 *      classic direct-provider submission path).
 *
 * Returns null if no provider can be resolved.
 */
export async function resolveAuthorizingProvider(
  supabase: SupabaseClient,
  input: ResolveAuthorizingProviderInput,
): Promise<ResolvedAuthorizingProvider | null> {
  if (input.delegationId) {
    const { data: delegation } = await supabase
      .from("delegations")
      .select(`provider_id, providers:provider_id(${PROVIDER_COLUMNS})`)
      .eq("id", input.delegationId)
      .maybeSingle();

    const linked = delegation?.providers as
      | AuthorizingProviderRow
      | AuthorizingProviderRow[]
      | null
      | undefined;
    const provider = Array.isArray(linked) ? linked[0] : linked;
    if (provider?.user_id) {
      return {
        provider,
        viaDelegation: true,
        delegationId: input.delegationId,
      };
    }
    // Delegation row is missing or its providers join blew up. Do NOT
    // silently fall back to the assistant's prescriber_id — that is the
    // Manning bug. Return null so the caller logs and decides.
    return null;
  }

  // Direct provider submission — classic path.
  const { data: provider } = await supabase
    .from("providers")
    .select(PROVIDER_COLUMNS)
    .eq("user_id", input.prescriberId)
    .maybeSingle();
  if (!provider?.user_id) return null;
  return {
    provider: provider as AuthorizingProviderRow,
    viaDelegation: false,
    delegationId: null,
  };
}

/**
 * Pre-creation lookup: given a delegate's user_id, return the active
 * authorizing provider's row (so the submit route can hard-block before
 * charging when the provider is missing NPI / signature).
 *
 * Returns null when the delegate has no active delegation.
 */
export async function resolveActiveAuthorizingProviderForDelegate(
  supabase: SupabaseClient,
  delegateUserId: string,
): Promise<{
  provider: AuthorizingProviderRow;
  delegationId: string;
} | null> {
  const { data: delegation } = await supabase
    .from("delegations")
    .select(`id, provider_id, providers:provider_id(${PROVIDER_COLUMNS})`)
    .eq("delegate_user_id", delegateUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!delegation?.id) return null;
  const linked = delegation.providers as
    | AuthorizingProviderRow
    | AuthorizingProviderRow[]
    | null
    | undefined;
  const provider = Array.isArray(linked) ? linked[0] : linked;
  if (!provider?.user_id) return null;
  return { provider, delegationId: delegation.id };
}
