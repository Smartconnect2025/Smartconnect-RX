/**
 * Supabase Server Module
 * 
 * Creates and provides a Supabase client for server-side operations in Next.js.
 */
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { envConfig } from "@core/config";

// This prevents the "You're importing a component that needs next/headers" error
// when this file is imported from a context that isn't a server component
const getCookieStore = async () => {
  // Dynamic import to prevent "next/headers" from being imported in
  // contexts where it's not supported (like pages/)
  const { cookies } = await import("next/headers");
  return cookies();
};

/**
 * Create a Supabase client for server-side usage in Next.js
 *
 * This function sets up a Supabase client with proper cookie handling for
 * Next.js server components and server actions.
 *
 * @returns A Promise resolving to a Supabase client instance configured for server environments
 */
export async function createServerClient() {
  const cookieStore = await getCookieStore();

  return createSupabaseServerClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const isSupabaseAuth = name.startsWith("sb-") && name.includes("-auth-token");
              if (isSupabaseAuth) {
                const { maxAge, expires, ...sessionOptions } = options as Record<string, unknown>;
                void maxAge;
                void expires;
                cookieStore.set(name, value, sessionOptions);
              } else {
                cookieStore.set(name, value, options);
              }
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase admin client for server-side operations that require elevated privileges
 *
 * This client uses the service role key and bypasses Row Level Security (RLS).
 * Use with caution and only in secure server-side contexts.
 *
 * @returns A Promise resolving to a Supabase client instance with admin privileges
 */
export async function createAdminClient() {
  const cookieStore = await getCookieStore();

  return createSupabaseServerClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore errors in Server Components
          }
        },
      },
    }
  );
}
