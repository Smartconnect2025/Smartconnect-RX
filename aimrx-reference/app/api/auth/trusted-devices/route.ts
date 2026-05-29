import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";
import {
  TRUST_COOKIE_NAME,
  decodeTrustTokenList,
  hashTrustToken,
  type TrustedDeviceRow,
} from "@core/auth/trusted-device";
import { toTrustedDeviceView } from "@core/auth/trusted-device-view";
import { scrubError } from "@core/auth/scrub-trust-token";

/**
 * GET /api/auth/trusted-devices
 *
 * Returns the signed-in user's active trusted devices, ordered by
 * last_used_at DESC. The row matching the request's aimrx_td cookie
 * (if any) is flagged with isCurrent=true so the UI can show a
 * "(This device)" badge.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await admin
      .from("trusted_devices")
      .select("*")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .order("last_used_at", { ascending: false });

    if (error) {
      console.error("[trusted-devices] list query failed", {
        error: scrubError(error),
      });
      return NextResponse.json(
        { error: "Failed to load trusted devices" },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as TrustedDeviceRow[];

    // Resolve which row (if any) is the current device. With Step 11
    // multi-user trust, the cookie may carry several tokens (one per
    // account that trusted this browser). Hash each one and accept the
    // first whose hash equals this user's row's token_hash. We never
    // send token_hash to the client.
    const currentTokenHashes = new Set<string>();
    try {
      const store = await cookies();
      const cookieValue = store.get(TRUST_COOKIE_NAME)?.value || null;
      for (const tok of decodeTrustTokenList(cookieValue)) {
        try {
          currentTokenHashes.add(hashTrustToken(tok));
        } catch {
          // Skip malformed tokens.
        }
      }
    } catch {
      // Malformed cookie — treat as no current device, never throw.
    }

    const devices = rows.map((row) => {
      // toTrustedDeviceView only checks string equality, so passing
      // each candidate hash isn't possible — instead, mark the row
      // current ourselves when its token_hash is in the set.
      const hashIfCurrent = currentTokenHashes.has(row.token_hash)
        ? row.token_hash
        : null;
      return toTrustedDeviceView(row, hashIfCurrent);
    });
    const currentDeviceId =
      devices.find((d) => d.isCurrent)?.id ?? null;

    return NextResponse.json({ devices, currentDeviceId });
  } catch (error) {
    console.error("[trusted-devices] handler threw", {
      error: scrubError(error),
    });
    return NextResponse.json(
      { error: "Failed to load trusted devices" },
      { status: 500 },
    );
  }
}
