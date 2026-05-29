/**
 * Verify the trusted-device helper end-to-end against the real DB.
 *
 * Usage: npx tsx scripts/verify-trusted-device-helper.ts <real-auth-user-id>
 *
 * Imports and exercises the actual helper module
 * (core/auth/trusted-device.ts) — generate -> create -> lookup-success ->
 * mark-used -> revoke -> lookup-after-revoke -> malformed-cookie -> cleanup.
 *
 * Cookie set/read/clear helpers are NOT exercised here because they
 * require a Next.js request context (cookies() from next/headers).
 */
import {
  createTrustedDevice,
  lookupTrustedDevice,
  markTrustedDeviceUsed,
  revokeTrustedDevice,
  hashTrustToken,
  hashFingerprint,
  generateTrustToken,
} from "../core/auth/trusted-device";
import { createAdminClient } from "../core/database/client";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("usage: npx tsx scripts/verify-trusted-device-helper.ts <user-id>");
    process.exit(2);
  }

  const fingerprint = "fp-verify-" + generateTrustToken().slice(0, 12);

  console.log("step 1: createTrustedDevice");
  const created = await createTrustedDevice({
    userId,
    fingerprint,
    userAgent: "verify-script",
    ip: "127.0.0.1",
  });
  console.log("  id =", created.id, "expiresAt =", created.expiresAt.toISOString());
  if (!created.token) throw new Error("expected plaintext token");
  const createdToken: string = created.token; // narrow `string | null` to `string`

  console.log("step 2: hash determinism");
  if (hashTrustToken(createdToken) !== hashTrustToken(createdToken)) {
    throw new Error("hashTrustToken not deterministic");
  }
  if (hashFingerprint(fingerprint) !== hashFingerprint(fingerprint)) {
    throw new Error("hashFingerprint not deterministic");
  }
  if (hashTrustToken(createdToken) === hashTrustToken(createdToken + "x")) {
    throw new Error("hashTrustToken collision");
  }

  console.log("step 3: lookupTrustedDevice success");
  const ok = await lookupTrustedDevice({ cookieValue: createdToken, fingerprint });
  if (!ok.trusted || ok.row.id !== created.id) {
    throw new Error(`expected trusted=true; got ${JSON.stringify(ok)}`);
  }

  console.log("step 4: markTrustedDeviceUsed");
  await markTrustedDeviceUsed(created.id, "10.0.0.1");

  console.log("step 5: lookup with wrong fingerprint -> fingerprint_mismatch");
  const wrongFp = await lookupTrustedDevice({
    cookieValue: createdToken,
    fingerprint: fingerprint + "-wrong",
  });
  if (wrongFp.trusted || wrongFp.reason !== "fingerprint_mismatch") {
    throw new Error(`expected fingerprint_mismatch; got ${JSON.stringify(wrongFp)}`);
  }

  console.log("step 6: lookup with no cookie -> no_cookie");
  const noCookie = await lookupTrustedDevice({ cookieValue: null, fingerprint });
  if (noCookie.trusted || noCookie.reason !== "no_cookie") {
    throw new Error(`expected no_cookie; got ${JSON.stringify(noCookie)}`);
  }

  console.log("step 7: lookup with malformed/short cookie -> not_found (no throw)");
  const malformed = await lookupTrustedDevice({ cookieValue: "x", fingerprint });
  if (malformed.trusted || malformed.reason !== "not_found") {
    throw new Error(`expected not_found; got ${JSON.stringify(malformed)}`);
  }

  console.log("step 8: lookup with bogus-but-long cookie -> not_found");
  const bogus = await lookupTrustedDevice({
    cookieValue: generateTrustToken(),
    fingerprint,
  });
  if (bogus.trusted || bogus.reason !== "not_found") {
    throw new Error(`expected not_found; got ${JSON.stringify(bogus)}`);
  }

  console.log("step 9: revokeTrustedDevice");
  await revokeTrustedDevice(created.id, { revokedBy: null, reason: "verify-script" });

  console.log("step 10: lookup after revoke -> revoked");
  const afterRevoke = await lookupTrustedDevice({ cookieValue: createdToken, fingerprint });
  if (afterRevoke.trusted || afterRevoke.reason !== "revoked") {
    throw new Error(`expected revoked; got ${JSON.stringify(afterRevoke)}`);
  }

  console.log("step 11: cleanup");
  const supabase = createAdminClient();
  const del = await supabase.from("trusted_devices").delete().eq("id", created.id);
  if (del.error) throw del.error;

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
