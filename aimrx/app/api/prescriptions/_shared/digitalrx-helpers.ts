import { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

const DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";

// --- Types ---

export interface DigitalRxStatusData {
  Status?: string;
  DeliveredDate?: string;
  PickupDate?: string;
  ApprovedDate?: string;
  PackDateTime?: string;
  TrackingNumber?: string;
  LastUpdated?: string;
  Error?: string;
  [key: string]: unknown;
}

export interface MappedStatus {
  newStatus: string;
  trackingNumber: string | null;
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
export function mapDigitalRxStatus(
  statusData: DigitalRxStatusData,
  currentStatus: string,
  existingTracking?: string | null,
): MappedStatus {
  let newStatus = currentStatus;

  if (statusData.Status) {
    const digitalRxStatus = statusData.Status.toLowerCase().trim();
    if (digitalRxStatus === "delivered") {
      newStatus = "delivered";
    } else if (digitalRxStatus === "picked up") {
      newStatus = "picked_up";
    } else if (digitalRxStatus === "approved") {
      newStatus = "approved";
    } else if (digitalRxStatus === "packed") {
      newStatus = "packed";
    } else if (digitalRxStatus === "submitted") {
      newStatus = "submitted";
    }
  } else if (statusData.DeliveredDate) {
    newStatus = "delivered";
  } else if (statusData.PickupDate) {
    newStatus = "picked_up";
  } else if (statusData.ApprovedDate) {
    newStatus = "approved";
  } else if (statusData.PackDateTime) {
    newStatus = "packed";
  }

  const trackingNumber =
    statusData.TrackingNumber || existingTracking || null;

  return { newStatus, trackingNumber };
}

// --- Backend Resolution ---

function resolveBackendRow(row: PharmacyBackendRow): ResolvedBackend {
  const apiKey = isEncrypted(row.api_key_encrypted)
    ? decryptApiKey(row.api_key_encrypted)
    : row.api_key_encrypted;

  return {
    apiKey,
    baseUrl: row.api_url || DIGITALRX_BASE_URL,
    storeId: row.store_id,
  };
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

    if (data) return resolveBackendRow(data);
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
        backendMap.set(b.pharmacy_id, resolveBackendRow(b));
      }
    }
  }

  // Fetch default backend as fallback
  const { data: defaultBackend } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id")
    .eq("is_active", true)
    .eq("system_type", "DigitalRx")
    .limit(1)
    .single();

  if (defaultBackend) {
    backendMap.set("__default__", resolveBackendRow(defaultBackend));
  }

  return backendMap;
}

// --- DigitalRx API Call ---

/**
 * Calls the DigitalRx RxRequestStatus endpoint.
 * Strips the "RX-" prefix from queue_id before sending.
 */
export async function fetchDigitalRxStatus(
  backend: ResolvedBackend,
  queueId: string,
): Promise<
  | { success: true; data: DigitalRxStatusData }
  | { success: false; error: string; errorText?: string; rawResponse?: string }
> {
  const queueIdNumeric = queueId.replace(/^RX-/i, "");
  const statusUrl = `${backend.baseUrl}/RxRequestStatus`;

  const response = await fetch(statusUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: backend.apiKey,
    },
    body: JSON.stringify({
      StoreID: backend.storeId,
      QueueID: queueIdNumeric,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return {
      success: false,
      error: `API error: ${response.status}`,
      errorText,
    };
  }

  const responseText = await response.text();

  let statusData: DigitalRxStatusData;
  try {
    statusData = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: "Invalid response from DigitalRx (not JSON)",
      rawResponse: responseText.substring(0, 200),
    };
  }

  if (statusData.Error) {
    return { success: false, error: statusData.Error };
  }

  return { success: true, data: statusData };
}
