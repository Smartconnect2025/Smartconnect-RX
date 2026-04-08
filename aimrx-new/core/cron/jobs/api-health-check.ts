import { logCronRun } from "../logger";
import { createCronClient } from "../supabase";
import { runAllHealthChecks } from "@/core/services/health/runner";

export async function runApiHealthCheck() {
  console.log("[api-health-check] Starting health check for all services...");
  const run = await logCronRun("api-health-check");

  try {
    const result = await runAllHealthChecks();

    console.log(
      `[api-health-check] Completed. Status: ${result.overallStatus} | ` +
      `${result.summary.operational} operational, ${result.summary.degraded} degraded, ` +
      `${result.summary.error} error, ${result.summary.unknown} unknown`
    );

    const supabase = createCronClient();
    await supabase.from("system_logs").insert({
      action: "API_HEALTH_CHECK",
      status: result.overallStatus === "critical" ? "error" : result.overallStatus === "degraded" ? "warning" : "success",
      user_name: "System",
      user_email: "system@smartconnectrx.com",
      details: JSON.stringify({
        overallStatus: result.overallStatus,
        summary: result.summary,
        checks: result.healthChecks.map((c) => ({
          name: c.service_name,
          status: c.status,
          responseTime: c.response_time_ms,
          error: c.last_error,
        })),
      }),
    });

    run.trackSuccess({
      overallStatus: result.overallStatus,
      total: result.summary.total,
      operational: result.summary.operational,
      degraded: result.summary.degraded,
      error: result.summary.error,
    });

    await run.success(result.summary.total);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api-health-check] Fatal error:", msg);
    await run.error(msg);
  }
}
