import { logCronRun } from "../logger";
import { createCronClient } from "../supabase";
import {
  resolvePharmacyBackendsBatchAll,
  type ResolvedPharmacyBackend,
} from "@/app/api/prescriptions/_shared/pharmacy-dispatcher";
import {
  resolvePharmacyBackendsBatch,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
  type ResolvedBackend,
} from "@/app/api/prescriptions/_shared/digitalrx-helpers";
import {
  fetchPioneerRxStatus,
  mapPioneerRxStatus,
  type PioneerRxBackend,
} from "@/app/api/prescriptions/_shared/pioneerrx-helpers";

interface PrescriptionRow {
  id: string;
  queue_id: string | null;
  status: string;
  pharmacy_id: string | null;
  tracking_number: string | null;
}

const BATCH_LIMIT = 50;

export async function syncPrescriptionStatuses() {
  console.log("[prescription-status-sync] Starting prescription status sync...");
  const run = await logCronRun("prescription-status-sync");

  try {
    const supabase = createCronClient();

    const { data: prescriptions, error } = await supabase
      .from("prescriptions")
      .select("id, queue_id, status, pharmacy_id, tracking_number")
      .in("status", ["submitted", "processing", "packed", "approved"])
      .not("queue_id", "is", null)
      .not("pharmacy_id", "is", null)
      .order("submitted_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      console.error("[prescription-status-sync] Query error:", error.message);
      await run.error(error.message);
      return;
    }

    if (!prescriptions || prescriptions.length === 0) {
      console.log("[prescription-status-sync] No prescriptions to sync");
      await run.success(0);
      return;
    }

    console.log(`[prescription-status-sync] Found ${prescriptions.length} prescriptions to check`);

    const pharmacyIds = [...new Set(
      prescriptions
        .map((p: PrescriptionRow) => p.pharmacy_id)
        .filter((id): id is string => id !== null)
    )];

    const [unifiedBackendMap, digitalBackendMap] = await Promise.all([
      resolvePharmacyBackendsBatchAll(supabase, pharmacyIds),
      resolvePharmacyBackendsBatch(supabase, pharmacyIds),
    ]);

    let updated = 0;
    let checked = 0;

    for (const rx of prescriptions as PrescriptionRow[]) {
      checked++;

      if (!rx.queue_id || !rx.pharmacy_id) {
        run.trackFailure({ prescriptionId: rx.id, step: "validation", error: "Missing queue_id or pharmacy_id" });
        continue;
      }

      const backend = unifiedBackendMap.get(rx.pharmacy_id);
      if (!backend) {
        run.trackFailure({ prescriptionId: rx.id, step: "backend-lookup", error: "No active backend found" });
        continue;
      }

      try {
        let newStatus = rx.status;
        let trackingNumber = rx.tracking_number;

        if (backend.systemType === "PioneerRx") {
          const prxBackend: PioneerRxBackend = {
            apiKey: backend.apiKey,
            sharedSecret: backend.sharedSecret,
            baseUrl: backend.baseUrl,
            storeId: backend.storeId,
            locationId: backend.locationId,
            employeeId: backend.employeeId || null,
          };

          const apiResult = await fetchPioneerRxStatus(prxBackend, rx.queue_id);

          if (apiResult.success) {
            const mapped = mapPioneerRxStatus(apiResult.data, rx.status);
            newStatus = mapped.newStatus;
            trackingNumber = mapped.trackingNumber || trackingNumber;
          } else {
            run.trackFailure({
              prescriptionId: rx.id,
              step: "pioneerrx-status",
              error: apiResult.error || "Unknown error",
            });
            continue;
          }
        } else if (backend.systemType === "DigitalRx") {
          const digitalBackend = digitalBackendMap.get(rx.pharmacy_id);
          if (!digitalBackend) {
            run.trackFailure({ prescriptionId: rx.id, step: "digitalrx-backend", error: "No DigitalRx backend" });
            continue;
          }

          const apiResult = await fetchDigitalRxStatus(digitalBackend, rx.queue_id);

          if (apiResult.success) {
            const mapped = mapDigitalRxStatus(apiResult.data, rx.status);
            newStatus = mapped.newStatus;
            trackingNumber = mapped.trackingNumber || trackingNumber;
          } else {
            run.trackFailure({
              prescriptionId: rx.id,
              step: "digitalrx-status",
              error: apiResult.error || "Unknown error",
            });
            continue;
          }
        } else {
          run.trackFailure({ prescriptionId: rx.id, step: "system-type", error: `Unsupported: ${backend.systemType}` });
          continue;
        }

        const updates: Record<string, string> = {};
        if (newStatus !== rx.status) updates.status = newStatus;
        if (trackingNumber && trackingNumber !== rx.tracking_number) updates.tracking_number = trackingNumber;

        if (Object.keys(updates).length > 0) {
          const { error: dbErr } = await supabase
            .from("prescriptions")
            .update(updates)
            .eq("id", rx.id);

          if (dbErr) {
            run.trackFailure({ prescriptionId: rx.id, step: "db-update", error: dbErr.message });
          } else {
            updated++;
            run.trackSuccess({
              prescriptionId: rx.id,
              oldStatus: rx.status,
              newStatus,
              trackingNumber,
            });
          }
        } else {
          run.trackSuccess({ prescriptionId: rx.id, status: "no-change" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[prescription-status-sync] Error for ${rx.id}:`, msg);
        run.trackFailure({ prescriptionId: rx.id, step: "process", error: msg });
      }
    }

    console.log(`[prescription-status-sync] Done. Checked ${checked}, updated ${updated}`);

    await supabase.from("system_logs").insert({
      action: "PRESCRIPTION_STATUS_SYNC",
      status: "success",
      user_name: "System",
      user_email: "system@smartconnectrx.com",
      details: JSON.stringify({ checked, updated, total: prescriptions.length }),
    });

    await run.success(checked);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[prescription-status-sync] Fatal error:", msg);
    await run.error(msg);
  }
}
