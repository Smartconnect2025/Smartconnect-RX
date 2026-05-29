import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";

/**
 * GET /api/admin/delegations
 *
 * Lists delegations for the admin "Provider Assistance" tab.
 * Optional ?status=pending_admin (default: all)
 */
export async function GET(request: NextRequest) {
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

  const supabase = createAdminClient();
  const status = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("delegations")
    .select(
      `
      id,
      delegate_first_name,
      delegate_last_name,
      delegate_email,
      delegate_phone,
      delegate_title,
      delegate_user_id,
      scope_refills,
      scope_new_rx,
      status,
      provider_signed_at,
      admin_action_at,
      admin_rejection_reason,
      revoked_at,
      revoke_reason,
      created_at,
      provider_id,
      providers:provider_id (
        id,
        prefix,
        first_name,
        last_name,
        npi_number,
        company_name,
        email
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/delegations GET]", error);
    return NextResponse.json(
      { error: "Failed to load delegations", details: error.message },
      { status: 500 },
    );
  }

  // Look up each assistant's own `providers` row (Provider Assistance — the
  // assistant is provisioned as a regular provider with company_name = NULL,
  // and the admin assigns a clinic via the Company Name dropdown). Returns
  // null on the row when the assistant hasn't been provisioned yet (legacy
  // pre-feature delegations).
  const delegations = data ?? [];
  const delegateUserIds = delegations
    .map((d) => d.delegate_user_id)
    .filter((id): id is string => Boolean(id));

  const assistantProviderMap = new Map<
    string,
    {
      id: string;
      company_name: string | null;
      tier_code: string | null;
      tier_name: string | null;
      discount_percentage: number | null;
      // `pay_on_terms` mirrors the per-provider billed-on-terms flag onto
      // the assistant's own providers row. When true, every prescription
      // she submits bypasses the patient payment flow (auto-paid, no
      // patient receipt). The admin "Provider Assistance" page surfaces
      // this so the toggle can be flipped per-assistant.
      pay_on_terms: boolean;
    }
  >();
  if (delegateUserIds.length > 0) {
    const { data: assistantProviders } = await supabase
      .from("providers")
      .select("id, user_id, company_name, tier_level, pay_on_terms")
      .in("user_id", delegateUserIds);

    // Sub-lookup tier metadata for any tier_levels in use, so the admin UI
    // can show the assistant's currently-assigned tier (and per-assistant
    // override) without an extra round-trip per card.
    const distinctTierCodes = Array.from(
      new Set(
        (assistantProviders ?? [])
          .map((p) => p.tier_level)
          .filter((c): c is string => Boolean(c)),
      ),
    );
    const tierMetaMap = new Map<
      string,
      { tier_name: string; discount_percentage: number }
    >();
    if (distinctTierCodes.length > 0) {
      const { data: tiersData } = await supabase
        .from("tiers")
        .select("tier_code, tier_name, discount_percentage")
        .in("tier_code", distinctTierCodes);
      (tiersData ?? []).forEach((t) => {
        if (t.tier_code) {
          tierMetaMap.set(t.tier_code, {
            tier_name: t.tier_name,
            discount_percentage: parseFloat(
              String(t.discount_percentage ?? "0"),
            ),
          });
        }
      });
    }

    (assistantProviders ?? []).forEach((p) => {
      if (p.user_id) {
        const meta = p.tier_level ? tierMetaMap.get(p.tier_level) ?? null : null;
        assistantProviderMap.set(p.user_id, {
          id: p.id,
          company_name: p.company_name ?? null,
          tier_code: p.tier_level ?? null,
          tier_name: meta?.tier_name ?? null,
          discount_percentage: meta?.discount_percentage ?? null,
          pay_on_terms: p.pay_on_terms === true,
        });
      }
    });
  }

  // Also collect the existing company list (same source the providers admin
  // page uses) so the UI can render a Select dropdown of clinics.
  const { data: allProviderCompanies } = await supabase
    .from("providers")
    .select("company_name");
  const companies = Array.from(
    new Set(
      (allProviderCompanies ?? [])
        .map((p) => (p.company_name ?? "").trim())
        .filter((c) => c.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  // Look up each assistant's delegate_profile (physical + billing addresses).
  // Strictly read-only. Chunked .in() lookup so the request stays well below
  // PostgREST/Supabase URL-length limits even with hundreds of delegations.
  // No per-card fetches in the UI.
  const delegateProfileMap = new Map<
    string,
    { physical_address: unknown; billing_address: unknown }
  >();
  if (delegateUserIds.length > 0) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < delegateUserIds.length; i += CHUNK_SIZE) {
      const chunk = delegateUserIds.slice(i, i + CHUNK_SIZE);
      const { data: delegateProfiles, error: profilesError } = await supabase
        .from("delegate_profiles")
        .select("delegate_user_id, physical_address, billing_address")
        .in("delegate_user_id", chunk);
      if (profilesError) {
        console.error("[admin/delegations GET] delegate_profiles", profilesError);
        return NextResponse.json(
          {
            error: "Failed to load delegate profiles",
            details: profilesError.message,
          },
          { status: 500 },
        );
      }
      (delegateProfiles ?? []).forEach((p) => {
        if (p.delegate_user_id) {
          delegateProfileMap.set(p.delegate_user_id, {
            physical_address: p.physical_address ?? null,
            billing_address: p.billing_address ?? null,
          });
        }
      });
    }
  }

  const enriched = delegations.map((d) => ({
    ...d,
    assistant_provider:
      d.delegate_user_id && assistantProviderMap.has(d.delegate_user_id)
        ? assistantProviderMap.get(d.delegate_user_id)
        : null,
    delegate_profile:
      d.delegate_user_id && delegateProfileMap.has(d.delegate_user_id)
        ? delegateProfileMap.get(d.delegate_user_id)
        : { physical_address: null, billing_address: null },
  }));

  return NextResponse.json({ delegations: enriched, companies });
}
