import type { DecryptedRedsailConfig } from "@/core/services/redsailPaymentConfigService";
import type { IRedSailClient } from "./types";
import { MockRedSailClient } from "./mockAdapter";
import { HttpRedSailClient } from "./httpAdapter";

/**
 * Selects the active RedSail transport.
 *
 * `REDSAIL_ADAPTER` is the seam:
 *   - `mock` (default): deterministic, network-free reference transport.
 *   - `http`: the real Emporos Payments Domain HTTP transport, authenticated by
 *     the integrator OIDC issuer in this codebase.
 *
 * This factory is the single place the transport is chosen — no caller changes
 * when switching. The real transport only ever sees a patient when a pharmacy is
 * provisioned + connected AND `REDSAIL_ENABLED` is on.
 */
export function getRedsailClient(
  config: DecryptedRedsailConfig,
): IRedSailClient {
  const adapter = (process.env.REDSAIL_ADAPTER ?? "mock").toLowerCase();

  switch (adapter) {
    case "mock":
      return new MockRedSailClient(config);
    case "http":
    case "emporos":
      return new HttpRedSailClient(config);
    default:
      throw new Error(
        `RedSail adapter "${adapter}" is not recognized. ` +
          `Use "mock" (default) or "http" (real Emporos transport).`,
      );
  }
}
