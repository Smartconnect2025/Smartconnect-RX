import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * GET /api/delegate/me
 * Returns delegations for the calling user (any status), used by:
 *   - first-login acknowledgment page (filters status='pending_delegate' & unsigned)
 *   - delegate dashboard (active list)
 */
export async function GET() {
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

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("delegations")
    .select(
      "id, status, delegate_first_name, delegate_last_name, delegate_title, scope_refills, scope_new_rx, agreement_version, agreement_text_snapshot, delegate_signed_at, providers:provider_id(id, user_id, prefix, first_name, last_name, npi_number, phone_number, signature_url, physical_address, company_name, is_active)",
    )
    .eq("delegate_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load delegations", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ delegations: data ?? [] });
}
