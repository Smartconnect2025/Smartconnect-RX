import { NextResponse } from "next/server";
import { getOidcPublicJwks } from "@/core/services/redsail/oidc/keys";

/**
 * JWKS endpoint for the integrator OIDC server. Publishes ONLY public keys,
 * which Emporos uses to validate the signature of every token we issue (both our
 * outbound tokens and the tokens Emporos mints to call our webhook).
 *
 * During a key rollover this publishes the current signing key plus any previous
 * keys still in their window (each by its own `kid`), so tokens signed with
 * either key keep verifying until the old ones expire.
 */
export async function GET() {
  const keys = await getOidcPublicJwks();

  return NextResponse.json(
    { keys },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
