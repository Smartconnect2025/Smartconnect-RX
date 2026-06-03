import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getRedsailConfigByOidcClientId } from "@/core/services/redsailPaymentConfigService";
import { issueToken } from "@/core/services/redsail/oidc/issuer";

/**
 * OAuth2 client-credentials token endpoint for the integrator OIDC server.
 *
 * Emporos calls this (with the per-tenant OIDC client id/secret we onboarded)
 * to obtain a Bearer token before POSTing to our webhook. The issued JWT carries
 * `aud: ["payments-domain"]` and the `tenant_id` for the client's pharmacy, so
 * our webhook can both trust the call and route it to the correct tenant.
 *
 * Credentials are resolved against the `redsail_payment_configs` rows: each
 * pharmacy config owns an `oidc_client_id` + encrypted secret, which also maps
 * the client to its Tenant GUID.
 */
export async function POST(request: NextRequest) {
  const { clientId, clientSecret, grantType } = await readCredentials(request);

  if (grantType && grantType !== "client_credentials") {
    return oauthError("unsupported_grant_type", 400);
  }
  if (!clientId || !clientSecret) {
    return oauthError("invalid_request", 400, "Missing client credentials");
  }

  const config = await getRedsailConfigByOidcClientId(clientId);
  if (
    !config ||
    !config.oidcClientSecret ||
    !secretsMatch(clientSecret, config.oidcClientSecret) ||
    !config.tenantId
  ) {
    // Uniform failure regardless of which check failed (no client enumeration).
    return oauthError("invalid_client", 401, "Client authentication failed");
  }

  try {
    const token = await issueToken({
      tenantId: config.tenantId,
      clientId,
    });
    return NextResponse.json(
      {
        access_token: token.accessToken,
        token_type: token.tokenType,
        expires_in: token.expiresIn,
      },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  } catch (error) {
    console.error(
      "[REDSAIL-OIDC] Token issuance failed:",
      error instanceof Error ? error.message : "Unknown",
    );
    return oauthError("server_error", 500, "Could not issue token");
  }
}

interface ParsedCredentials {
  clientId?: string;
  clientSecret?: string;
  grantType?: string;
}

/**
 * Accept both standard client-credentials transports: HTTP Basic
 * (`client_secret_basic`) and form-encoded body (`client_secret_post`).
 */
async function readCredentials(
  request: NextRequest,
): Promise<ParsedCredentials> {
  const result: ParsedCredentials = {};

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    result.clientId = params.get("client_id") ?? undefined;
    result.clientSecret = params.get("client_secret") ?? undefined;
    result.grantType = params.get("grant_type") ?? undefined;
  } else if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      result.clientId = asString(body.client_id);
      result.clientSecret = asString(body.client_secret);
      result.grantType = asString(body.grant_type);
    } catch {
      /* ignore malformed JSON; Basic header may still carry creds */
    }
  }

  const basic = parseBasicAuth(request.headers.get("authorization"));
  if (basic) {
    result.clientId = result.clientId ?? basic.clientId;
    result.clientSecret = result.clientSecret ?? basic.clientSecret;
  }

  return result;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseBasicAuth(
  authHeader: string | null,
): { clientId: string; clientSecret: string } | null {
  if (!authHeader) return null;
  const match = /^Basic\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, idx)),
      clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
    };
  } catch {
    return null;
  }
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function oauthError(
  error: string,
  status: number,
  description?: string,
): NextResponse {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
