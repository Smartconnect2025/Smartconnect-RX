import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { resolvePharmacyBackend } from "@/app/api/prescriptions/_shared/digitalrx-helpers";
import { getUser } from "@/core/auth/get-user";

/**
 * Admin diagnostic — calls DigitalRx /RxRequestStatus for one or more
 * QueueIDs and returns the raw HTTP response (status, headers, body).
 *
 * Used to inspect "Unknown DigitalRx Status" alerts (e.g. PAUSED) so we
 * can read what Greenwich's backend is actually telling us, end to end,
 * with no parsing or status-mapping in between.
 *
 * Auth: INTERNAL_API_SECRET via Authorization: Bearer <secret> or ?secret=
 *
 * Query params:
 *   - queueId=2233282                   single queue
 *   - queueIds=2233282,2222233,...      comma list (max 20)
 *   - pharmacyId=<uuid>                 default = Greenwich
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
const GREENWICH = "59623278-013e-407f-96af-b164144bdbc7";

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

async function callRaw(
  baseUrl: string,
  storeId: string,
  apiKey: string,
  queueId: string,
) {
  const url = `${baseUrl}/RxRequestStatus`;
  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ StoreID: storeId, QueueID: queueId }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return {
      queueId,
      networkError: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0,
    };
  }
  const text = await resp.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return {
    queueId,
    httpStatus: resp.status,
    httpStatusText: resp.statusText,
    contentType: resp.headers.get("content-type"),
    bodyLength: text.length,
    rawBody: text.length > 4000 ? text.substring(0, 4000) + "…[truncated]" : text,
    parsed,
    ms: Date.now() - t0,
  };
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const pharmacyId = sp.get("pharmacyId") || GREENWICH;
  const single = sp.get("queueId");
  const list = sp.get("queueIds");

  const queueIds = single
    ? [single.trim()]
    : (list || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);

  if (queueIds.length === 0) {
    return NextResponse.json(
      { error: "Provide ?queueId=... or ?queueIds=a,b,c" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const backend = await resolvePharmacyBackend(supabase, pharmacyId);
  if (!backend) {
    return NextResponse.json(
      { error: "Could not resolve pharmacy backend (key decrypt or row missing)" },
      { status: 500 },
    );
  }

  const results = [];
  for (const qid of queueIds) {
    results.push(await callRaw(backend.baseUrl, backend.storeId ?? "", backend.apiKey, qid));
  }

  return NextResponse.json({
    pharmacyId,
    baseUrl: backend.baseUrl,
    storeId: backend.storeId,
    apiKeyLength: backend.apiKey.length,
    count: results.length,
    results,
  });
}

export const GET = handle;
export const POST = handle;
