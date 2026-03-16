/**
 * Routing Utilities
 * Contains helper functions for route handling
 */
import { RouteType } from './types';
import { protectedRoutes } from './routes-config';

/**
 * Determines the route type based on the pathname
 * @param pathname - The current URL pathname
 * @returns The route type (public, auth, user, provider, or special)
 */
export function getRouteType(pathname: string): RouteType {
  // Normalize the pathname (remove trailing slash except for root)
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  // Check each protected route config for a match
  for (const config of protectedRoutes) {
    for (const pattern of config.patterns) {
      const isMatch = pattern.exact
        ? normalizedPath === pattern.path
        : normalizedPath === pattern.path || normalizedPath.startsWith(`${pattern.path}/`);

      if (isMatch) {
        return config.type;
      }
    }
  }

  // If no match found in protected routes, default to public
  return "public";
}

/**
 * Check if URL has a valid token
 * @param searchParams - The URL search parameters
 * @param tokenType - Optional specific token type to check for
 */
export function hasValidToken(
  searchParams: URLSearchParams, 
  tokenType?: string
): boolean {
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  if (!token) return false;
  
  // If specific token type required, check it
  if (tokenType) {
    return type === tokenType;
  }
  
  // Otherwise any valid token type is acceptable
  return !!type;
}

/**
 * Specific helper for recovery tokens
 */
export function hasValidRecoveryToken(searchParams: URLSearchParams): boolean {
  return hasValidToken(searchParams, "recovery");
}

/**
 * Get the redirect URL with an optional redirect parameter
 * @param baseUrl - The base URL to redirect to
 * @param redirectPath - Optional path to redirect back to after authentication
 */
export function getRedirectUrl(baseUrl: URL, redirectPath?: string): URL {
  const url = new URL(baseUrl);
  
  if (redirectPath) {
    url.searchParams.set('redirect', redirectPath);
  }
  
  return url;
} 