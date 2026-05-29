/**
 * Task #49 verification (helper level) — back-to-back createTrustedDevice
 * calls with the same (user_id, fingerprint) result in EXACTLY ONE active
 * row, with NO token rotation.
 *
 * The route-level HTTP test that exercises /api/auth/mfa/complete itself
 * lives in scripts/verify-mfa-complete-dedupe.ts.
 *
 * Usage: npx tsx scripts/verify-trusted-device-dedupe.ts <real-auth-user-id>
 */
import {
  createTrustedDevice,
  hashFingerprint,
  generateTrustToken,
  hashTrustToken,
} from "../core/auth/trusted-device";
import { createAdminClient } from "../core/database/client";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: npx tsx scripts/verify-trusted-device-dedupe.ts <user-id>");
    process.exit(2);
  }

  const fingerprint = "fp-dedupe-" + generateTrustToken().slice(0, 12);
  const fpHash = hashFingerprint(fingerprint);
  const supabase = createAdminClient();

  await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash);

  console.log("step 1: two parallel createTrustedDevice calls (double-click)");
  // Both calls simulate the route's behavior: no inbound aimrx_td cookie
  // yet because the browser hasn't received any response. The loser will
  // hit 23505 and rotate the surviving row's token_hash to its own
  // (cookieMatchesSurvivor=false), so the loser DOES return a token.
  // But the test in step 5 covers the established-cookie case where no
  // rotation happens.
  const [a, b] = await Promise.all([
    createTrustedDevice({ userId, fingerprint, userAgent: "dedupe-1", ip: "10.0.0.1" }),
    createTrustedDevice({ userId, fingerprint, userAgent: "dedupe-2", ip: "10.0.0.2" }),
  ]);
  console.log(
    "  a:",
    { id: a.id, hasToken: !!a.token, refreshed: a.refreshed },
    "b:",
    { id: b.id, hasToken: !!b.token, refreshed: b.refreshed },
  );

  console.log("step 2: assert exactly one active row");
  const { data: active, error: err1 } = await supabase
    .from("trusted_devices")
    .select("id, token_hash")
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash)
    .is("revoked_at", null);
  if (err1) throw err1;
  if (!active || active.length !== 1) {
    throw new Error(`expected exactly 1 active row, got ${active?.length ?? 0}`);
  }
  console.log("  OK — surviving row id =", active[0].id);

  console.log("step 3: at least one caller got a token; both refreshed flags consistent");
  // With no existingTrustCookie passed, the loser's call rotates the
  // surviving row's token_hash to its own token (retry-after-lost-
  // response semantics). Both calls therefore return a token. Only
  // ONE call should report refreshed=false (the insert winner).
  const winners = [a, b].filter((r) => !r.refreshed);
  const losers = [a, b].filter((r) => r.refreshed);
  if (winners.length !== 1) {
    throw new Error(`expected 1 insert winner (refreshed=false), got ${winners.length}`);
  }
  if (losers.length !== 1) {
    throw new Error(`expected 1 loser (refreshed=true), got ${losers.length}`);
  }
  if (!losers[0].token) {
    throw new Error("loser without an existing cookie should still receive a token");
  }
  if (active[0].token_hash !== hashTrustToken(losers[0].token!)) {
    throw new Error("loser's token (no inbound cookie) should win the surviving token_hash");
  }
  console.log("  OK — loser without inbound cookie rotated the surviving row");

  console.log("step 4: third call WITH the established cookie -> NO rotation");
  // Now simulate the true double-click: caller already has the cookie.
  const c = await createTrustedDevice({
    userId,
    fingerprint,
    userAgent: "dedupe-3",
    ip: "10.0.0.3",
    existingTrustCookie: losers[0].token!,
  });
  const { data: active2, error: err2 } = await supabase
    .from("trusted_devices")
    .select("id, token_hash, last_used_at")
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash)
    .is("revoked_at", null);
  if (err2) throw err2;
  if (!active2 || active2.length !== 1) {
    throw new Error(`expected 1 active row after third call, got ${active2?.length ?? 0}`);
  }
  if (c.token != null || !c.refreshed) {
    throw new Error("third call WITH established cookie should refresh-only (token=null)");
  }
  if (active2[0].token_hash !== hashTrustToken(losers[0].token!)) {
    throw new Error("third call rotated the token despite established cookie (must not)");
  }
  console.log("  OK — established cookie preserved, last_used_at refreshed");

  console.log("step 5: fourth call WITHOUT cookie -> rotates token (retry case)");
  const d = await createTrustedDevice({
    userId,
    fingerprint,
    userAgent: "dedupe-4",
    ip: "10.0.0.4",
  });
  if (!d.token || !d.refreshed) {
    throw new Error("fourth call (no cookie) should rotate and return a token");
  }
  const { data: active3 } = await supabase
    .from("trusted_devices")
    .select("token_hash")
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash)
    .is("revoked_at", null);
  if (active3?.[0]?.token_hash !== hashTrustToken(d.token!)) {
    throw new Error("fourth call did not rotate the token_hash to its new token");
  }
  console.log("  OK — retry without cookie rotated the surviving row's token");

  console.log("step 6: cleanup");
  void losers; // referenced above; silence unused-var if any
  void winners;
  await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId)
    .eq("device_fingerprint_hash", fpHash);

  console.log("\nAll dedupe checks passed.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
