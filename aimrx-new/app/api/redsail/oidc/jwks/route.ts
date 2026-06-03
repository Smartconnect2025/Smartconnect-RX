import { NextResponse } from "next/server";
import { getOidcKeyMaterial } from "@/core/services/redsail/oidc/keys";

/**
 * JWKS endpoint for the integrator OIDC server. Publishes ONLY the public key,
 * which Emporos uses to validate the signature of every token we issue (both our
 * outbound tokens and the tokens Emporos mints to call our webhook).
 */
export async function GET() {
  const { publicJwk } = await getOidcKeyMaterial();

  return NextResponse.json(
    { keys: [publicJwk] },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
