import cron from "node-cron";
import { checkRefills } from "./jobs/refill-check";
import { reconcileTracking } from "./jobs/tracking-reconcile";
import { reconcilePayments } from "./jobs/payment-reconcile";
import { monitorWebhookHealth } from "./jobs/webhook-monitor";
import { reconcileDigitalRx } from "./jobs/digitalrx-reconcile";
import {
  paymentJanitorTick,
  isPaymentJanitorEnabled,
} from "./jobs/payment-janitor";
import {
  paymentDailySweepTick,
  isDailySweepEnabled,
} from "./jobs/payment-daily-sweep";
import { cleanupTrustedDevices } from "./jobs/trusted-devices-cleanup";
import { recoverMissedPaymentLinks } from "./jobs/payment-link-fallback";

let started = false;

const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER;
const digitalRxCronEnabled = process.env.DIGITALRX_RECONCILE_ENABLED !== "false";

export function startCronJobs() {
  if (started) return;
  started = true;

  if (!isProduction) {
    console.log("[cron] Skipping cron jobs — not running on production server");
    return;
  }

  console.log("[cron] Starting cron jobs on production server");

  if (digitalRxCronEnabled) {
    // Bumped from "0 */4 * * *" to "*/5 * * * *" on May 19 2026 after the
    // Huncher q2329204 incident: tracking was assigned at Greenwich at 12:51
    // CT, but the UI still showed "packed" hours later because we only polled
    // every 4 hours. The reconcile job has an isRunning re-entrancy guard,
    // so overlapping 5-minute ticks are safely skipped. NEVER POLL TEST
    // PATIENTS rule (isTestPatient SQL exclusion) still applies.
    console.log("[cron] DigitalRx reconcile ENABLED — every 5 minutes America/Chicago");
    cron.schedule(
      "*/5 * * * *",
      () => {
        console.log("[cron] Running digitalrx-reconcile...");
        reconcileDigitalRx();
      },
      { timezone: "America/Chicago" },
    );
  } else {
    console.log("[cron] DigitalRx reconcile DISABLED via DIGITALRX_RECONCILE_ENABLED=false");
  }

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

  // Payment reconcile — runs every 1 minute. This is the PRIMARY safety
  // net that makes the system resilient to AuthNet webhook misses
  // (signature key not set in production, webhook URL misconfigured at
  // the AuthNet portal, network drop). Worst-case patient confirmation
  // delay = 60 seconds. Re-entrancy is implicitly guarded by the row-
  // level CAS in the completion path; concurrent reconcile ticks for
  // the same row can never both flip status to completed.
  cron.schedule(
    "* * * * *",
    () => {
      reconcilePayments();
    },
    { timezone: "UTC" },
  );

  cron.schedule(
    "0 */4 * * *",
    () => {
      console.log("[cron] Running webhook-monitor...");
      monitorWebhookHealth();
    },
    { timezone: "UTC" },
  );

  // Payment janitor — every 15 minutes. The tick function itself is
  // gated by PAYMENT_JANITOR_ENABLED so flipping the env var on Render
  // takes effect within 15 minutes without a server restart. We log
  // initial state at startup so operators can confirm the gate.
  console.log(
    `[cron] Payment janitor scheduled every 15min — currently ${
      isPaymentJanitorEnabled() ? "ENABLED" : "DISABLED (env gate)"
    }`,
  );
  cron.schedule(
    "*/15 * * * *",
    () => {
      paymentJanitorTick();
    },
    { timezone: "UTC" },
  );

  // Payment daily sweep — 3:00 AM America/New_York. Off-peak idempotent
  // safety net that pulls the last 7 days of Authnet settled batches plus
  // the full unsettled list and re-drives verify-and-complete for any
  // recoverable row whose authnet_ref_id matches an Authnet invoiceNumber.
  // Same env-gate convention as the janitor: explicit disable wins, prod
  // defaults ON with a loud console.warn so operators can grep deploy logs.
  console.log(
    `[cron] Payment daily sweep scheduled at 3:00 AM America/New_York — currently ${
      isDailySweepEnabled() ? "ENABLED" : "DISABLED (env gate)"
    }`,
  );
  cron.schedule(
    "0 3 * * *",
    () => {
      console.log("[cron] Running payment-daily-sweep...");
      paymentDailySweepTick();
    },
    { timezone: "America/New_York" },
  );

  // Trusted-device cleanup — daily 3:00 AM America/Chicago. Hard-deletes
  // rows from `trusted_devices` that have been revoked or expired for
  // more than 30 days. Permanent grant/use/revoke history lives in
  // system_logs (Step 9) so this only trims the live state table, never
  // the audit trail. Safe to run during the same window as the payment
  // daily sweep — disjoint tables, no contention.
  console.log(
    "[cron] Trusted-device cleanup scheduled daily at 3:00 AM America/Chicago",
  );
  cron.schedule(
    "0 3 * * *",
    () => {
      console.log("[cron] Running trusted-devices-cleanup...");
      cleanupTrustedDevices();
    },
    { timezone: "America/Chicago" },
  );

  // Payment-link fallback — every 5 minutes. Server-side safety net for
  // prescriptions that were submitted (step 3) but never had their payment
  // link generated (step 4 client-side never ran — browser closed, network
  // drop, etc.). 10-minute grace window inside the job ensures we never
  // race a legitimate slow clicker. Skips pay-on-terms providers and test
  // patients. See core/cron/jobs/payment-link-fallback.ts for full rules.
  // Established May 19 2026 after the Matthew Stephens incident: submit
  // logged but no PATIENT_NOTIFICATION_SENT, no payment_transactions row,
  // patient never emailed.
  console.log(
    "[cron] Payment-link fallback scheduled every 5 minutes (10-min grace)",
  );
  cron.schedule(
    "*/5 * * * *",
    () => {
      recoverMissedPaymentLinks();
    },
    { timezone: "UTC" },
  );

}
