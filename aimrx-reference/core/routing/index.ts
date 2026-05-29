/**
 * Routing Protection Module
 * Exports route protection utilities and configurations
 */

// Export types
export {
  type RouteType,
  type RoutePattern,
  type ProtectedRouteConfig,
  type UserAuthInfo,
} from "./types";

// Export route configuration
export { redirectPaths, protectedRoutes } from "./routes-config";

// Export utility functions
export {
  getRouteType,
  hasValidToken,
  hasValidRecoveryToken,
  getRedirectUrl,
} from "./utils";

// Export route guard functions
export { handleRouteAccess } from "./route-guard";

// Export role-based routing functions
export * from "./role-based-routing";
