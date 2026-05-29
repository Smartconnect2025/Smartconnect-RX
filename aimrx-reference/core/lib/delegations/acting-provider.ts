import { createAdminClient } from "@core/database/client";

/**
 * Resolve the "acting provider" identity for the given authenticated user.
 *
 * - If the user IS a provider, returns their own provider record + user_id.
 * - If the user is an active delegate (Provider Assistant), returns the
 *   AUTHORIZING provider's record + user_id, so the assistant can act on the
 *   provider's behalf and see the provider's data.
 *
 * Per product spec: the provider assistant must have full provider parity
 * inside the provider terminal. The only thing they may NOT do is create
 * another assistant (handled separately at /api/provider/delegations).
 *
 * Returns null if the user is neither a provider nor an active delegate.
 */
export interface ActingProvider {
  providerId: string;
  providerUserId: string;
  isDelegate: boolean;
}

export async function resolveActingProvider(
  userId: string,
): Promise<ActingProvider | null> {
  const adminClient = createAdminClient();

  const { data: providerRow } = await adminClient
    .from("providers")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (providerRow?.id && providerRow.user_id) {
    return {
      providerId: providerRow.id,
      providerUserId: providerRow.user_id,
      isDelegate: false,
    };
  }

  const { data: delegation } = await adminClient
    .from("delegations")
    .select("provider_id, providers:provider_id(user_id)")
    .eq("delegate_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const linked = delegation?.providers as
    | { user_id?: string | null }
    | { user_id?: string | null }[]
    | null
    | undefined;
  const linkedUserId = Array.isArray(linked)
    ? linked[0]?.user_id
    : linked?.user_id;

  if (delegation?.provider_id && linkedUserId) {
    return {
      providerId: delegation.provider_id,
      providerUserId: linkedUserId,
      isDelegate: true,
    };
  }

  return null;
}
