import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Browser fingerprint scheme — v2 (Task #83, May 2026).
 *
 * Inputs (in order, joined by "|"):
 *   1. fingerprint scheme version tag ("v2")
 *   2. parsed browser family + OS family (e.g. "chrome|macos") — version-free
 *   3. Long-lived `aimrx_dvc` cookie (random 24-byte id minted on first visit)
 *
 * v1 (now retired) used the raw User-Agent header AND Accept-Language. Both
 * proved too brittle in production: Chrome auto-updates every ~4 weeks and
 * the version bump rewrote the UA, invalidating ~10% of trust cookies on
 * every cycle. Accept-Language drifted on OS language changes / extension
 * updates and produced similar churn.
 *
 * v2 keeps the `aimrx_dvc` cookie as the real identity anchor (a random
 * id minted on first visit, stored in an HttpOnly 2-year cookie) and uses
 * only the version-free "browser family + OS family" parse of the UA as a
 * weak cross-check. Bumping the version tag retires every existing trust
 * row in one clean sweep: every user gets exactly ONE post-deploy 2FA
 * prompt, then 90-day trust as designed.
 *
 * The same composition is used by:
 *   - the trust-check gate (read side)
 *   - the trust-creation endpoint that writes a row into `trusted_devices`
 *   - any future "manage trusted devices" UI
 *
 * Any change to this list invalidates every existing trusted device, since
 * the stored `device_fingerprint_hash` will no longer match. Bump
 * FP_VERSION below if you intentionally want to force re-trust.
 */
const FP_VERSION = "v2";
export const DEVICE_ID_COOKIE = "aimrx_dvc";
const DEVICE_ID_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

/**
 * Reduce a raw User-Agent header to a stable "browser family | OS family"
 * pair with no version numbers. Order of browser checks matters: Edge/Opera
 * both inject the literal substring "Chrome" into their UA, so they MUST
 * be matched first. Returns empty string for empty input so the resulting
 * fingerprint composition stays stable.
 */
export function parseBrowserFamily(ua: string): string {
  if (!ua) return "";
  const u = ua.toLowerCase();

  // Order matters: Edge / Opera / Edge-mobile UAs all inject "Chrome/"
  // or "Safari/" into their UA, so they MUST be matched first to avoid
  // misclassification. edga/ = Edge on Android, edgios/ = Edge on iOS.
  let browser = "unknown";
  if (
    u.includes("edg/") ||
    u.includes("edge/") ||
    u.includes("edga/") ||
    u.includes("edgios/")
  )
    browser = "edge";
  else if (u.includes("opr/") || u.includes("opios/") || u.includes("opera"))
    browser = "opera";
  else if (u.includes("firefox/") || u.includes("fxios/")) browser = "firefox";
  else if (u.includes("chrome/") || u.includes("crios/")) browser = "chrome";
  else if (u.includes("safari/")) browser = "safari";

  let os = "unknown";
  if (u.includes("windows")) os = "windows";
  else if (
    u.includes("iphone") ||
    u.includes("ipad") ||
    u.includes("ipod") ||
    /\bcpu os \d/.test(u)
  )
    os = "ios";
  else if (u.includes("mac os") || u.includes("macintosh") || u.includes("mac_powerpc"))
    os = "macos";
  else if (u.includes("android")) os = "android";
  else if (u.includes("cros ")) os = "chromeos";
  else if (u.includes("linux")) os = "linux";

  return `${browser}|${os}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_ID_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,}$/.test(existing)) {
    return existing;
  }
  const id = crypto.randomBytes(24).toString("base64url");
  store.set({
    name: DEVICE_ID_COOKIE,
    value: id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_ID_MAX_AGE,
  });
  return id;
}

export async function readDeviceId(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEVICE_ID_COOKIE)?.value || null;
}

export interface FingerprintInput {
  userAgent: string;
  /**
   * @deprecated v1 input. v2 ignores Accept-Language because it drifted in
   * production and produced ~10% spurious fingerprint mismatches. The field
   * is kept on the interface so legacy callers / test scripts compile
   * unchanged, but its value is NOT mixed into the hash.
   */
  acceptLanguage?: string;
  deviceId: string;
}

export function fingerprintFromInput(input: FingerprintInput): string {
  return [
    FP_VERSION,
    parseBrowserFamily(input.userAgent || ""),
    input.deviceId || "",
  ].join("|");
}

/**
 * Compute the canonical fingerprint string for the current request.
 * On first call for a browser that has no `aimrx_dvc` cookie, this mints
 * one and sets it on the outgoing response. That means the very first
 * trust-check on a brand-new browser will always go through the not-found
 * branch (correct — no trust row exists yet) but subsequent calls will be
 * stable.
 *
 * NOTE: Prefer `prepareDeviceFingerprint` in any handler that also writes
 * cookies onto a `NextResponse` — Next.js can drop cookies set via
 * `next/headers cookies()` when the same handler also writes
 * `response.cookies`. Using this async variant in such a handler will
 * silently fail to land the `aimrx_dvc` cookie and trust will never
 * stabilize.
 */
export async function computeDeviceFingerprint(
  request: Request | NextRequest,
): Promise<string> {
  const userAgent = request.headers.get("user-agent") || "";
  const deviceId = await getOrCreateDeviceId();
  return fingerprintFromInput({ userAgent, deviceId });
}

/**
 * Response-bound variant. Use from handlers that ALSO set other cookies on
 * the returned NextResponse — Next.js can drop cookies set via next/headers
 * cookies() when the same handler also writes response.cookies (the same
 * gotcha that bit Step 4 the first time). Reads any existing aimrx_dvc from
 * the request, mints one if absent, and writes it onto the response so the
 * very next request from this browser sees the same value.
 */
export interface PreparedFingerprint {
  fingerprint: string;
  /**
   * Present only when this request had no valid `aimrx_dvc` cookie and we
   * minted a new one. Caller MUST invoke this against the SAME NextResponse
   * it ultimately returns, so the new device id reaches the browser.
   * Absent when the browser already has a stable id — nothing to write.
   */
  setDeviceIdCookie?: (response: NextResponse) => void;
}

/**
 * Pure-ish prepare step. Reads `aimrx_dvc` from the request, mints one if
 * absent, computes the canonical fingerprint, and returns a setter the
 * caller invokes on its FINAL response. Lets the route build a single
 * NextResponse end-to-end with no copying or re-wrapping — much safer
 * around the cookies()-vs-response.cookies merge gotcha.
 */
export function prepareDeviceFingerprint(
  request: Request | NextRequest,
): PreparedFingerprint {
  const userAgent = request.headers.get("user-agent") || "";
  const cookieHeader = request.headers.get("cookie") || "";
  let deviceId = "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName && rawName.trim() === DEVICE_ID_COOKIE) {
      deviceId = decodeURIComponent(rest.join("=").trim());
      break;
    }
  }
  let setDeviceIdCookie: PreparedFingerprint["setDeviceIdCookie"];
  if (!deviceId || !/^[A-Za-z0-9_-]{16,}$/.test(deviceId)) {
    deviceId = crypto.randomBytes(24).toString("base64url");
    const value = deviceId;
    setDeviceIdCookie = (response) => {
      response.cookies.set({
        name: DEVICE_ID_COOKIE,
        value,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: DEVICE_ID_MAX_AGE,
      });
    };
  }
  return {
    fingerprint: fingerprintFromInput({ userAgent, deviceId }),
    setDeviceIdCookie,
  };
}

/**
 * Convenience wrapper that composes prepareDeviceFingerprint + the setter
 * in one call. Kept for callers that don't need to defer the cookie write.
 */
export function computeDeviceFingerprintWithResponse(
  request: Request | NextRequest,
  response: NextResponse,
): string {
  const prepared = prepareDeviceFingerprint(request);
  prepared.setDeviceIdCookie?.(response);
  return prepared.fingerprint;
}
