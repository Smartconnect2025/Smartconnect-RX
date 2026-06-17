import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import {
  resolvePioneerRxBackend,
  fetchPioneerRxStatus,
  mapPioneerRxStatus,
  SIMULATION_MODE,
} from "@/app/api/prescriptions/_shared/pioneerrx-helpers";
import { getUser } from "@/core/auth/get-user";

/**
 * Admin diagnostic — calls PioneerRx GetRxTransaction for one Rx Transaction ID
 * and returns the raw PioneerRx response, the parsed transaction fields, AND the
 * status SmartConnect would derive from it (via the SAME mapPioneerRxStatus the
 * live system uses). This is the PioneerRx equivalent of the DigitalRx Inspector.
 *
 * Use it when a PioneerRx order looks stuck, rejected, or in an unexpected state,
 * so you can read exactly what PioneerRx is telling us and how we interpret it.
 *
 * Auth: INTERNAL_API_SECRET via Authorization: Bearer <secret> or ?secret=,
 *       or a signed-in admin / super_admin session.
 *
 * Query params:
 *   - rxTransactionId=12345   (aliases: txId, queueId, queue_id) — the PioneerRx
 *                             RxTransactionID to look up
 *   - pharmacyId=<uuid>       which PioneerRx pharmacy to query. Optional when only
 *                             one active PioneerRx pharmacy exists.
 *
 * With no rxTransactionId, returns just the list of active PioneerRx pharmacies so
 * the UI can populate its pharmacy picker.
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;

// Sentinel used to detect whether PioneerRx's status actually mapped to one of
// our known statuses. If mapPioneerRxStatus returns it unchanged, PioneerRx sent
// a status we don't recognize and the order would be left as-is (silently stuck).
const UNMAPPED_SENTINEL = "__pioneerrx_unmapped__";

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

type PioneerPharmacy = { id: string; name: string };

async function listPioneerPharmacies(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<PioneerPharmacy[]> {
  const { data: backends } = await supabase
    .from("pharmacy_backends")
    .select("pharmacy_id")
    .eq("system_type", "PioneerRx")
    .eq("is_active", true);

  const ids = [
    ...new Set(
      (backends ?? [])
        .map((b: { pharmacy_id: string | null }) => b.pharmacy_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (ids.length === 0) return [];

  const { data: pharmacies } = await supabase
    .from("pharmacies")
    .select("id, name")
    .in("id", ids);

  const nameById = new Map(
    (pharmacies ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  return ids.map((id) => ({ id, name: nameById.get(id) || "(unnamed pharmacy)" }));
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  // Normalize the ID once (strip a leading "RX-") so the PioneerRx call AND the
  // local prescriptions.queue_id lookup use the same value — fetchPioneerRxStatus
  // strips this internally, so an un-normalized DB lookup would falsely report
  // "no matching order".
  const rxTransactionId = (
    sp.get("rxTransactionId") ||
    sp.get("txId") ||
    sp.get("queueId") ||
    sp.get("queue_id") ||
    ""
  )
    .trim()
    .replace(/^RX-/i, "");
  const requestedPharmacyId = sp.get("pharmacyId");

  const supabase = createAdminClient();
  const pharmacies = await listPioneerPharmacies(supabase);

  // No transaction ID yet — just hand back the pharmacy list for the picker.
  if (!rxTransactionId) {
    return NextResponse.json({ pharmacies, simulationMode: SIMULATION_MODE });
  }

  if (pharmacies.length === 0) {
    return NextResponse.json(
      {
        error:
          "No active PioneerRx pharmacy is configured. Add one under Pharmacy Management first.",
        pharmacies,
      },
      { status: 404 },
    );
  }

  const pharmacyId =
    requestedPharmacyId && pharmacies.some((p) => p.id === requestedPharmacyId)
      ? requestedPharmacyId
      : pharmacies.length === 1
        ? pharmacies[0].id
        : null;

  if (!pharmacyId) {
    return NextResponse.json(
      {
        error:
          "Multiple PioneerRx pharmacies exist — choose one with ?pharmacyId=...",
        pharmacies,
      },
      { status: 400 },
    );
  }

  const pharmacyName =
    pharmacies.find((p) => p.id === pharmacyId)?.name || "(unknown)";

  const backend = await resolvePioneerRxBackend(supabase, pharmacyId);
  if (!backend) {
    return NextResponse.json(
      {
        error:
          "Could not resolve the PioneerRx backend for this pharmacy (missing/inactive row or key decrypt failed).",
        pharmacies,
        pharmacyId,
        pharmacyName,
      },
      { status: 500 },
    );
  }

  const hints: string[] = [];
  if (SIMULATION_MODE) {
    hints.push(
      "⚠️ SIMULATION MODE IS ON (PIONEERRX_SIMULATION_MODE=true). This response is FAKE — it is NOT coming from the real PioneerRx. Set PIONEERRX_SIMULATION_MODE=false in production to talk to PioneerRx for real.",
    );
  }
  if (!backend.baseUrl) {
    hints.push("No API URL is configured for this PioneerRx pharmacy.");
  }
  if (!backend.sharedSecret) {
    hints.push(
      "No shared secret is configured for this pharmacy — PioneerRx signature auth will fail.",
    );
  }

  // Run the SAME status fetch the live system uses, so the inspector reflects
  // reality exactly.
  const t0 = Date.now();
  const result = await fetchPioneerRxStatus(backend, rxTransactionId);
  const ms = Date.now() - t0;

  let parsed: Record<string, unknown> | null = null;
  let derived: {
    newStatus: string;
    trackingNumber: string | null;
    mapped: boolean;
  } | null = null;
  let callOk = false;
  let error: string | undefined;
  let rawResponse: string | undefined;

  if (result.success) {
    callOk = true;
    parsed = result.data as Record<string, unknown>;
    const mapped = mapPioneerRxStatus(result.data, UNMAPPED_SENTINEL);
    const didMap = mapped.newStatus !== UNMAPPED_SENTINEL;
    derived = {
      newStatus: didMap ? mapped.newStatus : UNMAPPED_SENTINEL,
      trackingNumber: mapped.trackingNumber,
      mapped: didMap,
    };
    if (!didMap) {
      const seen =
        result.data.currentRxTransactionStatusText ||
        result.data.currentRxStatusText ||
        result.data.fillState ||
        result.data.status ||
        "(no status text)";
      hints.push(
        `PioneerRx returned a status SmartConnect does not recognize: "${seen}". The order would be left UNCHANGED. This status text/ID needs to be added to the PioneerRx status map.`,
      );
    }
  } else {
    error = result.error;
    rawResponse = "rawResponse" in result ? result.rawResponse : undefined;
    if (error?.includes("401")) {
      hints.push(
        "401 Unauthorized — PioneerRx rejected our credentials. Most often this means our server IP is not whitelisted by PioneerRx, or the API key / shared secret is wrong.",
      );
    } else if (error?.toLowerCase().includes("no transaction")) {
      hints.push(
        "PioneerRx has no transaction for this ID. Double-check the Rx Transaction ID, or the order may not have reached PioneerRx yet.",
      );
    }
  }

  // Show our side of the order too, matched by queue_id.
  const { data: rx } = await supabase
    .from("prescriptions")
    .select(
      "id, queue_id, status, medication, payment_status, order_progress, tracking_number, created_at, updated_at",
    )
    .eq("queue_id", rxTransactionId)
    .maybeSingle();

  if (callOk && derived?.mapped && rx && derived.newStatus !== rx.status) {
    hints.push(
      `Status mismatch: PioneerRx indicates "${derived.newStatus}" but SmartConnect currently has this order as "${rx.status}". A status sync (cron or manual) would move it to "${derived.newStatus}".`,
    );
  }
  if (!rx) {
    hints.push(
      "No SmartConnect order is matched to this Rx Transaction ID (no prescription has this queue_id). This is fine for a raw PioneerRx lookup, but means status syncs cannot update any local order from it.",
    );
  }

  return NextResponse.json({
    pharmacies,
    pharmacyId,
    pharmacyName,
    rxTransactionId,
    simulationMode: SIMULATION_MODE,
    backend: {
      baseUrl: backend.baseUrl,
      storeId: backend.storeId,
      locationId: backend.locationId,
      employeeId: backend.employeeId,
      apiKeyLength: backend.apiKey.length,
      hasSharedSecret: !!backend.sharedSecret,
    },
    call: { ok: callOk, ms, error, rawResponse },
    parsed,
    derived,
    prescription: rx ?? null,
    hints,
  });
}

export const GET = handle;
export const POST = handle;
