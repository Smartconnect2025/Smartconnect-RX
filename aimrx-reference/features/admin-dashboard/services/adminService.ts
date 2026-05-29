import { createClient } from "@/core/supabase/client";

/**
 * Admin Service
 * Handles database operations for admin dashboard metrics
 */

export interface DashboardMetrics {
  totalProvidersInvited: number;
  activeProviders: number;
  inactiveProviders: number;
  ordersLast24Hours: number;
}

export interface MonthlyComparison {
  current: number;
  previous: number;
  growth: number;
}

/**
 * Get dashboard metrics for admin overview
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Route through the server-side endpoint so the count uses the admin
  // client (service role) rather than the browser anon client. The previous
  // implementation queried `providers` directly from the browser, which is
  // RLS-evaluated against the user's session — any drift between the JWT
  // and `is_admin()` returned 0 across the board even when the database
  // had providers. The /api/admin/dashboard-metrics endpoint enforces the
  // same admin-role gate and then uses the admin client for the counts,
  // matching the proven /api/admin/group-metrics pattern.
  try {
    const res = await fetch("/api/admin/dashboard-metrics", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`dashboard-metrics ${res.status}`);
    }
    const data = (await res.json()) as DashboardMetrics;
    return {
      totalProvidersInvited: data.totalProvidersInvited ?? 0,
      activeProviders: data.activeProviders ?? 0,
      inactiveProviders: data.inactiveProviders ?? 0,
      ordersLast24Hours: data.ordersLast24Hours ?? 0,
    };
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return {
      totalProvidersInvited: 0,
      activeProviders: 0,
      inactiveProviders: 0,
      ordersLast24Hours: 0,
    };
  }
}

/**
 * Get monthly comparison data for a specific metric
 */
export async function getMonthlyComparison(
  table: string,
  dateField: string = "created_at",
): Promise<MonthlyComparison> {
  const supabase = createClient();

  try {
    const currentMonth = new Date();
    const previousMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    const currentMonthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );

    const [{ count: current }, { count: previous }] = await Promise.all([
      supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .gte(dateField, currentMonthStart.toISOString()),
      supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .gte(dateField, previousMonth.toISOString())
        .lt(dateField, currentMonthStart.toISOString()),
    ]);

    const currentCount = current || 0;
    const previousCount = previous || 0;
    const growth =
      previousCount === 0
        ? currentCount > 0
          ? 100
          : 0
        : Math.round(
            ((currentCount - previousCount) / previousCount) * 100 * 10,
          ) / 10;

    return {
      current: currentCount,
      previous: previousCount,
      growth,
    };
  } catch (error) {
    console.error(`Error fetching monthly comparison for ${table}:`, error);
    return {
      current: 0,
      previous: 0,
      growth: 0,
    };
  }
}
