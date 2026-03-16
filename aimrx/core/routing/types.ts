/**
 * Routing Types
 * Contains type definitions for the routing module
 */

/**
 * Route types for access control
 */
export type RouteType =
  | "public"
  | "auth"
  | "user"
  | "provider"
  | "admin"
  | "special";

/**
 * Route pattern types
 */
export type RoutePattern = {
  path: string;
  // exact: true means exact match, false means startsWith match
  exact?: boolean;
  // Optional additional conditions for special route types
  conditions?: {
    hasToken?: boolean;
    hasRole?: string;
  };
};

/**
 * Protected route configuration interface
 */
export interface ProtectedRouteConfig {
  type: "auth" | "user" | "provider" | "admin" | "special";
  patterns: RoutePattern[];
}

/**
 * User authentication information
 */
export interface UserAuthInfo {
  isAuthenticated: boolean;
  role?: string | null;
}
