import { NextRequest, NextResponse } from "next/server";
import { verifyMFACode } from "@/core/services/mfa/mfaService";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import {
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@core/auth/mfa-recovery-hash";
import {
  appendTrustToken,
  createTrustedDevice,
  decodeTrustTokenList,
  encodeTrustTokenList,
  setTrustCookieOnResponse,
  TRUST_COOKIE_NAME,
  TRUST_DURATION_DAYS,
} from "@core/auth/trusted-device";
import { prepareDeviceFingerprint } from "@core/auth/device-fingerprint";
import { scrubError } from "@core/auth/scrub-trust-token";
import {
  applyMfaFinishLineCookies,
  resolveSessionRole,
  type MfaMethodCookieValue,
} from "@core/auth/session-finalize";

type CompleteMethod = "email_code" | "totp" | "recovery_code";

interface CompleteRequestBody {
  method?: CompleteMethod;
  userId?: string;
  code?: string;
  rememberDevice?: boolean;
  // `fingerprint` is accepted for backward compatibility with stale tabs
  // mid-deploy but is intentionally IGNORED — the server computes the
  // canonical fingerprint via computeDeviceFingerprintWithResponse so it
  // matches what /api/auth/mfa/trust-check computes on the next login.
  fingerprint?: string;
  redirect?: string;
}

const ALLOWED_METHODS: ReadonlySet<CompleteMethod> = new Set([
  "email_code",
  "totp",
  "recovery_code",
]);

const METHOD_TO_COOKIE: Record<CompleteMethod, MfaMethodCookieValue> = {
  email_code: "email",
  totp: "totp",
  recovery_code: "recovery_code",
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip") || null;
}

/**
 * Unified MFA completion endpoint (Step 4 of 14 — Trusted Device feature).
 *
 * Replaces the divergent finish lines of:
 *   - email-code path  (was: /api/auth/mfa/verify-code  + /api/auth/mfa/session-init)
 *   - TOTP path        (was: client mfa.challengeAndVerify + /api/auth/mfa/session-init)
 *   - recovery code    (was: /api/auth/mfa/verify-recovery-code + /api/auth/mfa/session-init)
 *
 * Single funnel handles:
 *   1. Method-specific verification
 *   2. Optional trusted-device creation (when rememberDevice && fingerprint)
 *   3. Standard MFA finish-line cookies + role-based redirect resolution
 *
 * Legacy endpoints remain live for backward compatibility — Step 5 will
 * migrate the verification pages to call this endpoint instead.
 */
export async function POST(request: NextRequest) {
  let body: CompleteRequestBody;
  try {
    body = (await request.json()) as CompleteRequestBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const method = body.method;
  if (!method || !ALLOWED_METHODS.has(method)) {
    return badRequest("Invalid or missing method");
  }

  const rememberDevice = body.rememberDevice === true;

  let userId: string;

  try {
    if (method === "email_code") {
      const reqUserId = typeof body.userId === "string" ? body.userId : "";
      const code = typeof body.code === "string" ? body.code : "";
      if (!reqUserId || !code) {
        return badRequest("Missing userId or code");
      }

      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id !== reqUserId) {
        return badRequest("User mismatch", 403);
      }

      const result = await verifyMFACode(reqUserId, code);
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            locked: result.locked || false,
          },
          { status: result.locked ? 429 : 400 },
        );
      }
      userId = reqUserId;
    } else if (method === "totp") {
      // TOTP is verified by Supabase before reaching here. Confirm the
      // session has actually been elevated to AAL2.
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return badRequest("Unauthorized", 401);

      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        console.error("[mfa/complete] AAL fetch failed", {
          error: scrubError(aalError),
        });
        return badRequest("Failed to verify TOTP elevation", 500);
      }
      if (aalData?.currentLevel !== "aal2") {
        return badRequest("TOTP not yet verified for this session", 401);
      }
      userId = user.id;
    } else {
      // recovery_code
      const rawCode = typeof body.code === "string" ? body.code : "";
      if (!rawCode) return badRequest("Recovery code is required");

      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return badRequest("Unauthorized", 401);

      const code = normalizeRecoveryCode(rawCode);
      if (code.length < 6) return badRequest("Invalid recovery code format");

      const codeHash = hashRecoveryCode(user.id, code);
      const ip = getClientIp(request);
      const ua = request.headers.get("user-agent") || null;

      const admin = createAdminClient();
      const { data: rpcResult, error: rpcError } = await admin.rpc(
        "consume_mfa_recovery_code",
        {
          p_user_id: user.id,
          p_user_email: user.email ?? null,
          p_code_hash: codeHash,
          p_ip_address: ip,
          p_user_agent: ua,
          p_rate_limit: 5,
          p_window_minutes: 10,
        },
      );

      if (rpcError) {
        console.error("[mfa/complete] recovery RPC error", {
          error: scrubError(rpcError),
        });
        return badRequest("Failed to verify recovery code", 500);
      }

      const rpc = (rpcResult || {}) as {
        success?: boolean;
        reason?: string;
      };
      if (!rpc.success) {
        if (rpc.reason === "rate_limited") {
          return badRequest(
            "Too many invalid attempts. Please wait a few minutes before trying again.",
            429,
          );
        }
        if (rpc.reason === "no_codes") {
          return badRequest(
            "No recovery codes are set up for this account. Use your authenticator app or email code instead.",
          );
        }
        return badRequest("Invalid recovery code", 401);
      }
      userId = user.id;
    }

    // 1) Resolve role + redirect (pure read, no cookies yet).
    const { role, redirectUrl, mfaMethodCookie } = await resolveSessionRole({
      userId,
      redirect: body.redirect ?? null,
      mfaMethodCookieOverride: METHOD_TO_COOKIE[method],
    });

    // 2) Try to create the trusted device BEFORE the response exists.
    //    The fingerprint is prepared server-side using the SAME scheme as
    //    /api/auth/mfa/trust-check, so the next login can find this row.
    //    The aimrx_dvc cookie write is DEFERRED via setDeviceIdCookie and
    //    invoked on the SINGLE response object below — no copying, no
    //    re-wrapping, no cookies()-vs-response.cookies merge ambiguity.
    //    Default-deny: ANY failure here → MFA still succeeds, no cookie.
    let rememberedDeviceDays = 0;
    let trust: { cookieValue: string; expiresAt: Date } | null = null;
    let setDeviceIdCookie: ((r: NextResponse) => void) | undefined;
    if (rememberDevice) {
      try {
        const ip = getClientIp(request);
        const ua = request.headers.get("user-agent");
        const prepared = prepareDeviceFingerprint(request);
        // Pass the inbound aimrx_td cookie (if any) so the helper can
        // distinguish a double-click race (cookie already established)
        // from a network retry where the first response was lost (no
        // cookie yet, must rotate the surviving row's token_hash so
        // this response can finally set a working cookie).
        //
        // Step 11: the cookie is now a period-separated token list and
        // any of its tokens may have been minted for THIS user on a
        // prior trust event. Pass the entire decoded list to
        // createTrustedDevice so its Task #49 idempotency match can hash
        // every candidate against the surviving row — picking only the
        // first token would silently miss the idempotency path whenever
        // another account's token sits at index 0, forcing an
        // unnecessary token rotation on every double-click and bloating
        // the cookie with stale entries.
        const existingTrustCookieRaw =
          request.cookies.get(TRUST_COOKIE_NAME)?.value || null;
        const existingTokens = decodeTrustTokenList(existingTrustCookieRaw);
        const td = await createTrustedDevice({
          userId,
          fingerprint: prepared.fingerprint,
          userAgent: ua,
          ip,
          existingTrustCookieTokens: existingTokens,
        });

        // Multi-user cookie merge (Step 11): preserve OTHER accounts'
        // tokens that were already in the cookie. Only the slot for
        // THIS user gets replaced by the new token.
        if (td.token) {
          // New token minted (fresh insert OR rotation). Append to the
          // existing list, dedupe-and-cap; the resulting cookie keeps
          // every prior account's token intact.
          const merged = appendTrustToken(existingTokens, td.token);
          trust = {
            cookieValue: encodeTrustTokenList(merged),
            expiresAt: td.expiresAt,
          };
        } else if (existingTokens.length > 0) {
          // Idempotency refresh path (Task #49): no new token, but we
          // still want to extend the cookie's max-age out to the new
          // expiresAt so the browser doesn't drop trust early. Re-write
          // the existing list value with the refreshed expiry.
          trust = {
            cookieValue: encodeTrustTokenList(existingTokens),
            expiresAt: td.expiresAt,
          };
        }
        setDeviceIdCookie = prepared.setDeviceIdCookie;
        rememberedDeviceDays = TRUST_DURATION_DAYS;
      } catch (err) {
        console.error("[mfa/complete] trusted-device create failed", {
          error: scrubError(err),
        });
      }
    }

    // 3) Build the FINAL response ONCE with the correct body, then write
    //    every cookie onto THIS response object.
    const response = NextResponse.json({
      success: true,
      role,
      redirect: redirectUrl,
      rememberedDeviceDays,
    });

    if (trust) {
      setTrustCookieOnResponse(response, trust.cookieValue, trust.expiresAt);
    }
    setDeviceIdCookie?.(response);
    await applyMfaFinishLineCookies(response, {
      userId,
      role,
      mfaMethodCookie,
    });

    return response;
  } catch (error) {
    console.error("[mfa/complete] unexpected error", {
      error: scrubError(error),
    });
    return badRequest("Failed to complete MFA", 500);
  }
}
