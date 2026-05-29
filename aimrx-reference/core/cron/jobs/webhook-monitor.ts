import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { alertStuckOrder } from "@/core/services/admin-alerts";

const STUCK_THRESHOLD_HOURS = 6;
const CRITICAL_THRESHOLD_HOURS = 24;

// Hidden test data — must match admin view filter in app/api/admin/prescriptions/route.ts
const HIDDEN_TEST_LASTNAMES = ["harton", "one", "testing", "test 1"];
const HIDDEN_TEST_FIRSTNAMES_LASTNAMES: Array<[string, string]> = [
  ["aimrx", "test"],
  ["p1", "one"],
  ["p2", "testing"],
  ["test", "test 1"],
];
const HIDDEN_PROVIDER_LASTNAMES = ["sughayer", "providerassitant"];

function isHiddenTestOrder(
  patient: { first_name?: string | null; last_name?: string | null } | null,
  provider: { last_name?: string | null } | null,
): boolean {
  if (patient) {
    const fn = patient.first_name?.toLowerCase() || "";
    const ln = patient.last_name?.toLowerCase() || "";
    if (HIDDEN_TEST_LASTNAMES.includes(ln)) return true;
    if (HIDDEN_TEST_FIRSTNAMES_LASTNAMES.some(([f, l]) => fn === f && ln === l)) return true;
  }
  if (provider && HIDDEN_PROVIDER_LASTNAMES.includes(provider.last_name?.toLowerCase() || "")) {
    return true;
  }
  return false;
}

export async function monitorWebhookHealth() {
  console.log("[webhook-monitor] Starting webhook health check...");
  const run = await logCronRun("webhook-monitor");

  try {
    const supabase = createCronClient();

    const { data: waitingOrders, error } = await supabase
      .from("prescriptions")
      .select("id, queue_id, status, medication, patient_id, prescriber_id, submitted_to_pharmacy_at, updated_at")
      .in("status", ["submitted", "packed", "approved"])
      .not("queue_id", "is", null)
      .neq("queue_id", "")
      .order("submitted_to_pharmacy_at", { ascending: true });

    if (error) {
      console.error("[webhook-monitor] Query error:", error.message);
      await run.error(error.message);
      return;
    }

    if (!waitingOrders || waitingOrders.length === 0) {
      console.log("[webhook-monitor] No orders waiting for webhook updates");
      await logMonitorResults(supabase, [], 0, 0, 0);
      await run.success(0);
      return;
    }

    // Pre-fetch patient and provider info for all orders so we can filter test orders
    const patientIds = [...new Set(waitingOrders.map(o => o.patient_id).filter(Boolean))] as string[];
    const providerIds = [...new Set(waitingOrders.map(o => o.prescriber_id).filter(Boolean))] as string[];

    const patientMap = new Map<string, { first_name: string; last_name: string }>();
    if (patientIds.length > 0) {
      const { data: patients } = await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds);
      patients?.forEach(p => patientMap.set(p.id, { first_name: p.first_name, last_name: p.last_name }));
    }

    const providerMap = new Map<string, { last_name: string }>();
    if (providerIds.length > 0) {
      const { data: providers } = await supabase.from("providers").select("user_id, last_name").in("user_id", providerIds);
      providers?.forEach(p => providerMap.set(p.user_id, { last_name: p.last_name }));
    }

    // Filter out hidden test orders (Dr. Sughayer + known test patients)
    const visibleOrders = waitingOrders.filter(order => {
      const patient = order.patient_id ? patientMap.get(order.patient_id) || null : null;
      const provider = order.prescriber_id ? providerMap.get(order.prescriber_id) || null : null;
      return !isHiddenTestOrder(patient, provider);
    });

    const hiddenCount = waitingOrders.length - visibleOrders.length;
    if (hiddenCount > 0) {
      console.log(`[webhook-monitor] Skipping ${hiddenCount} hidden test orders`);
    }

    let stuckCount = 0;
    let criticalCount = 0;
    const alerts: string[] = [];

    for (const order of visibleOrders) {
      const submittedAt = order.submitted_to_pharmacy_at
        ? new Date(order.submitted_to_pharmacy_at).getTime()
        : new Date(order.updated_at).getTime();
      const hoursWaiting = (Date.now() - submittedAt) / (1000 * 60 * 60);

      const { data: lastWebhook } = await supabase
        .from("system_logs")
        .select("created_at, details, status")
        .eq("action", "WEBHOOK_STATUS_UPDATE")
        .eq("queue_id", order.queue_id || "")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const patient = order.patient_id ? patientMap.get(order.patient_id) : null;
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown";

      const lastWebhookTime = lastWebhook ? new Date(lastWebhook.created_at).toISOString() : "never";

      if (hoursWaiting >= CRITICAL_THRESHOLD_HOURS) {
        criticalCount++;
        const msg = `CRITICAL: ${patientName} — ${order.medication} (Queue: ${order.queue_id}) waiting ${Math.round(hoursWaiting)}h, no webhook update. Last webhook: ${lastWebhookTime}`;
        alerts.push(msg);
        console.error(`[webhook-monitor] ${msg}`);

        const { data: alertCheck } = await supabase
          .from("system_logs")
          .select("id")
          .eq("action", "WEBHOOK_MONITOR_CRITICAL")
          .ilike("details", `%${order.queue_id}%`)
          .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!alertCheck || alertCheck.length === 0) {
          await supabase.from("system_logs").insert({
            user_id: null,
            user_email: "system@aimrx.com",
            user_name: "Webhook Monitor",
            action: "WEBHOOK_MONITOR_CRITICAL",
            details: msg,
            queue_id: order.queue_id,
            status: "error",
          });
          alertStuckOrder(patientName, order.medication || "", order.queue_id || "", order.id, hoursWaiting).catch(() => {});
        }
      } else if (hoursWaiting >= STUCK_THRESHOLD_HOURS) {
        stuckCount++;
        const msg = `WARNING: ${patientName} — ${order.medication} (Queue: ${order.queue_id}) waiting ${Math.round(hoursWaiting)}h for webhook. Last webhook: ${lastWebhookTime}`;
        alerts.push(msg);
        console.warn(`[webhook-monitor] ${msg}`);

        const { data: alertCheck } = await supabase
          .from("system_logs")
          .select("id")
          .eq("action", "WEBHOOK_MONITOR_WARNING")
          .ilike("details", `%${order.queue_id}%`)
          .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!alertCheck || alertCheck.length === 0) {
          await supabase.from("system_logs").insert({
            user_id: null,
            user_email: "system@aimrx.com",
            user_name: "Webhook Monitor",
            action: "WEBHOOK_MONITOR_WARNING",
            details: msg,
            queue_id: order.queue_id,
            status: "warning",
          });
        }
      }
    }

    await logMonitorResults(supabase, alerts, waitingOrders.length, stuckCount, criticalCount);
    console.log(`[webhook-monitor] Done. ${waitingOrders.length} orders waiting, ${stuckCount} stuck, ${criticalCount} critical`);
    await run.success(waitingOrders.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[webhook-monitor] Fatal error:", msg);
    await run.error(msg);
  }
}

async function logMonitorResults(
  supabase: ReturnType<typeof createCronClient>,
  alerts: string[],
  totalWaiting: number,
  stuckCount: number,
  criticalCount: number,
) {
  const lines: string[] = [];

  if (totalWaiting === 0) {
    lines.push("All prescriptions are up to date — no orders waiting for webhook updates.");
  } else {
    lines.push(`${totalWaiting} order${totalWaiting > 1 ? "s" : ""} waiting for webhook updates`);
    if (criticalCount > 0) lines.push(`${criticalCount} CRITICAL (24h+ without update)`);
    if (stuckCount > 0) lines.push(`${stuckCount} WARNING (6h+ without update)`);
    const ok = totalWaiting - stuckCount - criticalCount;
    if (ok > 0) lines.push(`${ok} OK (within normal timeframe)`);
  }

  if (alerts.length > 0) {
    lines.push("");
    lines.push("Alerts:");
    alerts.forEach(a => lines.push(`  ${a}`));
  }

  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "Webhook Monitor",
    action: "CRON_WEBHOOK_MONITOR",
    details: lines.join("\n").slice(0, 4000),
    status: criticalCount > 0 ? "error" : stuckCount > 0 ? "warning" : "success",
  });
}
