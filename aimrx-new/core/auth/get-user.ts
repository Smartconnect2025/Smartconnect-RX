/**
 * Server-side User Authentication Module
 *
 * Provides functionality to retrieve the authenticated user in server components.
 */
import { createServerClient } from "@core/supabase";
import { cache } from "react";
import { serializeUser, AuthResult, getUserRoleAndDemo } from "./auth-utils";

export const getUser = cache(async (): Promise<AuthResult> => {
  if (process.env.NODE_ENV === 'development') {
    return {
      user: { id: "c6e644ab-6ed4-4007-9184-7c27d5762ac6", email: "joseph+200@smartconnects.com" },
      userRole: "admin",
      isDemo: false,
    };
  }

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
