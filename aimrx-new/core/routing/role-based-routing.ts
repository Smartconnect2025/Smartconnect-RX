/**
 * Role-Based Routing Service
 *
 * Handles routing logic based on user roles and redirects users to appropriate dashboards
 */

import { redirectPaths } from "./routes-config";

export type UserRole = "admin" | "provider" | "user" | null;

export interface RoleBasedRedirectOptions {
  userRole: UserRole;
  currentPath?: string;
  isAuthenticated: boolean;
}

/**
 * Get the appropriate dashboard URL based on user role
 */
export function getDashboardUrl(userRole: UserRole): string {
  switch (userRole) {
    case "admin":
      return redirectPaths.adminDashboard;
    case "provider":
      return redirectPaths.providerDashboard;
    case "user":
      return redirectPaths.patientDashboard;
    default:
      return redirectPaths.home;
  }
}

/**
 * Determine if a user should be redirected based on their role and current path
 */
export function shouldRedirectToDashboard(options: RoleBasedRedirectOptions): {
  shouldRedirect: boolean;
  redirectUrl: string;
} {
  const { userRole, currentPath, isAuthenticated } = options;

  // If not authenticated, don't redirect
  if (!isAuthenticated) {
    return {
      shouldRedirect: false,
      redirectUrl: "",
    };
  }

  // If no role, don't redirect
  if (!userRole) {
    return {
      shouldRedirect: false,
      redirectUrl: "",
    };
  }

  const dashboardUrl = getDashboardUrl(userRole);

  // If user is on the home page and has a role, redirect to their dashboard
  if (currentPath === "/" || currentPath === redirectPaths.home) {
    return {
      shouldRedirect: true,
      redirectUrl: dashboardUrl,
    };
  }

  // If user is on a role-specific page that doesn't match their role, redirect
  const roleSpecificPaths = {
    admin: ["/admin"],
    provider: ["/provider"],
    user: ["/patient", "/dashboard"],
  };

  // Check if user is on a role-specific page that doesn't match their role
  for (const [role, paths] of Object.entries(roleSpecificPaths)) {
    if (role !== userRole) {
      const isOnWrongRolePage = paths.some((path) =>
        currentPath?.startsWith(path),
      );
      if (isOnWrongRolePage) {
        return {
          shouldRedirect: true,
          redirectUrl: dashboardUrl,
        };
      }
    }
  }

  return {
    shouldRedirect: false,
    redirectUrl: "",
  };
}

/**
 * Get the appropriate login redirect URL based on intended destination
 */
export function getLoginRedirectUrl(intendedPath?: string): string {
  if (!intendedPath) {
    return redirectPaths.login;
  }

  // Don't redirect to auth pages
  if (intendedPath.startsWith("/auth")) {
    return redirectPaths.login;
  }

  return `${redirectPaths.login}?redirect=${encodeURIComponent(intendedPath)}`;
}

/**
 * Get the intended destination after login
 */
export function getIntendedDestination(searchParams: URLSearchParams): string {
  const redirect = searchParams.get("redirect");
  if (redirect) {
    return decodeURIComponent(redirect);
  }

  return redirectPaths.home;
}

/**
 * Check if a user has access to a specific route based on their role
 */
export function hasRouteAccess(
  userRole: UserRole,
  routeType:
    | "public"
    | "auth"
    | "user"
    | "provider"
    | "admin"
    | "intake_required"
    | "special",
): boolean {
  switch (routeType) {
    case "public":
      return true;
    case "auth":
      return true; // Auth pages are accessible to everyone
    case "user":
      return userRole === "user"; // Only patients (users with "user" role) can access
    case "provider":
      return userRole === "provider";
    case "admin":
      return userRole === "admin";
    case "intake_required":
      return userRole === "user"; // Only patients need to complete intake
    case "special":
      return true; // Special routes can have custom logic
    default:
      return false;
  }
}

/**
 * Get navigation items based on user role
 */
export function getNavigationItems(userRole: UserRole) {
  const baseItems = [{ label: "Home", href: "/" }];

  switch (userRole) {
    case "admin":
      return [
        ...baseItems,
        { label: "Dashboard", href: "/admin" },
        { label: "Patients", href: "/admin/patients" },
        { label: "Providers", href: "/admin/providers" },
        { label: "Settings", href: "/admin/settings" },
      ];
    case "provider":
      return [
        ...baseItems,
        { label: "Dashboard", href: "/provider" },
        { label: "Appointments", href: "/provider/appointments" },
        { label: "Orders", href: "/provider/orders" },
        { label: "Patients", href: "/provider/patients" },
        { label: "Profile", href: "/provider/profile" },
      ];
    case "user":
      return [
        ...baseItems,
        { label: "Dashboard", href: "/" },
        { label: "Appointments", href: "/appointments" },
        { label: "Shop", href: "/shop" },
        { label: "Cart", href: "/cart" },
        { label: "Profile", href: "/profile" },
      ];
    default:
      return baseItems;
  }
}
