/**
 * Authentication Utilities
 *
 * Contains helper functions for user authentication and JWT processing.
 */
import { User, SupabaseClient, createClient } from "@supabase/supabase-js";
import { envConfig } from "@core/config";

function getAdminClient(): SupabaseClient {
  return createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Serialize user data consistently for client-side use
 *
 * Creates a safe subset of user data to pass to the client
 *
 * @param user - Supabase User object or null
 * @returns A serialized user object with only safe fields or null
 */
export function serializeUser(user: User | null) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Type for serialized user data
 */
export type SerializedUser = ReturnType<typeof serializeUser>;

/**
 * Fetch user role from database when JWT claims don't contain it
 *
 * @param userId - The user's ID
 * @param supabase - Supabase client instance (browser or server)
 * @returns The user role string or null if not found
 */
export async function fetchUserRoleFromDatabase(
  userId: string,
  _supabase: SupabaseClient,
): Promise<{ role: string; isDemo: boolean }> {
  try {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from("user_roles")
      .select("role, is_demo")
      .eq("user_id", userId)
      .single();

    if (error) {
      return { role: "user", isDemo: false };
    }

    return { role: data?.role || "user", isDemo: data?.is_demo || false };
  } catch {
    return { role: "user", isDemo: false };
  }
}

/**
 * Get user role from the database
 *
 * @param userId - The user's ID for database fallback
 * @param supabase - Supabase client instance (browser or server)
 * @returns The user role string or null if not found
 */
export async function getUserRole(
  userId: string | undefined,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (userId) {
    const result = await fetchUserRoleFromDatabase(userId, supabase);
    return result.role;
  }

  return "user";
}

export async function getUserRoleAndDemo(
  userId: string | undefined,
  supabase: SupabaseClient,
): Promise<{ role: string | null; isDemo: boolean }> {
  if (userId) {
    return await fetchUserRoleFromDatabase(userId, supabase);
  }

  return { role: "user", isDemo: false };
}

/**
 * Shared auth result type used across components
 */
export interface AuthResult {
  user: SerializedUser;
  userRole: string | null;
  isDemo: boolean;
}
