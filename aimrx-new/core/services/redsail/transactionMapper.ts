import type { RedsailLineItem, RedsailLinkRequest } from "./types";

/**
 * Minimal shape of a payment_transactions row needed to build a RedSail link.
 * Kept structural (not the full Drizzle type) because the row is read through
 * the untyped Supabase/PostgREST client.
 */
export interface PaymentTransactionLike {
  id: string;
  payment_token: string;
  total_amount_cents: number;
  medication_cost_cents?: number | null;
  shipping_fee_cents?: number | null;
  consultation_fee_cents?: number | null;
  description?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  patient_phone?: string | null;
}

export interface PrescriptionLineLike {
  medication?: string | null;
  quantity?: number | null;
  patient_price?: string | number | null;
  shipping_fee_cents?: number | null;
}

function toCents(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Build the line items for an Emporos transaction from our prescriptions. Falls
 * back to a single summary line (itemless-style) when no prescriptions are
 * available, so the total is always honored.
 */
export function buildLineItems(
  txn: PaymentTransactionLike,
  prescriptions: PrescriptionLineLike[],
): RedsailLineItem[] {
  const items: RedsailLineItem[] = [];

  for (const rx of prescriptions) {
    const priceCents = toCents(rx.patient_price);
    if (priceCents <= 0) continue;
    items.push({
      description: rx.medication ?? "Prescription",
      quantity: rx.quantity && rx.quantity > 0 ? rx.quantity : 1,
      unitPriceCents: priceCents,
    });
  }

  if (items.length === 0) {
    items.push({
      description: txn.description ?? "Prescription payment",
      quantity: 1,
      unitPriceCents: txn.total_amount_cents,
    });
  }

  return items;
}

/**
 * Map our payment transaction + prescriptions into a `RedsailLinkRequest`. The
 * total amount is always taken from the (server-authoritative) transaction so
 * the link can never disagree with what we recorded.
 */
export function mapTransactionToLinkRequest(params: {
  txn: PaymentTransactionLike;
  prescriptions: PrescriptionLineLike[];
  returnUrl: string;
  cancelUrl: string;
}): RedsailLinkRequest {
  const { txn, prescriptions, returnUrl, cancelUrl } = params;

  return {
    internalTransactionId: txn.id,
    paymentToken: txn.payment_token,
    amountCents: txn.total_amount_cents,
    currency: "usd",
    description: txn.description ?? "Prescription payment",
    customer: {
      name: txn.patient_name ?? undefined,
      email: txn.patient_email ?? undefined,
      phone: txn.patient_phone ?? undefined,
    },
    items: buildLineItems(txn, prescriptions),
    returnUrl,
    cancelUrl,
  };
}
