/**
 * Authentication Module Exports
 *
 * This file exports all components from the Authentication core module,
 * making imports cleaner throughout the application.
 */

// Export auth utilities
export {
  getUserRole,
  serializeUser,
  type SerializedUser,
  type AuthResult,
} from "./auth-utils";

// Export server-side user getter
export { getUser } from "./get-user";

// Export user provider and client
export { UserProvider } from "./UserProvider";
export { UserClient, useUser } from "./UserClient";

// Export API guards
export {
  requireAuthentication,
  requireRole,
  createGuardErrorResponse,
  type ApiAuthInfo,
  type ApiGuardResult,
} from "./api-guards";

// Export intake status checkers
export {
  checkIntakeStatusServer,
  type IntakeStatus,
} from "./server-intake-status";

// Export auth interceptor for global 401 handling
export {
  AuthInterceptorProvider,
  resetAuthRedirectFlag,
} from "./AuthInterceptorProvider";
