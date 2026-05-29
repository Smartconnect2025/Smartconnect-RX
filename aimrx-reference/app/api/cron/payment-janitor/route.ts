import { NextRequest, NextResponse } from "next/server";
import {
  runPaymentJanitor,
  isPaymentJanitorEnabled,
} from "@/core/cron/jobs/payment-janitor";

/**
 * /api/cron/payment-janitor
 *
 * HTTP entry point for the payment janitor sweep. The actual cohort
 * logic lives in core/cron/jobs/payment-janitor.ts (single source of
 * truth — the in-process node-cron tick calls the same function every
 * 15 minutes).
 *
 * This route exists for:
 *   - On-demand manual triggering by an operator
 *   - Monitoring tools that want to read the structured cohort summary
 *   - Local end-to-end tests of the sweep
 *
 * Safety mirrors the in-process tick:
 *   - ENV GATE: 503 unless PAYMENT_JANITOR_ENABLED='true'
 *   - AUTH: bearer token (INTERNAL_API_SECRET / CRON_SECRET)
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!INTERNAL_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  const urlSecret = request.nextUrl.searchParams.get("secret");
  const providedSecret =
    authHeader?.replace("Bearer ", "") || urlSecret;
  return providedSecret === INTERNAL_SECRET;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPaymentJanitorEnabled()) {
    return NextResponse.json(
      {
        error:
          "Payment janitor is disabled. Set PAYMENT_JANITOR_ENABLED=true after reconciliation sign-off.",
      },
      { status: 503 },
    );
  }

  try {
    const summary = await runPaymentJanitor();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error("[cron/payment-janitor] Fatal error:", msg);
    return NextResponse.json(
      { error: "Internal server error", message: msg },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
