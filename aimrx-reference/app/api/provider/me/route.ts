import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

/**
 * GET /api/provider/me
 *
 * Returns the caller's full providers row using the admin client (bypasses
 * RLS, which on the providers table is currently restrictive). Self-heals
 * a missing providers row for active delegates that were approved before
 * the auto-provisioning code in /api/admin/delegations/[id]/approve was
 * added — without this, the assistant has no row and her profile page is
 * empty.
 *
 * For delegates we additionally attach `authorizing_provider_*` fields and
 * overlay the authorizing provider's NPI on the returned row, so the
 * profile UI shows the legal prescriber's NPI (the one stamped on every
 * Rx she submits).
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Self-heal a missing providers row for delegates that were approved
  // before the auto-provisioning code was added.
  let { data: providerRow } = await admin
    .from("providers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerRow && roleRow?.role === "delegate") {
    const { data: delegation } = await admin
      .from("delegations")
      .select(
        "delegate_first_name, delegate_last_name, delegate_email, delegate_phone",
      )
      .eq("delegate_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (delegation) {
      const { data: created } = await admin
        .from("providers")
        .upsert(
          {
            user_id: user.id,
            first_name: delegation.delegate_first_name,
            last_name: delegation.delegate_last_name,
            email: delegation.delegate_email,
            phone_number: delegation.delegate_phone,
            is_active: true,
          },
          { onConflict: "user_id", ignoreDuplicates: false },
        )
        .select("*")
        .maybeSingle();
      providerRow = created;
    }
  }

  if (!providerRow) {
    return NextResponse.json(
      { error: "Provider not found", profile: null },
      { status: 404 },
    );
  }

  // Attach authorizing provider info for the assistant banner.
  if (roleRow?.role === "delegate") {
    const { data: delegation } = await admin
      .from("delegations")
      .select("provider_id, delegate_title")
      .eq("delegate_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (delegation?.provider_id) {
      const { data: authorizing } = await admin
        .from("providers")
        .select("prefix, first_name, last_name, npi_number")
        .eq("id", delegation.provider_id)
        .maybeSingle();
      if (authorizing) {
        return NextResponse.json({
          profile: {
            ...providerRow,
            // Display the authorizing provider's NPI — that's the legal
            // prescriber's NPI stamped on every Rx the assistant submits.
            npi_number: authorizing.npi_number || providerRow.npi_number,
            is_delegate_view: true,
            authorizing_provider_prefix: authorizing.prefix,
            authorizing_provider_first_name: authorizing.first_name,
            authorizing_provider_last_name: authorizing.last_name,
            authorizing_provider_npi: authorizing.npi_number,
            delegate_title: delegation.delegate_title || "Provider Assistant",
          },
        });
      }
    }
  }

  return NextResponse.json({ profile: providerRow });
}
