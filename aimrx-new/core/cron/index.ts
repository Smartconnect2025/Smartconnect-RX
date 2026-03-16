import cron from "node-cron";
import { checkRefills } from "./jobs/refill-check";
import { reconcileTracking } from "./jobs/tracking-reconcile";

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
}
