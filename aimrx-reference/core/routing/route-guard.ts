/**
 * Route Guard System
 * Handles route access control based on authentication status and user roles
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UserAuthInfo } from "./types";
import { redirectPaths, publicAdminRoutes } from "./routes-config";
import {
  getRouteType,
  hasValidToken,
  getRedirectUrl,
} from "./utils";
import { checkIntakeStatusServer } from "@core/auth";
import { getCachedUserData } from "@core/auth/cache-helpers";
import { getBaseUrl } from "./get-base-url";

/**
 * Helper function to check intake status and redirect if incomplete
 * Only caches "complete" status to keep logic simple
 * @returns NextResponse redirect if intake incomplete, null if complete
 */
async function checkAndRedirectIntake(
  userId: string,
  role: string | null,
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<NextResponse | null> {
  const baseUrl = getBaseUrl(request);

  try {
    const cached = getCachedUserData(request);
    if (cached.intakeComplete === true) {
      return null;
    }

    const intakeStatus = await checkIntakeStatusServer(userId, role, supabase);

    if (!intakeStatus.hasCompletedIntake) {
      const nextStepUrl =
        intakeStatus.nextStepUrl || "/intake/patient-information";
      return NextResponse.redirect(new URL(nextStepUrl, baseUrl));
    }

    return null;
  } catch (error) {
    console.error("Error checking intake status:", error);
    return NextResponse.redirect(
      new URL("/intake/patient-information", baseUrl),
    );
  }
}

/**
 * Handle routing based on route type, user authentication status, and role
 * @param request - The Next.js request object
 * @param auth - Authentication information (isAuthenticated, role, userId)
 * @param supabase - Supabase client instance for database queries
 * @returns NextResponse with redirect if access denied, null if access granted
 */
export async function handleRouteAccess(
  request: NextRequest,
  auth: UserAuthInfo & { userId?: string },
  supabase: SupabaseClient,
): Promise<NextResponse | null> {
  const { isAuthenticated, role } = auth;
  const pathname = request.nextUrl.pathname;

  // Check if this is a public admin route first (before any auth checks)
  if (publicAdminRoutes.includes(pathname)) {
    return null; // Allow access without authentication
  }

  const routeType = getRouteType(pathname);
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = getBaseUrl(request);

  const homeUrl = new URL(redirectPaths.home, baseUrl);
  const loginUrl = new URL(redirectPaths.login, baseUrl);
  const dashboardUrl = new URL(redirectPaths.dashboard, baseUrl);
  const unauthorizedUrl = new URL(
    redirectPaths.unauthorized || redirectPaths.home,
    baseUrl,
  );

  // Special handling for root path "/" - accessible to all but patients need intake check
  if (pathname === "/") {
    // Allow unauthenticated users (they see marketing page)
    if (!isAuthenticated) {
      return null;
    }

    // Redirect authenticated users to their role-based dashboard
    if (role === "admin" || role === "pharmacy_admin") {
      return NextResponse.redirect(
        new URL(redirectPaths.adminDashboard, baseUrl),
      );
    }

    if (role === "provider") {
      return NextResponse.redirect(
        new URL(redirectPaths.providerDashboard, baseUrl),
      );
    }

    if (role === "delegate") {
      // Provider Assistance — assistants use the regular provider terminal.
      // The "delegate" role only changes how the outgoing Rx is stamped.
      return NextResponse.redirect(
        new URL(redirectPaths.providerDashboard, baseUrl),
      );
    }

    // For authenticated patients (role="user" or null), check intake completion
    if ((role === "user" || role === null) && auth.userId) {
      return await checkAndRedirectIntake(
        auth.userId,
        role ?? null,
        supabase,
        request,
      );
    }

    // Fallback: allow access (shouldn't happen but prevents errors)
    return null;
  }

  // Apply routing rules based on route type
  switch (routeType) {
    case "public":
      // Everyone can access public routes
      return null;

    case "auth":
      // Redirect authenticated users away from auth pages
      if (isAuthenticated) {
        return NextResponse.redirect(dashboardUrl);
      }
      return null;

    case "user":
      // Redirect unauthenticated users to login
      if (!isAuthenticated) {
        // Add a redirect param so user can return to this page after login
        return NextResponse.redirect(getRedirectUrl(loginUrl, pathname));
      }

      if (
        role === "admin" ||
        role === "super_admin" ||
        role === "super-admin" ||
        role === "pharmacy_admin" ||
        role === "pharmacy-admin"
      ) {
        return NextResponse.redirect(
          new URL(redirectPaths.adminDashboard, baseUrl),
        );
      }
      if (role === "provider" || role === "delegate") {
        return NextResponse.redirect(
          new URL(redirectPaths.providerDashboard, baseUrl),
        );
      }

      // For "user" role or null role (patient users), check intake completion
      // Skip intake check for /intake routes (they handle their own flow)
      if (pathname.startsWith("/intake")) {
        return null;
      }

      // Check intake status for patient users (role === "user" or role === null)
      if (auth.userId) {
        return await checkAndRedirectIntake(
          auth.userId,
          role ?? null,
          supabase,
          request,
        );
      }

      return null;

    case "delegate":
      if (!isAuthenticated) {
        return NextResponse.redirect(getRedirectUrl(loginUrl, pathname));
      }
      if (role !== "delegate") {
        return NextResponse.redirect(unauthorizedUrl);
      }
      return null;

    case "provider":
      // First check authentication
      if (!isAuthenticated) {
        return NextResponse.redirect(getRedirectUrl(loginUrl, pathname));
      }

      // Special case: /appointment route is accessible to both providers and patients
      if (pathname.startsWith("/appointment")) {
        // Allow both provider and user (patient) roles
        if (role === "provider") {
          return null; // Providers can access directly
        }
        if (role === "user" && auth.userId) {
          // Patients need intake check before accessing appointments
          return await checkAndRedirectIntake(
            auth.userId,
            role,
            supabase,
            request,
          );
        }
        // Redirect other roles (admin, null, etc.) to unauthorized
        return NextResponse.redirect(unauthorizedUrl);
      }

      // Then check role
      if (role !== "provider" && role !== "delegate") {
        // Provider Assistance: delegates use the provider terminal exactly
        // like a provider — their own data, own patients, own Rx history.
        // The only difference is at submit time (outgoing Rx stamps the
        // authorizing provider's name + NPI).
        return NextResponse.redirect(unauthorizedUrl);
      }

      // Allow all providers to access the app (even if inactive)
      // Inactive providers will be blocked only at the API level when trying to place orders
      return null;

    case "admin":
      // First check authentication
      if (!isAuthenticated) {
        return NextResponse.redirect(getRedirectUrl(loginUrl, pathname));
      }

      // Then check role (admin, super_admin, and pharmacy_admin can access admin routes)
      if (role !== "admin" && role !== "super_admin" && role !== "pharmacy_admin") {
        // User is authenticated but not an admin
        return NextResponse.redirect(unauthorizedUrl);
      }
      return null;

    case "special":
      // Handle special routes with custom logic
      if (pathname === "/auth/reset-password") {
        // Always allow access - token is in hash fragment (client-side only)
        // Client component handles validation via Supabase session
        return null;
      }

      // Handle email verification page
      if (pathname === "/auth/verify") {
        // Check for verification token
        if (hasValidToken(searchParams, "verification")) {
          return null;
        }

        // No valid token, redirect based on auth status
        return NextResponse.redirect(isAuthenticated ? dashboardUrl : loginUrl);
      }

      // Default for unhandled special routes
      return NextResponse.redirect(homeUrl);
  }
}
