import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

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

    const supabase = createAdminClient();

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const [
      { count: totalProvidersInvited, error: totalErr },
      { count: activeProviders, error: activeErr },
      { count: inactiveProviders, error: inactiveErr },
      { count: ordersLast24Hours, error: ordersErr },
    ] = await Promise.all([
      supabase
        .from("providers")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("providers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("providers")
        .select("*", { count: "exact", head: true })
        .or("is_active.eq.false,is_active.is.null"),
      supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .gte("submitted_at", twentyFourHoursAgo.toISOString()),
    ]);

    if (totalErr || activeErr || inactiveErr || ordersErr) {
      console.error("[dashboard-metrics] supabase errors:", {
        totalErr,
        activeErr,
        inactiveErr,
        ordersErr,
      });
    }

    return NextResponse.json({
      totalProvidersInvited: totalProvidersInvited ?? 0,
      activeProviders: activeProviders ?? 0,
      inactiveProviders: inactiveProviders ?? 0,
      ordersLast24Hours: ordersLast24Hours ?? 0,
    });
  } catch (error) {
    console.error("[dashboard-metrics] unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 },
    );
  }
}
