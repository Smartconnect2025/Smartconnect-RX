import { NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { requirePlatformAdmin, createGuardErrorResponse } from "@/core/auth/api-guards";

export async function GET() {
  const adminCheck = await requirePlatformAdmin();
  if (!adminCheck.success) return createGuardErrorResponse(adminCheck);

  try {
    const supabase = createAdminClient();

    const [pharmaciesResult, linksResult, providersResult, prescriptionsResult] = await Promise.all([
      supabase
        .from("pharmacies")
        .select("id, name, slug, is_active, logo_url")
        .order("name"),

      supabase
        .from("provider_pharmacy_links")
        .select("pharmacy_id, provider_id"),

      supabase
        .from("providers")
        .select("user_id, is_active"),

      supabase
        .from("prescriptions")
        .select("pharmacy_id, total_paid_cents"),
    ]);

    if (pharmaciesResult.error) {
      return NextResponse.json(
        { success: false, error: pharmaciesResult.error.message },
        { status: 500 }
      );
    }

    if (linksResult.error || providersResult.error || prescriptionsResult.error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch metrics data" },
        { status: 500 }
      );
    }

    const providerActiveMap = new Map<string, boolean>();
    for (const p of providersResult.data || []) {
      providerActiveMap.set(p.user_id, p.is_active);
    }

    const linksByPharmacy = new Map<string, string[]>();
    for (const link of linksResult.data || []) {
      const list = linksByPharmacy.get(link.pharmacy_id) || [];
      list.push(link.provider_id);
      linksByPharmacy.set(link.pharmacy_id, list);
    }

    const ordersByPharmacy = new Map<string, { count: number; revenueCents: number }>();
    for (const rx of prescriptionsResult.data || []) {
      if (!rx.pharmacy_id) continue;
      const entry = ordersByPharmacy.get(rx.pharmacy_id) || { count: 0, revenueCents: 0 };
      entry.count++;
      entry.revenueCents += rx.total_paid_cents || 0;
      ordersByPharmacy.set(rx.pharmacy_id, entry);
    }

    const pharmacyMetrics = (pharmaciesResult.data || []).map((pharmacy) => {
      const providerIds = linksByPharmacy.get(pharmacy.id) || [];
      const activeProviders = providerIds.filter((pid) => providerActiveMap.get(pid) === true).length;
      const orders = ordersByPharmacy.get(pharmacy.id) || { count: 0, revenueCents: 0 };

      return {
        id: pharmacy.id,
        name: pharmacy.name,
        slug: pharmacy.slug,
        is_active: pharmacy.is_active,
        logo_url: pharmacy.logo_url,
        provider_count: providerIds.length,
        active_providers: activeProviders,
        order_count: orders.count,
        total_revenue_cents: orders.revenueCents,
      };
    });

    return NextResponse.json({
      success: true,
      pharmacyMetrics,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
