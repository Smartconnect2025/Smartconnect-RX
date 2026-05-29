import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: recentWebhooks } = await supabase
      .from("system_logs")
      .select("action, details, status, created_at, queue_id")
      .in("action", [
        "WEBHOOK_STATUS_UPDATE",
        "WEBHOOK_AUTH_FAILED",
        "WEBHOOK_PARSE_ERROR",
        "WEBHOOK_UNKNOWN_STATUS",
        "WEBHOOK_STATUS_SKIP",
      ])
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: waitingOrders } = await supabase
      .from("prescriptions")
      .select("id, queue_id, status, medication, patient_id, submitted_to_pharmacy_at, updated_at, patients(first_name, last_name)")
      .in("status", ["submitted", "packed", "approved"])
      .not("queue_id", "is", null)
      .neq("queue_id", "")
      .order("submitted_to_pharmacy_at", { ascending: true });

    const { data: monitorLogs } = await supabase
      .from("system_logs")
      .select("action, details, status, created_at")
      .in("action", [
        "CRON_WEBHOOK_MONITOR",
        "WEBHOOK_MONITOR_WARNING",
        "WEBHOOK_MONITOR_CRITICAL",
      ])
      .order("created_at", { ascending: false })
      .limit(10);

    const now = Date.now();
    const ordersWithTiming = (waitingOrders || []).map((order) => {
      const submittedAt = order.submitted_to_pharmacy_at
        ? new Date(order.submitted_to_pharmacy_at).getTime()
        : new Date(order.updated_at).getTime();
      const hoursWaiting = Math.round((now - submittedAt) / (1000 * 60 * 60) * 10) / 10;
      const patient = Array.isArray(order.patients) ? order.patients[0] : order.patients;
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

      let healthStatus = "ok";
      if (hoursWaiting >= 24) healthStatus = "critical";
      else if (hoursWaiting >= 6) healthStatus = "warning";

      return {
        id: order.id,
        queue_id: order.queue_id,
        status: order.status,
        medication: order.medication,
        patient_name: patientName,
        hours_waiting: hoursWaiting,
        health_status: healthStatus,
        submitted_at: order.submitted_to_pharmacy_at || order.updated_at,
      };
    });

    const webhookStats = {
      total: (recentWebhooks || []).length,
      successful: (recentWebhooks || []).filter(w => w.status === "success").length,
      failed: (recentWebhooks || []).filter(w => w.status === "error").length,
      auth_failures: (recentWebhooks || []).filter(w => w.action === "WEBHOOK_AUTH_FAILED").length,
      last_received: recentWebhooks && recentWebhooks.length > 0
        ? recentWebhooks[0].created_at
        : null,
    };

    const overallHealth = ordersWithTiming.some(o => o.health_status === "critical")
      ? "critical"
      : ordersWithTiming.some(o => o.health_status === "warning")
        ? "warning"
        : "healthy";

    return NextResponse.json({
      mode: "webhook-only",
      polling_disabled: true,
      overall_health: overallHealth,
      webhook_stats: webhookStats,
      orders_waiting: ordersWithTiming,
      recent_webhooks: (recentWebhooks || []).map(w => ({
        action: w.action,
        details: w.details,
        result: w.status,
        queue_id: w.queue_id,
        received_at: w.created_at,
      })),
      monitor_history: (monitorLogs || []).map(m => ({
        action: m.action,
        details: m.details,
        result: m.status,
        checked_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error("[webhook-monitor] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
