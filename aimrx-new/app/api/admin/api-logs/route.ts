import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import { createServerClient } from "@core/supabase";

export async function GET(request: NextRequest) {
  const { user, userRole } = await getUser();

  if (!user || (userRole !== "admin" && userRole !== "super_admin")) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required" },
      { status: 403 },
    );
  }

  const isSuperAdmin = userRole === "super_admin";

  let pharmacyId: string | null = null;

  if (isSuperAdmin) {
    const paramPharmacy = request.nextUrl.searchParams.get("pharmacyId");
    if (paramPharmacy && paramPharmacy !== "all") {
      pharmacyId = paramPharmacy;
    }
  } else {
    const scope = await getPharmacyAdminScope(user.id);
    if (!scope.isPharmacyAdmin || !scope.pharmacyId) {
      return NextResponse.json(
        { error: "Forbidden: No pharmacy access" },
        { status: 403 },
      );
    }
    pharmacyId = scope.pharmacyId;
  }

  try {
    const supabase = await createServerClient();

    let rxQuery = supabase
      .from("prescriptions")
      .select(`
        id,
        queue_id,
        submitted_at,
        medication,
        dosage,
        status,
        patient:patients(first_name, last_name)
      `)
      .order("submitted_at", { ascending: false })
      .limit(20);

    let statsQuery = supabase
      .from("prescriptions")
      .select("submitted_at");

    if (pharmacyId) {
      rxQuery = rxQuery.eq("pharmacy_id", pharmacyId);
      statsQuery = statsQuery.eq("pharmacy_id", pharmacyId);
    }

    let systemLogs: Record<string, unknown>[] = [];

    if (pharmacyId) {
      const { data: pharmacyRx, error: queueError } = await supabase
        .from("prescriptions")
        .select("queue_id")
        .eq("pharmacy_id", pharmacyId)
        .not("queue_id", "is", null);

      if (queueError) {
        console.error("Error loading pharmacy queue IDs:", queueError);
        return NextResponse.json(
          { error: "Failed to resolve pharmacy log associations" },
          { status: 500 },
        );
      }

      const { data: pharmacyAdmins, error: adminsError } = await supabase
        .from("pharmacy_admins")
        .select("user_id")
        .eq("pharmacy_id", pharmacyId);

      if (adminsError) {
        console.error("Error loading pharmacy admins:", adminsError);
        return NextResponse.json(
          { error: "Failed to resolve pharmacy admin associations" },
          { status: 500 },
        );
      }

      const queueIds = (pharmacyRx || []).map((rx) => rx.queue_id).filter(Boolean);
      const userIds = (pharmacyAdmins || []).map((a) => a.user_id).filter(Boolean);

      const orFilters: string[] = [];
      if (queueIds.length > 0) {
        orFilters.push(`queue_id.in.(${queueIds.join(",")})`);
      }
      if (userIds.length > 0) {
        orFilters.push(`user_id.in.(${userIds.join(",")})`);
      }

      if (orFilters.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from("system_logs")
          .select("*")
          .or(orFilters.join(","))
          .order("created_at", { ascending: false })
          .limit(50);

        if (logsError) {
          console.error("Error loading filtered system logs:", logsError);
          return NextResponse.json(
            { error: "Failed to load system logs" },
            { status: 500 },
          );
        }

        systemLogs = logsData || [];
      }
    } else {
      const { data: logsData, error: logsError } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsError) {
        console.error("Error loading system logs:", logsError);
        return NextResponse.json(
          { error: "Failed to load system logs" },
          { status: 500 },
        );
      }

      systemLogs = logsData || [];
    }

    const [rxResult, statsResult] = await Promise.all([rxQuery, statsQuery]);

    if (rxResult.error) {
      console.error("Error loading prescriptions:", rxResult.error);
      return NextResponse.json(
        { error: "Failed to load prescriptions" },
        { status: 500 },
      );
    }

    if (statsResult.error) {
      console.error("Error loading prescription stats:", statsResult.error);
      return NextResponse.json(
        { error: "Failed to load prescription stats" },
        { status: 500 },
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allRx = statsResult.data || [];
    const todayCount = allRx.filter(
      (rx) => new Date(rx.submitted_at) >= today,
    ).length;
    const weekCount = allRx.filter(
      (rx) => new Date(rx.submitted_at) >= weekAgo,
    ).length;

    return NextResponse.json({
      success: true,
      systemLogs,
      prescriptions: rxResult.data || [],
      stats: {
        today: todayCount,
        thisWeek: weekCount,
        allTime: allRx.length,
      },
    });
  } catch (err) {
    console.error("Error in api-logs API:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
