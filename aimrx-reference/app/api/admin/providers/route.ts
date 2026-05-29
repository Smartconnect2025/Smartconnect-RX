/**
 * Admin Providers API
 *
 * Endpoint for admin users to fetch provider data
 * Only accessible to users with admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function GET(request: NextRequest) {
  try {
    // Check if the current user is an admin
    const { user, userRole } = await getUser();

    // Optional query: ?includeDelegates=true also returns active provider
    // assistants (delegates) so the admin Reporting & Analytics filter
    // can scope a report to a single assistant. Each delegate row is
    // tagged with `is_delegate: true` and carries `delegation_id` plus
    // `supervising_provider_*` so the UI can label it as
    // "Jane Smith (Assistant of Dr. Brown)".
    const includeDelegates =
      request.nextUrl.searchParams.get("includeDelegates") === "true";

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

    const { data: providerUsers, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id, is_demo")
      .eq("role", "provider");

    if (roleError) {
      console.error("Error fetching provider roles:", roleError);
      return NextResponse.json(
        { error: "Failed to fetch providers" },
        { status: 500 },
      );
    }

    const providerUserIds = providerUsers?.map((u) => u.user_id) || [];
    const demoMap = new Map(
      (providerUsers || []).map((u) => [u.user_id, u.is_demo || false]),
    );
    const { data: providers, error } = await supabase
      .from("providers")
      .select("*")
      .in("user_id", providerUserIds);

    if (error) {
      console.error("Error fetching providers:", error);
      return NextResponse.json(
        { error: "Failed to fetch providers" },
        { status: 500 },
      );
    }

    // Fetch all tiers for lookup
    const { data: tiers } = await supabase.from("tiers").select("*");
    const tierMap = new Map(tiers?.map((t) => [t.tier_code, t]) || []);


    // Transform the data to match the expected format
    const transformedProviders =
      providers?.map((provider) => {
        // Get tier info from provider's tier_level column and tiers table
        const tierCode = provider.tier_level;
        const tier = tierCode ? tierMap.get(tierCode) : null;

        // Check if profile is complete (payment details, addresses filled)
        const hasPaymentDetails =
          provider.payment_details &&
          typeof provider.payment_details === "object" &&
          Object.keys(provider.payment_details).length > 0;
        const hasPhysicalAddress =
          provider.physical_address &&
          typeof provider.physical_address === "object" &&
          Object.keys(provider.physical_address).length > 0;
        const hasBillingAddress =
          provider.billing_address &&
          typeof provider.billing_address === "object" &&
          Object.keys(provider.billing_address).length > 0;

        const profileComplete =
          hasPaymentDetails && hasPhysicalAddress && hasBillingAddress;

        // Status logic:
        // - "pending" if profile is incomplete (even if is_active is true)
        // - "active" only if profile is complete AND is_active is true
        // - "inactive" if is_active is false and profile is complete
        let status = "pending";
        if (profileComplete) {
          status = provider.is_active ? "active" : "inactive";
        }

        return {
          id: provider.id,
          prefix: provider.prefix || null,
          first_name: provider.first_name || "",
          last_name: provider.last_name || "",
          email: provider.email || "",
          phone_number: provider.phone_number || null,
          avatar_url: provider.avatar_url || "",
          npi_number: provider.npi_number || null,
          specialty: provider.specialty || "",
          licensed_states: provider.licensed_states || [],
          service_types: provider.service_types || [],
          insurance_plans: provider.insurance_plans || [],
          created_at: provider.created_at,
          status: status,
          role: "provider",
          is_verified: provider.is_verified || false,
          tier_level: tier
            ? `${tier.tier_name} (${tier.discount_percentage}%)`
            : "Not set",
          tier_code: tierCode || null,
          is_active: provider.is_active || false,
          user_id: provider.user_id || "",
          is_demo: demoMap.get(provider.user_id) || false,
          physical_address: provider.physical_address || null,
          billing_address: provider.billing_address || null,
          payment_details: provider.payment_details || null,
          payment_method: provider.payment_method || null,
          payment_schedule: provider.payment_schedule || null,
          tax_id: provider.tax_id || null,
          medical_licenses: provider.medical_licenses || null,
          company_name: provider.company_name || null,
          // Delegate-only fields — null for actual providers.
          is_delegate: false,
          delegation_id: null as string | null,
          supervising_provider_id: null as string | null,
          supervising_provider_name: null as string | null,
        };
      }) || [];

    // ---- Optional: append delegates (provider assistants) ----
    // Only when ?includeDelegates=true. We return one entry per active
    // delegation (status active or pending_delegate) whose assistant has
    // a provisioned providers row (admins create one at approval time).
    const delegateEntries: typeof transformedProviders = [];
    if (includeDelegates) {
      const { data: delegations, error: delErr } = await supabase
        .from("delegations")
        .select(
          "id, delegate_user_id, delegate_first_name, delegate_last_name, delegate_email, provider_id, status",
        )
        .in("status", ["active", "pending_delegate"])
        .not("delegate_user_id", "is", null);

      if (delErr) {
        console.error("Error fetching delegations for providers list:", delErr);
      } else if (delegations && delegations.length > 0) {
        // Look up the supervising provider's name for every delegation.
        const supervisorIds = [
          ...new Set(delegations.map((d) => d.provider_id).filter(Boolean)),
        ];
        const { data: supervisors } = await supabase
          .from("providers")
          .select("id, prefix, first_name, last_name")
          .in("id", supervisorIds);
        const supervisorMap = new Map(
          (supervisors || []).map((s) => [s.id, s]),
        );

        // Look up the delegate's own providers row (provisioned at admin
        // approval) — its `id` is what the report groups by. If a delegate
        // somehow has no providers row we skip the entry (defensive).
        const delegateUserIds = delegations
          .map((d) => d.delegate_user_id)
          .filter((u): u is string => !!u);
        const { data: delegateProviders } = await supabase
          .from("providers")
          .select(
            "id, user_id, prefix, first_name, last_name, email, npi_number, is_active, created_at",
          )
          .in("user_id", delegateUserIds);
        const delegateProviderByUserId = new Map(
          (delegateProviders || []).map((p) => [p.user_id, p]),
        );

        for (const d of delegations) {
          if (!d.delegate_user_id) continue;
          const dp = delegateProviderByUserId.get(d.delegate_user_id);
          if (!dp) continue; // assistant not yet provisioned — skip
          const sup = supervisorMap.get(d.provider_id);
          const supervisorName = sup
            ? `${(sup as { prefix?: string | null }).prefix || "Dr."} ${sup.first_name || ""} ${sup.last_name || ""}`.trim() ||
              "Unknown"
            : "Unknown";
          delegateEntries.push({
            id: dp.id,
            prefix: (dp as { prefix?: string | null }).prefix || null,
            first_name: d.delegate_first_name || dp.first_name || "",
            last_name: d.delegate_last_name || dp.last_name || "",
            email: d.delegate_email || dp.email || "",
            phone_number: null,
            avatar_url: "",
            npi_number: dp.npi_number || null,
            specialty: "",
            licensed_states: [],
            service_types: [],
            insurance_plans: [],
            created_at: dp.created_at,
            status: d.status === "active" ? "active" : "pending",
            role: "delegate",
            is_verified: false,
            tier_level: "Not set",
            tier_code: null,
            is_active: dp.is_active || false,
            user_id: dp.user_id || "",
            is_demo: false,
            physical_address: null,
            billing_address: null,
            payment_details: null,
            payment_method: null,
            payment_schedule: null,
            tax_id: null,
            medical_licenses: null,
            company_name: null,
            is_delegate: true,
            delegation_id: d.id,
            supervising_provider_id: d.provider_id,
            supervising_provider_name: supervisorName,
          });
        }
      }
    }

    const combined = [...transformedProviders, ...delegateEntries];

    return NextResponse.json({
      providers: combined,
      total: combined.length,
    });
  } catch (error) {
    console.error("Error listing providers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
