import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * Toggle a pharmacy's patient-fee visibility flags.
 * PATCH /api/admin/pharmacies/[id]/fee-flags
 *
 * Admin / super_admin only. Writes ONLY the three recognized boolean flags and
 * records an audit row in system_logs. Uses the service-role client for the
 * write because the pharmacies UPDATE RLS policy only matches role='admin'.
 */

const FLAG_COLUMNS = [
  "show_delivery_fee",
  "show_technology_fee",
  "show_provider_fee",
] as const;

type FlagColumn = (typeof FLAG_COLUMNS)[number];

const FLAG_LABELS: Record<FlagColumn, string> = {
  show_delivery_fee: "Delivery fee",
  show_technology_fee: "Technology fee",
  show_provider_fee: "Provider charges",
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: pharmacyId } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Admin access required." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const updates: Partial<Record<FlagColumn, boolean>> = {};
  for (const col of FLAG_COLUMNS) {
    if (typeof body[col] === "boolean") updates[col] = body[col];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid fee flags provided" },
      { status: 400 },
    );
  }

  // Service-role client: the pharmacies UPDATE RLS policy only matches
  // role='admin', so a super_admin on a normal client would be blocked.
  const supabaseAdmin = createAdminClient();

  const { data: beforeRow } = await supabaseAdmin
    .from("pharmacies")
    .select(
      "id, name, show_delivery_fee, show_technology_fee, show_provider_fee",
    )
    .eq("id", pharmacyId)
    .maybeSingle();
  if (!beforeRow) {
    return NextResponse.json(
      { success: false, error: "Pharmacy not found" },
      { status: 404 },
    );
  }

  const { data: updated, error } = await supabaseAdmin
    .from("pharmacies")
    .update(updates)
    .eq("id", pharmacyId)
    .select(
      "id, show_delivery_fee, show_technology_fee, show_provider_fee",
    )
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  const changes = (Object.keys(updates) as FlagColumn[])
    .map(
      (col) =>
        `${FLAG_LABELS[col]} (${col}): ${(beforeRow as Record<string, unknown>)[col]} -> ${updates[col]}`,
    )
    .join(", ");

  // Audit (non-fatal).
  await supabaseAdmin.from("system_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    user_name: user.email ?? "admin",
    action: "PHARMACY_FEE_FLAGS_TOGGLE",
    details: `Admin updated patient fee visibility on pharmacy ${beforeRow.name} (${pharmacyId}): ${changes}.`,
    status: "success",
  });

  return NextResponse.json({ success: true, pharmacy: updated });
}
