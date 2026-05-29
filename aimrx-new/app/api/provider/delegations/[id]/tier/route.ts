/**
 * POST /api/provider/delegations/[id]/tier
 *
 * Lets a SUPERVISING PROVIDER set (or clear with `tierCode: null`) the
 * pricing tier override for one of their own assistants. The override is
 * stored on the assistant's `providers.tier_level`. Clearing it reverts
 * the assistant to the supervising provider's own tier.
 *
 * Body: { tierCode: string | null }
 *
 * Auth: caller must be a `provider` role AND the delegation's `provider_id`
 * must match the caller's own `providers.id`. The assistant must already be
 * provisioned (delegation has `delegate_user_id`).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: delegationId } = await params;

  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (userRole !== "provider") {
    return NextResponse.json(
      { error: "Provider access required" },
      { status: 403 },
    );
  }

  let body: { tierCode?: string | null };
  try {
    body = (await request.json()) as { tierCode?: string | null };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const tierCode = body.tierCode === undefined ? null : body.tierCode;
  if (
    tierCode !== null &&
    (typeof tierCode !== "string" || tierCode.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "tierCode must be a non-empty string or null" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Resolve the calling provider.
  const { data: provider, error: provErr } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (provErr || !provider) {
    return NextResponse.json(
      { error: "No provider record linked to this account" },
      { status: 404 },
    );
  }

  // Verify the delegation belongs to the calling provider AND has a
  // provisioned delegate.
  const { data: delegation, error: delegErr } = await supabase
    .from("delegations")
    .select("id, provider_id, delegate_user_id, delegate_email, status")
    .eq("id", delegationId)
    .maybeSingle();
  if (delegErr) {
    return NextResponse.json(
      { error: "Failed to load delegation", details: delegErr.message },
      { status: 500 },
    );
  }
  if (!delegation) {
    return NextResponse.json(
      { error: "Delegation not found" },
      { status: 404 },
    );
  }
  if (delegation.provider_id !== provider.id) {
    return NextResponse.json(
      { error: "This delegation does not belong to you" },
      { status: 403 },
    );
  }
  // Tier overrides only make sense while the delegation is in flight or
  // active. Block writes against rejected/revoked rows so a stranded
  // override can't silently reappear if the assistant is later
  // re-delegated under a fresh row.
  if (
    delegation.status !== "pending_delegate" &&
    delegation.status !== "active"
  ) {
    return NextResponse.json(
      {
        error:
          "Tier can only be set on active or pending-onboarding assistants. This delegation is " +
          delegation.status +
          ".",
      },
      { status: 409 },
    );
  }
  if (!delegation.delegate_user_id) {
    return NextResponse.json(
      {
        error:
          "This assistant has not finished onboarding yet. You can set their tier once their account has been activated.",
      },
      { status: 409 },
    );
  }

  // If a tier is being set, validate it exists.
  if (tierCode !== null) {
    const { data: tierRow } = await supabase
      .from("tiers")
      .select("tier_code")
      .eq("tier_code", tierCode)
      .maybeSingle();
    if (!tierRow) {
      return NextResponse.json(
        { error: "Unknown tier code" },
        { status: 400 },
      );
    }
  }

  // Look up the assistant's own providers row.
  const { data: assistantProvider, error: apErr } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", delegation.delegate_user_id)
    .maybeSingle();
  if (apErr || !assistantProvider) {
    return NextResponse.json(
      {
        error:
          "Assistant has no provider profile yet. Cannot set tier until they sign in for the first time.",
      },
      { status: 409 },
    );
  }

  // Update.
  const { error: updErr } = await supabase
    .from("providers")
    .update({ tier_level: tierCode })
    .eq("id", assistantProvider.id);
  if (updErr) {
    return NextResponse.json(
      { error: "Failed to update tier", details: updErr.message },
      { status: 500 },
    );
  }

  // Audit (non-fatal).
  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_TIER_SET",
      details:
        tierCode === null
          ? `Provider cleared tier override for assistant ${delegation.delegate_email} (delegation ${delegation.id}). Will fall back to supervisor tier.`
          : `Provider set tier "${tierCode}" for assistant ${delegation.delegate_email} (delegation ${delegation.id}).`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    tierCode,
    message:
      tierCode === null
        ? "Tier override cleared. Assistant will use your tier."
        : `Tier ${tierCode} set for this assistant.`,
  });
}
