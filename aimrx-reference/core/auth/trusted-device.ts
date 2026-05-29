import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { logTrustedDeviceEvent } from "@core/audit/trusted-device-audit";
import { scrubError } from "@core/auth/scrub-trust-token";
import { sendNewTrustedDeviceEmail as notifyNewTrustedDevice } from "@core/services/trusted-device-email";

const HASH_VERSION = "v1";
export const TRUST_COOKIE_NAME = "aimrx_td";
export const TRUST_DURATION_DAYS = 90;
const TRUST_DURATION_SECONDS = TRUST_DURATION_DAYS * 24 * 60 * 60;

/**
 * Multi-user trust on the same browser (Step 11 of 14).
 *
 * The aimrx_td cookie used to hold ONE token. That broke when two
 * different accounts trusted the same browser back-to-back: the second
 * trust overwrote the first account's secret, and switching back forced
 * 2FA on the first account.
 *
 * Wire format is now a period-separated list of trust tokens
 * (e.g. `tokA.tokB.tokC`). Period is NOT in the base64url alphabet so
 * splitting on it is unambiguous. A legacy single-token cookie (no
 * period) decodes to a one-element list, so existing browsers keep
 * working through the deploy. Capped at MAX_TRUST_TOKENS — appending
 * the (cap+1)th token evicts the oldest (FIFO) so the cookie can't grow
 * unboundedly.
 */
export const MAX_TRUST_TOKENS = 5;

/**
 * Step 12 (per-user trusted-device cap): hard upper bound on the number
 * of ACTIVE (non-revoked, non-expired) rows a single user may have in
 * `trusted_devices`. When a fresh grant pushes the count past this
 * limit, the OLDEST rows (by last_used_at ASC) are auto-revoked with
 * reason "cap_exceeded" so the live table and per-user device list
 * stay bounded. The audit trail in system_logs (Step 9) preserves the
 * full history. 10 is generous enough to cover a power user's laptop +
 * desktop + phone + tablet + a few hotel/loaner browsers, but tight
 * enough to keep an attacker who steals one session from quietly
 * trusting dozens of devices.
 */
export const MAX_TRUSTED_DEVICES_PER_USER = 10;
const TRUST_TOKEN_DELIMITER = ".";

/**
 * Decode an aimrx_td cookie value into a list of trust tokens.
 * Tolerates legacy single-token format (no delimiter present).
 * Drops empty / too-short fragments. Returns [] for null/empty input.
 * Caps the result at MAX_TRUST_TOKENS, keeping the most recent
 * (rightmost) entries — same eviction direction as appendTrustToken.
 */
export function decodeTrustTokenList(
  cookieValue: string | null | undefined,
): string[] {
  if (!cookieValue || typeof cookieValue !== "string") return [];
  const parts = cookieValue
    .split(TRUST_TOKEN_DELIMITER)
    .map((p) => p.trim())
    .filter((p) => p.length >= 16);
  return parts.slice(-MAX_TRUST_TOKENS);
}

/** Encode a list of tokens into the cookie wire format. */
export function encodeTrustTokenList(tokens: string[]): string {
  return tokens
    .filter((t) => t && t.length >= 16)
    .slice(-MAX_TRUST_TOKENS)
    .join(TRUST_TOKEN_DELIMITER);
}

/**
 * Append a token to the list, deduping exact-string matches (so a
 * retry that re-uses an already-present token doesn't double-list it).
 * FIFO-evicts the oldest token when the list would exceed the cap.
 */
export function appendTrustToken(
  existing: string[],
  newToken: string,
): string[] {
  if (!newToken || newToken.length < 16) return existing.slice(-MAX_TRUST_TOKENS);
  const filtered = existing.filter((t) => t !== newToken);
  filtered.push(newToken);
  return filtered.slice(-MAX_TRUST_TOKENS);
}

/**
 * Drop tokens whose SHA-256 hash is in `hashesToRemove`. Used by the
 * revoke endpoints to prune cookie entries whose backing rows just
 * got revoked, while leaving other users' tokens untouched.
 */
export function removeTrustTokensByHash(
  tokens: string[],
  hashesToRemove: Set<string>,
): string[] {
  if (hashesToRemove.size === 0) return tokens.slice();
  const out: string[] = [];
  for (const t of tokens) {
    try {
      if (!hashesToRemove.has(hashTrustToken(t))) out.push(t);
    } catch {
      // Malformed token — drop silently.
    }
  }
  return out;
}

function getAuthPepper(): string {
  const pepper =
    process.env.MFA_RECOVERY_HMAC_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!pepper) {
    throw new Error(
      "Trusted device pepper is not configured (set MFA_RECOVERY_HMAC_SECRET or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return pepper;
}

export function generateTrustToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashTrustToken(token: string): string {
  if (!token || typeof token !== "string" || token.length < 16) {
    throw new Error("trust token too short to hash");
  }
  return (
    HASH_VERSION +
    ":" +
    crypto
      .createHmac("sha256", getAuthPepper())
      .update(`trusted-device:token:${token}`)
      .digest("hex")
  );
}

export function hashFingerprint(fingerprint: string): string {
  if (!fingerprint || typeof fingerprint !== "string") {
    throw new Error("fingerprint required to hash");
  }
  return (
    HASH_VERSION +
    ":" +
    crypto
      .createHmac("sha256", getAuthPepper())
      .update(`trusted-device:fingerprint:${fingerprint}`)
      .digest("hex")
  );
}

export async function setTrustCookie(token: string, expiresAt: Date): Promise<void> {
  if (!token) throw new Error("token required to set trust cookie");
  const maxAgeMs = expiresAt.getTime() - Date.now();
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000));
  const store = await cookies();
  store.set({
    name: TRUST_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    expires: expiresAt,
  });
}

/**
 * Variant that writes the trust cookie directly onto a NextResponse the
 * caller will return. Required when the same handler also sets other
 * cookies on the response — Next.js does not always merge multi-value
 * Set-Cookie headers across cookies() and response.cookies.
 */
export function setTrustCookieOnResponse(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  if (!token) throw new Error("token required to set trust cookie");
  const maxAgeMs = expiresAt.getTime() - Date.now();
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000));
  response.cookies.set({
    name: TRUST_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    expires: expiresAt,
  });
}

export async function readTrustCookie(): Promise<string | null> {
  const store = await cookies();
  const c = store.get(TRUST_COOKIE_NAME);
  return c?.value || null;
}

export async function clearTrustCookie(): Promise<void> {
  const store = await cookies();
  store.set({
    name: TRUST_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export interface TrustedDeviceRow {
  id: string;
  user_id: string;
  token_hash: string;
  device_fingerprint_hash: string;
  user_agent: string | null;
  ip_first_seen: string | null;
  ip_last_seen: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export type TrustedLookupReason =
  | "no_cookie"
  | "not_found"
  | "expired"
  | "revoked"
  | "fingerprint_mismatch";

export type TrustedLookupResult =
  | { trusted: true; row: TrustedDeviceRow }
  | {
      trusted: false;
      reason: TrustedLookupReason;
      /**
       * The user_id of the row that backed this token, when known.
       * Populated for `expired`, `revoked`, and `fingerprint_mismatch`.
       * Lets multi-token callers (Step 11) decide whether the failure
       * is audit-worthy for the *current* user vs. some other account
       * that also trusted this browser.
       */
      rowUserId?: string | null;
    };

export interface CreateTrustedDeviceArgs {
  userId: string;
  fingerprint: string;
  userAgent?: string | null;
  ip?: string | null;
  /**
   * The plaintext aimrx_td cookie value the inbound request already
   * carries, if any. Used by the unique-violation idempotency path
   * (Task #49) to distinguish two scenarios that both hit 23505:
   *
   *   1. Double-click race: the original POST already inserted the row
   *      AND its response cookie reached the client. The retry will
   *      arrive with the existing aimrx_td cookie that matches the
   *      surviving row's token_hash. Refresh expires_at + last_used_at
   *      and DO NOT rotate — return token: null so the route doesn't
   *      overwrite a cookie the browser already has.
   *
   *   2. Network retry where the first response was lost: the client
   *      never got a cookie, so the retry comes in with no aimrx_td
   *      (or one that does not match the surviving row's token_hash).
   *      Rotate token_hash to a fresh token and return it so the
   *      retry's response can finally establish trust on the browser.
   *
   * Pass the raw cookie value or null/undefined if absent.
   *
   * Step 11 (multi-user trust): the cookie may now be a period-separated
   * list of trust tokens, each owned by a different user. Pass the
   * already-decoded list via `existingTrustCookieTokens` so the
   * idempotency check can match the survivor against ANY token belonging
   * to this user, not just the first one (which may belong to another
   * account that previously trusted the same browser). When
   * `existingTrustCookieTokens` is provided it takes precedence over the
   * single-value `existingTrustCookie` field.
   */
  existingTrustCookie?: string | null;
  existingTrustCookieTokens?: readonly string[] | null;
}

export interface CreateTrustedDeviceResult {
  id: string;
  /**
   * The plaintext trust token to send to the browser as the aimrx_td cookie.
   * `null` when an existing active row was refreshed in place (Task #49
   * idempotency path) — the caller MUST NOT overwrite the existing trust
   * cookie in that case, since rotating the token unconditionally on every
   * double-click defeats idempotency. The browser keeps whatever cookie it
   * already has from the original request that won the insert race.
   */
  token: string | null;
  expiresAt: Date;
  refreshed: boolean;
}

export async function createTrustedDevice(
  args: CreateTrustedDeviceArgs,
): Promise<CreateTrustedDeviceResult> {
  const {
    userId,
    fingerprint,
    userAgent,
    ip,
    existingTrustCookie,
    existingTrustCookieTokens,
  } = args;
  if (!userId) throw new Error("userId required to create trusted device");
  if (!fingerprint) throw new Error("fingerprint required to create trusted device");

  const token = generateTrustToken();
  const tokenHash = hashTrustToken(token);
  const fingerprintHash = hashFingerprint(fingerprint);
  const expiresAt = new Date(Date.now() + TRUST_DURATION_SECONDS * 1000);

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("trusted_devices")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      device_fingerprint_hash: fingerprintHash,
      user_agent: userAgent ?? null,
      ip_first_seen: ip ?? null,
      ip_last_seen: ip ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (!error && data) {
    await logTrustedDeviceEvent({
      action: "TRUSTED_DEVICE_GRANTED",
      userId,
      deviceId: data.id,
      actorId: userId,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      detailsExtra: { path: "fresh_insert" },
    });
    await enforceTrustedDeviceCap(userId);
    void notifyNewTrustedDevice({
      userId,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      grantedAt: new Date(),
    });
    return { id: data.id, token, expiresAt, refreshed: false };
  }

  // Idempotency path (Task #49): a partial unique index exists on
  //   (user_id, device_fingerprint_hash) WHERE revoked_at IS NULL
  // so a second concurrent /api/auth/mfa/complete (double-click, retry,
  // mid-deploy retransmit) for the same browser races into 23505.
  //
  // Convert that into a no-rotation refresh of the surviving row: bump
  // expires_at out to +90d, stamp last_used_at, and update ip_last_seen
  // / user_agent. token_hash is intentionally NOT touched — the original
  // caller (whichever insert won) keeps owning the cookie. Returning
  // `token: null` tells the route to leave the existing aimrx_td cookie
  // alone instead of overwriting it with a token that nobody can verify.
  const isUniqueViolation =
    !!error &&
    ((error as { code?: string }).code === "23505" ||
      /duplicate key|unique constraint|trusted_devices_user_fp_active_uniq/i.test(
        error.message ?? "",
      ));

  if (!isUniqueViolation) {
    console.error("[trusted-device] insert failed", { error: scrubError(error) });
    throw new Error("Failed to create trusted device");
  }

  // Decide whether the inbound cookie already maps to the surviving row.
  // If yes -> double-click race, no rotation. If no -> retry-after-lost-
  // response, rotate token_hash so the retry can finally set a working
  // cookie. timingSafeEqual on equal-length buffers; missing or short
  // cookies short-circuit to "no match" without throwing.
  let cookieMatchesSurvivor = false;
  // Step 11: prefer the multi-token list when provided. Fall back to the
  // single-token field for legacy callers. Each candidate is hashed and
  // compared (timing-safe) against the survivor row's token_hash. ANY
  // match means the browser already has a working trust cookie for THIS
  // user, so we take the no-rotation idempotency path.
  const candidateTokens: string[] = [];
  if (
    existingTrustCookieTokens &&
    Array.isArray(existingTrustCookieTokens) &&
    existingTrustCookieTokens.length > 0
  ) {
    for (const t of existingTrustCookieTokens) {
      if (typeof t === "string" && t.length >= 16) candidateTokens.push(t);
    }
  } else if (
    existingTrustCookie &&
    typeof existingTrustCookie === "string" &&
    existingTrustCookie.length >= 16
  ) {
    candidateTokens.push(existingTrustCookie);
  }

  if (candidateTokens.length > 0) {
    try {
      const { data: survivor } = await supabase
        .from("trusted_devices")
        .select("token_hash")
        .eq("user_id", userId)
        .eq("device_fingerprint_hash", fingerprintHash)
        .is("revoked_at", null)
        .maybeSingle();
      if (survivor?.token_hash) {
        const survivorBuf = Buffer.from(survivor.token_hash);
        for (const cand of candidateTokens) {
          const candBuf = Buffer.from(hashTrustToken(cand));
          if (
            candBuf.length === survivorBuf.length &&
            crypto.timingSafeEqual(candBuf, survivorBuf)
          ) {
            cookieMatchesSurvivor = true;
            break;
          }
        }
      }
    } catch {
      cookieMatchesSurvivor = false;
    }
  }

  const updateFields: Record<string, unknown> = {
    expires_at: expiresAt.toISOString(),
    last_used_at: nowIso,
    ip_last_seen: ip ?? null,
    user_agent: userAgent ?? null,
  };
  // Only rotate token_hash on the retry-after-lost-response path. The
  // double-click case keeps the original token so the original cookie
  // (which the browser already has) stays valid.
  if (!cookieMatchesSurvivor) {
    updateFields.token_hash = tokenHash;
  }

  const { data: updated, error: updErr } = await supabase
    .from("trusted_devices")
    .update(updateFields)
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fingerprintHash)
    .is("revoked_at", null)
    .select("id, expires_at")
    .maybeSingle();

  if (updErr || !updated) {
    // Row vanished between insert race and update (revoked or deleted in
    // the same window). One last attempt to insert before giving up.
    const retry = await supabase
      .from("trusted_devices")
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        device_fingerprint_hash: fingerprintHash,
        user_agent: userAgent ?? null,
        ip_first_seen: ip ?? null,
        ip_last_seen: ip ?? null,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (retry.error || !retry.data) {
      console.error("[trusted-device] insert+refresh failed", {
        insertError: scrubError(error?.message),
        updateError: scrubError(updErr?.message),
        retryError: scrubError(retry.error?.message),
      });
      throw new Error("Failed to create trusted device");
    }
    await logTrustedDeviceEvent({
      action: "TRUSTED_DEVICE_GRANTED",
      userId,
      deviceId: retry.data.id,
      actorId: userId,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      detailsExtra: { path: "vanished_retry_insert" },
    });
    await enforceTrustedDeviceCap(userId);
    void notifyNewTrustedDevice({
      userId,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      grantedAt: new Date(),
    });
    return { id: retry.data.id, token, expiresAt, refreshed: false };
  }

  // Rotation path = effectively re-granting trust to a different
  // browser instance (lost first response, retry won the cookie).
  // Refresh-only path (cookieMatchesSurvivor === true) is the same
  // browser double-clicking and explicitly does NOT log GRANTED.
  if (!cookieMatchesSurvivor) {
    await logTrustedDeviceEvent({
      action: "TRUSTED_DEVICE_GRANTED",
      userId,
      deviceId: updated.id,
      actorId: userId,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      detailsExtra: { path: "dedupe_token_rotation" },
    });
  }

  return {
    id: updated.id,
    // No-rotation path returns null so the route preserves the existing
    // browser cookie. Rotation path returns the freshly minted token so
    // the response can set a usable aimrx_td.
    token: cookieMatchesSurvivor ? null : token,
    expiresAt: new Date(updated.expires_at),
    refreshed: true,
  };
}

export interface LookupArgs {
  cookieValue: string | null | undefined;
  fingerprint: string;
}

export async function lookupTrustedDevice(
  args: LookupArgs,
): Promise<TrustedLookupResult> {
  const { cookieValue, fingerprint } = args;
  if (!cookieValue) return { trusted: false, reason: "no_cookie" };
  if (!fingerprint) return { trusted: false, reason: "fingerprint_mismatch" };

  let tokenHash: string;
  try {
    tokenHash = hashTrustToken(cookieValue);
  } catch {
    // Malformed/tampered cookie value — treat as not_found, never throw.
    return { trusted: false, reason: "not_found" };
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Active-row query (matches Step 3 contract: revoked_at IS NULL AND expires_at > now()).
  const { data: activeRow, error: activeErr } = await supabase
    .from("trusted_devices")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (activeErr) {
    console.error("[trusted-device] lookup query failed", { error: scrubError(activeErr) });
    return { trusted: false, reason: "not_found" };
  }

  if (!activeRow) {
    // Disambiguate not_found vs revoked vs expired by re-querying without the active filters.
    const { data: anyRow } = await supabase
      .from("trusted_devices")
      .select("id, user_id, revoked_at, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!anyRow) return { trusted: false, reason: "not_found" };
    if (anyRow.revoked_at) {
      console.warn("[trusted-device] lookup hit revoked row");
      return {
        trusted: false,
        reason: "revoked",
        rowUserId: (anyRow.user_id as string | null) ?? null,
      };
    }
    return {
      trusted: false,
      reason: "expired",
      rowUserId: (anyRow.user_id as string | null) ?? null,
    };
  }

  const typed = activeRow as TrustedDeviceRow;

  const expectedFingerprintHash = hashFingerprint(fingerprint);
  const stored = Buffer.from(typed.device_fingerprint_hash);
  const expected = Buffer.from(expectedFingerprintHash);
  if (
    stored.length !== expected.length ||
    !crypto.timingSafeEqual(stored, expected)
  ) {
    console.warn("[trusted-device] fingerprint mismatch");
    return {
      trusted: false,
      reason: "fingerprint_mismatch",
      rowUserId: typed.user_id,
    };
  }

  return { trusted: true, row: typed };
}

export async function markTrustedDeviceUsed(
  rowId: string,
  ip?: string | null,
): Promise<void> {
  if (!rowId) throw new Error("rowId required to mark trusted device used");
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { last_used_at: new Date().toISOString() };
  if (ip) update.ip_last_seen = ip;
  const { data: updated, error } = await supabase
    .from("trusted_devices")
    .update(update)
    .eq("id", rowId)
    .select("user_id, user_agent")
    .maybeSingle();
  if (error) {
    console.error("[trusted-device] mark-used failed", { error: scrubError(error) });
    return;
  }
  // Zero-row update = the device was revoked or deleted in the gap
  // between trust-check's lookup and this mark-used call. Skip the
  // audit row so USED only ever represents a real successful skip.
  if (!updated) return;
  await logTrustedDeviceEvent({
    action: "TRUSTED_DEVICE_USED",
    userId: updated.user_id ?? null,
    deviceId: rowId,
    actorId: updated.user_id ?? null,
    ip: ip ?? null,
    userAgent: (updated.user_agent as string | null | undefined) ?? null,
  });
}

export interface RevokeArgs {
  revokedBy?: string | null;
  reason: string;
}

export async function revokeTrustedDevice(
  rowId: string,
  args: RevokeArgs,
): Promise<void> {
  if (!rowId) throw new Error("rowId required to revoke trusted device");
  if (!args?.reason) throw new Error("reason required to revoke trusted device");
  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("trusted_devices")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: args.revokedBy ?? null,
      revoke_reason: args.reason,
    })
    .eq("id", rowId)
    .is("revoked_at", null)
    .select("user_id, user_agent, ip_last_seen")
    .maybeSingle();
  if (error) {
    console.error("[trusted-device] revoke failed", { error: scrubError(error) });
    throw new Error("Failed to revoke trusted device");
  }
  // No row updated = already revoked; idempotent no-op, no audit row.
  if (updated) {
    await logTrustedDeviceEvent({
      action: "TRUSTED_DEVICE_REVOKED",
      userId: updated.user_id ?? null,
      deviceId: rowId,
      actorId: args.revokedBy ?? null,
      ip: (updated.ip_last_seen as string | null | undefined) ?? null,
      userAgent: (updated.user_agent as string | null | undefined) ?? null,
      detailsExtra: { reason: args.reason },
    });
  }
}

/**
 * Step 12 (per-user trusted-device cap): after a fresh GRANT, count this
 * user's active rows and revoke the oldest excess so the total stays at
 * MAX_TRUSTED_DEVICES_PER_USER. "Oldest" = smallest last_used_at, with
 * created_at as the tiebreaker for never-used rows. The just-inserted
 * row has the largest created_at and a NULL last_used_at, so it sorts
 * to the top of the keep-list and is never the evictee.
 *
 * Internal (not exported) and intentionally swallows its own errors —
 * a cap-enforcement failure must NEVER break the calling MFA flow.
 * Each evicted row goes through revokeTrustedDevice() which writes a
 * TRUSTED_DEVICE_REVOKED audit row with reason "cap_exceeded".
 */
async function enforceTrustedDeviceCap(userId: string): Promise<void> {
  try {
    if (!userId) return;
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("trusted_devices")
      .select("id, last_used_at, created_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .gt("expires_at", nowIso);
    if (error) {
      console.error("[trusted-device] cap query failed", {
        error: scrubError(error),
      });
      return;
    }
    const rows = (data ?? []) as Array<{
      id: string;
      last_used_at: string | null;
      created_at: string | null;
    }>;
    if (rows.length <= MAX_TRUSTED_DEVICES_PER_USER) return;

    // Sort newest-first. Never-used rows (last_used_at = NULL) fall back
    // to created_at, so the just-granted row (highest created_at) lands
    // at index 0 and is safe from eviction.
    const sorted = [...rows].sort((a, b) => {
      const aKey = a.last_used_at ?? a.created_at ?? "";
      const bKey = b.last_used_at ?? b.created_at ?? "";
      if (aKey === bKey) return 0;
      return aKey > bKey ? -1 : 1;
    });
    const evictees = sorted.slice(MAX_TRUSTED_DEVICES_PER_USER);
    if (evictees.length === 0) return;

    await Promise.allSettled(
      evictees.map((row) =>
        revokeTrustedDevice(row.id, {
          reason: "cap_exceeded",
          revokedBy: userId,
        }),
      ),
    );
  } catch (err) {
    console.error("[trusted-device] cap enforcement failed", {
      error: scrubError(err),
    });
  }
}

export async function revokeAllForUser(
  userId: string,
  reason: string,
  revokedBy?: string | null,
): Promise<number> {
  if (!userId) throw new Error("userId required to revoke trusted devices");
  if (!reason) throw new Error("reason required to revoke trusted devices");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("trusted_devices")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy ?? null,
      revoke_reason: reason,
    })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id, ip_last_seen, user_agent");
  if (error) {
    console.error("[trusted-device] revoke-all failed", { error: scrubError(error) });
    throw new Error("Failed to revoke trusted devices");
  }
  // One audit row per device actually revoked. Parallel + allSettled so
  // a single audit failure never drops the rest or breaks the caller.
  // Per-row IP + UA are pulled from the revoked rows so admin/forensic
  // review can see where each session was last active.
  const rows = (data ?? []) as Array<{
    id: string;
    ip_last_seen: string | null;
    user_agent: string | null;
  }>;
  if (rows.length > 0) {
    await Promise.allSettled(
      rows.map((row) =>
        logTrustedDeviceEvent({
          action: "TRUSTED_DEVICE_REVOKED",
          userId,
          deviceId: row.id,
          actorId: revokedBy ?? null,
          ip: row.ip_last_seen,
          userAgent: row.user_agent,
          detailsExtra: { reason, bulk: true },
        }),
      ),
    );
  }
  return rows.length;
}
