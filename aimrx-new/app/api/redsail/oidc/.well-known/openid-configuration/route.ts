import { NextResponse } from "next/server";
import { getOidcIssuerUrl, PAYMENTS_DOMAIN_AUDIENCE } from "@/core/services/redsail/oidc/issuer";

/**
 * OIDC discovery document for the integrator-operated RedSail/Emporos OIDC
 * server. Emporos reads this (the guide requires the `.well-known` folder to sit
 * at the configured OIDC URL level) to find the token and JWKS endpoints used to
 * validate the JWTs we issue.
 *
 * This endpoint is metadata-only and exposes no secrets; it is always available.
 */
export async function GET() {
  const issuer = getOidcIssuerUrl();

  return NextResponse.json(
    {
      issuer,
      token_endpoint: `${issuer}/connect/token`,
      jwks_uri: `${issuer}/jwks`,
      grant_types_supported: ["client_credentials"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
      ],
      response_types_supported: ["token"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: [PAYMENTS_DOMAIN_AUDIENCE],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
