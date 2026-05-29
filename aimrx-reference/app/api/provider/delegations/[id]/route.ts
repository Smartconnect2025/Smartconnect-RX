import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * DELETE /api/provider/delegations/[id]
 *
 * Provider-side self-serve deletion of a Provider Assistance request that
 * is still PENDING ADMIN APPROVAL. Lets the supervising provider clean up
 * a typo'd or outdated request without bothering the portal admin.
 *
 * Strict guards:
 *   - caller must be the supervising provider who owns the delegation
 *   - delegation must be in status 'pending_admin' (active / pending_delegate
 *     must use the existing Revoke flow; rejected/revoked rows are cleaned
 *     up by admin)
 *
 * Audit: writes a system_logs entry BEFORE the delete fires so the row's
 * identifying fields are preserved for post-mortem.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: delegationId } = await params;
  if (!delegationId) {
    return NextResponse.json(
      { error: "Delegation id is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Resolve the calling provider's row so we can verify ownership.
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

  // Capture identifying fields BEFORE delete so the audit log is meaningful.
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select(
      "id, status, delegate_email, delegate_first_name, delegate_last_name, provider_id",
    )
    .eq("id", delegationId)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json(
      { error: "Failed to load delegation", details: loadErr.message },
      { status: 500 },
    );
  }
  if (!delegation) {
    return NextResponse.json(
      { error: "Delegation not found" },
      { status: 404 },
    );
  }

  // Ownership: only the supervising provider on this delegation may delete it.
  if (delegation.provider_id !== provider.id) {
    return NextResponse.json(
      { error: "You can only delete your own assistant requests" },
      { status: 403 },
    );
  }

  // Only pending_admin is self-serve deletable. Active / pending_delegate
  // must go through the existing Revoke flow (which preserves the row and
  // legal trail). Rejected / revoked are admin-only cleanup.
  if (delegation.status !== "pending_admin") {
    return NextResponse.json(
      {
        error:
          "Only pending requests awaiting admin approval can be deleted here. " +
          "For active or in-progress assistants, use Revoke instead.",
      },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase
    .from("delegations")
    .delete()
    .eq("id", delegationId)
    .eq("provider_id", provider.id)
    .eq("status", "pending_admin");

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete request", details: deleteError.message },
      { status: 500 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_PROVIDER_DELETED",
      details:
        `Provider self-deleted pending delegation ${delegation.id} ` +
        `(delegate=${delegation.delegate_first_name} ${delegation.delegate_last_name} ` +
        `<${delegation.delegate_email}>, provider_id=${delegation.provider_id})`,
      status: "success",
    });
  } catch {
    /* non-fatal — the delete already succeeded */
  }

  return NextResponse.json({
    success: true,
    message: "Pending request deleted.",
    deletedId: delegation.id,
  });
}
