/**
 * Accounting & Refunds — mark issued.
 *
 * Marks a single prescription's `prescription_refunds` row as issued with
 * an admin-supplied amount, optional refunded-at date, and free-text note.
 * For card-paid refunds also stamps `payment_transactions.refunded_at` +
 * refund_amount_cents so card and ledger views agree. POT-credit refunds
 * touch only the refund row.
 *
 * Request body: { prescriptionId, refundAmountCents, note?, refundedAt? }
 *
 * Idempotent: rows already 'issued' are returned unchanged with
 * `alreadyIssued: true`. Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";

interface RequestBody {
  prescriptionId?: string;
  refundAmountCents?: number;
  note?: string;
  refundedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const prescriptionId = typeof body.prescriptionId === "string" ? body.prescriptionId.trim() : "";
    if (!prescriptionId) {
      return NextResponse.json({ error: "prescriptionId is required" }, { status: 400 });
    }

    const refundAmountCents = Number(body.refundAmountCents);
    if (!Number.isFinite(refundAmountCents) || refundAmountCents < 0 || refundAmountCents > 10_000_000) {
      return NextResponse.json(
        { error: "refundAmountCents must be a non-negative integer (max $100,000)" },
        { status: 400 },
      );
    }
    const amountCents = Math.round(refundAmountCents);

    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    let issuedAtIso = new Date().toISOString();
    if (typeof body.refundedAt === "string" && body.refundedAt.trim()) {
      const parsed = new Date(body.refundedAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "refundedAt must be a valid ISO date string" }, { status: 400 });
      }
      // Disallow future-dated refunds (allow up to 1 day skew for timezone)
      if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: "refundedAt cannot be in the future" }, { status: 400 });
      }
      issuedAtIso = parsed.toISOString();
    }

    const supabase = await createServerClient();

    // Load the refund row keyed by prescription_id (UNIQUE).
    const { data: refundRow, error: loadErr } = await supabase
      .from("prescription_refunds")
      .select("id, prescription_id, status, refund_amount_cents, refund_method, issued_at, note")
      .eq("prescription_id", prescriptionId)
      .maybeSingle();
    if (loadErr) {
      console.error("[refunds mark-issued] lookup error:", loadErr);
      return NextResponse.json({ error: "Failed to load refund", details: loadErr.message }, { status: 500 });
    }
    if (!refundRow) {
      return NextResponse.json({ error: "No refund record found for this prescription" }, { status: 404 });
    }
    if (refundRow.status === "issued") {
      return NextResponse.json({
        ok: true,
        alreadyIssued: true,
        prescriptionId,
        refundId: refundRow.id,
        amountCents: refundRow.refund_amount_cents,
        issuedAt: refundRow.issued_at,
      });
    }
    // Only `owed` rows can transition to `issued`. `not_applicable`
    // means there's nothing to refund (cancelled before charge, etc.)
    // and would corrupt accounting if marked issued via direct API call.
    if (refundRow.status !== "owed") {
      return NextResponse.json(
        { error: `Cannot mark refund issued from status "${refundRow.status}"; only "owed" is allowed.` },
        { status: 409 },
      );
    }

    // Resolve linked payment_transaction_id for card-method refunds.
    let txnId: string | null = null;
    if (refundRow.refund_method === "card") {
      const { data: rxRow, error: rxErr } = await supabase
        .from("prescriptions")
        .select("id, payment_transaction_id")
        .eq("id", prescriptionId)
        .maybeSingle();
      if (rxErr) {
        console.error("[refunds mark-issued] rx lookup error:", rxErr);
        return NextResponse.json(
          { error: "Failed to load prescription", details: rxErr.message },
          { status: 500 },
        );
      }
      txnId = rxRow?.payment_transaction_id || null;
    }

    const { data: updated, error: updErr } = await supabase
      .from("prescription_refunds")
      .update({
        status: "issued",
        refund_amount_cents: amountCents,
        issued_at: issuedAtIso,
        issued_by_user_id: user.id,
        note: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", refundRow.id)
      .eq("status", "owed") // optimistic guard
      .select("id, prescription_id, refund_amount_cents, refund_method, issued_at")
      .single();

    if (updErr || !updated) {
      console.error("[refunds mark-issued] update error:", updErr);
      return NextResponse.json(
        { error: "Failed to mark refund issued", details: updErr?.message || "no row updated" },
        { status: 500 },
      );
    }

    // Audit AFTER the refund row is updated. If the audit write fails
    // we revert the row so the system_logs ledger never disagrees with
    // prescription_refunds. Revert is best-effort; revert failure is
    // separately logged and surfaced.
    const { error: auditErr } = await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email,
      action: "ACCOUNTING_REFUND_MARKED_ISSUED",
      details: `Refund issued for prescription ${prescriptionId}: $${(amountCents / 100).toFixed(2)} via ${refundRow.refund_method}${note ? ` — note: ${note}` : ""}`,
    });
    if (auditErr) {
      console.error("[refunds mark-issued] audit log error — reverting refund:", auditErr);
      const { error: revertErr } = await supabase
        .from("prescription_refunds")
        .update({
          status: "owed",
          refund_amount_cents: refundRow.refund_amount_cents,
          issued_at: null,
          issued_by_user_id: null,
          note: refundRow.note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundRow.id);
      if (revertErr) {
        console.error("[refunds mark-issued] CRITICAL: revert also failed", revertErr);
        return NextResponse.json(
          {
            error: "Audit log failed AND state revert failed; refund row is issued without audit. Manual reconciliation required.",
            refundId: refundRow.id,
            prescriptionId,
            auditError: auditErr.message,
            revertError: revertErr.message,
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: "Audit log write failed; refund not marked issued", details: auditErr.message },
        { status: 500 },
      );
    }

    // Card-method txn mirror: if mirror fails we revert the refund row
    // and the audit so prescription_refunds + payment_transactions never
    // disagree. A compensating audit row records the failed attempt.
    let txnMirror: { ok: boolean; id?: string; err?: string } | null = null;
    if (refundRow.refund_method === "card" && txnId) {
      const { error: txnErr } = await supabase
        .from("payment_transactions")
        .update({ refunded_at: issuedAtIso, refund_amount_cents: amountCents })
        .eq("id", txnId)
        .is("refunded_at", null);
      if (txnErr) {
        console.error("[refunds mark-issued] txn mirror failed — reverting:", txnId, txnErr);
        await supabase
          .from("prescription_refunds")
          .update({
            status: "owed",
            refund_amount_cents: refundRow.refund_amount_cents,
            issued_at: null,
            issued_by_user_id: null,
            note: refundRow.note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", refundRow.id);
        await supabase.from("system_logs").insert({
          user_id: user.id,
          user_email: user.email,
          action: "ACCOUNTING_REFUND_MARK_ISSUED_REVERTED",
          details: `Revert: card txn ${txnId} mirror failed for prescription ${prescriptionId}: ${txnErr.message}`,
        });
        return NextResponse.json(
          {
            error: "Card transaction mirror failed; refund reverted to owed.",
            details: txnErr.message,
            prescriptionId,
            txnId,
          },
          { status: 500 },
        );
      }
      txnMirror = { ok: true, id: txnId };
    }

    return NextResponse.json({
      ok: true,
      prescriptionId,
      refundId: updated.id,
      amountCents: updated.refund_amount_cents,
      method: updated.refund_method,
      issuedAt: updated.issued_at,
      txnMirror,
    });
  } catch (error) {
    console.error("[refunds mark-issued] Internal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
