import { NextRequest, NextResponse } from "next/server";
import { reconcileDigitalRx } from "@/core/cron/jobs/digitalrx-reconcile";
import { getUser } from "@/core/auth/get-user";

const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (INTERNAL_SECRET) {
    const authHeader = request.headers.get("authorization");
    const urlSecret = request.nextUrl.searchParams.get("secret");
    const provided = authHeader?.replace("Bearer ", "") || urlSecret;
    if (provided === INTERNAL_SECRET) return true;
  }
  try {
    const { user, userRole } = await getUser();
    if (user && (userRole === "admin" || userRole === "super_admin")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  try {
    const result = await reconcileDigitalRx();
    return NextResponse.json({
      ok: true,
      ms: Date.now() - t0,
      result: result ?? { note: "Reconcile already running, this trigger was skipped." },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
