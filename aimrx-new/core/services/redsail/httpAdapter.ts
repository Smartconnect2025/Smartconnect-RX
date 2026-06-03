import {
  type DecryptedRedsailConfig,
  REDSAIL_BASE_URLS,
  type RedsailEnvironment,
} from "@/core/services/redsailPaymentConfigService";
import {
  issueToken,
  verifyToken,
  extractBearer,
} from "./oidc/issuer";
import type {
  IRedSailClient,
  RedsailLinkRequest,
  RedsailLinkResult,
  RedsailPingResult,
  RedsailWebhookEvent,
  RedsailWebhookVerification,
} from "./types";

/**
 * Real HTTP transport for the Emporos Payments Domain.
 *
 * The Emporos integration is .NET-SDK-first; the HTTP surface is only partially
 * published (the guide documents `POST /api/{tenantId}/sdk/transaction/initialize`
 * → `{ urlCode }`, and the Link-to-Pay SDK shape but not its HTTP path). This
 * adapter implements the documented contract faithfully and exposes the
 * not-yet-published bits as configurable env overrides so they can be set
 * without a code change once Emporos confirms them. It NEVER fabricates a
 * payment link: if a response is not usable it throws (fail loudly).
 *
 * Auth uses the integrator OIDC issuer in this same codebase: a client-
 * credentials JWT (aud "payments-domain", tenant_id claim) is minted in-process
 * and presented as a Bearer token. Inbound webhooks are verified against that
 * same OIDC key.
 *
 * Selected via `REDSAIL_ADAPTER=http`. Until a pharmacy is fully provisioned and
 * connected AND `REDSAIL_ENABLED` is on, no patient is ever routed here.
 */
export class HttpRedSailClient implements IRedSailClient {
  readonly transport = "http";

  constructor(private readonly config: DecryptedRedsailConfig) {}

  private requestTimeoutMs(): number {
    const raw = process.env.REDSAIL_HTTP_TIMEOUT_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 15000;
  }

  private hasCredentials(): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!this.config.tenantId) missing.push("tenantId");
    if (!this.config.oidcClientId) missing.push("oidcClientId");
    if (!this.config.oidcClientSecret) missing.push("oidcClientSecret");
    return { ok: missing.length === 0, missing };
  }

  /** Resolve the Payments Domain API base URL for this config's environment. */
  private apiBaseUrl(): string {
    if (this.config.apiBaseUrl) return this.config.apiBaseUrl.replace(/\/$/, "");
    return (
      REDSAIL_BASE_URLS[this.config.environment as RedsailEnvironment] ??
      REDSAIL_BASE_URLS.ftr1
    );
  }

  /** Mint an outbound Bearer token for this tenant via our OIDC issuer. */
  private async bearerToken(): Promise<string> {
    const { tenantId, oidcClientId } = this.config;
    const token = await issueToken({
      tenantId: tenantId!,
      clientId: oidcClientId!,
    });
    return token.accessToken;
  }

  private fillTemplate(path: string): string {
    return path
      .replace(/\{tenantId\}/g, encodeURIComponent(this.config.tenantId ?? ""))
      .replace(/\{siteId\}/g, encodeURIComponent(this.config.siteId ?? ""))
      .replace(
        /\{stationId\}/g,
        encodeURIComponent(this.config.stationId ?? ""),
      );
  }

  private async authedFetch(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<{ status: number; ok: boolean; json: unknown; text: string }> {
    const token = await this.bearerToken();
    const url = `${this.apiBaseUrl()}${this.fillTemplate(path)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs());

    try {
      const res = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        /* non-JSON body; keep raw text */
      }
      return { status: res.status, ok: res.ok, json, text };
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<RedsailPingResult> {
    const { ok, missing } = this.hasCredentials();
    if (!ok) {
      return {
        connected: false,
        message: `Missing required credential(s): ${missing.join(", ")}`,
      };
    }

    // Proves the OIDC signing key is configured and a well-formed token (with
    // aud + tenant_id) can be minted — the part we fully control.
    let token: string;
    try {
      token = await this.bearerToken();
    } catch (err) {
      return {
        connected: false,
        message: `Could not mint an OIDC token: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      };
    }

    // If a reachability/health path is configured, do a real authenticated call
    // so "connected" reflects Emporos actually accepting our token. Without it
    // we cannot prove the far side, so we say so honestly rather than guess an
    // undocumented endpoint.
    const pingPath = process.env.REDSAIL_PING_PATH?.trim();
    if (!pingPath) {
      return {
        connected: true,
        message:
          "OIDC token minted successfully (aud=payments-domain, tenant_id set). " +
          "Set REDSAIL_PING_PATH to a Payments Domain health endpoint to also " +
          "verify live reachability.",
        raw: { transport: this.transport, environment: this.config.environment },
      };
    }

    try {
      const res = await this.authedFetch(pingPath, { method: "GET" });
      if (res.ok) {
        return {
          connected: true,
          message: `Payments Domain reachable and accepted the token (HTTP ${res.status}).`,
          raw: res.json ?? undefined,
        };
      }
      return {
        connected: false,
        message: `Payments Domain rejected the request (HTTP ${res.status}).`,
        raw: res.text,
      };
    } catch (err) {
      void token;
      return {
        connected: false,
        message: `Could not reach the Payments Domain: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      };
    }
  }

  /**
   * Create an Emporos Link to Pay for a patient.
   *
   * The request body mirrors the documented SDK `Transaction` /
   * `CreateLinkToPayRequest` shape. The HTTP path is taken from
   * `REDSAIL_LINK_TO_PAY_PATH` (templated with {tenantId}/{siteId}), defaulting
   * to a path consistent with the documented `/api/{tenantId}/sdk/...` family.
   * The response is read for `linkToPayUrl` + `linkToPayCode`; it falls back to
   * the documented `{ urlCode }` shape, constructing the hosted URL as the guide
   * specifies. If neither yields a usable URL, it throws.
   */
  async createLinkToPay(req: RedsailLinkRequest): Promise<RedsailLinkResult> {
    const { ok, missing } = this.hasCredentials();
    if (!ok) {
      throw new Error(
        `RedSail is not fully configured (missing: ${missing.join(", ")})`,
      );
    }

    const path =
      process.env.REDSAIL_LINK_TO_PAY_PATH?.trim() ||
      "/api/{tenantId}/sdk/link-to-pay/create";

    const body = this.buildLinkToPayBody(req);
    const res = await this.authedFetch(path, { method: "POST", body });

    if (!res.ok) {
      throw new Error(
        `Emporos Link to Pay creation failed (HTTP ${res.status}): ${res.text.slice(0, 500)}`,
      );
    }

    const data = (res.json ?? {}) as Record<string, unknown>;
    const inner = (data.data ?? data) as Record<string, unknown>;

    const linkUrl =
      asString(inner.linkToPayUrl) ??
      asString(inner.LinkToPayUrl) ??
      asString(inner.paymentUrl);
    const linkCode =
      asString(inner.linkToPayCode) ??
      asString(inner.LinkToPayCode) ??
      asString(inner.urlCode) ??
      asString(inner.UrlCode);
    const redsailTransactionId =
      asString(inner.transactionId) ??
      asString(inner.TransactionId) ??
      req.internalTransactionId;

    let url = linkUrl;
    if (!url) {
      const urlCode = asString(inner.urlCode) ?? asString(inner.UrlCode);
      if (urlCode) {
        // Documented hosted-URL construction for the initialize flow.
        url = `${this.apiBaseUrl()}/${encodeURIComponent(this.config.tenantId!)}/pay/${urlCode}`;
      }
    }

    if (!url || !linkCode) {
      throw new Error(
        "Emporos response did not include a usable Link to Pay URL / code. " +
          `Raw: ${res.text.slice(0, 500)}`,
      );
    }

    return {
      url,
      linkCode,
      redsailTransactionId,
      raw: res.json ?? undefined,
    };
  }

  private buildLinkToPayBody(req: RedsailLinkRequest): Record<string, unknown> {
    const subTotalCents = req.items.reduce(
      (sum, it) => sum + it.unitPriceCents * it.quantity,
      0,
    );
    const totalSale = centsToAmount(req.amountCents);
    const subTotal = centsToAmount(subTotalCents || req.amountCents);

    return {
      transaction: {
        transactionId: req.internalTransactionId,
        siteId: this.config.siteId ?? undefined,
        stationId: this.config.stationId ?? undefined,
        totalSale,
        subTotal,
        totalTax: Number((totalSale - subTotal).toFixed(2)),
        customer: {
          customerId: req.internalTransactionId,
          firstName: firstName(req.customer.name),
          lastName: lastName(req.customer.name),
          email: req.customer.email ?? undefined,
          phones: req.customer.phone
            ? [{ number: req.customer.phone, isPrimary: true }]
            : undefined,
        },
        items: req.items.map((it, idx) => ({
          transactionItemId: `${req.internalTransactionId}-${idx}`,
          description: it.description,
          rx: it.code ?? undefined,
          listPrice: centsToAmount(it.unitPriceCents),
          quantity: it.quantity,
          extension: centsToAmount(it.unitPriceCents * it.quantity),
          itemTypeId: it.code ? 14 : 9,
          qhpIndicator: true,
        })),
        featureFlags: {
          linkToPayAuthenticationMode: this.config.linkToPayAuthMode,
        },
      },
      tenantId: this.config.tenantId,
      returnUrl: req.returnUrl,
      cancelUrl: req.cancelUrl,
    };
  }

  async verifyAndParseWebhook(
    authHeader: string | null,
    rawBody: string,
  ): Promise<RedsailWebhookVerification> {
    const jwt = extractBearer(authHeader);
    if (!jwt) {
      return { valid: false, reason: "Missing or malformed bearer token" };
    }

    let tokenTenantId: string;
    try {
      const verified = await verifyToken(jwt);
      tokenTenantId = verified.tenantId;
    } catch (err) {
      return {
        valid: false,
        reason: `Token verification failed: ${
          err instanceof Error ? err.message : "invalid token"
        }`,
      };
    }

    // The token is signed by our shared OIDC key; the tenant_id claim is what
    // binds it to a specific pharmacy. Only the config whose Tenant GUID matches
    // may accept this webhook.
    if (!this.config.tenantId || tokenTenantId !== this.config.tenantId) {
      return {
        valid: false,
        reason: "Token tenant_id does not match this configuration",
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: "Body is not valid JSON" };
    }

    const event = normalizeEmporosEvent(parsed);
    if (!event) {
      return { valid: false, reason: "Missing eventId / eventName" };
    }

    return { valid: true, event };
  }
}

/** Normalize the documented Emporos webhook envelope into our internal shape. */
function normalizeEmporosEvent(
  parsed: Record<string, unknown>,
): RedsailWebhookEvent | null {
  const eventId = asString(parsed.eventId) ?? asString(parsed.eventID);
  const eventType = asString(parsed.eventName) ?? asString(parsed.eventType);
  if (!eventId || !eventType) return null;

  const payload = (parsed.eventPayload ?? parsed) as Record<string, unknown>;
  const transaction = (payload.transaction ?? {}) as Record<string, unknown>;

  const redsailTransactionId =
    asString(payload.transactionId) ??
    asString(transaction.transactionId) ??
    undefined;
  const linkCode =
    asString(payload.linkToPayCode) ??
    asString(payload.linkCode) ??
    asString(payload.urlCode) ??
    undefined;

  return {
    eventId,
    eventType,
    redsailTransactionId,
    linkCode,
    payload: parsed,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function firstName(name?: string): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0] || undefined;
}

function lastName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : undefined;
}
