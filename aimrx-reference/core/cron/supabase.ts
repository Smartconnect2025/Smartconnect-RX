import { createClient } from "@supabase/supabase-js";
import { envConfig } from "@core/config";

/**
 * Supabase admin client for cron jobs.
 * Uses service role key — bypasses RLS. No cookies needed.
 */
export function createCronClient() {
  const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
  const key = envConfig.SUPABASE_SERVICE_ROLE_KEY;
  console.error(`[cron-client] URL: ${url ? url.substring(0, 30) + "..." : "MISSING"}, Key: ${key ? "set" : "MISSING"}`);
  return createClient(url, key);
}
