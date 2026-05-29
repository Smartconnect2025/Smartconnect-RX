/**
 * Backfills missing prescription_refunds rows for any rejected/cancelled
 * prescription appearing after the migration. Classification mirrors
 * 20260511180000_prescription_refunds.sql exactly. Idempotent via
 * ON CONFLICT DO NOTHING. Returns an in-memory fallback map for any rows
 * we couldn't persist so callers can still render them (fail-open).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Prescription = {
  id: string;
  payment_status: string | null;
  payment_transaction_id: string | null;
  patient_price: string | number | null;
  shipping_fee_cents: number | null;
  prescriber_id: string | null;
};

export type FallbackRefundRow = {
  prescription_id: string;
  status: "owed" | "issued" | "not_applicable";
  refund_amount_cents: number;
  refund_method: "card" | "pot_credit" | "none";
  issued_at: string | null;
  note: string | null;
};

type ProviderRow = { user_id: string; pay_on_terms: boolean | null };
type TxnRow = {
  id: string;
  authnet_transaction_id: string | null;
  refunded_at: string | null;
  refund_amount_cents: number | null;
};

export async function ensureRefundRowsExist(
  supabase: SupabaseClient,
  prescriptions: Prescription[],
): Promise<Map<string, FallbackRefundRow>> {
  const fallback = new Map<string, FallbackRefundRow>();
  if (!prescriptions.length) return fallback;

  const rxIds = prescriptions.map((p) => p.id);
  const { data: existing, error: existingErr } = await supabase
    .from("prescription_refunds")
    .select("prescription_id")
    .in("prescription_id", rxIds);
  if (existingErr) {
    console.error("[refunds ensure] existing lookup failed:", existingErr);
    return computeFallbacks(supabase, prescriptions);
  }
  const haveRow = new Set((existing || []).map((r) => (r as { prescription_id: string }).prescription_id));
  const missing = prescriptions.filter((p) => !haveRow.has(p.id));
  if (!missing.length) return fallback;

  const txnIds = [...new Set(missing.map((p) => p.payment_transaction_id).filter(Boolean) as string[])];
  const prescriberIds = [...new Set(missing.map((p) => p.prescriber_id).filter(Boolean) as string[])];

  const [{ data: txns }, { data: providers }] = await Promise.all([
    txnIds.length
      ? supabase
          .from("payment_transactions")
          .select("id, authnet_transaction_id, refunded_at, refund_amount_cents")
          .in("id", txnIds)
      : Promise.resolve({ data: [] as TxnRow[] }),
    prescriberIds.length
      ? supabase.from("providers").select("user_id, pay_on_terms").in("user_id", prescriberIds)
      : Promise.resolve({ data: [] as ProviderRow[] }),
  ]);

  const txnMap = new Map<string, TxnRow>(
    ((txns as TxnRow[]) || []).map((t) => [t.id, t]),
  );
  const providerMap = new Map<string, ProviderRow>(
    ((providers as ProviderRow[]) || []).map((p) => [p.user_id, p]),
  );

  const rowsToInsert = missing.map((rx) => classifyRefund(rx, txnMap, providerMap));
  const { error: insErr } = await supabase
    .from("prescription_refunds")
    .upsert(rowsToInsert, { onConflict: "prescription_id", ignoreDuplicates: true });
  if (insErr) {
    console.error("[refunds ensure] upsert failed:", insErr);
    for (const r of rowsToInsert) fallback.set(r.prescription_id, r);
    return fallback;
  }
  return fallback;
}

function classifyRefund(
  rx: Prescription,
  txnMap: Map<string, TxnRow>,
  providerMap: Map<string, ProviderRow>,
): FallbackRefundRow {
  const txn = rx.payment_transaction_id ? txnMap.get(rx.payment_transaction_id) || null : null;
  const provider = rx.prescriber_id ? providerMap.get(rx.prescriber_id) || null : null;

  const isCard = !!(txn?.authnet_transaction_id && txn.authnet_transaction_id.trim());
  const isPaidOrPending = rx.payment_status === "paid" || rx.payment_status === "rejected_refund_pending";

  let status: "issued" | "owed" | "not_applicable" = "not_applicable";
  if (txn?.refunded_at) status = "issued";
  else if (isPaidOrPending) status = "owed";

  let method: "card" | "pot_credit" | "none" = "none";
  if (isCard) method = "card";
  else if (provider?.pay_on_terms && isPaidOrPending) method = "pot_credit";

  let amountCents = 0;
  if (typeof txn?.refund_amount_cents === "number") {
    amountCents = txn.refund_amount_cents;
  } else {
    const priceNum = Number(rx.patient_price ?? 0);
    const dollars = Number.isFinite(priceNum) ? priceNum : 0;
    amountCents = Math.round(dollars * 100) + (rx.shipping_fee_cents || 0);
  }

  return {
    prescription_id: rx.id,
    status,
    refund_amount_cents: amountCents,
    refund_method: method,
    issued_at: txn?.refunded_at || null,
    note: txn?.refunded_at ? "Auto-classified from existing card refund" : null,
  };
}

async function computeFallbacks(
  supabase: SupabaseClient,
  prescriptions: Prescription[],
): Promise<Map<string, FallbackRefundRow>> {
  const out = new Map<string, FallbackRefundRow>();
  const txnIds = [...new Set(prescriptions.map((p) => p.payment_transaction_id).filter(Boolean) as string[])];
  const prescriberIds = [...new Set(prescriptions.map((p) => p.prescriber_id).filter(Boolean) as string[])];
  const [{ data: txns }, { data: providers }] = await Promise.all([
    txnIds.length
      ? supabase.from("payment_transactions").select("id, authnet_transaction_id, refunded_at, refund_amount_cents").in("id", txnIds)
      : Promise.resolve({ data: [] as TxnRow[] }),
    prescriberIds.length
      ? supabase.from("providers").select("user_id, pay_on_terms").in("user_id", prescriberIds)
      : Promise.resolve({ data: [] as ProviderRow[] }),
  ]);
  const txnMap = new Map<string, TxnRow>(((txns as TxnRow[]) || []).map((t) => [t.id, t]));
  const providerMap = new Map<string, ProviderRow>(((providers as ProviderRow[]) || []).map((p) => [p.user_id, p]));
  for (const rx of prescriptions) out.set(rx.id, classifyRefund(rx, txnMap, providerMap));
  return out;
}
