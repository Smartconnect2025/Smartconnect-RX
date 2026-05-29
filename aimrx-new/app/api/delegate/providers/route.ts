import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * GET /api/delegate/providers
 *
 * Returns the providers this delegate is currently authorized to act on
 * behalf of (status='active' delegations only). Used by the delegate
 * dashboard to populate the provider switcher.
 *
 * Returns: { providers: Array<{
 *   delegation_id, provider_id, provider_user_id,
 *   first_name, last_name, npi_number,
 *   scope_refills, scope_new_rx, delegate_title,
 * }> }
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
      `id, scope_refills, scope_new_rx, delegate_title,
       providers:provider_id (id, user_id, prefix, first_name, last_name, npi_number, is_active)`,
    )
    .eq("delegate_user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load providers", details: error.message },
      { status: 500 },
    );
  }

  type DelegationRow = {
    id: string;
    scope_refills: boolean;
    scope_new_rx: boolean;
    delegate_title: string;
    providers:
      | {
          id: string;
          user_id: string | null;
          prefix: string | null;
          first_name: string | null;
          last_name: string | null;
          npi_number: string | null;
          is_active: boolean | null;
        }
      | Array<{
          id: string;
          user_id: string | null;
          prefix: string | null;
          first_name: string | null;
          last_name: string | null;
          npi_number: string | null;
          is_active: boolean | null;
        }>
      | null;
  };

  const providers = ((data ?? []) as DelegationRow[])
    .map((row) => {
      const p = Array.isArray(row.providers) ? row.providers[0] : row.providers;
      if (!p || !p.user_id) return null;
      // Quietly drop providers who were deactivated after the delegation
      // became active. The submit endpoint also re-checks at submit time, so
      // this is just to keep the UI clean.
      if (p.is_active === false) return null;
      return {
        delegation_id: row.id,
        provider_id: p.id,
        provider_user_id: p.user_id,
        prefix: p.prefix,
        first_name: p.first_name,
        last_name: p.last_name,
        npi_number: p.npi_number,
        scope_refills: row.scope_refills,
        scope_new_rx: row.scope_new_rx,
        delegate_title: row.delegate_title,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ providers });
}
