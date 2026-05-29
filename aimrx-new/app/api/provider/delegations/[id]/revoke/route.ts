import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * POST /api/provider/delegations/[id]/revoke
 * Body: { reason?: string }
 *
 * Provider one-click revoke. Verifies the delegation belongs to a provider
 * record owned by the calling user, then flips the row to status='revoked'
 * with a CAS guard so a concurrent admin/provider revoke cannot overwrite.
 *
 * Past prescriptions submitted by the assistant are unaffected — they keep
 * their submitted_by_delegation_id pointer for audit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  // Allow provider OR admin; admin path will also be exposed from the admin UI.
  if (userRole !== "provider" && userRole !== "admin" && userRole !== "super_admin") {
    return NextResponse.json(
      { error: "Provider or admin access required" },
      { status: 403 },
    );
  }

  const { id: delegationId } = await params;

  let reason: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === "string" && body.reason.trim().length > 0) {
      reason = body.reason.trim().slice(0, 500);
    }
  } catch {
    /* optional */
  }

  const supabase = createAdminClient();

  // Load delegation + owning provider for ownership check
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select("id, status, provider_id, delegate_email, providers:provider_id(user_id, first_name, last_name)")
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

  // Provider may only revoke his own delegations. Admins may revoke any.
  if (userRole === "provider") {
    const ownerUserId = (delegation as unknown as {
      providers: { user_id: string | null } | null;
    }).providers?.user_id;
    if (ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "You can only revoke your own assistants" },
        { status: 403 },
      );
    }
  }

  if (delegation.status !== "active" && delegation.status !== "pending_delegate") {
    return NextResponse.json(
      {
        error: `Delegation is not in a revokable state (current: ${delegation.status})`,
      },
      { status: 409 },
    );
  }

  // CAS: only revoke if still in a revokable state. For provider-initiated
  // revokes we ALSO re-assert the provider_id ownership in the predicate so
  // a concurrent reassignment cannot make us revoke a row that is no longer
  // ours. Admin path skips this predicate (admins may revoke any).
  let updateQuery = supabase
    .from("delegations")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revoke_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delegationId)
    .in("status", ["active", "pending_delegate"]);

  if (userRole === "provider") {
    updateQuery = updateQuery.eq("provider_id", delegation.provider_id);
  }

  const { data: updatedRows, error: updateErr } = await updateQuery.select(
    "id",
  );

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to revoke delegation", details: updateErr.message },
      { status: 500 },
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Delegation status changed during revoke (likely already revoked). Refresh and try again.",
      },
      { status: 409 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_REVOKED",
      details: `Revoked delegation ${delegationId} for ${delegation.delegate_email}${reason ? ` — reason: ${reason}` : ""}`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    message: "Authorization revoked. The assistant can no longer act on your behalf.",
  });
}
