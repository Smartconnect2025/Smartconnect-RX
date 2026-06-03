/**
 * RedSail Pay (Emporos Payments Domain) connector contract.
 *
 * This is the integrator-side seam. The application only ever talks to
 * `IRedSailClient`; the concrete transport (deterministic mock today, a .NET
 * SDK sidecar + OIDC issuer later) is chosen by `getRedsailClient`. Swapping
 * the transport must not require touching any caller.
 */

import type { DecryptedRedsailConfig } from "@/core/services/redsailPaymentConfigService";

export type { DecryptedRedsailConfig };

/** Result of a connectivity / credential verification check. */
export interface RedsailPingResult {
  connected: boolean;
  message: string;
  raw?: unknown;
}

/** A single line item on an Emporos transaction. */
export interface RedsailLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  /** NDC / product code when available (optional for itemless transactions). */
  code?: string;
}

/** Request to create a remote "Link to Pay" for a patient. */
export interface RedsailLinkRequest {
  /** Our internal payment_transactions.id — used for webhook correlation. */
  internalTransactionId: string;
  /** Opaque token from our payment magic link. */
  paymentToken: string;
  amountCents: number;
  currency: string;
  description: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
  };
  items: RedsailLineItem[];
  /** Where Emporos should send the patient after completion. */
  returnUrl: string;
  /** Where Emporos should send the patient on cancel. */
  cancelUrl: string;
}

/** Result of creating a Link to Pay. */
export interface RedsailLinkResult {
  /** The hosted URL the patient is redirected to. */
  url: string;
  /** Emporos link code (used to invalidate / look up the link). */
  linkCode: string;
  /** Emporos transaction id (correlates webhooks back to us). */
  redsailTransactionId: string;
  raw?: unknown;
}

/** A normalized inbound webhook event. */
export interface RedsailWebhookEvent {
  /** Unique event id (idempotency key). */
  eventId: string;
  /** e.g. 'payment.success', 'link_to_pay.fully_paid'. */
  eventType: string;
  /** Emporos transaction id, when present. */
  redsailTransactionId?: string;
  /** Emporos link code, when present. */
  linkCode?: string;
  payload: unknown;
}

export interface RedsailWebhookVerification {
  valid: boolean;
  reason?: string;
  event?: RedsailWebhookEvent;
}

/**
 * The connector interface every transport implements.
 */
export interface IRedSailClient {
  /** Human-readable identifier of the active transport (e.g. 'mock'). */
  readonly transport: string;

  /** Verify credentials / connectivity without side effects. */
  ping(): Promise<RedsailPingResult>;

  /** Create a remote payment link for a patient. */
  createLinkToPay(req: RedsailLinkRequest): Promise<RedsailLinkResult>;

  /**
   * Validate an inbound webhook (bearer token / signature) and normalize it.
   * `authHeader` is the raw `Authorization` header value; `rawBody` is the
   * unparsed request body.
   */
  verifyAndParseWebhook(
    authHeader: string | null,
    rawBody: string,
  ): Promise<RedsailWebhookVerification>;
}
