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
  rxTransactionID?: string;
  status?: string;
  trackingNumber?: string;
  fillDate?: string;
  dispensedDate?: string;
  deliveredDate?: string;
  cancelledDate?: string;
  lastUpdated?: string;
  error?: string;
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
  const signature = crypto.createHmac("sha512", Buffer.from(sharedSecret, "utf16le"))
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

  if (statusData.status) {
    const prxStatus = statusData.status.toLowerCase().trim();
    if (prxStatus === "delivered" || prxStatus === "complete" || prxStatus === "completed") {
      newStatus = "delivered";
    } else if (prxStatus === "shipped" || prxStatus === "in transit" || prxStatus === "picked up") {
      newStatus = "picked_up";
    } else if (prxStatus === "verified" || prxStatus === "approved") {
      newStatus = "approved";
    } else if (prxStatus === "filled" || prxStatus === "dispensed" || prxStatus === "packed") {
      newStatus = "packed";
    } else if (prxStatus === "received" || prxStatus === "queued" || prxStatus === "submitted" || prxStatus === "pending") {
      newStatus = "submitted";
    } else if (prxStatus === "cancelled" || prxStatus === "canceled" || prxStatus === "rejected") {
      newStatus = "cancelled";
    }
  } else if (statusData.deliveredDate) {
    newStatus = "delivered";
  } else if (statusData.dispensedDate) {
    newStatus = "packed";
  } else if (statusData.fillDate) {
    newStatus = "packed";
  } else if (statusData.cancelledDate) {
    newStatus = "cancelled";
  }

  const trackingNumber =
    statusData.trackingNumber || existingTracking || null;

  return { newStatus, trackingNumber };
}

function resolveBackendRow(row: PharmacyBackendRow): PioneerRxBackend {
  const rawKey = isEncrypted(row.api_key_encrypted)
    ? decryptApiKey(row.api_key_encrypted)
    : row.api_key_encrypted;

  let apiKey = rawKey;
  let sharedSecret = "";

  if (rawKey.includes("|")) {
    const parts = rawKey.split("|");
    apiKey = parts[0];
    sharedSecret = parts[1];
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
  if (pharmacyId) {
    const { data } = await supabase
      .from("pharmacy_backends")
      .select("api_key_encrypted, api_url, store_id, location_id")
      .eq("pharmacy_id", pharmacyId)
      .eq("is_active", true)
      .eq("system_type", "PioneerRx")
      .single();

    if (data) return resolveBackendRow(data);
  }

  const { data: defaultBackend, error } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id, location_id")
    .eq("is_active", true)
    .eq("system_type", "PioneerRx")
    .limit(1)
    .single();

  if (!defaultBackend || error) return null;

  return resolveBackendRow(defaultBackend);
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

  const { data: defaultBackend } = await supabase
    .from("pharmacy_backends")
    .select("api_key_encrypted, api_url, store_id, location_id")
    .eq("is_active", true)
    .eq("system_type", "PioneerRx")
    .limit(1)
    .single();

  if (defaultBackend) {
    backendMap.set("__default__", resolveBackendRow(defaultBackend));
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
  const eScriptUrl = `${backend.baseUrl}/api/v1/EScript/New`;

  const eScriptPayload = {
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
    medication: {
      drugName: payload.medication.drugName,
      ndc: payload.medication.ndc || "",
      quantity: payload.medication.quantity,
      daysSupply: payload.medication.daysSupply || 30,
      refills: payload.medication.refills,
      sig: payload.medication.sig,
      dispenseAsWritten: payload.medication.dispenseAsWritten,
      notes: payload.medication.notes || "",
    },
    rxNumber: payload.rxNumber,
    pdfDocument: payload.pdfBase64 || null,
    prescriberSignature: payload.signatureUrl || null,
  };

  try {
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

    if (data.error || data.Error) {
      return { success: false, error: data.error || data.Error };
    }

    const rxTransactionID = data.rxTransactionID || data.RxTransactionID || data.id || data.ID;
    if (!rxTransactionID) {
      return {
        success: false,
        error: "PioneerRx did not return an rxTransactionID",
        rawResponse: JSON.stringify(data).substring(0, 200),
      };
    }

    return { success: true, data: { ...data, rxTransactionID } };
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
  const statusUrl = `${backend.baseUrl}/api/v1/Claims/RxTransaction/${cleanId}`;

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

    if (statusData.error) {
      return { success: false, error: statusData.error };
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
  const priceCheckUrl = `${backend.baseUrl}/api/v1/Item/Pricing/PriceCheck/Rx/${cleanNdc}`;

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
