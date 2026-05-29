import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import { setSessionStarted } from "@core/auth/cache-helpers";
import {
  decodeTrustTokenList,
  lookupTrustedDevice,
  markTrustedDeviceUsed,
  readTrustCookie,
  type TrustedLookupReason,
  type TrustedLookupResult,
} from "@core/auth/trusted-device";
import {
  prepareDeviceFingerprint,
  type PreparedFingerprint,
} from "@core/auth/device-fingerprint";
import { logTrustedDeviceEvent } from "@core/audit/trusted-device-audit";
import { scrubError } from "@core/auth/scrub-trust-token";

type Reason =
  | TrustedLookupReason
  | "ok"
  | "unauthenticated"
  | "lookup_error"
  | "user_mismatch";

function logTrustCheck(
  userId: string | null,
  reason: Reason,
  allowed: boolean,
): void {
  // Single structured log line per call. Intentionally NOT logging
  // the cookie value, token hash, or raw fingerprint.
  console.log(
    JSON.stringify({
      event: "trusted_device_skip",
      user_id: userId,
      reason,
      allowed,
    }),
  );
}

function pickRedirect(
  role: string | null | undefined,
  requested: string | null,
): string {
  let safe = "/";
  // Match session-init's sanitization rule exactly so trusted-skip and
  // normal-MFA paths land in the same place.
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
    safe = requested;
  }
  if (safe !== "/") return safe;
  switch (role) {
    case "admin":
    case "super_admin":
    case "super-admin":
    case "pharmacy_admin":
    case "pharmacy-admin":
      return "/admin";
    case "provider":
    case "delegate":
      return "/prescriptions";
    default:
      return "/";
  }
}

/**
 * Apply the deferred `aimrx_dvc` setter (if any) to the response we are
 * about to return. The aimrx_dvc cookie is the IDENTITY ANCHOR of the
 * trusted-device fingerprint — if a route that also writes other cookies
 * on `response.cookies` forgets this call, Next.js silently drops the
 * `cookies().set()` write and the browser never sees the device id. On
 * the NEXT login the fingerprint won't match anything and the user is
 * kicked back to 2FA. This was the "Dr. Whipps 9 active rows in 8 days"
 * pattern that motivated Task #83.
 *
 * Returns the response unchanged so it can be used inline.
 */
function withDeviceIdCookie<R extends NextResponse>(
  response: R,
  prepared: PreparedFingerprint | null,
): R {
  prepared?.setDeviceIdCookie?.(response);
  return response;
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  // Prepared up front so that even error / early-return paths can stamp
  // the device id cookie onto their NextResponse. Without this an empty
  // aimrx_dvc cookie state would propagate forever (no trust possible).
  let prepared: PreparedFingerprint | null = null;
  try {
    prepared = prepareDeviceFingerprint(request);
  } catch {
    prepared = null;
  }
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logTrustCheck(null, "unauthenticated", false);
      return withDeviceIdCookie(
        NextResponse.json(
          { trusted: false, reason: "unauthenticated" },
          { status: 401 },
        ),
        prepared,
      );
    }
    userId = user.id;

    let body: { redirect?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const requestedRedirect =
      typeof body.redirect === "string" ? body.redirect : null;

    const cookieValue = await readTrustCookie();
    const tokens = decodeTrustTokenList(cookieValue);
    if (tokens.length === 0) {
      logTrustCheck(userId, "no_cookie", false);
      return withDeviceIdCookie(
        NextResponse.json({ trusted: false, reason: "no_cookie" }),
        prepared,
      );
    }

    // Multi-user trust on the same browser (Step 11): the cookie is a
    // period-separated list of tokens (one per account that trusted
    // this browser). Iterate them and accept the first one whose row
    // belongs to THIS user. We track the most-relevant per-user failure
    // (fingerprint_mismatch / expired) so audit logging stays accurate.
    let lookup: TrustedLookupResult | null = null;
    let auditableFailure:
      | "fingerprint_mismatch"
      | "expired"
      | null = null;
    let fallbackReason: TrustedLookupReason = "not_found";
    try {
      const fingerprint = prepared
        ? prepared.fingerprint
        : prepareDeviceFingerprint(request).fingerprint;
      for (const tok of tokens) {
        const r = await lookupTrustedDevice({
          cookieValue: tok,
          fingerprint,
        });
        if (r.trusted) {
          if (r.row.user_id === userId) {
            lookup = r;
            break;
          }
          // Belongs to another account that also trusted this browser —
          // fine, just not the one signing in right now. Keep looking.
          continue;
        }
        // Failure: only record an audit-worthy reason when the row
        // actually belongs to THIS user. fingerprint_mismatch wins
        // over expired because it's the more security-relevant event.
        if (
          r.rowUserId === userId &&
          (r.reason === "fingerprint_mismatch" || r.reason === "expired")
        ) {
          if (!auditableFailure || r.reason === "fingerprint_mismatch") {
            auditableFailure = r.reason;
          }
          fallbackReason = r.reason;
        }
      }
    } catch (err) {
      console.error("[trust-check] lookup threw", {
        error: scrubError(err),
      });
      logTrustCheck(userId, "lookup_error", false);
      return withDeviceIdCookie(
        NextResponse.json({ trusted: false, reason: "lookup_error" }),
        prepared,
      );
    }

    if (!lookup) {
      const reportedReason: Reason = auditableFailure ?? fallbackReason;
      logTrustCheck(userId, reportedReason, false);
      // Persist auto-break events for HIPAA audit ONLY when the failing
      // row belongs to the signing-in user. Other accounts' tokens
      // failing here is normal (they didn't sign in) and must not
      // pollute this user's audit trail.
      if (auditableFailure) {
        const ipForAudit =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          null;
        const uaForAudit = request.headers.get("user-agent");
        await logTrustedDeviceEvent({
          action:
            auditableFailure === "fingerprint_mismatch"
              ? "TRUSTED_DEVICE_FINGERPRINT_MISMATCH"
              : "TRUSTED_DEVICE_EXPIRED",
          userId,
          actorId: userId,
          ip: ipForAudit,
          userAgent: uaForAudit,
        });
      }
      return withDeviceIdCookie(
        NextResponse.json({ trusted: false, reason: reportedReason }),
        prepared,
      );
    }

    const admin = createAdminClient();
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role, mfa_method")
      .eq("user_id", userId)
      .maybeSingle();

    const role = roleData?.role || "user";
    const mfaMethod = roleData?.mfa_method || "email";
    const target = pickRedirect(role, requestedRedirect);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    try {
      await markTrustedDeviceUsed(lookup.row.id, ip);
    } catch (err) {
      // Mark-used is best-effort; do NOT fail the trust skip on it.
      console.warn("[trust-check] mark-used failed", {
        error: scrubError(err),
      });
    }

    const response = NextResponse.json({ trusted: true, redirect: target });

    // Mirror the post-2FA finalization (see session-init / complete-setup):
    // clear mfa_pending, set totp_verified, set mfa_method, prime role
    // cookies, start the signed session timestamp.
    response.cookies.set("mfa_pending", "", { path: "/", maxAge: 0 });
    response.cookies.set("totp_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("mfa_method", mfaMethod, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    response.cookies.set("user_role_cache", role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role", role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    response.cookies.set("user_role_uid", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    await setSessionStarted(response);

    logTrustCheck(userId, "ok", true);
    return withDeviceIdCookie(response, prepared);
  } catch (err) {
    console.error("[trust-check] handler threw", {
      error: scrubError(err),
    });
    logTrustCheck(userId, "lookup_error", false);
    // Default-deny: never silently let the user past 2FA on an error.
    return withDeviceIdCookie(
      NextResponse.json({ trusted: false, reason: "lookup_error" }),
      prepared,
    );
  }
}
