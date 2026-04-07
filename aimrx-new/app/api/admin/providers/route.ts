import { NextResponse, NextRequest } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";

export async function GET(request: NextRequest) {
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

    const supabase = createAdminClient();
    const isSuperAdmin = userRole === "super_admin";

    let scopePharmacyId: string | null = null;

    if (!isSuperAdmin) {
      const scope = await getPharmacyAdminScope(user.id);

      if (scope.isPharmacyAdmin && !scope.pharmacyId) {
        return NextResponse.json(
          { error: "Unable to determine pharmacy scope" },
          { status: 403 },
        );
      }

      if (scope.isPharmacyAdmin && scope.pharmacyId) {
        scopePharmacyId = scope.pharmacyId;
      }
    }

    const filterPharmacyId = scopePharmacyId || (isSuperAdmin ? request.nextUrl.searchParams.get("pharmacyId") : null);

    let providerUserIds: string[];

    if (filterPharmacyId) {
      const { data: linkedProviders, error: linkError } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id")
        .eq("pharmacy_id", filterPharmacyId);

      if (linkError) {
        return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
      }

      providerUserIds = (linkedProviders || []).map((l: { provider_id: string }) => l.provider_id);
      if (providerUserIds.length === 0) {
        return NextResponse.json({ providers: [], total: 0 });
      }
    } else {
      const { data: providerUsers, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "provider");

      if (roleError) {
        console.error("Error fetching provider roles:", roleError);
        return NextResponse.json(
          { error: "Failed to fetch providers" },
          { status: 500 },
        );
      }
      providerUserIds = providerUsers?.map((u) => u.user_id) || [];
    }

    if (providerUserIds.length === 0) {
      return NextResponse.json({ providers: [], total: 0 });
    }

    const { data: demoRows } = await supabase
      .from("user_roles")
      .select("user_id, is_demo")
      .in("user_id", providerUserIds);
    const demoMap = new Map(
      (demoRows || []).map((u) => [u.user_id, u.is_demo || false]),
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

    const allProviderUserIds = (providers || []).map((p) => p.user_id).filter(Boolean);
    let pharmacyLinksMap = new Map<string, string[]>();
    if (allProviderUserIds.length > 0) {
      const { data: allLinks } = await supabase
        .from("provider_pharmacy_links")
        .select("provider_id, pharmacy_id")
        .in("provider_id", allProviderUserIds);

      if (allLinks && allLinks.length > 0) {
        const pharmacyIds = [...new Set(allLinks.map((l) => l.pharmacy_id))];
        const { data: pharmacyRows } = await supabase
          .from("pharmacies")
          .select("id, name")
          .in("id", pharmacyIds);
        const pharmacyNameMap = new Map((pharmacyRows || []).map((p) => [p.id, p.name]));

        for (const link of allLinks) {
          const names = pharmacyLinksMap.get(link.provider_id) || [];
          const name = pharmacyNameMap.get(link.pharmacy_id);
          if (name) names.push(name);
          pharmacyLinksMap.set(link.provider_id, names);
        }
      }
    }

    const { data: tiers } = await supabase.from("tiers").select("*");
    const tierMap = new Map(tiers?.map((t) => [t.tier_code, t]) || []);

    const transformedProviders =
      providers?.map((provider) => {
        const tierCode = provider.tier_level;
        const tier = tierCode ? tierMap.get(tierCode) : null;

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
          company_name: provider.company_name || null,
          pharmacy_names: pharmacyLinksMap.get(provider.user_id) || [],
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
