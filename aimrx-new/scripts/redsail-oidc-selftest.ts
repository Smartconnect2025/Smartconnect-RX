/**
 * Self-test for the RedSail/Emporos OIDC issuer + HTTP-adapter webhook verify.
 * Runs fully offline (ephemeral OIDC key) — proves the security-critical loop:
 * issue a client-credentials token, then verify it the way the webhook does.
 *
 * Run: npx tsx scripts/redsail-oidc-selftest.ts
 */
import assert from "node:assert";
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import {
  issueToken,
  verifyToken,
  PAYMENTS_DOMAIN_AUDIENCE,
} from "@/core/services/redsail/oidc/issuer";
import {
  getOidcPublicJwks,
  __resetOidcKeyCacheForTests,
} from "@/core/services/redsail/oidc/keys";
import { HttpRedSailClient } from "@/core/services/redsail/httpAdapter";
import type { DecryptedRedsailConfig } from "@/core/services/redsailPaymentConfigService";

process.env.REDSAIL_ADAPTER = "http";

const TENANT = "8d03e72c-1451-4c75-8bad-14a0c45895e5";
const OTHER_TENANT = "11111111-1111-1111-1111-111111111111";

function makeConfig(tenantId: string): DecryptedRedsailConfig {
  return {
    id: "cfg-1",
    pharmacyId: "pharm-1",
    environment: "ftr1",
    isActive: true,
    isConnected: true,
    label: "Test",
    tenantId,
    siteId: "111111",
    stationId: "0",
    oidcClientId: "client-abc",
    oidcClientSecret: "super-secret",
    linkToPayAuthMode: "SingleUseToken",
  };
}

async function main() {
  // 1) Issue → verify round trip.
  const { accessToken } = await issueToken({
    tenantId: TENANT,
    clientId: "client-abc",
  });
  const verified = await verifyToken(accessToken);
  assert.equal(verified.tenantId, TENANT, "tenant_id should round-trip");
  assert.equal(verified.payload.aud, PAYMENTS_DOMAIN_AUDIENCE, "aud claim");
  console.log("✓ issue→verify round trip (aud=payments-domain, tenant_id set)");

  // 2) Tampered token is rejected.
  const tampered = accessToken.slice(0, -3) + "abc";
  await assert.rejects(() => verifyToken(tampered), "tampered token must fail");
  console.log("✓ tampered token rejected");

  // 3) Webhook verify accepts a valid token whose tenant matches the config.
  const client = new HttpRedSailClient(makeConfig(TENANT));
  const body = JSON.stringify({
    eventName: "payment.success",
    eventId: "5d3094d9-0739-4a1d-aa2a-b847d7fcb370",
    eventDate: "2025-11-14T17:37:25.970929Z",
    eventPayload: {
      transactionId: "ef94dadd-eef7-466c-bbfd-6d1c359dd489",
      siteId: "111111",
    },
  });
  const okResult = await client.verifyAndParseWebhook(
    `Bearer ${accessToken}`,
    body,
  );
  assert.equal(okResult.valid, true, `webhook should be valid: ${okResult.reason}`);
  assert.equal(okResult.event?.eventType, "payment.success");
  assert.equal(
    okResult.event?.redsailTransactionId,
    "ef94dadd-eef7-466c-bbfd-6d1c359dd489",
  );
  console.log("✓ webhook verify accepts matching-tenant token + normalizes event");

  // 4) Webhook verify rejects a token whose tenant != config tenant.
  const wrongTenantClient = new HttpRedSailClient(makeConfig(OTHER_TENANT));
  const mismatch = await wrongTenantClient.verifyAndParseWebhook(
    `Bearer ${accessToken}`,
    body,
  );
  assert.equal(mismatch.valid, false, "tenant mismatch must be rejected");
  console.log("✓ webhook verify rejects tenant_id mismatch");

  // 5) Missing bearer is rejected.
  const noAuth = await client.verifyAndParseWebhook(null, body);
  assert.equal(noAuth.valid, false, "missing bearer must be rejected");
  console.log("✓ webhook verify rejects missing bearer");

  await rotationTests();

  console.log("\nALL REDSAIL OIDC SELF-TESTS PASSED");
}

/**
 * Dual-key rollover: a token signed with the OLD key must keep verifying while
 * the OLD public key is published as a "previous" key, and stop verifying once
 * it is retired — all while the NEW key signs fresh tokens.
 */
async function rotationTests() {
  // Generate two distinct, stable RSA key pairs as PEM (the env format).
  const a = await generateKeyPair("RS256", { extractable: true });
  const b = await generateKeyPair("RS256", { extractable: true });
  const oldPrivatePem = await exportPKCS8(a.privateKey);
  const oldPublicPem = await exportSPKI(a.publicKey);
  const newPrivatePem = await exportPKCS8(b.privateKey);

  // Phase 1: OLD key is the only (current) key. Mint a token with it.
  process.env.REDSAIL_OIDC_PRIVATE_KEY = oldPrivatePem;
  delete process.env.REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS;
  __resetOidcKeyCacheForTests();
  const oldToken = (await issueToken({ tenantId: TENANT, clientId: "c" }))
    .accessToken;
  await verifyToken(oldToken); // sanity: verifies under the old key
  console.log("✓ rotation: token minted under the old key");

  // Phase 2: rotate — NEW key becomes current, OLD public stays as previous.
  process.env.REDSAIL_OIDC_PRIVATE_KEY = newPrivatePem;
  process.env.REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS = oldPublicPem;
  __resetOidcKeyCacheForTests();

  // The in-flight old token still verifies during the rollover window.
  const stillValid = await verifyToken(oldToken);
  assert.equal(stillValid.tenantId, TENANT, "old token must still verify");
  console.log("✓ rotation: old in-flight token still verifies during overlap");

  // New tokens are signed with the new key and verify too.
  const newToken = (await issueToken({ tenantId: TENANT, clientId: "c" }))
    .accessToken;
  const newVerified = await verifyToken(newToken);
  assert.equal(newVerified.tenantId, TENANT, "new token must verify");
  console.log("✓ rotation: new key signs and verifies fresh tokens");

  // JWKS publishes BOTH keys (distinct kids) during the window.
  const jwks = await getOidcPublicJwks();
  assert.equal(jwks.length, 2, "JWKS should publish both keys during overlap");
  const kids = new Set(jwks.map((k) => k.kid));
  assert.equal(kids.size, 2, "the two published keys must have distinct kids");
  console.log("✓ rotation: JWKS publishes both keys with distinct kids");

  // Phase 3: retire the old key (its tokens have expired). Old token now fails.
  delete process.env.REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS;
  __resetOidcKeyCacheForTests();
  await assert.rejects(
    () => verifyToken(oldToken),
    "retired old token must be rejected",
  );
  const afterRetire = await getOidcPublicJwks();
  assert.equal(afterRetire.length, 1, "JWKS should publish only the new key");
  console.log("✓ rotation: retired key no longer verifies or publishes");

  // Clean up env so we don't leak into anything else.
  delete process.env.REDSAIL_OIDC_PRIVATE_KEY;
  delete process.env.REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS;
  __resetOidcKeyCacheForTests();
}

main().catch((err) => {
  console.error("SELF-TEST FAILED:", err);
  process.exit(1);
});
