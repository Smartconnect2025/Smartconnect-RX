import cron from "node-cron";
import { checkRefills } from "./jobs/refill-check";
import { reconcileTracking } from "./jobs/tracking-reconcile";
import { runApiHealthCheck } from "./jobs/api-health-check";
import { syncPrescriptionStatuses } from "./jobs/prescription-status-sync";
import { reconcilePayments } from "./jobs/payment-reconcile";
import { monitorWebhookHealth } from "./jobs/webhook-monitor";
import { paymentDailySweepTick, isDailySweepEnabled } from "./jobs/payment-daily-sweep";
import { cleanupTrustedDevices } from "./jobs/trusted-devices-cleanup";
import { recoverMissedPaymentLinks } from "./jobs/payment-link-fallback";

let started = false;

const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER;

export function startCronJobs() {
  if (started) return;
  started = true;

  if (!isProduction) {
    console.log("[cron] Skipping cron jobs — not running on production server");
    return;
  }

  console.log("[cron] Starting cron jobs on production server");

  // --- SmartConnect existing jobs (preserved) ---
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

  // --- AimRx upstream jobs (merged) ---
  // NOTE: digitalrx-reconcile intentionally NOT registered. It depends on
  // AimRx's richer digitalrx-helpers API (isForwardStatusTransition,
  // unrecognizedStatus, STATUS_ORDINAL) which SmartConnect's custom, leaner
  // digitalrx-helpers.ts does not expose. Merging requires extending the
  // custom tracking helpers + testing before wiring into the live flow.

  // Payment reconcile — runs every 1 minute. Primary safety net for missed
  // AuthNet webhooks. Re-entrancy guarded by row-level CAS in completion path.
  // Env kill-switch (default ON): set PAYMENT_RECONCILE_ENABLED=false on Render
  // to halt within 1 minute without a redeploy.
  if (process.env.PAYMENT_RECONCILE_ENABLED !== "false") {
    cron.schedule(
      "* * * * *",
      () => {
        reconcilePayments();
      },
      { timezone: "UTC" },
    );
  } else {
    console.log("[cron] Payment reconcile DISABLED via PAYMENT_RECONCILE_ENABLED=false");
  }

  cron.schedule(
    "0 */4 * * *",
    () => {
      console.log("[cron] Running webhook-monitor...");
      monitorWebhookHealth();
    },
    { timezone: "UTC" },
  );

  // Payment daily sweep — 3:00 AM America/New_York. Off-peak idempotent
  // AuthNet settled/unsettled reconciliation. Env-gated.
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

  // Trusted-device cleanup — daily 3:00 AM America/Chicago. Trims revoked/
  // expired rows from trusted_devices; audit history stays in system_logs.
  console.log("[cron] Trusted-device cleanup scheduled daily at 3:00 AM America/Chicago");
  cron.schedule(
    "0 3 * * *",
    () => {
      console.log("[cron] Running trusted-devices-cleanup...");
      cleanupTrustedDevices();
    },
    { timezone: "America/Chicago" },
  );

  // Payment-link fallback — every 5 minutes (10-min grace). Server-side
  // safety net for submitted prescriptions whose payment link never generated.
  // Env kill-switch (default ON): set PAYMENT_LINK_FALLBACK_ENABLED=false to halt.
  if (process.env.PAYMENT_LINK_FALLBACK_ENABLED !== "false") {
    console.log("[cron] Payment-link fallback scheduled every 5 minutes (10-min grace)");
    cron.schedule(
      "*/5 * * * *",
      () => {
        recoverMissedPaymentLinks();
      },
      { timezone: "UTC" },
    );
  } else {
    console.log("[cron] Payment-link fallback DISABLED via PAYMENT_LINK_FALLBACK_ENABLED=false");
  }

  // NOTE: payment-janitor (Cohort F stuck-submission recovery) intentionally
  // NOT registered. Its re-submit path calls AimRx's submitPrescriptionToPharmacy
  // directly, which would bypass SmartConnect's multi-pharmacy dispatcher
  // (pharmacy-dispatcher.ts / PioneerRX). Requires adaptation + sign-off before
  // wiring into the live multi-pharmacy submission flow.
}
