import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import {
  TRUST_COOKIE_NAME,
  decodeTrustTokenList,
  encodeTrustTokenList,
  hashTrustToken,
  removeTrustTokensByHash,
} from "@core/auth/trusted-device";
import { logTrustedDeviceEvent } from "@core/audit/trusted-device-audit";
import { scrubError } from "@core/auth/scrub-trust-token";

/**
 * POST /api/auth/trusted-devices/revoke-others
 *
 * "Sign out all my other devices." Revokes every active trusted-device
 * row owned by the calling user EXCEPT the row matching the request's
 * aimrx_td cookie (so the user isn't bounced into MFA on the browser
 * they're using right now).
 *
 * Returns { revokedCount }. Always 0 for users with no other devices.
 *
 * Auth: requires a logged-in Supabase session (401 otherwise).
 *
 * Idempotent: only updates rows where revoked_at IS NULL, so a double
 * click is a no-op the second time.
 */
export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the current device's row id (if any). With Step 11
    // multi-user trust, the cookie may carry several tokens (one per
    // account that trusted this browser). We hash each token in turn
    // and accept the first whose row belongs to THIS user. Other
    // accounts' tokens in the cookie can't reach this user's rows
    // (token_hash uniqueness + user_id scope on the lookup).
    let currentRowId: string | null = null;
    let cookieTokens: string[] = [];
    try {
      const store = await cookies();
      const cookieValue = store.get(TRUST_COOKIE_NAME)?.value || null;
      cookieTokens = decodeTrustTokenList(cookieValue);
      if (cookieTokens.length > 0) {
        const hashes: string[] = [];
        for (const tok of cookieTokens) {
          try {
            hashes.push(hashTrustToken(tok));
          } catch {
            // Skip malformed tokens.
          }
        }
        if (hashes.length > 0) {
          const admin = createAdminClient();
          const { data: row } = await admin
            .from("trusted_devices")
            .select("id")
            .eq("user_id", user.id)
            .in("token_hash", hashes)
            .is("revoked_at", null)
            .maybeSingle();
          currentRowId = row?.id ?? null;
        }
      }
    } catch {
      // Bad cookie — treat as "no current device to preserve" and
      // proceed; user will get re-MFA'd on this browser too, which is
      // acceptable degraded behavior, not a security hole.
      currentRowId = null;
    }

    const admin = createAdminClient();
    let query = admin
      .from("trusted_devices")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoke_reason: "user_self_revoke_others",
      })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if (currentRowId) {
      query = query.neq("id", currentRowId);
    }

    // Pull token_hash so we can prune the just-revoked entries from
    // the cookie list while leaving OTHER accounts' tokens untouched.
    const { data, error } = await query.select(
      "id, ip_last_seen, user_agent, token_hash",
    );
    if (error) {
      console.error("[trusted-devices] revoke-others failed", {
        error: scrubError(error),
      });
      return NextResponse.json(
        { error: "Failed to sign out other devices" },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as Array<{
      id: string;
      ip_last_seen: string | null;
      user_agent: string | null;
      token_hash: string;
    }>;
    if (rows.length > 0) {
      await Promise.allSettled(
        rows.map((row) =>
          logTrustedDeviceEvent({
            action: "TRUSTED_DEVICE_REVOKED",
            userId: user.id,
            deviceId: row.id,
            actorId: user.id,
            ip: row.ip_last_seen,
            userAgent: row.user_agent,
            detailsExtra: { reason: "user_self_revoke_others", bulk: true },
          }),
        ),
      );
    }

    // Step 11: prune just-revoked tokens from the cookie list, but
    // leave OTHER accounts' tokens (and the current device's own
    // token) untouched so they keep skipping 2FA on this browser.
    const response = NextResponse.json({ revokedCount: rows.length });
    if (rows.length > 0 && cookieTokens.length > 0) {
      const revokedHashes = new Set(rows.map((r) => r.token_hash));
      const remaining = removeTrustTokensByHash(cookieTokens, revokedHashes);
      if (remaining.length !== cookieTokens.length) {
        if (remaining.length > 0) {
          const ninetyDays = 90 * 24 * 60 * 60;
          response.cookies.set({
            name: TRUST_COOKIE_NAME,
            value: encodeTrustTokenList(remaining),
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: ninetyDays,
            expires: new Date(Date.now() + ninetyDays * 1000),
          });
        } else {
          // No tokens left — clear the cookie outright.
          response.cookies.set({
            name: TRUST_COOKIE_NAME,
            value: "",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          });
        }
      }
    }
    return response;
  } catch (error) {
    console.error("[trusted-devices] revoke-others handler threw", {
      error: scrubError(error),
    });
    return NextResponse.json(
      { error: "Failed to sign out other devices" },
      { status: 500 },
    );
  }
}
