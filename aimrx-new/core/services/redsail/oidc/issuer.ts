import { SignJWT, jwtVerify, createLocalJWKSet, type JWTPayload } from "jose";
import { getOidcKeyMaterial, getOidcPublicJwks } from "./keys";

/**
 * The integrator-operated OIDC token issuer for RedSail / Emporos Payments.
 *
 * Emporos requires every token (ours outbound, and the ones it mints to call our
 * webhook) to carry `aud` containing "payments-domain" and a `tenant_id` claim
 * equal to the pharmacy's Tenant GUID. This module is the single place those
 * tokens are signed and verified.
 */

/** Audience every Emporos-bound / Emporos-issued token must contain. */
export const PAYMENTS_DOMAIN_AUDIENCE = "payments-domain";

const DEFAULT_TTL_SECONDS = 3600;

/** Base URL of our OIDC server, used as the JWT issuer (`iss`). */
export function getOidcIssuerUrl(): string {
  const explicit = process.env.REDSAIL_OIDC_ISSUER?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const site = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${site}/api/redsail/oidc`;
}

function tokenTtlSeconds(): number {
  const raw = process.env.REDSAIL_OIDC_TOKEN_TTL_SECONDS;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

export interface IssueTokenParams {
  /** Tenant GUID this token authorizes (becomes the `tenant_id` claim). */
  tenantId: string;
  /** OIDC client id requesting the token (becomes `sub` / `client_id`). */
  clientId: string;
  /** Optional override of the token lifetime in seconds. */
  ttlSeconds?: number;
}

export interface IssuedToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

/**
 * Mint a signed client-credentials access token for `tenantId`. Used both by the
 * `/connect/token` endpoint (when Emporos requests a webhook token) and directly
 * by the HTTP adapter for its outbound calls to Emporos.
 */
export async function issueToken(params: IssueTokenParams): Promise<IssuedToken> {
  const { tenantId, clientId } = params;
  if (!tenantId) throw new Error("issueToken: tenantId is required");
  if (!clientId) throw new Error("issueToken: clientId is required");

  const { privateKey, kid, alg } = await getOidcKeyMaterial();
  const ttl = params.ttlSeconds ?? tokenTtlSeconds();
  const issuer = getOidcIssuerUrl();

  const accessToken = await new SignJWT({
    tenant_id: tenantId,
    client_id: clientId,
  })
    .setProtectedHeader({ alg, kid, typ: "JWT" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(clientId)
    .setAudience([PAYMENTS_DOMAIN_AUDIENCE])
    .setExpirationTime(`${ttl}s`)
    .sign(privateKey);

  return { accessToken, tokenType: "Bearer", expiresIn: ttl };
}

export interface VerifiedToken {
  tenantId: string;
  clientId?: string;
  payload: JWTPayload;
}

/**
 * Verify a JWT that claims to come from our OIDC server: signature against our
 * published JWKS, audience contains "payments-domain", and a `tenant_id` claim
 * is present. Throws on any failure. Callers (the webhook) additionally check
 * that `tenant_id` matches the pharmacy config they are processing for.
 *
 * Verification uses the full published JWKS (current signing key plus any
 * previous keys still in their rollover window), so a token signed with a key
 * we just rotated away from keeps verifying until it expires. `jwtVerify`
 * selects the matching key by the token header's `kid`.
 */
export async function verifyToken(jwt: string): Promise<VerifiedToken> {
  const keys = await getOidcPublicJwks();
  const jwks = createLocalJWKSet({ keys });

  const { payload } = await jwtVerify(jwt, jwks, {
    issuer: getOidcIssuerUrl(),
    audience: PAYMENTS_DOMAIN_AUDIENCE,
  });

  const tenantId = payload.tenant_id;
  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Token is missing the required tenant_id claim");
  }

  return {
    tenantId,
    clientId:
      typeof payload.client_id === "string" ? payload.client_id : undefined,
    payload,
  };
}

/** Extract a bearer token from a raw Authorization header value. */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}
