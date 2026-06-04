import {
  importPKCS8,
  exportJWK,
  calculateJwkThumbprint,
  generateKeyPair,
  type JWK,
  type KeyLike,
} from "jose";
import { createPublicKey } from "crypto";

/**
 * Signing-key material for the integrator-operated OIDC server.
 *
 * The Emporos Payments Domain requires the integrator to run its own OIDC
 * (OAuth2 client-credentials) server whose JWTs it can validate via a published
 * JWKS. The SAME key pair is used for:
 *   - outbound tokens our app presents to Emporos, and
 *   - the tokens Emporos mints (from our token endpoint) and presents back to
 *     our webhook — which we then verify locally with the public key.
 *
 * The CURRENT private key is supplied via `REDSAIL_OIDC_PRIVATE_KEY` as a
 * PKCS#8 PEM (optionally base64-encoded so it survives single-line env storage).
 * New tokens are always signed with this key.
 *
 * To rotate the key without downtime, the PREVIOUS key(s) are supplied via
 * `REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS` — one or more public (SPKI) or private
 * (PKCS#8) PEM blocks, concatenated (and optionally base64-encoded as a whole).
 * Only the public material is used: their public JWKs are published alongside
 * the current key (each keyed by its own `kid`) so tokens signed with a retired
 * key keep verifying until they expire. Once the old tokens have aged out
 * (token TTL), the previous key can be dropped from the env var.
 */

const ALG = "RS256";

export interface OidcKeyMaterial {
  /** Private key used to sign issued JWTs. */
  privateKey: KeyLike;
  /** Public JWK published via JWKS (includes `kid`, `use`, `alg`). */
  publicJwk: JWK;
  /** Key id stamped into the JWT header and the published JWK. */
  kid: string;
  /** Signing algorithm. */
  alg: string;
  /** True when keys were generated ephemerally (dev only, not stable). */
  ephemeral: boolean;
}

let cached: Promise<OidcKeyMaterial> | null = null;
let cachedPublicJwks: Promise<JWK[]> | null = null;

function decodePrivateKeyPem(raw: string): string {
  const trimmed = raw.trim();
  // Allow a base64-encoded PEM so the multi-line key can live on one env line.
  if (!trimmed.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) return decoded;
    } catch {
      /* fall through to error below */
    }
    throw new Error(
      "REDSAIL_OIDC_PRIVATE_KEY is not a valid PKCS#8 PEM (or base64 of one).",
    );
  }
  return trimmed;
}

/**
 * Extract every PEM block from a raw env value. Accepts the value either as
 * literal PEM text (one or more blocks) or as a single base64 encoding of that
 * text. Returns one string per `-----BEGIN ...----- ... -----END ...-----`
 * block so several keys can share one env var.
 */
function extractPemBlocks(raw: string): string[] {
  let text = raw.trim();
  if (!text.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(text, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) text = decoded;
    } catch {
      /* fall through — no blocks found */
    }
  }
  const matches = text.match(
    /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g,
  );
  return matches ?? [];
}

/** Build the published public JWK (with kid/use/alg) from any PEM block. */
async function publicJwkFromPem(pem: string): Promise<JWK> {
  const publicKeyObject = createPublicKey({ key: pem, format: "pem" });
  const publicJwk = await exportJWK(publicKeyObject);
  const kid = await calculateJwkThumbprint(publicJwk);
  return { ...publicJwk, kid, use: "sig", alg: ALG };
}

async function buildFromPem(pem: string): Promise<OidcKeyMaterial> {
  const privateKey = await importPKCS8(pem, ALG, { extractable: false });
  // Derive the public key from the private key so JWKS always matches.
  const publicJwk = await publicJwkFromPem(pem);
  return {
    privateKey,
    publicJwk,
    kid: publicJwk.kid as string,
    alg: ALG,
    ephemeral: false,
  };
}

async function buildEphemeral(): Promise<OidcKeyMaterial> {
  const { privateKey, publicKey } = await generateKeyPair(ALG, {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  console.error(
    "[REDSAIL-OIDC] REDSAIL_OIDC_PRIVATE_KEY is not set — generated an " +
      "EPHEMERAL signing key. Tokens will not survive a restart and JWKS is " +
      "not stable. Set REDSAIL_OIDC_PRIVATE_KEY before any real Emporos use.",
  );
  return {
    privateKey,
    publicJwk: { ...publicJwk, kid, use: "sig", alg: ALG },
    kid,
    alg: ALG,
    ephemeral: true,
  };
}

/**
 * Resolve the CURRENT OIDC signing-key material (cached for the process
 * lifetime). New tokens are always signed with this key.
 *
 * In production a missing `REDSAIL_OIDC_PRIVATE_KEY` is a hard error: a JWKS that
 * changes on every restart would silently break Emporos token validation. In dev
 * we fall back to an ephemeral key so the flow can be exercised locally.
 */
export function getOidcKeyMaterial(): Promise<OidcKeyMaterial> {
  if (cached) return cached;

  const raw = process.env.REDSAIL_OIDC_PRIVATE_KEY?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDSAIL_OIDC_PRIVATE_KEY is required in production to run the RedSail " +
          "OIDC server. Provide a PKCS#8 RSA private key (PEM or base64 PEM).",
      );
    }
    cached = buildEphemeral();
    return cached;
  }

  cached = buildFromPem(decodePrivateKeyPem(raw));
  return cached;
}

/**
 * Resolve the public JWKs of any PREVIOUS signing keys still in their rollover
 * window, supplied via `REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS`. Returns an empty
 * array when none are configured or none parse. Failures are logged but never
 * fatal — a bad previous key must not take down token issuance with the current
 * one.
 */
async function getPreviousPublicJwks(): Promise<JWK[]> {
  const raw = process.env.REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS?.trim();
  if (!raw) return [];

  const blocks = extractPemBlocks(raw);
  const jwks: JWK[] = [];
  for (const block of blocks) {
    try {
      jwks.push(await publicJwkFromPem(block));
    } catch (err) {
      console.error(
        "[REDSAIL-OIDC] Skipping an unparseable key in " +
          "REDSAIL_OIDC_PREVIOUS_PUBLIC_KEYS:",
        err,
      );
    }
  }
  return jwks;
}

/**
 * All public JWKs that should currently verify a token: the current signing key
 * plus every previous key still inside its rollover window. Deduplicated by
 * `kid` (the current key always wins). This is what the JWKS endpoint publishes
 * and what `verifyToken` validates against.
 */
export function getOidcPublicJwks(): Promise<JWK[]> {
  if (cachedPublicJwks) return cachedPublicJwks;

  cachedPublicJwks = (async () => {
    const current = await getOidcKeyMaterial();
    const previous = await getPreviousPublicJwks();

    const byKid = new Map<string, JWK>();
    byKid.set(current.publicJwk.kid as string, current.publicJwk);
    for (const jwk of previous) {
      const kid = jwk.kid as string;
      if (!byKid.has(kid)) byKid.set(kid, jwk);
    }
    return Array.from(byKid.values());
  })();

  return cachedPublicJwks;
}

/** Test-only: clear the cached key material. */
export function __resetOidcKeyCacheForTests(): void {
  cached = null;
  cachedPublicJwks = null;
}
