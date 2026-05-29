import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * POST /api/prescriptions/check-pay-on-terms
 * Body: { prescriptionIds: string[] }
 *
 * Returns { payOnTerms: boolean, prescriberId: string | null }.
 *
 * Used by the Prescribe wizard's Collect Payment step to decide whether to
 * auto-skip the payment screen and trigger the pay-on-terms bypass instead.
 *
 * Read-only. Authenticated callers (provider, delegate, admin) only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const ids: unknown = body?.prescriptionIds;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json(
        { error: "prescriptionIds must be a non-empty string array" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: rxs, error: rxErr } = await admin
      .from("prescriptions")
      .select("id, prescriber_id")
      .in("id", ids as string[]);

    if (rxErr || !rxs || rxs.length === 0) {
      return NextResponse.json(
        { error: "Prescriptions not found" },
        { status: 404 },
      );
    }

    const prescriberId = rxs[0].prescriber_id;
    if (!prescriberId) {
      return NextResponse.json({ payOnTerms: false, prescriberId: null });
    }

    const allSamePrescriber = rxs.every((r) => r.prescriber_id === prescriberId);
    if (!allSamePrescriber) {
      return NextResponse.json({ payOnTerms: false, prescriberId });
    }

    const { data: provider } = await admin
      .from("providers")
      .select("pay_on_terms")
      .eq("user_id", prescriberId)
      .maybeSingle();

    return NextResponse.json({
      payOnTerms: provider?.pay_on_terms === true,
      prescriberId,
    });
  } catch (err) {
    console.error("[check-pay-on-terms] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
