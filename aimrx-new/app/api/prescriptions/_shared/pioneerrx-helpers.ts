import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

interface PharmacyBackendRow {
  pharmacy_id?: string;
  api_key_encrypted: string;
  api_url: string | null;
  store_id: string | null;
  location_id: string | null;
}

export interface PioneerRxBackend {
  apiKey: string;
  sharedSecret: string;
  baseUrl: string;
  storeId: string | null;
  locationId: string | null;
}

export interface PioneerRxStatusData {
  TransactionID?: string;
  RxTransactionID?: string;
  rxTransactionID?: string;
  RxNumber?: number;
  rxNumber?: number;
  RxStatusTypeID?: number;
  rxStatusTypeID?: number;
  primaryClaimResponse?: Record<string, unknown>;
  status?: string;
  trackingNumber?: string;
  TrackingNumber?: string;
  fillDate?: string;
  FillDate?: string;
  dispensedDate?: string;
  DispensedDate?: string;
  deliveredDate?: string;
  DeliveredDate?: string;
  cancelledDate?: string;
  CancelledDate?: string;
  lastUpdated?: string;
  LastUpdated?: string;
  error?: string;
  Error?: string;
  message?: string;
  Message?: string;
  [key: string]: unknown;
}

export interface MappedStatus {
  newStatus: string;
  trackingNumber: string | null;
}

function generatePioneerRxHeaders(apiKey: string, sharedSecret: string) {
  const timestamp = new Date().toISOString();

  const saltedValue = timestamp + sharedSecret;
  const encoded = Buffer.from(saltedValue, "utf16le");
  const signature = crypto.createHash("sha512")
    .update(encoded)
    .digest("base64");

  return {
    "Content-Type": "application/json",
    "prx-api-key": apiKey,
    "prx-timestamp": timestamp,
    "prx-signature": signature,
  };
}

export function mapPioneerRxStatus(
  statusData: PioneerRxStatusData,
  currentStatus: string,
  existingTracking?: string | null,
): MappedStatus {
  let newStatus = currentStatus;

  const statusTypeId = statusData.RxStatusTypeID || statusData.rxStatusTypeID;
  if (statusTypeId !== undefined) {
    switch (statusTypeId) {
      case 1: newStatus = "submitted"; break;
      case 2: newStatus = "packed"; break;
      case 3: newStatus = "cancelled"; break;
      case 4: newStatus = "cancelled"; break;
      case 5: newStatus = "approved"; break;
      case 6: newStatus = "picked_up"; break;
      case 7: newStatus = "delivered"; break;
      default:
        console.warn(`[pioneerrx] Unknown RxStatusTypeID: ${statusTypeId}, keeping current status`);
    }
  } else if (statusData.status) {
    const prxStatus = statusData.status.toLowerCase().trim();
    if (prxStatus === "delivered" || prxStatus === "complete" || prxStatus === "completed") {
      newStatus = "delivered";
    } else if (prxStatus === "shipped" || prxStatus === "in transit" || prxStatus === "picked up" || prxStatus === "out for delivery") {
      newStatus = "picked_up";
    } else if (prxStatus === "verified" || prxStatus === "approved" || prxStatus === "ready for pickup" || prxStatus === "ready for delivery") {
      newStatus = "approved";
    } else if (prxStatus === "filled" || prxStatus === "dispensed" || prxStatus === "packed" || prxStatus === "in process") {
      newStatus = "packed";
    } else if (prxStatus === "received" || prxStatus === "queued" || prxStatus === "submitted" || prxStatus === "pending" || prxStatus === "entered") {
      newStatus = "submitted";
    } else if (prxStatus === "cancelled" || prxStatus === "canceled" || prxStatus === "rejected" || prxStatus === "discontinue" || prxStatus === "voided" || prxStatus === "on hold") {
      newStatus = "cancelled";
    }
  } else if (statusData.deliveredDate || statusData.DeliveredDate) {
    newStatus = "delivered";
  } else if (statusData.dispensedDate || statusData.DispensedDate) {
    newStatus = "packed";
  } else if (statusData.fillDate || statusData.FillDate) {
    newStatus = "packed";
  } else if (statusData.cancelledDate || statusData.CancelledDate) {
    newStatus = "cancelled";
  }

  const trackingNumber =
    statusData.trackingNumber || statusData.TrackingNumber || existingTracking || null;

  return { newStatus, trackingNumber };
}

function resolveBackendRow(row: PharmacyBackendRow): PioneerRxBackend {
  const rawKey = isEncrypted(row.api_key_encrypted)
    ? decryptApiKey(row.api_key_encrypted)
    : row.api_key_encrypted;

  let apiKey = rawKey;
  let sharedSecret = "";

  const pipeIndex = rawKey.indexOf("|");
  if (pipeIndex > 0 && pipeIndex < rawKey.length - 1) {
    apiKey = rawKey.substring(0, pipeIndex);
    sharedSecret = rawKey.substring(pipeIndex + 1);
  } else if (pipeIndex >= 0) {
    console.error("[pioneerrx] INVALID api_key format — expected 'apiKey|sharedSecret' but got malformed value with pipe at position", pipeIndex);
    apiKey = rawKey.replace(/\|/g, "");
  } else {
    console.error("[pioneerrx] INVALID api_key format — expected 'apiKey|sharedSecret' but no pipe separator found. PioneerRx auth will fail without a shared secret.");
  }

  return {
    apiKey,
    sharedSecret,
    baseUrl: row.api_url || "",
    storeId: row.store_id,
    locationId: row.location_id || null,
  };
}

export async function resolvePioneerRxBackend(
  supabase: SupabaseClient,
  pharmacyId: string | null,
): Promise<PioneerRxBackend | null> {
  if (!pharmacyId) {
    console.warn("[pioneerrx] No pharmacy_id provided, cannot resolve PioneerRx backend");
    return null;
  }

  const { data } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id, location_id")
    .eq("pharmacy_id", pharmacyId)
    .eq("is_active", true)
    .eq("system_type", "PioneerRx")
    .single();

  if (!data) return null;
  return resolveBackendRow(data);
}

export async function resolvePioneerRxBackendsBatch(
  supabase: SupabaseClient,
  pharmacyIds: string[],
): Promise<Map<string, PioneerRxBackend>> {
  const backendMap = new Map<string, PioneerRxBackend>();
  const uniqueIds = [...new Set(pharmacyIds.filter(Boolean))];

  if (uniqueIds.length > 0) {
    const { data: backends } = await supabase
      .from("pharmacy_backends")
      .select("pharmacy_id, api_key_encrypted, api_url, store_id, location_id")
      .in("pharmacy_id", uniqueIds)
      .eq("is_active", true)
      .eq("system_type", "PioneerRx");

    if (backends) {
      for (const b of backends) {
        backendMap.set(b.pharmacy_id, resolveBackendRow(b));
      }
    }
  }

  return backendMap;
}

export async function testPioneerRxConnection(
  backend: PioneerRxBackend,
): Promise<{ success: boolean; authenticated?: boolean; error?: string }> {
  try {
    const testUrl = `${backend.baseUrl}/api/v1/Test/IsAvailable`;
    const response = await fetch(testUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return { success: false, error: `Connection failed: ${response.status}` };
    }

    const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
    const authTestUrl = `${backend.baseUrl}/api/v1/Test/IsAvailableWithAuth`;
    const authResponse = await fetch(authTestUrl, {
      method: "GET",
      headers,
    });

    return {
      success: true,
      authenticated: authResponse.ok,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

export async function submitPioneerRxEScript(
  backend: PioneerRxBackend,
  payload: {
    patient: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone?: string;
      email?: string;
    };
    prescriber: {
      firstName: string;
      lastName: string;
      npi?: string;
      dea?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      phone?: string;
    };
    medication: {
      drugName: string;
      ndc?: string;
      quantity: string;
      daysSupply?: number;
      refills: string;
      sig: string;
      dispenseAsWritten: boolean;
      notes?: string;
    };
    rxNumber: string;
    pdfBase64?: string | null;
    signatureUrl?: string | null;
  },
): Promise<
  | { success: true; data: { rxTransactionID: string; [key: string]: unknown } }
  | { success: false; error: string; errorText?: string; rawResponse?: string }
> {
  const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
  const eScriptUrl = `${backend.baseUrl}/api/v1/Prescription/Process/NewEScript`;

  const rxID = crypto.randomUUID();
  const startDate = new Date().toISOString();

  const eScriptPayload: Record<string, unknown> = {
    rx: [{
      rxID,
      directionsLiteral: payload.medication.sig,
      prescribedQuantity: parseFloat(payload.medication.quantity) || 30,
      prescribedQuantityUnit: "EA",
      refillsAuthorized: parseInt(payload.medication.refills) || 0,
      daysSupply: payload.medication.daysSupply || 30,
      startDate,
      dispenseAsWritten: payload.medication.dispenseAsWritten,
      drugName: payload.medication.drugName,
      ndc: payload.medication.ndc || "",
      notes: payload.medication.notes || "",
    }],
    patient: {
      firstName: payload.patient.firstName,
      lastName: payload.patient.lastName,
      dateOfBirth: payload.patient.dateOfBirth,
      gender: payload.patient.gender,
      address: {
        street: payload.patient.street || "",
        city: payload.patient.city || "",
        state: payload.patient.state || "",
        zipCode: payload.patient.zip || "",
      },
      phone: payload.patient.phone || "",
      email: payload.patient.email || "",
    },
    prescriber: {
      firstName: payload.prescriber.firstName,
      lastName: payload.prescriber.lastName,
      npi: payload.prescriber.npi || "",
      dea: payload.prescriber.dea || "",
      address: {
        street: payload.prescriber.street || "",
        city: payload.prescriber.city || "",
        state: payload.prescriber.state || "",
        zipCode: payload.prescriber.zip || "",
      },
      phone: payload.prescriber.phone || "",
    },
    rxNumber: payload.rxNumber,
    pdfDocument: payload.pdfBase64 || null,
    prescriberSignature: payload.signatureUrl || null,
  };

  if (backend.storeId) {
    eScriptPayload.storeID = backend.storeId;
  }
  if (backend.locationId) {
    eScriptPayload.locationID = backend.locationId;
  }

  try {
    console.log(`[pioneerrx] Submitting NewEScript to ${eScriptUrl} with rxID: ${rxID}`);
    const response = await fetch(eScriptUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(eScriptPayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `PioneerRx API error: ${response.status}`,
        errorText,
      };
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: "Invalid response from PioneerRx (not JSON)",
        rawResponse: responseText.substring(0, 200),
      };
    }

    if (data.error || data.Error || data.message) {
      const errMsg = data.error || data.Error || data.message || data.Message;
      if (errMsg) {
        return { success: false, error: errMsg };
      }
    }

    const rxTransactionID = data.TransactionID || data.transactionID
      || data.RxTransactionID || data.rxTransactionID
      || data.id || data.ID;
    const rxNumberReturned = data.RxNumber || data.rxNumber;

    if (!rxTransactionID) {
      return {
        success: false,
        error: "PioneerRx did not return a TransactionID",
        rawResponse: JSON.stringify(data).substring(0, 500),
      };
    }

    return {
      success: true,
      data: {
        ...data,
        rxTransactionID,
        rxNumber: rxNumberReturned,
        primaryClaimResponse: data.primaryClaimResponse || null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "PioneerRx connection failed",
    };
  }
}

export async function fetchPioneerRxStatus(
  backend: PioneerRxBackend,
  rxTransactionID: string,
): Promise<
  | { success: true; data: PioneerRxStatusData }
  | { success: false; error: string; errorText?: string; rawResponse?: string }
> {
  const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
  const cleanId = rxTransactionID.replace(/^RX-/i, "");
  const statusUrl = `${backend.baseUrl}/api/v1/Claim/RxTransaction?rxTransactionID=${encodeURIComponent(cleanId)}`;

  try {
    const response = await fetch(statusUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `PioneerRx API error: ${response.status}`,
        errorText,
      };
    }

    const responseText = await response.text();

    let statusData: PioneerRxStatusData;
    try {
      statusData = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: "Invalid response from PioneerRx (not JSON)",
        rawResponse: responseText.substring(0, 200),
      };
    }

    if (statusData.error || statusData.Error) {
      return { success: false, error: statusData.error || statusData.Error || "Unknown error" };
    }

    return { success: true, data: statusData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "PioneerRx connection failed",
    };
  }
}

export async function fetchPioneerRxPriceCheck(
  backend: PioneerRxBackend,
  ndc: string,
  options?: {
    calculatePriceUsingTypeID?: number;
    quantity?: number;
    daysSupply?: number;
  },
): Promise<
  | { success: true; data: { itemName: string; ndc: string; price: number; total: number; [key: string]: unknown } }
  | { success: false; error: string }
> {
  const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
  const cleanNdc = ndc.replace(/-/g, "");
  const priceCheckUrl = `${backend.baseUrl}/api/v1/Item/Pricing/PriceCheck?ndc=${encodeURIComponent(cleanNdc)}`;

  const body = {
    calculatePriceUsingTypeID: options?.calculatePriceUsingTypeID ?? 2,
    priceScheduleID: null,
    patientCategoryID: null,
    thirdPartyID: null,
    quantity: options?.quantity ?? 30,
    daysSupply: options?.daysSupply ?? 30,
  };

  try {
    const response = await fetch(priceCheckUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { success: false, error: `Price check failed: ${response.status} ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Price check failed",
    };
  }
}
