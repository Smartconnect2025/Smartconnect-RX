/**
 * POST /api/provider/delegations/[id]/pay-on-terms
 *
 * Lets a SUPERVISING PROVIDER toggle the `pay_on_terms` flag on one of
 * their own assistants. The flag is stored on the assistant's own
 * `providers.pay_on_terms`. When ON, every prescription the assistant
 * submits is auto-marked paid and shipped without a patient receipt —
 * same behavior as a billed-on-terms regular provider.
 *
 * Body: { payOnTerms: boolean }
 *
 * Auth: caller must be a `provider` role AND the delegation's
 * `provider_id` must match the caller's own `providers.id`. The
 * assistant must already be provisioned (delegation has
 * `delegate_user_id`) and the delegation must be `pending_delegate`
 * or `active` — otherwise the write is rejected so a stranded toggle
 * cannot reappear if the assistant is later re-delegated.
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

  let body: { payOnTerms?: boolean };
  try {
    body = (await request.json()) as { payOnTerms?: boolean };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (typeof body.payOnTerms !== "boolean") {
    return NextResponse.json(
      { error: "payOnTerms must be true or false" },
      { status: 400 },
    );
  }
  const payOnTerms: boolean = body.payOnTerms;

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
  // Block writes against rejected/revoked delegations so the toggle
  // can't strand on an assistant who's later re-delegated under a new
  // row.
  if (
    delegation.status !== "pending_delegate" &&
    delegation.status !== "active"
  ) {
    return NextResponse.json(
      {
        error:
          "Billing flag can only be set on active or pending-onboarding assistants. This delegation is " +
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
          "This assistant has not finished onboarding yet. You can set their billing flag once their account has been activated.",
      },
      { status: 409 },
    );
  }

  // Look up the assistant's own providers row.
  const { data: assistantProvider, error: apErr } = await supabase
    .from("providers")
    .select("id, pay_on_terms")
    .eq("user_id", delegation.delegate_user_id)
    .maybeSingle();
  if (apErr || !assistantProvider) {
    return NextResponse.json(
      {
        error:
          "Assistant has no provider profile yet. Cannot set billing flag until they sign in for the first time.",
      },
      { status: 409 },
    );
  }

  const { error: updErr } = await supabase
    .from("providers")
    .update({ pay_on_terms: payOnTerms })
    .eq("id", assistantProvider.id);
  if (updErr) {
    return NextResponse.json(
      { error: "Failed to update billing flag", details: updErr.message },
      { status: 500 },
    );
  }

  // Audit (non-fatal).
  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_PAY_ON_TERMS_TOGGLE",
      details: `Provider toggled pay_on_terms for assistant ${delegation.delegate_email} (delegation ${delegation.id}): ${assistantProvider.pay_on_terms === true ? "true" : "false"} → ${payOnTerms}.`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    payOnTerms,
    message: payOnTerms
      ? "Billed on terms enabled for this assistant. Her prescriptions will be auto-paid (no patient receipt)."
      : "Billed on terms disabled for this assistant. Her prescriptions will go through the normal patient payment flow.",
  });
}
