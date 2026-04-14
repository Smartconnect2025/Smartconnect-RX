import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { fetchAndApplyTracking } from "@/app/api/prescriptions/_shared/tracking-sync";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let mismatch = 0;
  for (let i = 0; i < bufA.length; i++) {
    mismatch |= bufA[i] ^ bufB[i];
  }
  return mismatch === 0;
}

function isAuthorized(request: NextRequest): boolean {
  if (!INTERNAL_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const providedSecret = authHeader.slice(7);
  if (!providedSecret) return false;
  return timingSafeEqual(providedSecret, INTERNAL_SECRET);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runTrackingSync();
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runTrackingSync();
}

async function runTrackingSync() {
  const supabase = createAdminClient();
  const results: Array<{ id: string; tracking: string; result: string }> = [];

  try {
    const { data: prescriptions, error } = await supabase
      .from("prescriptions")
      .select("id, queue_id, tracking_number, easypost_tracker_id, status")
      .not("tracking_number", "is", null)
      .not("tracking_number", "eq", "")
      .not("status", "in", "(delivered,cancelled)")
      .order("updated_at", { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!prescriptions || prescriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No prescriptions need tracking updates",
        synced: 0,
      });
    }

    console.log(`[cron/tracking-sync] Syncing ${prescriptions.length} prescriptions`);

    for (const rx of prescriptions) {
      try {
        const result = await fetchAndApplyTracking(
          rx.id,
          rx.tracking_number!,
          rx.easypost_tracker_id,
        );
        results.push({
          id: rx.id,
          tracking: rx.tracking_number!,
          result: result.updated ? "updated" : result.error || "no_change",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: rx.id, tracking: rx.tracking_number!, result: `error: ${msg}` });
      }
    }

    const updated = results.filter((r) => r.result === "updated").length;

    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: "system@aimrx.com",
      user_name: "Tracking Sync",
      action: "CRON_TRACKING_SYNC",
      details: `Synced ${prescriptions.length} prescriptions: ${updated} updated`,
      status: "success",
    });

    return NextResponse.json({ success: true, total: prescriptions.length, updated, results });
  } catch (error) {
    console.error("[cron/tracking-sync] Fatal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
