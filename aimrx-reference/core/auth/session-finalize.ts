import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";

export type MfaMethodCookieValue = "email" | "totp" | "recovery_code";

const ROLE_DEFAULT_PATHS: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  "super-admin": "/admin",
  pharmacy_admin: "/admin",
  "pharmacy-admin": "/admin",
  provider: "/prescriptions",
  delegate: "/prescriptions",
};

function resolveSafeRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null;
  if (!redirect.startsWith("/") || redirect.startsWith("//")) return null;
  return redirect;
}

function defaultPathForRole(role: string): string {
  return ROLE_DEFAULT_PATHS[role] ?? "/";
}

export interface ResolveSessionRoleArgs {
  userId: string;
  redirect?: string | null;
  mfaMethodCookieOverride?: MfaMethodCookieValue;
}

export interface ResolvedSessionRole {
  role: string;
  redirectUrl: string;
  mfaMethodCookie: MfaMethodCookieValue;
}

/**
 * Look up the user's role + persisted MFA method and compute the
 * post-login redirect URL. Pure data — no cookies are written here.
 */
export async function resolveSessionRole(
  args: ResolveSessionRoleArgs,
): Promise<ResolvedSessionRole> {
  const { userId, redirect, mfaMethodCookieOverride } = args;
  if (!userId) throw new Error("userId required to resolve session role");

  const admin = createAdminClient();
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role, mfa_method")
    .eq("user_id", userId)
    .maybeSingle();

  const role = roleRow?.role || "user";
  const mfaMethodCookie =
    mfaMethodCookieOverride ||
    (roleRow?.mfa_method as MfaMethodCookieValue | undefined) ||
    "email";

  const safeRedirect = resolveSafeRedirect(redirect);
  const redirectUrl = safeRedirect ?? defaultPathForRole(role);

  return { role, redirectUrl, mfaMethodCookie };
}

export interface ApplyFinishLineCookiesArgs {
  userId: string;
  role: string;
  mfaMethodCookie: MfaMethodCookieValue;
}

/**
 * Write all post-MFA finish-line cookies onto the response object the
 * caller will return. MUST be called on the SAME NextResponse that the
 * handler returns — Next.js can drop Set-Cookie headers when responses
 * are reconstructed.
 */
export async function applyMfaFinishLineCookies(
  response: NextResponse,
  args: ApplyFinishLineCookiesArgs,
): Promise<void> {
  const { userId, role, mfaMethodCookie } = args;
  if (!userId) throw new Error("userId required to apply finish-line cookies");

  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd;

  response.cookies.set("totp_verified", "true", {
    httpOnly: true,
    secure: secureFlag,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set("mfa_method", mfaMethodCookie, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
  response.cookies.set("user_role_cache", role, {
    httpOnly: true,
    secure: secureFlag,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set("user_role", role, {
    httpOnly: true,
    secure: secureFlag,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set("user_role_uid", userId, {
    httpOnly: true,
    secure: secureFlag,
    sameSite: "lax",
    path: "/",
  });

  await setSessionStarted(response);
}
