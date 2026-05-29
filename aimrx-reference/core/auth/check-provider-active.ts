/**
 * Provider Active Status Check
 * Helper function to check if a provider is active in API routes.
 *
 * IMPORTANT: This helper is invoked AFTER the calling route has already
 * authenticated the user via getUser(). To avoid intermittent RLS / cookie
 * race conditions where a second cookie-bound Supabase client returns no
 * row for a provider whose `is_active` is TRUE, we read with the admin
 * (service-role) client. This is safe because:
 *   - The route has already established the caller's identity.
 *   - We only return a boolean about that already-known userId.
 *   - We do not return any sensitive provider fields.
 */

import { createAdminClient } from "@core/database/client";

export async function checkProviderActive(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { data: provider, error } = await supabase
      .from("providers")
      .select("is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("checkProviderActive query error:", error);
      return false;
    }
    if (!provider) return false;

    return provider.is_active === true;
  } catch (error) {
    console.error("checkProviderActive failed:", error);
    return false;
  }
}
