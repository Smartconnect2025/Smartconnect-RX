import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { getEasyPostClient } from "@/app/api/prescriptions/_shared/easypost-helpers";
import { ensureTrackerRegistered, applyTrackingUpdate } from "@/app/api/prescriptions/_shared/tracking-sync";
import { alertBadTrackingNumber } from "@/core/services/admin-alerts";

export async function reconcileTracking() {
  console.log("[tracking-reconcile] Starting tracking reconciliation...");
  const run = await logCronRun("tracking-reconcile");

  try {
    const ep = getEasyPostClient();
    if (!ep) {
      console.warn("[tracking-reconcile] EasyPost not configured, skipping");
      await run.success(0);
      return;
    }

    const supabase = createCronClient();

    const { data: prescriptions, error } = await supabase
      .from("prescriptions")
      .select("id, tracking_number, easypost_tracker_id, status, fedex_status, medication, patient_id")
      .not("tracking_number", "is", null)
      .neq("tracking_number", "")
      .not("status", "in", '("delivered")')
      .order("updated_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[tracking-reconcile] Query error:", error.message);
      await run.error(error.message);
      return;
    }

    if (!prescriptions || prescriptions.length === 0) {
      console.log("[tracking-reconcile] No prescriptions to check");
      await run.success(0);
      return;
    }

    console.log(`[tracking-reconcile] Checking ${prescriptions.length} prescriptions`);

    let updated = 0;

    for (const rx of prescriptions) {
      try {
        if (!rx.easypost_tracker_id) {
          const result = await ensureTrackerRegistered(rx.id, rx.tracking_number!);
          if (!result.trackerId) {
            run.trackFailure({
              prescriptionId: rx.id,
              step: "register",
              error: result.error,
            });
            continue;
          }
          rx.easypost_tracker_id = result.trackerId;
        }

        const tracker = await ep.Tracker.retrieve(rx.easypost_tracker_id);
        const trackerStatus = (tracker as { status?: string }).status || "unknown";
        const trackerCarrier = (tracker as { carrier?: string }).carrier || null;

        if (trackerStatus === "unknown" && !trackerCarrier) {
          const { data: badAlertCheck } = await supabase
            .from("system_logs")
            .select("id")
            .eq("action", "ADMIN_ALERT_BAD_TRACKING")
            .ilike("details", `%${rx.id}%`)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);
          if (!badAlertCheck || badAlertCheck.length === 0) {
            let patientName = "Unknown";
            if (rx.patient_id) {
              const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", rx.patient_id).single();
              if (pat) patientName = `${pat.first_name} ${pat.last_name}`;
            }
            alertBadTrackingNumber(
              patientName, rx.medication || "", rx.tracking_number!, rx.id,
              `Tracking number "${rx.tracking_number}" returned "unknown" status with no carrier identified after registration with EasyPost.`,
            ).catch(() => {});
            await supabase.from("system_logs").insert({
              user_id: null, user_email: "system@aimrx.com", user_name: "System Alert",
              action: "ADMIN_ALERT_BAD_TRACKING",
              details: `Bad tracking number "${rx.tracking_number}" for ${patientName} — ${rx.medication} (${rx.id})`,
              status: "warning",
            });
            console.warn(`[tracking-reconcile] BAD TRACKING ALERT: ${rx.tracking_number} for ${rx.id}`);
          }
        }

        const result = await applyTrackingUpdate(
          rx.id,
          tracker as unknown as Record<string, unknown>,
          "cron-reconcile",
        );

        if (result.updated) {
          updated++;
          run.trackSuccess({
            prescriptionId: rx.id,
            status: trackerStatus,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tracking-reconcile] Error for ${rx.id}:`, msg);
        run.trackFailure({
          prescriptionId: rx.id,
          step: "update",
          error: msg,
        });
      }
    }

    console.log(`[tracking-reconcile] Done. Updated ${updated}/${prescriptions.length}`);
    await run.success(prescriptions.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[tracking-reconcile] Fatal error:", msg);
    await run.error(msg);
  }
}
