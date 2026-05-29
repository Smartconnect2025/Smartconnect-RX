import { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

const DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";

// --- Types ---

export interface DigitalRxStatusData {
  Status?: string;
  Statuswf?: string;
  RxStatus?: string;
  DeliveredDate?: string;
  DeliveryDate?: string;
  PickupDate?: string;
  ApprovedDate?: string;
  approveddated?: string;
  PackDateTime?: string;
  packdatetime?: string;
  TrackingNumber?: string;
  Trackingnumber?: string;
  LastUpdated?: string;
  Error?: string;
  [key: string]: unknown;
}

export interface MappedStatus {
  newStatus: string;
  trackingNumber: string | null;
  unrecognizedStatus?: string;
}

interface PharmacyBackendRow {
  pharmacy_id?: string;
  api_key_encrypted: string;
  api_url: string | null;
  store_id: string | null;
}

export interface ResolvedBackend {
  apiKey: string;
  baseUrl: string;
  storeId: string | null;
}

// --- Status Mapping ---

/**
 * Maps a DigitalRx status response to the internal prescription status.
 *
 * DigitalRx status progression:
 * 1. Submitted  - Prescription received, QueueID assigned
 * 2. Packed     - Pharmacy fills prescription (PackDateTime set)
 * 3. Approved   - Pharmacist approval for shipping (ApprovedDate set)
 * 4. Picked Up  - Carrier collects package (PickupDate, TrackingNumber set)
 * 5. Delivered  - Patient receives prescription (DeliveredDate set)
 */
// ─────────────────────────────────────────────────────────────────────────────
// Status ordering — used by the reconcile cron and status-batch endpoint to
// REFUSE backward transitions written by polling. Mirrors the webhook's own
// guard at app/api/webhook/digitalrx/route.ts (kept duplicated there to avoid
// touching a working hot path). Keep these two tables in sync.
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_ORDINAL: Record<string, number> = {
  pending_payment: 0,
  payment_received: 1,
  submitting_to_pharmacy: 2,
  submitted: 3,
  packed: 4,
  approved: 5,
  picked_up: 6,
  delivered: 7,
};

export function isForwardStatusTransition(currentStatus: string, newStatus: string): boolean {
  if (newStatus === currentStatus) return false;
  if (newStatus === "rejected") return true;
  const currentOrd = STATUS_ORDINAL[currentStatus] ?? -1;
  const newOrd = STATUS_ORDINAL[newStatus] ?? -1;
  if (newOrd < 0) return false;
  return newOrd > currentOrd;
}

// Single source of truth for Greenwich/DBS rejection keywords. Used by both
// the multi-entry selector (pickAuthoritativeEntry) and mapDigitalRxStatus so
// the two can never drift apart (drift between guard sites is what caused the
// Emily Freeman + Amanda Holiday incidents).
export const REJECT_STATUS_WORDS = new Set<string>([
  "rph reject", "rph rejected", "rejected", "reject",
  "cancelled", "canceled", "denied", "void", "voided",
]);

export function isRejectStatusWord(s: string | null | undefined): boolean {
  return !!s && REJECT_STATUS_WORDS.has(s.toLowerCase().trim());
}

// Active_Rx is Greenwich's "is this prescription still alive in our system"
// flag. A reject is only REAL when Active_Rx is explicitly 0/false/no. Truthy
// or absent Active_Rx alongside a reject keyword = transient/duplicate reject.
export function isActiveRxExplicitlyInactive(entry: DigitalRxStatusData): boolean {
  const raw = entry.Active_Rx ?? entry.active_rx ?? entry.ActiveRx;
  const s = raw == null ? "" : String(raw).trim().toLowerCase();
  return s === "0" || s === "false" || s === "no";
}

// Greenwich returns an ARRAY of Rx entries per queue ID — one per pharmacist
// action (original, retypes, voids, re-issues, duplicates). Picking the single
// newest-by-RxDate entry is WRONG when the newest happens to be a rejected
// DUPLICATE that sits next to an older line Greenwich actually kept and
// advanced (Amanda Holiday q2408203/2408204: 581511 TYPED+approved@12:57 typed
// 10:43:20, 581517 RPH REJECT typed 10:44:06 — newest-wins picked the reject).
//
// Rule (Joseph, May 28 2026 — "are they ACTUALLY rejected?"):
//   1. A reject line only counts as a REAL kill when Active_Rx is explicitly
//      inactive (0/false/no). If any such real-kill line exists, use the
//      newest one — that's a genuine pharmacist rejection.
//   2. Otherwise, IGNORE every reject-keyword line whose Active_Rx is still
//      alive (these are transient/duplicate rejects) and pick the newest of
//      the REMAINING alive lines. This recovers Amanda (alive line = the
//      approved 581511) AND preserves Diana Harr (alive line = the TYPED
//      retype, which was already the newest).
//   3. If EVERY line is an alive-reject (no alive non-reject line at all),
//      fall back to the newest overall — the downstream Active_Rx guard in
//      mapDigitalRxStatus still refuses to write `rejected` in that case.
function byNewest(a: DigitalRxStatusData, b: DigitalRxStatusData): number {
  const da = a?.RxDate ? new Date(String(a.RxDate)).getTime() : 0;
  const db = b?.RxDate ? new Date(String(b.RxDate)).getTime() : 0;
  if (db !== da) return db - da;
  return Number(b?.RxNumber ?? 0) - Number(a?.RxNumber ?? 0);
}

export function pickAuthoritativeEntry(entries: DigitalRxStatusData[]): DigitalRxStatusData {
  const sorted = [...entries].sort(byNewest);

  const realKills = sorted.filter(
    (e) => isRejectStatusWord(e.Statuswf ?? e.Status ?? e.RxStatus) && isActiveRxExplicitlyInactive(e),
  );
  if (realKills.length > 0) return realKills[0];

  const aliveNonReject = sorted.filter(
    (e) => !isRejectStatusWord(e.Statuswf ?? e.Status ?? e.RxStatus),
  );
  if (aliveNonReject.length > 0) return aliveNonReject[0];

  return sorted[0];
}

function hasExplicitDigitalRxStatus(raw: DigitalRxStatusData): boolean {
  const s = typeof raw.Status === "string" ? raw.Status.trim() : "";
  const w = typeof raw.Statuswf === "string" ? raw.Statuswf.trim() : "";
  const r = typeof raw.RxStatus === "string" ? raw.RxStatus.trim() : "";
  return !!(s || w || r);
}

function normalizeStatusData(raw: DigitalRxStatusData): DigitalRxStatusData {
  const normalized: DigitalRxStatusData = { ...raw };
  if (!normalized.Status && normalized.Statuswf) {
    normalized.Status = normalized.Statuswf;
  }
  if (!normalized.Status && normalized.RxStatus) {
    normalized.Status = normalized.RxStatus;
  }
  if (!normalized.TrackingNumber && normalized.Trackingnumber) {
    normalized.TrackingNumber = normalized.Trackingnumber;
  }
  if (!normalized.ApprovedDate && normalized.approveddated) {
    normalized.ApprovedDate = normalized.approveddated;
  }
  if (!normalized.PackDateTime && normalized.packdatetime) {
    normalized.PackDateTime = normalized.packdatetime;
  }
  return normalized;
}

export function mapDigitalRxStatus(
  statusData: DigitalRxStatusData,
  currentStatus: string,
  existingTracking?: string | null,
): MappedStatus {
  const data = normalizeStatusData(statusData);
  let newStatus = currentStatus;

  const tracking = data.TrackingNumber
    ? String(data.TrackingNumber).trim()
    : null;

  let unrecognizedStatus: string | undefined;

  if (tracking && tracking.length > 3) {
    newStatus = "picked_up";
  } else if (data.Status) {
    const digitalRxStatus = data.Status.toLowerCase().trim();
    if (digitalRxStatus === "delivered") {
      newStatus = "delivered";
    } else if (digitalRxStatus === "picked up" || digitalRxStatus === "shipped") {
      newStatus = "picked_up";
    } else if (digitalRxStatus === "approved") {
      newStatus = "approved";
    } else if (digitalRxStatus === "packed" || digitalRxStatus === "typed") {
      newStatus = "packed";
    } else if (
      digitalRxStatus === "submitted" ||
      digitalRxStatus === "fileonly" ||
      digitalRxStatus === "active"
    ) {
      newStatus = "submitted";
    } else if (digitalRxStatus === "paused") {
      // Greenwich's "PAUSED" workflow state means the pharmacist has placed
      // the prescription on hold (back-order, license check, prior-auth) but
      // the Rx is still Active_Rx="1". We surface it as a real visible status
      // so providers + admins can see WHERE the order is, instead of it
      // looking like a stale "Submitted." Stuck-order alerts (>72h) still
      // apply via the existing escalation logic.
      newStatus = "paused";
    } else if (
      // Pharmacist / pharmacy rejection signals from DBS. Includes the
      // observed "RPH REJECT" plus common reject/cancel/deny variants.
      // Shares the single REJECT_STATUS_WORDS source of truth to prevent
      // drift between this branch and pickAuthoritativeEntry.
      isRejectStatusWord(digitalRxStatus)
    ) {
      // ACTIVE_RX GUARD (Emily Freeman q2404472/q2404478 incident, May 28
      // 2026): Greenwich's status API can briefly emit a rejection keyword
      // while Active_Rx="1" (Rx is still alive in their queue, being TYPED
      // / re-routed / under pharmacist review). Marking us "rejected" in
      // that transient window permanently locks the row (rejected always
      // wins via isForwardStatusTransition), so subsequent TYPED/PACKED
      // polls can never advance it. RULE: only honor a reject keyword
      // when Active_Rx is explicitly "0" / 0 / false. If Active_Rx is
      // "1" / truthy / absent-but-other-active-signals-present, treat as
      // transient and preserve currentStatus.
      const activeRxRaw = data.Active_Rx ?? data.active_rx ?? data.ActiveRx;
      const activeRxStr = activeRxRaw == null ? "" : String(activeRxRaw).trim().toLowerCase();
      const isExplicitlyInactive =
        activeRxStr === "0" || activeRxStr === "false" || activeRxStr === "no";
      if (isExplicitlyInactive) {
        newStatus = "rejected";
      } else {
        // Reject keyword refused (Active_Rx not explicitly "0"). Joseph's
        // rule (May 28 2026): "if they undrejected let it be — why play
        // God." A row sitting at `rejected` must be able to recover when
        // Greenwich's same response carries positive signals on other
        // fields (Statuswf="typed"/"packed"/"approved", PackDateTime,
        // ApprovedDate, PickupDate, DeliveredDate, TrackingNumber).
        //
        // Pre-fix behavior: this branch left newStatus=currentStatus, so
        // `submitted` rows stayed `submitted` (fine) but `rejected` rows
        // stayed `rejected` (Emily Freeman's bug — 22h stuck).
        //
        // New behavior: pick the highest non-reject signal available in
        // the same payload and let the forward-transition guard handle
        // the rest. Rejected→packed/approved/picked_up/delivered are all
        // valid since rejected has no ordinal (-1) and any real status
        // is > -1.
        const wfRaw = typeof data.Statuswf === "string" ? data.Statuswf.toLowerCase().trim() : "";
        const rxRaw = typeof data.RxStatus === "string" ? data.RxStatus.toLowerCase().trim() : "";
        const workflowToken =
          wfRaw && !isRejectStatusWord(wfRaw) ? wfRaw :
          rxRaw && !isRejectStatusWord(rxRaw) ? rxRaw : "";
        let workflowDerived: string | null = null;
        if (workflowToken === "delivered") workflowDerived = "delivered";
        else if (workflowToken === "picked up" || workflowToken === "shipped") workflowDerived = "picked_up";
        else if (workflowToken === "approved") workflowDerived = "approved";
        else if (workflowToken === "packed" || workflowToken === "typed") workflowDerived = "packed";
        else if (workflowToken === "submitted" || workflowToken === "fileonly" || workflowToken === "active") workflowDerived = "submitted";
        const dateDerived =
          data.DeliveredDate || data.DeliveryDate ? "delivered" :
          data.PickupDate ? "picked_up" :
          data.ApprovedDate ? "approved" :
          data.PackDateTime ? "packed" :
          null;
        const candidates = [workflowDerived, dateDerived].filter(
          (s): s is string => !!s,
        );
        if (candidates.length > 0) {
          newStatus = candidates.reduce((best, cur) => {
            const bestOrd = STATUS_ORDINAL[best] ?? -1;
            const curOrd = STATUS_ORDINAL[cur] ?? -1;
            return curOrd > bestOrd ? cur : best;
          });
        }
        // else: no positive signals available — leave newStatus =
        // currentStatus (preserves prior behavior for ambiguous responses).
      }
    } else {
      unrecognizedStatus = data.Status;
    }
  }

  // Date-based fallback — ONLY runs when DigitalRx returned no explicit
  // workflow status token (Status/Statuswf/RxStatus all empty). Without this
  // gate, a response like `Statuswf="TYPED"` + `approveddated` set would map
  // correctly to `packed` on one tick and then flip BACK to `approved` on the
  // next tick (because newStatus === currentStatus="packed" would re-enter
  // this block and the ApprovedDate branch would override). Joseph watched
  // Daniel Everett q2329612 oscillate between packed↔approved every cron run
  // on May 19 2026 because of this exact bug. The fallback is preserved for
  // legitimate responses that omit Statuswf and rely on date fields alone.
  if (newStatus === currentStatus && !hasExplicitDigitalRxStatus(statusData)) {
    if (data.DeliveredDate || data.DeliveryDate) {
      newStatus = "delivered";
    } else if (data.PickupDate) {
      newStatus = "picked_up";
    } else if (data.ApprovedDate) {
      newStatus = "approved";
    } else if (data.PackDateTime) {
      newStatus = "packed";
    }
  }

  const trackingNumber = tracking || existingTracking || null;

  return { newStatus, trackingNumber, unrecognizedStatus };
}

// --- Backend Resolution ---

function resolveBackendRow(row: PharmacyBackendRow): ResolvedBackend | null {
  try {
    const apiKey = isEncrypted(row.api_key_encrypted)
      ? decryptApiKey(row.api_key_encrypted)
      : row.api_key_encrypted;

    return {
      apiKey,
      baseUrl: row.api_url || DIGITALRX_BASE_URL,
      storeId: row.store_id,
    };
  } catch (error) {
    console.error("[digitalrx-helpers] Failed to decrypt API key for pharmacy:", row.pharmacy_id || "default", error);
    return null;
  }
}

/**
 * Fetches and decrypts a single pharmacy backend configuration.
 * Tries the specific pharmacy_id first, then falls back to any active DigitalRx backend.
 */
export async function resolvePharmacyBackend(
  supabase: SupabaseClient,
  pharmacyId: string | null,
): Promise<ResolvedBackend | null> {
  if (pharmacyId) {
    const { data } = await supabase
      .from("pharmacy_backends")
      .select("api_key_encrypted, api_url, store_id")
      .eq("pharmacy_id", pharmacyId)
      .eq("is_active", true)
      .eq("system_type", "DigitalRx")
      .single();

    if (data) {
      const resolved = resolveBackendRow(data);
      if (resolved) return resolved;
    }
  }

  const { data: defaultBackend, error } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id")
    .eq("is_active", true)
    .eq("system_type", "DigitalRx")
    .limit(1)
    .single();

  if (!defaultBackend || error) return null;

  return resolveBackendRow(defaultBackend);
}

/**
 * Fetches all pharmacy backends for a set of pharmacy IDs in a single query.
 * Returns a Map keyed by pharmacy_id, with "__default__" for the fallback backend.
 * Solves the N+1 query problem for batch operations.
 */
export async function resolvePharmacyBackendsBatch(
  supabase: SupabaseClient,
  pharmacyIds: string[],
): Promise<Map<string, ResolvedBackend>> {
  const backendMap = new Map<string, ResolvedBackend>();
  const uniqueIds = [...new Set(pharmacyIds.filter(Boolean))];

  if (uniqueIds.length > 0) {
    const { data: backends } = await supabase
      .from("pharmacy_backends")
      .select("pharmacy_id, api_key_encrypted, api_url, store_id")
      .in("pharmacy_id", uniqueIds)
      .eq("is_active", true)
      .eq("system_type", "DigitalRx");

    if (backends) {
      for (const b of backends) {
        const resolved = resolveBackendRow(b);
        if (resolved) {
          backendMap.set(b.pharmacy_id!, resolved);
        }
      }
    }
  }

  const { data: defaultBackend } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id")
    .eq("is_active", true)
    .eq("system_type", "DigitalRx")
    .limit(1)
    .single();

  if (defaultBackend) {
    const resolved = resolveBackendRow(defaultBackend);
    if (resolved) {
      backendMap.set("__default__", resolved);
    }
  }

  return backendMap;
}

// --- DigitalRx API Call ---

/**
 * Calls the DigitalRx RxRequestStatus endpoint.
 * Strips the "RX-" prefix from queue_id before sending.
 */
const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 0;
const RETRY_DELAY_MS = 5000;

function isTransientError(error: string, rawResponse?: string): boolean {
  const transientPatterns = [
    "not JSON",
    "socket address",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "fetch failed",
    "network",
    "aborted",
    "timeout",
  ];
  const text = `${error} ${rawResponse || ""}`.toLowerCase();
  return transientPatterns.some((p) => text.includes(p.toLowerCase()));
}

async function singleFetchDigitalRxStatus(
  statusUrl: string,
  storeId: string,
  apiKey: string,
  queueIdNumeric: string,
): Promise<
  | { success: true; data: DigitalRxStatusData }
  | { success: false; error: string; errorText?: string; rawResponse?: string; retryable: boolean; queueNotFound?: boolean }
> {
  const requestBody = {
    StoreID: storeId,
    QueueID: queueIdNumeric,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(statusUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "Unknown fetch error";
    return { success: false, error: `Network error: ${msg}`, retryable: true };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return {
      success: false,
      error: `API error: ${response.status}`,
      errorText,
      retryable: response.status >= 500,
    };
  }

  const responseText = await response.text();
  const contentType = response.headers.get("content-type") || "(none)";

  // Greenwich silently returns HTTP 200 + empty text/plain body when a
  // QueueID no longer exists in their system (no proper 404, no JSON error).
  // Treat this as a definitive "queue not found at pharmacy" — NOT retryable,
  // NOT a transient error. Cron uses queueNotFound to stop spamming alerts.
  if (responseText.length === 0) {
    return {
      success: false,
      error: `Queue not found at pharmacy (HTTP ${response.status} empty body, content-type=${contentType})`,
      rawResponse: "<empty body>",
      queueNotFound: true,
      retryable: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error(`[digitalrx-helpers] Non-JSON response (HTTP ${response.status}, ct=${contentType}, ${responseText.length} chars): ${responseText.substring(0, 300)}`);
    return {
      success: false,
      error: `Invalid response from DigitalRx (not JSON) [HTTP ${response.status} ${response.statusText}, content-type=${contentType}, body-length=${responseText.length}]`,
      rawResponse: responseText.substring(0, 1500),
      retryable: true,
    };
  }

  let statusData: DigitalRxStatusData;
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { success: false, error: "DigitalRx returned empty array — no data for this QueueID", retryable: false };
    }
    // Greenwich returns an ARRAY of Rx entries per queue ID — one entry per
    // pharmacist action (original Rx, retypes, voids, re-issues). The NEWEST
    // entry (highest RxDate) is the current state of the order; older entries
    // are historical snapshots. Reading parsed[0] (the oldest) caused us to
    // show stale rejected/paused statuses for orders Greenwich had already
    // retyped. Diana Harr q2232755 was the canary: RxNumber 863295 RPH REJECT
    // (5/7) followed by RxNumber 871273 TYPED (5/10 retype) — we kept showing
    // her as rejected for 3 days. Sort by RxDate desc, fall back to RxNumber
    // desc if RxDate is missing or equal. (Established May 12 2026.)
    const entries = parsed as DigitalRxStatusData[];
    statusData = pickAuthoritativeEntry(entries);
    if (entries.length > 1) {
      console.log(
        `[digitalrx-helpers] Greenwich returned ${entries.length} Rx entries; chose authoritative RxNumber=${statusData?.RxNumber} RxDate=${statusData?.RxDate} Statuswf=${statusData?.Statuswf} (alive-line preference over rejected duplicates)`,
      );
    }
  } else {
    statusData = parsed as DigitalRxStatusData;
  }

  if (statusData.Error) {
    const retryable = isTransientError(statusData.Error);
    return { success: false, error: statusData.Error, retryable };
  }

  return { success: true, data: statusData };
}

export async function fetchDigitalRxStatus(
  backend: ResolvedBackend,
  queueId: string,
): Promise<
  | { success: true; data: DigitalRxStatusData }
  | { success: false; error: string; errorText?: string; rawResponse?: string; queueNotFound?: boolean }
> {
  const queueIdNumeric = queueId.trim().replace(/^RX-/i, "");
  const storeId = (backend.storeId || "").trim();
  const apiKey = (backend.apiKey || "").trim();
  const statusUrl = `${backend.baseUrl}/RxRequestStatus`;

  console.log(`[digitalrx-helpers] Calling ${statusUrl} | StoreID: ${storeId} | QueueID: ${queueIdNumeric} | apiKey length: ${apiKey.length}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await singleFetchDigitalRxStatus(statusUrl, storeId, apiKey, queueIdNumeric);

    if (result.success) return result;

    if (!result.retryable || attempt === MAX_RETRIES) {
      if (attempt > 0) {
        console.log(`[digitalrx-helpers] Failed after ${attempt + 1} attempts for QueueID ${queueIdNumeric}: ${result.error}`);
      }
      const { retryable: _, ...rest } = result;
      return rest;
    }

    const delay = RETRY_DELAY_MS * (attempt + 1);
    console.log(`[digitalrx-helpers] Attempt ${attempt + 1} failed (retryable): ${result.error} — retrying in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  return { success: false, error: "Exhausted all retries" };
}
