import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { checkRefills } from "@core/cron/jobs/refill-check";
import { reconcileTracking } from "@core/cron/jobs/tracking-reconcile";
import { reconcileDigitalRx } from "@core/cron/jobs/digitalrx-reconcile";
import { reconcilePayments } from "@core/cron/jobs/payment-reconcile";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Per-job cooldown for MANUAL (admin-UI) triggers only. Scheduled cron and
// internal-secret calls bypass this — they're rate-controlled at the schedule
// level. This protects pharmacy partner APIs (DigitalRx/Greenwich) from being
// hammered when an admin gets impatient and clicks "Pull from Greenwich"
// repeatedly. Without a cooldown, ~50 Greenwich calls per click × N clicks
// puts us at real risk of being rate-limited or blocked. Joseph: "there is a
// risk digital rx will block us" (May 12 2026).
const MANUAL_COOLDOWN_MS: Record<string, number> = {
  "digitalrx-reconcile": 10 * 60 * 1000, // 10 min
  "tracking-reconcile": 10 * 60 * 1000,
  "payment-reconcile": 60 * 1000,        // payment cron runs every 1 min anyway
  "refill-check": 5 * 60 * 1000,
};
const lastManualRunAt = new Map<string, number>();

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get("x-internal-api-key");
  const authHeader = request.headers.get("authorization")?.replace("Bearer ", "");
  const isInternalCall =
    !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY) ||
    !!(INTERNAL_API_SECRET && authHeader && authHeader === INTERNAL_API_SECRET) ||
    !!(INTERNAL_API_SECRET && internalKey && internalKey === INTERNAL_API_SECRET);

  if (!isInternalCall) {
    const { user, userRole } = await getUser();

    if (!user || (userRole !== "admin" && userRole !== "super_admin")) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 },
      );
    }
  }

  const { job } = await request.json();

  const jobs: Record<string, () => Promise<void>> = {
    "refill-check": checkRefills,
    "tracking-reconcile": reconcileTracking,
    "digitalrx-reconcile": reconcileDigitalRx,
    "payment-reconcile": reconcilePayments,
  };

  const jobFn = jobs[job];
  if (!jobFn) {
    return NextResponse.json(
      { error: `Unknown job: ${job}. Available: ${Object.keys(jobs).join(", ")}` },
      { status: 400 },
    );
  }

  // Manual-trigger cooldown — protects partner APIs from admin-UI hammering.
  // Internal/cron calls bypass.
  if (!isInternalCall) {
    const cooldown = MANUAL_COOLDOWN_MS[job];
    if (cooldown) {
      const last = lastManualRunAt.get(job) || 0;
      const elapsed = Date.now() - last;
      if (elapsed < cooldown) {
        const waitSec = Math.ceil((cooldown - elapsed) / 1000);
        const waitMin = Math.ceil(waitSec / 60);
        return NextResponse.json(
          {
            error: `Please wait ${waitMin} more minute${waitMin === 1 ? "" : "s"} before running this again. We just polled Greenwich — running it back-to-back risks getting our account rate-limited.`,
            cooldownRemainingSec: waitSec,
          },
          { status: 429 },
        );
      }
      lastManualRunAt.set(job, Date.now());
    }
  }

  await jobFn();

  return NextResponse.json({ success: true, job, message: `Job "${job}" executed. Check cron_job_runs table for results.` });
}
