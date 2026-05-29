import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import { hashAgreement } from "@core/lib/delegations/agreement";

/**
 * POST /api/delegate/acknowledge/[id]
 * Body: { signature: string }   // data-URL PNG from the signature pad
 *
 * Assistant acknowledges the agreement she was approved under. We verify:
 *   - she owns the row (delegate_user_id = me)
 *   - the row is currently pending_delegate
 *   - the agreement hash on the row still matches what we render in the UI
 *     (defensive — text snapshot is captured at request time and frozen)
 * Then we flip status='active'. The DB CHECK constraint
 * "delegations_active_requires_signature" enforces that
 * delegate_user_id + delegate_signed_at are both populated.
 */
function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function isLikelyDataUrlPng(s: string): boolean {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length > 200;
}

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
  if (userRole !== "delegate") {
    return NextResponse.json(
      { error: "Delegate access required" },
      { status: 403 },
    );
  }

  const { id: delegationId } = await params;

  let signature = "";
  try {
    const body = await request.json();
    signature = typeof body?.signature === "string" ? body.signature : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!signature || !isLikelyDataUrlPng(signature)) {
    return NextResponse.json(
      { error: "A signature is required to continue" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Load + verify ownership and state, AND re-hash the snapshot to defend
  // against the (extremely unlikely) case the snapshot was tampered with at rest.
  const { data: delegation, error: loadErr } = await supabase
    .from("delegations")
    .select(
      "id, status, delegate_user_id, agreement_text_snapshot, agreement_text_hash",
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
  if (delegation.delegate_user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only acknowledge your own authorization" },
      { status: 403 },
    );
  }
  if (delegation.status !== "pending_delegate") {
    return NextResponse.json(
      {
        error: `Delegation is not awaiting acknowledgment (status: ${delegation.status})`,
      },
      { status: 409 },
    );
  }

  const recomputed = hashAgreement(delegation.agreement_text_snapshot);
  if (recomputed !== delegation.agreement_text_hash) {
    return NextResponse.json(
      {
        error:
          "Agreement text checksum mismatch — please contact support before continuing.",
      },
      { status: 500 },
    );
  }

  const ip = getClientIp(request);
  const now = new Date().toISOString();

  // CAS: only flip if still pending_delegate.
  const { data: updatedRows, error: updateErr } = await supabase
    .from("delegations")
    .update({
      delegate_signature_url: signature,
      delegate_signed_at: now,
      delegate_signed_ip: ip,
      status: "active",
      updated_at: now,
    })
    .eq("id", delegationId)
    .eq("status", "pending_delegate")
    .eq("delegate_user_id", user.id)
    .select("id");

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to record acknowledgment", details: updateErr.message },
      { status: 500 },
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Delegation status changed during acknowledgment. Please refresh and try again.",
      },
      { status: 409 },
    );
  }

  try {
    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: "DELEGATION_ACKNOWLEDGED",
      details: `Delegate ${user.email} signed acknowledgment for delegation ${delegationId}`,
      status: "success",
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    message: "Acknowledgment recorded. Authorization is now active.",
  });
}
