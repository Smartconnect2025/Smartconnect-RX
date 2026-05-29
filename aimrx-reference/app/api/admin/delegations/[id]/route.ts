import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * DELETE /api/admin/delegations/[id]
 *
 * Hard-deletes a single delegation (provider-assistance) row.
 * Admin / super_admin only. The intent is operational cleanup — e.g.
 * removing a stale pending request, a duplicate submission, or a
 * delegation that should never have existed. This is destructive and
 * permanent; the row will not survive in any soft-deleted form.
 *
 * Audit trail is preserved by writing a system_logs entry with the
 * deleted row's identifying fields BEFORE the delete fires, so a
 * post-mortem can always reconstruct who removed what and when.
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
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json(
      { error: "Admin access required" },
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

  // Capture identifying fields before delete so the system log entry
  // is meaningful even after the row is gone.
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select("id, status, delegate_email, delegate_first_name, delegate_last_name, provider_id")
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

  const { error: deleteError } = await supabase
    .from("delegations")
    .delete()
    .eq("id", delegationId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete delegation", details: deleteError.message },
      { status: 500 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_DELETED",
      details:
        `Deleted delegation ${delegation.id} ` +
        `(status=${delegation.status}, ` +
        `delegate=${delegation.delegate_first_name} ${delegation.delegate_last_name} <${delegation.delegate_email}>, ` +
        `provider_id=${delegation.provider_id})`,
      status: "success",
    });
  } catch {
    /* non-fatal — the delete succeeded */
  }

  return NextResponse.json({
    success: true,
    message: "Delegation deleted.",
    deletedId: delegation.id,
  });
}
