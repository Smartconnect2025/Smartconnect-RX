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
  const supabase = createClient();

  try {
    // Get 24 hours ago timestamp
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Parallel queries for platform owner metrics
    const [
      { count: totalProvidersInvited },
      { data: activeProvidersData },
      { data: inactiveProvidersData },
      { count: ordersLast24Hours },
    ] = await Promise.all([
      // Total providers invited
      supabase.from("providers").select("*", { count: "exact", head: true }),

      // Active providers (is_active = true)
      supabase.from("providers").select("id").eq("is_active", true),

      // Inactive providers (is_active = false or null)
      supabase.from("providers").select("id").or("is_active.eq.false,is_active.is.null"),

      // Orders (prescriptions) submitted in last 24 hours
      supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .gte("submitted_at", twentyFourHoursAgo.toISOString()),
    ]);

    return {
      totalProvidersInvited: totalProvidersInvited || 0,
      activeProviders: activeProvidersData?.length || 0,
      inactiveProviders: inactiveProvidersData?.length || 0,
      ordersLast24Hours: ordersLast24Hours || 0,
    };
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    // Return zero values on error
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
