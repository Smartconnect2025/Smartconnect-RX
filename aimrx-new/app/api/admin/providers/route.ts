/**
 * Admin Providers API
 *
 * Endpoint for admin users to fetch provider data
 * Only accessible to users with admin role
 */

import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET() {
  try {
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

    const scope = await getPharmacyAdminScope(user.id);
    const supabase = createAdminClient();

    if (scope.isPharmacyAdmin && !scope.pharmacyId) {
      return NextResponse.json(
        { error: "Unable to determine pharmacy scope" },
        { status: 403 },
      );
    }

    if (scope.isPharmacyAdmin && scope.pharmacyId) {
      const { data: linkedProviders, error: linkError } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", scope.pharmacyId);

      if (linkError) {
        return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
      }

      const linkedProviderIds = (linkedProviders || []).map((l: { provider_id: string }) => l.provider_id);
      if (linkedProviderIds.length === 0) {
        return NextResponse.json({ providers: [] });
      }

      const { data: providers, error } = await supabase
        .from("providers")
        .select("*")
        .in("user_id", linkedProviderIds);

      if (error) {
        return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
      }

      const providerData = await Promise.all(
        (providers || []).map(async (provider) => {
          const { data: userData } = await supabase.auth.admin.getUserById(provider.user_id);
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("is_demo")
            .eq("user_id", provider.user_id)
            .single();
          return {
            ...provider,
            email: userData?.user?.email || "Unknown",
            is_demo: roleData?.is_demo || false,
          };
        })
      );

      return NextResponse.json({ providers: providerData });
    }

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

    // Fetch all groups and platform managers for lookup
    const { data: groups } = await supabase.from("groups").select("*");
    const groupMap = new Map((groups || []).map((g) => [g.id, g]));

    const pmIds = [...new Set((groups || []).map((g) => g.platform_manager_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length > 0) {
      const { data: pms } = await supabase.from("platform_managers").select("id, name").in("id", pmIds);
      pmMap = new Map((pms || []).map((pm) => [pm.id, pm.name]));
    }

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
          group_id: provider.group_id || null,
          group_name: provider.group_id ? (groupMap.get(provider.group_id)?.name || null) : null,
          platform_manager_name: provider.group_id
            ? (pmMap.get(groupMap.get(provider.group_id)?.platform_manager_id || "") || null)
            : null,
        };
      }) || [];

    return NextResponse.json({
      providers: transformedProviders,
      total: transformedProviders.length,
    });
  } catch (error) {
    console.error("Error listing providers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
