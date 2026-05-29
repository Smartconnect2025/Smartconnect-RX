import { createAdminClient } from "@core/database/client";

export type DelegatedAction = "submit_refill" | "submit_new_rx";

export type DelegationValidationResult =
  | {
      allowed: true;
      delegationId: string;
      providerId: string;
      providerUserId: string;
    }
  | { allowed: false; reason: string };

/**
 * Single source of truth for "is this delegate user allowed to perform this
 * action on behalf of this provider RIGHT NOW?"
 *
 * Every API a delegate can touch (submit prescription, etc.) must call this
 * before doing the work. App-layer guard, because most APIs use the
 * service-role client and bypass row-level security.
 *
 * Returns a discriminated union so callers can branch cleanly.
 */
export async function validateDelegatedAction(params: {
  delegateUserId: string;
  providerId: string;
  action: DelegatedAction;
}): Promise<DelegationValidationResult> {
  const supabase = createAdminClient();

  // Look up the delegation
  const { data: delegation, error } = await supabase
    .from("delegations")
    .select("id, status, scope_refills, scope_new_rx, provider_id")
    .eq("delegate_user_id", params.delegateUserId)
    .eq("provider_id", params.providerId)
    .maybeSingle();

  if (error) {
    console.error("[validateDelegatedAction] DB error:", error);
    return { allowed: false, reason: "Authorization check failed" };
  }
  if (!delegation) {
    return {
      allowed: false,
      reason: "No delegation exists between this user and this provider",
    };
  }
  if (delegation.status !== "active") {
    return {
      allowed: false,
      reason: `Delegation is not active (status: ${delegation.status})`,
    };
  }

  // Scope check
  if (params.action === "submit_refill" && !delegation.scope_refills) {
    return {
      allowed: false,
      reason: "Delegation does not authorize submitting refills",
    };
  }
  if (params.action === "submit_new_rx" && !delegation.scope_new_rx) {
    return {
      allowed: false,
      reason: "Delegation does not authorize submitting new prescriptions",
    };
  }

  // Look up provider's user_id (needed by callers to set prescriber_id)
  const { data: provider, error: provError } = await supabase
    .from("providers")
    .select("user_id")
    .eq("id", params.providerId)
    .maybeSingle();

  if (provError || !provider?.user_id) {
    return {
      allowed: false,
      reason: "Authorizing provider not found or not linked to a user account",
    };
  }

  return {
    allowed: true,
    delegationId: delegation.id,
    providerId: delegation.provider_id,
    providerUserId: provider.user_id,
  };
}
