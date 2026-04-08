import cron from "node-cron";
import { checkRefills } from "./jobs/refill-check";
import { reconcileTracking } from "./jobs/tracking-reconcile";
import { runApiHealthCheck } from "./jobs/api-health-check";
import { syncPrescriptionStatuses } from "./jobs/prescription-status-sync";

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  cron.schedule(
    "0 6 * * *",
    () => {
      console.log("[cron] Running refill-check...");
      checkRefills();
    },
    { timezone: "UTC" },
  );

  cron.schedule(
    "*/30 * * * *",
    () => {
      console.log("[cron] Running tracking-reconcile...");
      reconcileTracking();
    },
    { timezone: "UTC" },
  );

  cron.schedule(
    "*/10 * * * *",
    () => {
      console.log("[cron] Running api-health-check...");
      runApiHealthCheck();
    },
    { timezone: "UTC" },
  );

  cron.schedule(
    "*/5 * * * *",
    () => {
      console.log("[cron] Running prescription-status-sync...");
      syncPrescriptionStatuses();
    },
    { timezone: "UTC" },
  );
}
