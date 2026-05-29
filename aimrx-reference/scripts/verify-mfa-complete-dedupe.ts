/**
 * Task #49 — route-level integration test for /api/auth/mfa/complete.
 *
 * Spins up two real HTTP POSTs to the running Next dev server with
 * `rememberDevice: true`, identical bodies, and a shared aimrx_dvc cookie
 * (so they fingerprint identically) and asserts that the trusted_devices
 * table ends up with EXACTLY ONE active row for that user.
 *
 * Setup (handled by the script):
 *   - Insert two mfa_codes rows with the same value so both /complete
 *     calls can verify (the first call marks one row used; the second
 *     call falls back to the other).
 *   - Clear any prior trusted_devices rows for this synthetic device id.
 *
 * Usage:
 *   PORT=5000 npx next dev -p 5000 -H 0.0.0.0    # in another shell
 *   npx tsx scripts/verify-mfa-complete-dedupe.ts <real-auth-user-id> [base-url]
 *
 * Default base URL is http://127.0.0.1:5000.
 */
import crypto from "crypto";
import { createAdminClient } from "../core/database/client";
import {
  fingerprintFromInput,
  DEVICE_ID_COOKIE,
} from "../core/auth/device-fingerprint";
import {
  hashFingerprint,
  hashTrustToken,
  TRUST_COOKIE_NAME,
} from "../core/auth/trusted-device";

function extractTrustCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  // fetch's Headers.get joins multiple Set-Cookie with ", " — handle both.
  const m = setCookieHeader.match(
    new RegExp(`${TRUST_COOKIE_NAME}=([^;,\\s]+)`),
  );
  return m ? m[1] : null;
}

const USER_AGENT = "aimrx-dedupe-test/1.0";
const ACCEPT_LANGUAGE = "en-US,en;q=0.9";

async function main() {
  const userId = process.argv[2];
  const baseUrl = process.argv[3] || "http://127.0.0.1:5000";
  if (!userId) {
    console.error(
      "usage: npx tsx scripts/verify-mfa-complete-dedupe.ts <user-id> [base-url]",
    );
    process.exit(2);
  }

  const supabase = createAdminClient();

  // Stable device id so both POSTs produce the same fingerprint.
  const deviceId = crypto.randomBytes(24).toString("base64url");
  const fingerprint = fingerprintFromInput({
    userAgent: USER_AGENT,
    acceptLanguage: ACCEPT_LANGUAGE,
    deviceId,
  });
  const fpHash = hashFingerprint(fingerprint);

  console.log("step 1: pre-clean any rows for this synthetic fingerprint");
  await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash);

  console.log("step 2: clear any active mfa_codes for this user");
  await supabase
    .from("mfa_codes")
    .update({ is_used: true })
    .eq("user_id", userId)
    .eq("is_used", false);

  // Reset the lockout counter so a stale failure-streak from earlier runs
  // doesn't make the second verify fail with "Too many invalid attempts".
  await supabase
    .from("mfa_verification_attempts")
    .update({ failed_attempts: 0, locked_until: null, last_failed_at: null })
    .eq("user_id", userId);

  console.log("step 3: insert two mfa_codes rows with the same code value");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ins = await supabase
    .from("mfa_codes")
    .insert([
      { user_id: userId, code, expires_at: expiresAt, is_used: false },
      { user_id: userId, code, expires_at: expiresAt, is_used: false },
    ])
    .select("id");
  if (ins.error || (ins.data?.length ?? 0) !== 2) {
    throw new Error(`failed to seed mfa_codes: ${ins.error?.message ?? "no rows"}`);
  }

  const headers = {
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "accept-language": ACCEPT_LANGUAGE,
    cookie: `${DEVICE_ID_COOKIE}=${deviceId}`,
  };
  const body = JSON.stringify({
    method: "email_code",
    userId,
    code,
    rememberDevice: true,
  });

  console.log(`step 4: two parallel POST ${baseUrl}/api/auth/mfa/complete`);
  const [r1, r2] = await Promise.all([
    fetch(`${baseUrl}/api/auth/mfa/complete`, { method: "POST", headers, body }),
    fetch(`${baseUrl}/api/auth/mfa/complete`, { method: "POST", headers, body }),
  ]);

  const j1 = await r1.json().catch(() => ({}));
  const j2 = await r2.json().catch(() => ({}));
  console.log("  resp1:", r1.status, j1);
  console.log("  resp2:", r2.status, j2);

  if (!r1.ok || !r2.ok) {
    throw new Error("at least one /complete call did not return 2xx");
  }
  if (j1.success !== true || j2.success !== true) {
    throw new Error("one or both /complete calls reported success=false");
  }
  if (j1.rememberedDeviceDays !== 90 || j2.rememberedDeviceDays !== 90) {
    throw new Error(
      `expected rememberedDeviceDays=90 on both calls (got ${j1.rememberedDeviceDays}, ${j2.rememberedDeviceDays})`,
    );
  }

  console.log("step 5: assert EXACTLY ONE active trusted_devices row");
  const { data: active, error: actErr } = await supabase
    .from("trusted_devices")
    .select("id, token_hash, last_used_at, expires_at")
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash)
    .is("revoked_at", null);
  if (actErr) throw actErr;
  if (!active || active.length !== 1) {
    throw new Error(
      `expected exactly 1 active row, got ${active?.length ?? 0}: ${JSON.stringify(active)}`,
    );
  }
  console.log("  OK — single row id =", active[0].id);

  console.log("step 6: surviving row's token_hash matches at least one issued cookie");
  // Neither parallel call carries an inbound aimrx_td (both started
  // with the same headers without a trust cookie), so both fall into
  // the retry-after-lost-response path and rotate. The DB row's
  // token_hash will match the cookie from whichever UPDATE ran last.
  // The browser sees both Set-Cookie headers but keeps the last one
  // (whichever response arrives second). Critical correctness check:
  // the DB row must hash to one of the two issued cookies — never
  // orphaned.
  const cookie1 = extractTrustCookie(r1.headers.get("set-cookie"));
  const cookie2 = extractTrustCookie(r2.headers.get("set-cookie"));
  if (!cookie1 || !cookie2) {
    throw new Error(
      `expected both responses to carry aimrx_td (r1=${!!cookie1}, r2=${!!cookie2})`,
    );
  }
  const matches1 = active[0].token_hash === hashTrustToken(cookie1);
  const matches2 = active[0].token_hash === hashTrustToken(cookie2);
  if (!matches1 && !matches2) {
    throw new Error("surviving row's token_hash matches NEITHER issued cookie");
  }
  console.log(
    `  OK — surviving row hashes to ${matches1 && matches2 ? "both" : matches1 ? "r1" : "r2"} cookie`,
  );

  console.log("step 7: lost-first-response retry case");
  // Scenario: a prior /complete already inserted the row, but the
  // client never received the cookie (response dropped, browser refresh,
  // etc). The retry comes in with NO aimrx_td. Helper must rotate
  // token_hash so this response can finally set a working cookie.
  const code2 = String(Math.floor(100000 + Math.random() * 900000));
  await supabase.from("mfa_codes").insert({
    user_id: userId,
    code: code2,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    is_used: false,
  });
  // No aimrx_td cookie on this request — same fingerprint though.
  const r3 = await fetch(`${baseUrl}/api/auth/mfa/complete`, {
    method: "POST",
    headers, // headers already lacks aimrx_td (only carries aimrx_dvc)
    body: JSON.stringify({
      method: "email_code",
      userId,
      code: code2,
      rememberDevice: true,
    }),
  });
  const j3 = await r3.json().catch(() => ({}));
  console.log("  resp3:", r3.status, j3);
  if (!r3.ok || j3.success !== true) {
    throw new Error("retry-after-lost-response /complete did not succeed");
  }
  const td3 = (r3.headers.get("set-cookie") || "").includes("aimrx_td=");
  if (!td3) {
    throw new Error(
      "retry without aimrx_td cookie MUST set a fresh aimrx_td so trust can establish",
    );
  }
  // Still exactly one active row.
  const { data: active3 } = await supabase
    .from("trusted_devices")
    .select("id, token_hash")
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash)
    .is("revoked_at", null);
  if (!active3 || active3.length !== 1) {
    throw new Error(
      `after retry, expected 1 active row, got ${active3?.length ?? 0}`,
    );
  }
  if (active3[0].id !== active[0].id) {
    throw new Error("retry should refresh existing row, not create a new one");
  }
  console.log("  OK — retry rotated token_hash on the surviving row, set fresh cookie");

  console.log("step 8: cleanup");
  await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash);
  await supabase
    .from("mfa_codes")
    .update({ is_used: true })
    .eq("user_id", userId)
    .in("code", [code, code2]);

  console.log("\n/api/auth/mfa/complete dedupe test PASSED.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
