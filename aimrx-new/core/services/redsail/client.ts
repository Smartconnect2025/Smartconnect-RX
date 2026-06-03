import type { DecryptedRedsailConfig } from "@/core/services/redsailPaymentConfigService";
import type { IRedSailClient } from "./types";
import { MockRedSailClient } from "./mockAdapter";

/**
 * Selects the active RedSail transport.
 *
 * Until the Emporos .NET SDK + OIDC issuer are provisioned, the only available
 * transport is the deterministic mock. `REDSAIL_ADAPTER` is the seam: setting it
 * to `sidecar` (or any non-mock value) will switch to the real transport once
 * that adapter is implemented — at which point this factory is the single place
 * to wire it in. No caller needs to change.
 */
export function getRedsailClient(
  config: DecryptedRedsailConfig,
): IRedSailClient {
  const adapter = (process.env.REDSAIL_ADAPTER ?? "mock").toLowerCase();

  switch (adapter) {
    case "mock":
      return new MockRedSailClient(config);
    default:
      throw new Error(
        `RedSail adapter "${adapter}" is not implemented yet. ` +
          `The real Emporos transport (SDK sidecar + OIDC issuer) is pending ` +
          `provisioning. Unset REDSAIL_ADAPTER to use the mock.`,
      );
  }
}
