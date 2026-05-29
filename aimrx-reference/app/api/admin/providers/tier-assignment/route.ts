import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";

/**
 * POST /api/admin/providers/tier-assignment
 *
 * Body: { providerId: string, tierCode: string | null }
 *
 * Sets (or clears with `tierCode: null`) the `tier_level` column on the
 * given providers row. Used by:
 *   - Admin "Providers" page: assign tier to a regular provider.
 *   - Admin "Provider Assistance" page: assign a per-assistant tier override.
 *     Clearing it (null) reverts the assistant to the supervising provider's
 *     tier (handled at runtime by `getEffectiveTierDiscountForUser`).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { providerId, tierCode } = body as {
      providerId?: string;
      tierCode?: string | null;
    };

    if (!providerId) {
      return NextResponse.json(
        { error: "Missing providerId" },
        { status: 400 }
      );
    }
    // tierCode may be `null` (clear the override) or a non-empty string.
    if (tierCode !== null && (typeof tierCode !== "string" || tierCode.trim().length === 0)) {
      return NextResponse.json(
        { error: "tierCode must be a non-empty string or null" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Normalize tierCode and validate it actually exists in the tiers
    // catalog before persisting. Without this, an admin could pin a
    // typo'd code on a provider/assistant and `getEffectiveTierDiscountForUser`
    // would silently return 0% (provider) or fall back to supervisor
    // (assistant) — both confusing and easy to miss.
    const normalizedTierCode =
      tierCode === null ? null : (tierCode as string).trim();

    if (normalizedTierCode !== null) {
      const { data: tierRow } = await supabase
        .from("tiers")
        .select("tier_code")
        .eq("tier_code", normalizedTierCode)
        .maybeSingle();
      if (!tierRow) {
        return NextResponse.json(
          { error: `Unknown tier code: ${normalizedTierCode}` },
          { status: 400 },
        );
      }
    }

    // Snapshot the existing tier so we can record old → new in the audit
    // trail. Non-fatal if it can't be read — we still proceed with the
    // update.
    const { data: beforeRow } = await supabase
      .from("providers")
      .select("id, tier_level, user_id")
      .eq("id", providerId)
      .maybeSingle();

    const { error } = await supabase
      .from("providers")
      .update({ tier_level: normalizedTierCode })
      .eq("id", providerId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update tier assignment. Please try again." },
        { status: 500 }
      );
    }

    // Audit (non-fatal). Mirrors the provider-side writer at
    // /api/provider/delegations/[id]/tier so we have one consistent
    // story for who-changed-what across both entry points.
    try {
      const beforeCode = beforeRow?.tier_level ?? null;
      await supabase.from("system_logs").insert({
        user_id: user.id,
        user_email: user.email ?? null,
        action: "PROVIDER_TIER_ASSIGNMENT",
        details: `Admin (${user.email ?? user.id}) updated providers.tier_level on provider ${providerId} (target user_id ${beforeRow?.user_id ?? "unknown"}): ${beforeCode ?? "(none)"} → ${normalizedTierCode ?? "(none)"}.`,
        status: "success",
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      success: true,
      message: normalizedTierCode === null
        ? "Tier override cleared."
        : "Tier assignment updated successfully",
    });
  } catch (error) {
    console.error("Error updating tier assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
