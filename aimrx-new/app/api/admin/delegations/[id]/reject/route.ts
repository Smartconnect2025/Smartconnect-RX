import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * POST /api/admin/delegations/[id]/reject
 * Body: { reason: string }
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
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const { id: delegationId } = await params;
  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason || reason.length < 10) {
    return NextResponse.json(
      { error: "Rejection reason must be at least 10 characters" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Load + verify state
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select("id, status, delegate_email, provider_id")
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
  if (delegation.status !== "pending_admin") {
    return NextResponse.json(
      {
        error: `Delegation is not awaiting admin approval (status: ${delegation.status})`,
      },
      { status: 409 },
    );
  }

  // Compare-and-swap: only flip if still pending_admin. Prevents a
  // concurrent approval from being overwritten by a late reject.
  const { data: updatedRows, error: updateError } = await supabase
    .from("delegations")
    .update({
      status: "rejected",
      admin_user_id: user.id,
      admin_action_at: new Date().toISOString(),
      admin_rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delegationId)
    .eq("status", "pending_admin")
    .select("id");

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to reject delegation", details: updateError.message },
      { status: 500 },
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Delegation status changed during reject (likely actioned by another admin). Refresh and try again.",
      },
      { status: 409 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_REJECTED",
      details: `Rejected delegation ${delegationId} for ${delegation.delegate_email}: ${reason}`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ success: true, message: "Delegation rejected." });
}
