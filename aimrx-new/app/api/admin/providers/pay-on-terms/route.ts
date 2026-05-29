import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";

/**
 * POST /api/admin/providers/pay-on-terms
 *
 * Body: { providerId: string, payOnTerms: boolean }
 *
 * Toggles the `pay_on_terms` flag on the given providers row. Used by:
 *   - Admin "Providers" page: switch a regular provider to/from
 *     billed-on-terms (bypasses the patient payment flow at checkout).
 *   - Admin "Provider Assistance" page: toggle the same flag for an
 *     individual assistant. When ON, every prescription she submits is
 *     auto-marked paid and shipped without a patient receipt — same
 *     behavior as a billed-on-terms regular provider.
 *
 * Audit-logged for both paths.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { providerId, payOnTerms } = body as {
      providerId?: string;
      payOnTerms?: boolean;
    };

    if (!providerId || typeof providerId !== "string") {
      return NextResponse.json(
        { error: "Missing providerId" },
        { status: 400 },
      );
    }
    if (typeof payOnTerms !== "boolean") {
      return NextResponse.json(
        { error: "payOnTerms must be true or false" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    // Snapshot the existing value so the audit trail records old → new.
    // Non-fatal if it can't be read.
    const { data: beforeRow } = await supabase
      .from("providers")
      .select("id, pay_on_terms, user_id, first_name, last_name")
      .eq("id", providerId)
      .maybeSingle();

    if (!beforeRow) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    const { error } = await supabase
      .from("providers")
      .update({ pay_on_terms: payOnTerms })
      .eq("id", providerId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update billing flag. Please try again." },
        { status: 500 },
      );
    }

    // Audit (non-fatal). Mirrors the supervising-provider writer at
    // /api/provider/delegations/[id]/pay-on-terms so we have one
    // consistent who-changed-what story across both entry points.
    try {
      const targetName = `${beforeRow.first_name ?? ""} ${beforeRow.last_name ?? ""}`.trim() || "(unnamed)";
      await supabase.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        action: "PROVIDER_PAY_ON_TERMS_TOGGLE",
        details: `Admin (${user.email ?? user.id}) updated providers.pay_on_terms on provider ${providerId} (${targetName}, user_id ${beforeRow.user_id ?? "unknown"}): ${beforeRow.pay_on_terms === true ? "true" : "false"} → ${payOnTerms}.`,
        status: "success",
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      payOnTerms,
      message: payOnTerms
        ? "Billed on terms enabled. Patient payment flow is bypassed for this account."
        : "Billed on terms disabled. Patient payment flow is back to normal.",
    });
  } catch (err) {
    console.error("Error updating pay_on_terms:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
