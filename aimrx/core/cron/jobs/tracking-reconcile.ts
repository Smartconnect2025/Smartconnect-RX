import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import { getEasyPostClient } from "@/app/api/prescriptions/_shared/easypost-helpers";
import { ensureTrackerRegistered, applyTrackingUpdate } from "@/app/api/prescriptions/_shared/tracking-sync";

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
      .select("id, tracking_number, easypost_tracker_id, status, fedex_status")
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

        const result = await applyTrackingUpdate(
          rx.id,
          tracker as unknown as Record<string, unknown>,
          "cron-reconcile",
        );

        if (result.updated) {
          updated++;
          run.trackSuccess({
            prescriptionId: rx.id,
            status: (tracker as { status?: string }).status,
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
