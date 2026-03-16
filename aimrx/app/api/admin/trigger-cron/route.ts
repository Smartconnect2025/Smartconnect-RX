import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/core/auth/get-user";
import { checkRefills } from "@core/cron/jobs/refill-check";
import { reconcileTracking } from "@core/cron/jobs/tracking-reconcile";

/**
 * POST /api/admin/trigger-cron
 * Manually trigger a cron job for testing purposes.
 * Admin-only endpoint.
 *
 * Body: { job: "refill-check" }
 */
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get("x-internal-api-key");
  const isInternalCall = !!(INTERNAL_API_KEY && internalKey && internalKey === INTERNAL_API_KEY);

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
  };

  const jobFn = jobs[job];
  if (!jobFn) {
    return NextResponse.json(
      { error: `Unknown job: ${job}. Available: ${Object.keys(jobs).join(", ")}` },
      { status: 400 },
    );
  }

  await jobFn();

  return NextResponse.json({ success: true, job, message: `Job "${job}" executed. Check cron_job_runs table for results.` });
}
