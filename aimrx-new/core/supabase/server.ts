/**
 * Supabase Server Module
 * 
 * Creates and provides a Supabase client for server-side operations in Next.js.
 */
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { envConfig } from "@core/config";

const getCookieStore = async () => {
  const { cookies } = await import("next/headers");
  return cookies();
};

const DEV_MOCK_USER = {
  id: "c6e644ab-6ed4-4007-9184-7c27d5762ac6",
  aud: "authenticated",
  role: "authenticated",
  email: "joseph+200@smartconnects.com",
  email_confirmed_at: "2026-03-16T17:30:09.400674Z",
  phone: "",
  confirmed_at: "2026-03-16T17:30:09.400674Z",
  created_at: "2026-03-16T17:20:22.262251Z",
  updated_at: "2026-03-16T17:20:22.262251Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { email_verified: true, role: "admin" },
  identities: [],
  is_anonymous: false,
  factors: [],
} as any;

export async function createServerClient() {
  if (process.env.NODE_ENV === 'development') {
    const client = await createAdminClient();
    client.auth.getUser = async () => ({ data: { user: DEV_MOCK_USER }, error: null } as any);
    return client;
  }

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
          }
        },
      },
    }
  );
}

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
          }
        },
      },
    }
  );
}
