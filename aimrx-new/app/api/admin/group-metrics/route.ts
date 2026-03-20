import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";
import { requirePlatformAdmin, createGuardErrorResponse } from "@core/auth/api-guards";

export async function GET() {
  const platformCheck = await requirePlatformAdmin();
  if (!platformCheck.success) return createGuardErrorResponse(platformCheck);

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

    const [
      { data: groups },
      { data: providers },
      { data: platformManagers },
      { data: prescriptions },
    ] = await Promise.all([
      supabase.from("groups").select("id, name, platform_manager_id"),
      supabase.from("providers").select("id, group_id, is_active, user_id"),
      supabase.from("platform_managers").select("id, name"),
      supabase
        .from("prescriptions")
        .select("prescriber_id, total_paid_cents, profit_cents, status")
        .in("status", ["submitted", "billing", "approved", "packed", "shipped", "delivered"]),
    ]);

    const pmMap = new Map((platformManagers || []).map((pm) => [pm.id, pm.name]));

    const groupMetrics = (groups || []).map((group) => {
      const groupProviders = (providers || []).filter((p) => p.group_id === group.id);
      const activeProviders = groupProviders.filter((p) => p.is_active);

      const groupUserIds = new Set(groupProviders.map((p) => p.user_id).filter(Boolean));
      const groupPrescriptions = (prescriptions || []).filter(
        (rx) => rx.prescriber_id && groupUserIds.has(rx.prescriber_id)
      );

      const totalRevenue = groupPrescriptions.reduce(
        (sum, rx) => sum + ((rx.total_paid_cents || 0) + (rx.profit_cents || 0)),
        0
      );

      return {
        id: group.id,
        name: group.name,
        platform_manager_name: group.platform_manager_id
          ? pmMap.get(group.platform_manager_id) || null
          : null,
        provider_count: groupProviders.length,
        active_providers: activeProviders.length,
        order_count: groupPrescriptions.length,
        total_revenue_cents: totalRevenue,
      };
    });

    groupMetrics.sort((a, b) => b.order_count - a.order_count);

    return NextResponse.json({ groupMetrics });
  } catch (error) {
    console.error("Error fetching group metrics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
