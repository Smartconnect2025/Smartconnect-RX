/**
 * Database Client for Server-side Operations
 *
 * This module provides a direct Supabase client for server-side operations
 * like migrations, seeding, and administrative tasks that don't require
 * request context or cookies.
 */

import { createClient } from "@supabase/supabase-js";
import { envConfig } from "@core/config";

/**
 * Create a Supabase client for administrative operations
 *
 * This client uses the service role key for full database access
 * and doesn't require request context or cookies.
 *
 * @returns A Supabase client instance for administrative operations
 */
export function createAdminClient() {
  const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a simple client for seeding operations
 *
 * This is a fallback that uses the anon key if service role key is not available
 */
export function createSeedClient() {
  return createAdminClient();
}
