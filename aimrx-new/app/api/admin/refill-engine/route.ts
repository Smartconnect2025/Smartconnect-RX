import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { getPharmacyAdminScope } from "@/core/auth/api-guards";
import { createServerClient } from "@core/supabase";

function safeArray(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val) ? val : [];
}

function sanitizeRun(run: Record<string, unknown>) {
  return {
    id: run.id,
    job_name: run.job_name,
    status: run.status,
    records_processed: run.records_processed,
    details: run.details,
    started_at: run.started_at,
    finished_at: run.finished_at,
    duration_ms: run.duration_ms,
  };
}

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

    if (!pharmacyId) {
      const { data: runs, error } = await supabase
        .from("cron_job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading cron runs:", error);
        return NextResponse.json(
          { error: "Failed to load cron job runs" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        runs: (runs || []).map((r) => ({
          ...sanitizeRun(r),
          error_message: r.error_message,
        })),
      });
    }

    const { data: runs, error } = await supabase
      .from("cron_job_runs")
      .select("*")
      .eq("job_name", "refill-check")
      .order("started_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Error loading cron runs:", error);
      return NextResponse.json(
        { error: "Failed to load cron job runs" },
        { status: 500 },
      );
    }

    const allRxIds: string[] = [];
    for (const run of runs || []) {
      if (run.details && typeof run.details === "object") {
        const processed = safeArray((run.details as Record<string, unknown>).processed);
        const failed = safeArray((run.details as Record<string, unknown>).failed);
        for (const item of [...processed, ...failed]) {
          if (typeof item.rxId === "string") allRxIds.push(item.rxId);
        }
      }
    }

    let pharmacyRxIds = new Set<string>();

    if (allRxIds.length > 0) {
      const uniqueRxIds = [...new Set(allRxIds)];
      const batchSize = 100;
      for (let i = 0; i < uniqueRxIds.length; i += batchSize) {
        const batch = uniqueRxIds.slice(i, i + batchSize);
        const { data: rxData, error: rxError } = await supabase
          .from("prescriptions")
          .select("id")
          .eq("pharmacy_id", pharmacyId)
          .in("id", batch);

        if (rxError) {
          console.error("Error filtering prescriptions by pharmacy:", rxError);
          return NextResponse.json(
            { error: "Failed to filter prescription data" },
            { status: 500 },
          );
        }

        for (const rx of rxData || []) {
          pharmacyRxIds.add(rx.id);
        }
      }
    }

    const filteredRuns = [];
    for (const run of runs || []) {
      if (!run.details || typeof run.details !== "object") {
        continue;
      }

      const details = run.details as Record<string, unknown>;
      const processed = safeArray(details.processed).filter(
        (item) => typeof item.rxId === "string" && pharmacyRxIds.has(item.rxId),
      );
      const failed = safeArray(details.failed).filter(
        (item) => typeof item.rxId === "string" && pharmacyRxIds.has(item.rxId),
      );

      if (processed.length > 0 || failed.length > 0) {
        filteredRuns.push({
          ...sanitizeRun(run),
          records_processed: processed.length,
          details: { processed, failed },
        });
      }

      if (filteredRuns.length >= 50) break;
    }

    return NextResponse.json({ success: true, runs: filteredRuns });
  } catch (err) {
    console.error("Error in refill engine API:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
