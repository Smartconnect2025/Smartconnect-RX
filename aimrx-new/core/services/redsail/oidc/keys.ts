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
 * The private key is supplied via `REDSAIL_OIDC_PRIVATE_KEY` as a PKCS#8 PEM
 * (optionally base64-encoded so it survives single-line env storage). The public
 * JWKS is derived from it, so there is nothing else to configure.
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

async function buildFromPem(pem: string): Promise<OidcKeyMaterial> {
  const privateKey = await importPKCS8(pem, ALG, { extractable: false });
  // Derive the public key from the private key so JWKS always matches.
  const publicKeyObject = createPublicKey({ key: pem, format: "pem" });
  const publicJwk = await exportJWK(publicKeyObject);
  const kid = await calculateJwkThumbprint(publicJwk);
  return {
    privateKey,
    publicJwk: { ...publicJwk, kid, use: "sig", alg: ALG },
    kid,
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
 * Resolve the OIDC key material (cached for the process lifetime).
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

/** Test-only: clear the cached key material. */
export function __resetOidcKeyCacheForTests(): void {
  cached = null;
}
