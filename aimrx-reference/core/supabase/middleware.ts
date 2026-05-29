/**
 * Supabase Middleware Module
 *
 * Handles authentication and session management in Next.js middleware.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { handleRouteAccess } from "@core/routing";
import { getUserRole } from "@core/auth";
import { envConfig } from "@core/config";
import { getCachedUserData, isSessionExpired, setSessionStarted } from "@core/auth/cache-helpers";
import { getBaseUrl } from "@core/routing/get-base-url";

/**
 * Updates the Supabase session during middleware execution
 *
 * This function:
 * 1. Creates a middleware-compatible Supabase client
 * 2. Retrieves the current user and their role
 * 3. Handles route access control based on authentication status and role
 * 4. Updates cookies for maintaining the session
 *
 * @param request - The incoming Next.js request
 * @returns A Next.js response, either the original response with updated cookies or a redirect
 */
export async function updateSession(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const isSupabaseAuth = name.startsWith("sb-") && name.includes("-auth-token");
            if (isSupabaseAuth) {
              const { maxAge, expires, ...sessionOptions } = options as Record<string, unknown>;
              void maxAge;
              void expires;
              supabaseResponse.cookies.set(name, value, sessionOptions);
            } else {
              supabaseResponse.cookies.set(name, value, options);
            }
          });
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const staleCookies = ["totp_verified", "session_started", "user_role_cache", "user_role", "user_role_uid", "intake_complete_cache", "provider_active_cache", "mfa_pending", "mfa_method"];
    staleCookies.forEach((name) => {
      if (request.cookies.get(name)?.value) {
        supabaseResponse.cookies.set(name, "", { path: "/", maxAge: 0 });
      }
    });
  }

  const pathname = request.nextUrl.pathname;

  if (user) {
    const cached = getCachedUserData(request);

    const authExemptPaths = [
      "/auth/mfa-enroll",
      "/auth/mfa-verify",
      "/auth/verify-mfa",
      "/auth/logout",
      "/auth/login",
      "/auth/reset-password",
      "/auth/confirm",
      "/api/",
      // Patient-facing payment pages are authorized PURELY by the signed
      // token in the URL — never by Supabase auth. If a patient happens to
      // also have a Supabase user account (or a stale session from a prior
      // visit), the MFA gate below would otherwise redirect them to
      // /auth/verify-mfa and trap them on a 6-digit-code screen they can
      // never escape, even though the payment page itself requires no
      // login. This was the Keith Robinson incident, May 7 2026.
      "/payment/",
    ];

    const isExemptPath = authExemptPaths.some((p) => pathname.startsWith(p));

    if (!isExemptPath) {
      if (cached.sessionToken && await isSessionExpired(cached.sessionToken)) {
        await supabase.auth.signOut();
        const loginUrl = new URL("/auth/login", baseUrl);
        loginUrl.searchParams.set("reason", "session_expired");
        const redirectResponse = NextResponse.redirect(loginUrl);
        const expiredCookies = ["user_role_cache", "user_role", "user_role_uid", "intake_complete_cache", "provider_active_cache", "mfa_pending", "mfa_method", "session_started", "totp_verified"];
        expiredCookies.forEach((name) => {
          redirectResponse.cookies.set(name, "", { path: "/", maxAge: 0 });
        });
        return redirectResponse;
      }

      const totpVerified = request.cookies.get("totp_verified")?.value === "true";
      const userMfaMethod = request.cookies.get("mfa_method")?.value;

      if (!totpVerified) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (userMfaMethod === "email") { // explicit email flow; missing/undefined/totp all use TOTP AAL path below
          if (aalData?.currentLevel === "aal2") {
            supabaseResponse.cookies.set("totp_verified", "true", {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
            if (request.cookies.get("mfa_pending")?.value) {
              supabaseResponse.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
            }
            if (!cached.sessionToken) {
              await setSessionStarted(supabaseResponse);
            }
          } else {
            const mfaPending = request.cookies.get("mfa_pending")?.value === "true";
            if (mfaPending) {
              const verifyUrl = new URL("/auth/verify-mfa", baseUrl);
              verifyUrl.searchParams.set("redirect", pathname);
              const mfaRedirect = NextResponse.redirect(verifyUrl);
              for (const cookie of supabaseResponse.cookies.getAll()) {
                mfaRedirect.cookies.set(cookie.name, cookie.value);
              }
              return mfaRedirect;
            }
            const verifyUrl = new URL("/auth/verify-mfa", baseUrl);
            verifyUrl.searchParams.set("redirect", pathname);
            const mfaFallbackRedirect = NextResponse.redirect(verifyUrl);
            for (const cookie of supabaseResponse.cookies.getAll()) {
              mfaFallbackRedirect.cookies.set(cookie.name, cookie.value);
            }
            mfaFallbackRedirect.cookies.set("mfa_pending", "true", {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
            return mfaFallbackRedirect;
          }
        } else {
          if (aalData?.nextLevel === "aal2" && aalData?.currentLevel === "aal1") {
            const verifyUrl = new URL("/auth/mfa-verify", baseUrl);
            verifyUrl.searchParams.set("redirect", pathname);
            const mfaRedirect = NextResponse.redirect(verifyUrl);
            for (const cookie of supabaseResponse.cookies.getAll()) {
              mfaRedirect.cookies.set(cookie.name, cookie.value);
            }
            return mfaRedirect;
          }

          if (aalData?.currentLevel === "aal2") {
            supabaseResponse.cookies.set("totp_verified", "true", {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
            if (!cached.sessionToken) {
              await setSessionStarted(supabaseResponse);
            }
          } else if (aalData?.nextLevel === "aal1" || !aalData?.nextLevel) {
            const enrollUrl = new URL("/auth/mfa-enroll", baseUrl);
            enrollUrl.searchParams.set("redirect", pathname);
            const enrollRedirect = NextResponse.redirect(enrollUrl);
            for (const cookie of supabaseResponse.cookies.getAll()) {
              enrollRedirect.cookies.set(cookie.name, cookie.value);
            }
            return enrollRedirect;
          }
        }
      } else if (!cached.sessionToken) {
        await setSessionStarted(supabaseResponse);
      }
    }
  }

  let userRole: string | null = null;

  if (user) {
    // Try to get role from cache first, but only trust it if it's bound to the current user
    const cached = getCachedUserData(request);
    const cachedUserId = request.cookies.get("user_role_uid")?.value;

    if (cached.role && cachedUserId === user.id) {
      userRole = cached.role;
    }

    // If not cached or cache is for a different user, query database
    if (!userRole) {
      userRole = await getUserRole(user.id, supabase);
      // Cache the role for future requests, bound to user ID
      if (userRole) {
        supabaseResponse.cookies.set("user_role_cache", userRole, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        supabaseResponse.cookies.set("user_role", userRole, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        supabaseResponse.cookies.set("user_role_uid", user.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    }
  } else {
    const noUserCookies = ["user_role_cache", "user_role", "user_role_uid", "intake_complete_cache", "provider_active_cache", "mfa_pending", "mfa_method", "session_started", "totp_verified"];
    noUserCookies.forEach((name) => {
      supabaseResponse.cookies.set(name, "", { path: "/", maxAge: 0 });
    });
  }

  // -----------------------------------------------------------------------
  // First-login gates for assistants ("delegates").
  //
  // 1. must_change_password — set in user_metadata at user create. While true,
  //    redirect every protected page to /auth/change-password.
  // 2. unsigned delegation — once the password is changed, if the user is a
  //    delegate with at least one pending_delegate row that has not been
  //    signed yet, redirect to /auth/first-login-acknowledgment.
  //
  // Both gates run only AFTER MFA (MFA paths are exempt above) and skip the
  // gate's own page + all /api/* so the page can call its own API.
  // -----------------------------------------------------------------------
  if (user) {
    const isApi = pathname.startsWith("/api/");
    const isAuthLogout = pathname === "/auth/logout";
    // Login + recovery pages must ALWAYS be reachable. If a user is somehow
    // stranded with bad cookies, they need to be able to land on /auth/login
    // (which the route-guard then redirects to dashboard if they are valid).
    const isAuthRecovery =
      pathname === "/auth/login" || pathname === "/auth/reset-password";
    // MFA flow MUST run before either of these gates. If we redirect MFA
    // pages to /auth/change-password we create an MFA<->password loop.
    const isMfaFlow =
      pathname.startsWith("/auth/mfa-enroll") ||
      pathname.startsWith("/auth/mfa-verify") ||
      pathname.startsWith("/auth/verify-mfa");
    const mustChangePassword =
      (user.user_metadata as Record<string, unknown> | undefined)
        ?.must_change_password === true;
    const onChangePasswordPage = pathname === "/auth/change-password";
    const onAcknowledgmentPage = pathname === "/auth/first-login-acknowledgment";

    if (
      mustChangePassword &&
      !isApi &&
      !isAuthLogout &&
      !isAuthRecovery &&
      !isMfaFlow &&
      !onChangePasswordPage
    ) {
      const url = new URL("/auth/change-password", baseUrl);
      const redirect = NextResponse.redirect(url);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie.name, cookie.value);
      }
      return redirect;
    }

    if (
      !mustChangePassword &&
      userRole === "delegate" &&
      !isApi &&
      !isAuthLogout &&
      !isAuthRecovery &&
      !isMfaFlow &&
      !onAcknowledgmentPage &&
      !onChangePasswordPage
    ) {
      // Cheap existence check using the same anon-keyed client (RLS allows
      // delegates to read their own rows). Service role not needed here.
      const { count, error: ackErr } = await supabase
        .from("delegations")
        .select("id", { count: "exact", head: true })
        .eq("delegate_user_id", user.id)
        .eq("status", "pending_delegate")
        .is("delegate_signed_at", null);
      if (ackErr) {
        // Soft-fail: a transient error on this read (network blip, slow
        // Supabase response, momentary token refresh race) used to sign
        // the assistant out and bounce them to /auth/login with
        // ?reason=ack_check_failed, creating an unrecoverable login loop
        // for users who repeatedly hit the blip. The acknowledgment is
        // re-checked on EVERY request, so allowing this single request
        // through does not bypass the gate — the next navigation will
        // re-evaluate. We log loudly so this is still observable in
        // production logs, but we no longer kick the user out.
        console.error(
          "[middleware] pending-delegation ack check errored; allowing request through, will re-check on next navigation:",
          ackErr,
        );
      } else if ((count ?? 0) > 0) {
        const url = new URL("/auth/first-login-acknowledgment", baseUrl);
        const redirect = NextResponse.redirect(url);
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(cookie.name, cookie.value);
        }
        return redirect;
      }
    }
  }

  // Handle route access based on authentication and role
  const routeResponse = await handleRouteAccess(
    request,
    {
      isAuthenticated: !!user,
      role: userRole,
      userId: user?.id,
    },
    supabase,
  );
  if (routeResponse) {
    // Copy ALL cookies from supabaseResponse to redirect response (session + cache)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      routeResponse.cookies.set(cookie.name, cookie.value);
    }
    // Also set role cookies on redirect if available
    if (userRole && user) {
      routeResponse.cookies.set("user_role_cache", userRole, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      routeResponse.cookies.set("user_role", userRole, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      routeResponse.cookies.set("user_role_uid", user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }
    return routeResponse;
  }

  // If patient user successfully accessed a protected route, cache intake as complete
  const isPatient = userRole === "user" || (user && userRole === null);
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/appointments");

  if (user && isPatient && isProtectedRoute) {
    supabaseResponse.cookies.set("intake_complete_cache", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  // Prevent browser caching of auth pages to avoid stale state
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    supabaseResponse.headers.set("Pragma", "no-cache");
  }

  return supabaseResponse;
}
