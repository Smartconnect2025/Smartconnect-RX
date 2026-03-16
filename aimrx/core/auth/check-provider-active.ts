/**
 * Provider Active Status Check
 * Helper function to check if a provider is active in API routes
 */

import { createServerClient } from "@/core/supabase/server";

/**
 * Check if a provider user is active
 * @param userId - The user ID to check
 * @returns true if provider is active, false if inactive or not found
 */
export async function checkProviderActive(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();

    // Query database to check is_active status
    const { data: provider, error } = await supabase
      .from("providers")
      .select("is_active, id, first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking provider active status:", error);
      // On error, deny access for security - provider can retry
      return false;
    }

    if (!provider) {
      // Provider record doesn't exist yet (new provider)
      // Block access until they complete setup and are activated
      return false;
    }

    const isActive = provider.is_active === true;

    // Return the is_active status (must be explicitly true)
    return isActive;
  } catch (error) {
    console.error("❌ Error checking provider active status:", error);
    // On error, deny access for security - provider can retry
    return false;
  }
}
