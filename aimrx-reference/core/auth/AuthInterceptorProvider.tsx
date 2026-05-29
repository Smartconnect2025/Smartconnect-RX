"use client";

import { useEffect, useRef } from "react";

/**
 * URLs that should NOT trigger auth redirect on 401
 * (auth-related endpoints where 401 is expected behavior)
 */
const AUTH_EXCLUDED_PATHS = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/payments/details/",
  "/api/payments/status/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-mfa",
];

/**
 * Check if a URL should be excluded from auth redirect
 */
function shouldExcludeFromAuthRedirect(url: string | URL | Request): boolean {
  const urlString = typeof url === "string"
    ? url
    : url instanceof URL
      ? url.pathname
      : url.url;

  return AUTH_EXCLUDED_PATHS.some(path => urlString.includes(path));
}

/**
 * AuthInterceptorProvider
 *
 * This provider intercepts all fetch requests globally and handles 401 responses
 * by redirecting the user to the login page with a session_expired reason.
 *
 * Usage: Wrap your app with this provider in the root layout.
 *
 * Benefits:
 * - No need to change existing fetch calls
 * - Automatic 401 handling across the entire app
 * - Excludes auth-related endpoints from redirect
 */
export function AuthInterceptorProvider({ children }: { children: React.ReactNode }) {
  const originalFetchRef = useRef<typeof fetch | null>(null);
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") {
      return;
    }

    // Prevent double-initialization in StrictMode
    // Check if fetch is already intercepted by checking for our marker
    const fetchAlreadyIntercepted = (window.fetch as unknown as { __authIntercepted?: boolean }).__authIntercepted;
    if (fetchAlreadyIntercepted) {
      return;
    }

    // Store original fetch
    originalFetchRef.current = window.fetch.bind(window);
    const originalFetch = originalFetchRef.current;

    // Create intercepted fetch
    const interceptedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init);

      // Handle 401 Unauthorized
      if (
        response.status === 401 &&
        !isRedirectingRef.current &&
        !shouldExcludeFromAuthRedirect(input)
      ) {
        // Store current path for redirect after login
        const currentPath = window.location.pathname + window.location.search;

        // Don't redirect if already on auth pages
        if (!currentPath.startsWith("/auth/") && !currentPath.startsWith("/payment/")) {
          isRedirectingRef.current = true;
          const loginUrl = `/auth/login?redirect=${encodeURIComponent(currentPath)}&reason=session_expired`;

          // Small delay to allow any pending UI updates
          setTimeout(() => {
            window.location.href = loginUrl;
          }, 100);
        }
      }

      return response;
    };

    // Mark the intercepted fetch so we don't double-wrap
    (interceptedFetch as unknown as { __authIntercepted?: boolean }).__authIntercepted = true;

    // Override global fetch
    window.fetch = interceptedFetch;

    // Cleanup: restore original fetch on unmount
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
        originalFetchRef.current = null;
        isRedirectingRef.current = false;
      }
    };
  }, []);

  return <>{children}</>;
}

/**
 * Reset the redirect flag (called after successful login)
 * Note: This is a no-op now since we use a ref inside the component,
 * but kept for API compatibility. The flag auto-resets on navigation.
 */
export function resetAuthRedirectFlag(): void {
  // No-op - the ref is scoped to the component instance
  // and resets naturally when the user navigates to login
}
