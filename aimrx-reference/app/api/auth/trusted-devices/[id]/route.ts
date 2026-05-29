import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import {
  TRUST_COOKIE_NAME,
  decodeTrustTokenList,
  encodeTrustTokenList,
  hashTrustToken,
  removeTrustTokensByHash,
  revokeTrustedDevice,
} from "@core/auth/trusted-device";
import { scrubError } from "@core/auth/scrub-trust-token";

/**
 * DELETE /api/auth/trusted-devices/:id
 *
 * Revokes ONE trusted_devices row owned by the calling user. If the
 * revoked row matches the request's aimrx_td cookie (the user is
 * revoking the current browser), we also clear that cookie on the
 * response so the next request from this browser stops trying to use
 * a token whose row is now revoked.
 *
 * Ownership is enforced server-side: we look up the row by id and
 * compare user_id against the authenticated user. Cross-user attempts
 * return 404 (don't leak the row's existence).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid device id" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: row, error: lookupErr } = await admin
      .from("trusted_devices")
      .select("id, user_id, token_hash, revoked_at")
      .eq("id", id)
      .maybeSingle();

    if (lookupErr) {
      console.error("[trusted-devices] DELETE lookup failed", {
        error: scrubError(lookupErr),
      });
      return NextResponse.json(
        { error: "Failed to revoke device" },
        { status: 500 },
      );
    }

    // Treat unknown id and cross-user id identically — never leak
    // existence of rows owned by other users.
    if (!row || row.user_id !== user.id) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 },
      );
    }

    // Idempotent: revoking an already-revoked row is a no-op success.
    if (!row.revoked_at) {
      try {
        await revokeTrustedDevice(id, {
          revokedBy: user.id,
          reason: "user_self_revoke",
        });
      } catch (err) {
        console.error("[trusted-devices] revoke failed", {
          error: scrubError(err),
        });
        return NextResponse.json(
          { error: "Failed to revoke device" },
          { status: 500 },
        );
      }
    }

    // If the revoked row's token is in the current browser's aimrx_td
    // cookie, surgically remove ONLY that token from the cookie list.
    // Step 11: the cookie may carry tokens for other accounts that
    // also trusted this browser — those must remain intact so signing
    // in to any of them on this browser still skips 2FA. Only when the
    // revoked token was the LAST entry do we clear the cookie outright.
    let clearedCurrent = false;
    let updatedCookieValue: string | null = null;
    let cookieMaxAge = 0;
    let cookieExpires: Date | undefined;
    try {
      const store = await cookies();
      const cookieValue = store.get(TRUST_COOKIE_NAME)?.value || null;
      const tokens = decodeTrustTokenList(cookieValue);
      if (tokens.length > 0) {
        const remaining = removeTrustTokensByHash(
          tokens,
          new Set([row.token_hash]),
        );
        if (remaining.length !== tokens.length) {
          clearedCurrent = true;
          if (remaining.length > 0) {
            updatedCookieValue = encodeTrustTokenList(remaining);
            // Preserve the original cookie's lifetime by reading the
            // longest expires_at among rows still represented in the
            // remaining tokens. Cheapest correct approach: re-use the
            // existing row's expires_at as a floor — the browser will
            // keep whatever it already has, and on next sign-in the
            // cookie gets re-issued with the full TRUST_DURATION_DAYS.
            // For Set-Cookie we just match the existing 90d window.
            const ninetyDays = 90 * 24 * 60 * 60;
            cookieMaxAge = ninetyDays;
            cookieExpires = new Date(Date.now() + ninetyDays * 1000);
          }
        }
      }
    } catch {
      // Bad cookie value — nothing to clear.
      clearedCurrent = false;
    }

    const response = NextResponse.json({
      success: true,
      clearedCurrent,
    });
    if (clearedCurrent) {
      if (updatedCookieValue) {
        // Other accounts' tokens remain — rewrite the cookie with the
        // pruned list so the revoked token can never be replayed.
        response.cookies.set({
          name: TRUST_COOKIE_NAME,
          value: updatedCookieValue,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: cookieMaxAge,
          expires: cookieExpires,
        });
      } else {
        // Revoked the only token in the cookie — clear it outright.
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
    return response;
  } catch (error) {
    console.error("[trusted-devices] DELETE handler threw", {
      error: scrubError(error),
    });
    return NextResponse.json(
      { error: "Failed to revoke device" },
      { status: 500 },
    );
  }
}
