import crypto from "crypto";
import {
  type DecryptedRedsailConfig,
  REDSAIL_BASE_URLS,
  type RedsailEnvironment,
} from "@/core/services/redsailPaymentConfigService";
import type {
  IRedSailClient,
  RedsailLinkRequest,
  RedsailLinkResult,
  RedsailPingResult,
  RedsailWebhookEvent,
  RedsailWebhookVerification,
} from "./types";

/**
 * Deterministic, side-effect-free mock of the Emporos Payments transport.
 *
 * It encodes the real contract (credential checks, link shape, webhook bearer
 * validation + event normalization) so the rest of the application can be built
 * and exercised before the real .NET SDK + OIDC issuer are provisioned. It never
 * contacts a network and never moves money.
 *
 * The mock is intentionally honest: `ping()` only reports "connected" when the
 * credentials that the real transport requires are actually present, and webhook
 * verification requires a shared secret derived from the stored config. This way
 * nothing reports a false "ready" state.
 */
export class MockRedSailClient implements IRedSailClient {
  readonly transport = "mock";

  constructor(private readonly config: DecryptedRedsailConfig) {}

  private hasCredentials(): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!this.config.tenantId) missing.push("tenantId");
    if (!this.config.oidcClientId) missing.push("oidcClientId");
    if (!this.config.oidcClientSecret) missing.push("oidcClientSecret");
    return { ok: missing.length === 0, missing };
  }

  /**
   * A stable per-config shared secret used to sign mock webhooks. Derived from
   * the OIDC client secret so it requires real credentials and is deterministic.
   */
  private webhookSecret(): string | null {
    if (!this.config.oidcClientSecret) return null;
    return crypto
      .createHash("sha256")
      .update(`redsail-mock:${this.config.oidcClientSecret}`)
      .digest("hex");
  }

  async ping(): Promise<RedsailPingResult> {
    const { ok, missing } = this.hasCredentials();
    if (!ok) {
      return {
        connected: false,
        message: `Missing required credential(s): ${missing.join(", ")}`,
      };
    }
    return {
      connected: true,
      message:
        "Mock transport: configuration is complete and well-formed. Live verification will run against Emporos once the SDK and credentials are provisioned.",
      raw: { transport: this.transport, environment: this.config.environment },
    };
  }

  private baseUrl(): string {
    if (this.config.apiBaseUrl) return this.config.apiBaseUrl.replace(/\/$/, "");
    return REDSAIL_BASE_URLS[this.config.environment as RedsailEnvironment]
      ?? REDSAIL_BASE_URLS.ftr1;
  }

  async createLinkToPay(req: RedsailLinkRequest): Promise<RedsailLinkResult> {
    const { ok, missing } = this.hasCredentials();
    if (!ok) {
      throw new Error(
        `RedSail is not fully configured (missing: ${missing.join(", ")})`,
      );
    }

    // Deterministic identifiers derived from our token so repeat calls for the
    // same transaction yield the same link (idempotent at the transport layer).
    const linkCode = crypto
      .createHash("sha256")
      .update(`link:${this.config.id}:${req.paymentToken}`)
      .digest("hex")
      .slice(0, 24);

    const redsailTransactionId = crypto
      .createHash("sha256")
      .update(`txn:${this.config.id}:${req.internalTransactionId}`)
      .digest("hex")
      .slice(0, 32);

    // Mock hosted-page URL. NOTE: this is a placeholder that mirrors the shape of
    // a real Emporos Link to Pay URL; it does not resolve to a live page. The
    // real adapter returns the hosted URL Emporos issues. This path is only ever
    // reached when REDSAIL_ENABLED is on AND a pharmacy is connected.
    const url = `${this.baseUrl()}/mock/link-to-pay/${linkCode}?amount=${req.amountCents}`;

    return {
      url,
      linkCode,
      redsailTransactionId,
      raw: {
        transport: this.transport,
        authMode: this.config.linkToPayAuthMode,
        amountCents: req.amountCents,
      },
    };
  }

  async verifyAndParseWebhook(
    authHeader: string | null,
    rawBody: string,
  ): Promise<RedsailWebhookVerification> {
    const secret = this.webhookSecret();
    if (!secret) {
      return { valid: false, reason: "No stored credentials to verify against" };
    }

    const expected = `Bearer ${secret}`;
    if (!authHeader || authHeader !== expected) {
      return { valid: false, reason: "Invalid or missing bearer token" };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: "Body is not valid JSON" };
    }

    const eventId = (parsed.eventId ?? parsed.id) as string | undefined;
    const eventType = (parsed.eventType ?? parsed.type) as string | undefined;
    if (!eventId || !eventType) {
      return { valid: false, reason: "Missing eventId / eventType" };
    }

    const event: RedsailWebhookEvent = {
      eventId,
      eventType,
      redsailTransactionId:
        (parsed.transactionId as string | undefined) ??
        (parsed.redsailTransactionId as string | undefined),
      linkCode: parsed.linkCode as string | undefined,
      payload: parsed,
    };

    return { valid: true, event };
  }
}
