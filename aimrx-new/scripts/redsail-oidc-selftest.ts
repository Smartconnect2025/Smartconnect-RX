/**
 * Self-test for the RedSail/Emporos OIDC issuer + HTTP-adapter webhook verify.
 * Runs fully offline (ephemeral OIDC key) — proves the security-critical loop:
 * issue a client-credentials token, then verify it the way the webhook does.
 *
 * Run: npx tsx scripts/redsail-oidc-selftest.ts
 */
import assert from "node:assert";
import {
  issueToken,
  verifyToken,
  PAYMENTS_DOMAIN_AUDIENCE,
} from "@/core/services/redsail/oidc/issuer";
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

  console.log("\nALL REDSAIL OIDC SELF-TESTS PASSED");
}

main().catch((err) => {
  console.error("SELF-TEST FAILED:", err);
  process.exit(1);
});
