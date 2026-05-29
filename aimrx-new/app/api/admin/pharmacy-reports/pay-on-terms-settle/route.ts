/**
 * Pay-on-Terms Settle
 *
 * Marks one or more prescriptions as settled (admin collected payment
 * outside the platform). Admin/super_admin only. Idempotent: only flips
 * rows that are currently NULL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";

interface RequestBody {
  prescriptionIds: string[];
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
    if (!Array.isArray(body.prescriptionIds) || body.prescriptionIds.length === 0) {
      return NextResponse.json(
        { error: "prescriptionIds must be a non-empty array" },
        { status: 400 },
      );
    }
    if (body.prescriptionIds.some((id) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json(
        { error: "Every prescriptionIds entry must be a non-empty string" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Pre-validate: only allow flipping IDs whose prescriber is currently
    // on pay_on_terms AND that were not actually charged on a card.
    // Prevents accidental/scripted "settling" of unrelated prescriptions or
    // of card-paid prescriptions through a malformed payload.
    const { data: candidateRows, error: candErr } = await supabase
      .from("prescriptions")
      .select("id, prescriber_id, pay_on_terms_settled_at, payment_transaction_id")
      .in("id", body.prescriptionIds);

    if (candErr) {
      console.error("[pay-on-terms-settle] lookup error:", candErr);
      return NextResponse.json(
        { error: "Failed to load prescriptions", details: candErr.message },
        { status: 500 },
      );
    }

    const prescriberIds = [
      ...new Set((candidateRows || []).map((r) => r.prescriber_id).filter(Boolean)),
    ];

    let allowedPrescriberIds = new Set<string>();
    if (prescriberIds.length > 0) {
      const { data: providers, error: provErr } = await supabase
        .from("providers")
        .select("user_id, pay_on_terms")
        .in("user_id", prescriberIds)
        .eq("pay_on_terms", true);
      if (provErr) {
        console.error("[pay-on-terms-settle] provider lookup error:", provErr);
        return NextResponse.json(
          { error: "Failed to verify providers", details: provErr.message },
          { status: 500 },
        );
      }
      allowedPrescriberIds = new Set((providers || []).map((p) => p.user_id));
    }

    // Resolve which candidate rows have a real card charge (authnet) on
    // their linked payment_transaction. Those are NOT eligible for settle
    // because the patient already paid.
    const candidateTxnIds = [
      ...new Set((candidateRows || []).map((r) => r.payment_transaction_id).filter(Boolean)),
    ] as string[];
    let candidateTxns: { id: string; authnet_transaction_id: string | null }[] = [];
    if (candidateTxnIds.length > 0) {
      const { data: txns, error: txnErr } = await supabase
        .from("payment_transactions")
        .select("id, authnet_transaction_id")
        .in("id", candidateTxnIds);
      if (txnErr) {
        console.error("[pay-on-terms-settle] payment_transactions lookup error:", txnErr);
        return NextResponse.json(
          { error: "Failed to verify payment transactions", details: txnErr.message },
          { status: 500 },
        );
      }
      candidateTxns = txns || [];
    }
    const txnHasAuthnet = new Map(
      candidateTxns.map((t) => [
        t.id,
        !!(t.authnet_transaction_id && String(t.authnet_transaction_id).trim() !== ""),
      ]),
    );
    const rxIdsWithCardCharge = new Set(
      (candidateRows || [])
        .filter(
          (r) => r.payment_transaction_id && txnHasAuthnet.get(r.payment_transaction_id),
        )
        .map((r) => r.id),
    );

    const eligibleIds = (candidateRows || [])
      .filter(
        (r) =>
          r.pay_on_terms_settled_at === null &&
          allowedPrescriberIds.has(r.prescriber_id) &&
          !rxIdsWithCardCharge.has(r.id),
      )
      .map((r) => r.id);

    const skippedIds = body.prescriptionIds.filter((id) => !eligibleIds.includes(id));

    if (eligibleIds.length === 0) {
      return NextResponse.json({
        settled: 0,
        settledAt: null,
        ids: [],
        skipped: skippedIds,
        reason: "No eligible pay-on-terms prescriptions in payload",
      });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("prescriptions")
      .update({ pay_on_terms_settled_at: nowIso })
      .in("id", eligibleIds)
      .is("pay_on_terms_settled_at", null)
      .select("id");

    if (error) {
      console.error("[pay-on-terms-settle] update error:", error);
      return NextResponse.json(
        { error: "Failed to mark prescriptions settled", details: error.message },
        { status: 500 },
      );
    }

    console.log(
      `[pay-on-terms-settle] actor=${user.id} settled=${data?.length || 0} skipped=${skippedIds.length}`,
    );

    return NextResponse.json({
      settled: data?.length || 0,
      settledAt: nowIso,
      ids: data?.map((r) => r.id) || [],
      skipped: skippedIds,
    });
  } catch (error) {
    console.error("[pay-on-terms-settle] Internal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
