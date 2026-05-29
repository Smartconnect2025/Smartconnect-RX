/**
 * Server-side User Authentication Module
 *
 * Provides functionality to retrieve the authenticated user in server components.
 */
import { createServerClient } from "@core/supabase";
import { cache } from "react";
import { serializeUser, AuthResult, getUserRoleAndDemo } from "./auth-utils";

/**
 * Server-side function to get the current authenticated user
 *
 * This function is cached with React's cache to deduplicate requests within
 * a server component render pass, improving performance when multiple
 * components request the same user data.
 *
 * @returns Promise resolving to user data and role information
 */
export const getUser = cache(async (): Promise<AuthResult> => {
  const supabase = await createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, userRole: null, isDemo: false };
  }

  const { role, isDemo } = await getUserRoleAndDemo(user.id, supabase);

  return {
    user: serializeUser(user),
    userRole: role,
    isDemo,
  };
});
