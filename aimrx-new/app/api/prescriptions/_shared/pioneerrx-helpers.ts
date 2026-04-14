import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

export const SIMULATION_MODE = process.env.PIONEERRX_SIMULATION_MODE === "true";

if (SIMULATION_MODE) {
  console.warn("⚠️ [pioneerrx] SIMULATION MODE IS ACTIVE — all PioneerRx API calls are being simulated. Set PIONEERRX_SIMULATION_MODE=false to use live API.");
}

function simulateMethod(
  methodName: string,
  params: Array<{ Name: string; Value: string }>,
): { success: true; data: PioneerRxMethodResponse } | null {
  if (!SIMULATION_MODE) return null;

  console.log(`[pioneerrx-sim] 🧪 SIMULATION: ${methodName}`);

  const getParam = (name: string) => params.find(p => p.Name === name)?.Value || "";

  switch (methodName) {
    case "PatientSearch": {
      const firstName = getParam("FirstName");
      const lastName = getParam("LastName");
      return {
        success: true,
        data: {
          results: {
            patientSearchResults: [
              { personID: `SIM-PAT-${Date.now()}`, PersonID: `SIM-PAT-${Date.now()}`, firstName, lastName },
            ],
          },
        },
      };
    }
    case "PatientAdd": {
      const patId = `SIM-PAT-${Date.now()}`;
      return {
        success: true,
        data: {
          results: {
            patient: [{ personID: patId, PersonID: patId }],
          },
        },
      };
    }
    case "PrescriberSearch": {
      const presId = `SIM-PRE-${Date.now()}`;
      return {
        success: true,
        data: {
          results: {
            prescriberSearchResults: [
              { personID: presId, PersonID: presId, npi: getParam("NPI") },
            ],
          },
        },
      };
    }
    case "RxAddOnHold": {
      const txId = `SIM-TX-${Date.now()}`;
      const rxId = `SIM-RX-${Date.now()}`;
      console.log(`[pioneerrx-sim] 🧪 Rx submitted successfully — rxTransactionID: ${txId}`);
      return {
        success: true,
        data: {
          results: {
            rxTransaction: [
              { rxTransactionID: txId, rxID: rxId, rxNumber: Math.floor(Math.random() * 900000) + 100000, refillNumber: 0 },
            ],
          },
        },
      };
    }
    case "GetRxTransaction": {
      const simTxId = getParam("RxTransactionID");
      console.log(`[pioneerrx-sim] 🧪 Status check for ${simTxId} → returning "verified" (approved)`);
      return {
        success: true,
        data: {
          results: {
            rxTransaction: [
              {
                rxTransactionID: simTxId,
                currentRxStatusText: "Verified",
                currentRxTransactionStatusText: "Verified",
                currentRxStatusID: 5,
                fillState: "Verified",
              },
            ],
          },
        },
      };
    }
    case "Test": {
      return { success: true, data: { results: {} } };
    }
    default:
      return { success: true, data: { results: {} } };
  }
}

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
  employeeId: string | null;
}

export interface PioneerRxMethodRequest {
  MethodName: string;
  Version: string | number;
  ParameterCollection: Array<{ Name: string; Value: string }>;
}

export interface PioneerRxMethodResponse {
  results?: Record<string, unknown[]>;
  metadata?: unknown[];
}

export interface PioneerRxStatusData {
  rxTransactionID?: string;
  rxID?: string;
  rxNumber?: number;
  rxStatusTypeEnum?: number;
  currentRxStatusID?: number;
  currentRxStatusText?: string;
  currentRxTransactionStatusID?: number;
  currentRxTransactionStatusText?: string;
  fillState?: string;
  completedDate?: string;
  trackingNumber?: string;
  TrackingNumber?: string;
  status?: string;
  [key: string]: unknown;
}

export interface MappedStatus {
  newStatus: string;
  trackingNumber: string | null;
}

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number, d = 2) => String(n).padStart(d, "0");
  return (
    now.getUTCFullYear() +
    "-" +
    pad(now.getUTCMonth() + 1) +
    "-" +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    ":" +
    pad(now.getUTCMinutes()) +
    ":" +
    pad(now.getUTCSeconds()) +
    "." +
    pad(now.getUTCMilliseconds(), 3) +
    "000Z"
  );
}

function generatePioneerRxHeaders(apiKey: string, sharedSecret: string) {
  const timestamp = generateTimestamp();
  const saltedValue = timestamp + sharedSecret;
  const encoded = Buffer.from(saltedValue, "utf16le");
  const signature = crypto
    .createHash("sha512")
    .update(encoded)
    .digest("base64");

  return {
    "Content-Type": "application/json",
    "prx-api-key": apiKey,
    "prx-timestamp": timestamp,
    "prx-signature": signature,
  };
}

export async function callPioneerRxMethod(
  backend: PioneerRxBackend,
  methodName: string,
  params: Array<{ Name: string; Value: string }>,
  options?: { version?: string; useTestEndpoint?: boolean },
): Promise<
  | { success: true; data: PioneerRxMethodResponse }
  | { success: false; error: string; statusCode?: number; rawResponse?: string }
> {
  const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
  const testSuffix = options?.useTestEndpoint ? "/test" : "";
  const url = `${backend.baseUrl}/api/enterprise/method${testSuffix}/process`;

  const body: PioneerRxMethodRequest = {
    MethodName: methodName,
    Version: options?.version || "1.0",
    ParameterCollection: params,
  };

  const simulated = simulateMethod(methodName, params);
  if (simulated) return simulated;

  try {
    console.log(`[pioneerrx] Calling ${methodName} at ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const detail = responseText.substring(0, 500);
      console.error(`[pioneerrx] ${methodName} failed: HTTP ${response.status} — ${detail}`);
      if (response.status === 401) {
        console.error(`[pioneerrx] 401 Unauthorized — likely IP not whitelisted or credentials invalid. API key starts with: ${backend.apiKey.substring(0, 10)}... Base URL: ${backend.baseUrl}`);
      }
      return {
        success: false,
        error: `PioneerRx API error: ${response.status}`,
        statusCode: response.status,
        rawResponse: detail,
      };
    }

    let data: PioneerRxMethodResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: "Invalid response from PioneerRx (not JSON)",
        rawResponse: responseText.substring(0, 200),
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "PioneerRx connection failed",
    };
  }
}

const RX_STATUS_MAP: Record<number, string> = {
  1: "submitted",
  2: "submitted",
  3: "packed",
  4: "packed",
  5: "approved",
  6: "approved",
  7: "picked_up",
  8: "packed",
};

const RX_TRANSACTION_STATUS_MAP: Record<number, string> = {
  1: "submitted",
  2: "submitted",
  3: "packed",
  4: "approved",
  5: "picked_up",
  6: "delivered",
  7: "cancelled",
};

const TEXT_STATUS_MAP: Record<string, string> = {
  "waiting for data entry": "submitted",
  "data entry": "submitted",
  "fill in progress": "submitted",
  "fillable on hold": "submitted",
  "on hold": "submitted",
  "ready for pharmacist review": "packed",
  "pharmacist review": "packed",
  "verified": "approved",
  "ready for pickup": "ready_for_pickup",
  "ready for delivery": "ready_for_pickup",
  "ready for shipping": "ready_for_pickup",
  "will call": "ready_for_pickup",
  "out for delivery": "picked_up",
  "in transit": "picked_up",
  "shipped": "picked_up",
  "picked up": "picked_up",
  "completed": "delivered",
  "complete": "delivered",
  "delivered": "delivered",
  "cancelled": "cancelled",
  "canceled": "cancelled",
  "rejected": "cancelled",
  "voided": "cancelled",
  "discontinued": "cancelled",
  "reversed": "cancelled",
};

export function mapPioneerRxStatus(
  statusData: PioneerRxStatusData,
  currentStatus: string,
  existingTracking?: string | null,
): MappedStatus {
  let newStatus = currentStatus;

  if (statusData.currentRxTransactionStatusID !== undefined) {
    newStatus =
      RX_TRANSACTION_STATUS_MAP[statusData.currentRxTransactionStatusID] || currentStatus;
  } else if (statusData.currentRxStatusID !== undefined) {
    newStatus = RX_STATUS_MAP[statusData.currentRxStatusID] || currentStatus;
  } else if (statusData.rxStatusTypeEnum !== undefined) {
    newStatus = RX_STATUS_MAP[statusData.rxStatusTypeEnum] || currentStatus;
  } else if (statusData.currentRxTransactionStatusText) {
    const normalized = statusData.currentRxTransactionStatusText.toLowerCase().trim();
    newStatus = TEXT_STATUS_MAP[normalized] || currentStatus;
  } else if (statusData.currentRxStatusText) {
    const normalized = statusData.currentRxStatusText.toLowerCase().trim();
    newStatus = TEXT_STATUS_MAP[normalized] || currentStatus;
  } else if (statusData.fillState) {
    const normalized = statusData.fillState.toLowerCase().trim();
    for (const [key, val] of Object.entries(TEXT_STATUS_MAP)) {
      if (normalized.includes(key)) {
        newStatus = val;
        break;
      }
    }
  } else if (statusData.completedDate) {
    newStatus = "delivered";
  } else if (statusData.status) {
    const normalized = statusData.status.toLowerCase().trim();
    newStatus = TEXT_STATUS_MAP[normalized] || currentStatus;
  }

  const trackingNumber =
    (statusData.trackingNumber as string) ||
    (statusData.TrackingNumber as string) ||
    existingTracking ||
    null;

  return { newStatus, trackingNumber };
}

function resolveBackendRow(row: PharmacyBackendRow): PioneerRxBackend {
  const rawKey = isEncrypted(row.api_key_encrypted)
    ? decryptApiKey(row.api_key_encrypted)
    : row.api_key_encrypted;

  let apiKey = rawKey;
  let sharedSecret = "";
  let employeeId: string | null = null;

  const parts = rawKey.split("|");
  if (parts.length >= 2) {
    apiKey = parts[0];
    sharedSecret = parts[1];
    if (parts.length >= 3) {
      employeeId = parts[2];
    }
  } else {
    console.error(
      "[pioneerrx] INVALID api_key format — expected 'apiKey|sharedSecret' or 'apiKey|sharedSecret|employeeId'",
    );
  }

  return {
    apiKey,
    sharedSecret,
    baseUrl: (row.api_url || "").replace(/\/+$/, ""),
    storeId: row.store_id,
    locationId: row.location_id || null,
    employeeId,
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
): Promise<{ success: boolean; authenticated?: boolean; error?: string; details?: string; simulated?: boolean }> {
  if (SIMULATION_MODE) {
    console.log("[pioneerrx-sim] 🧪 SIMULATION: testPioneerRxConnection — returning success");
    return { success: true, authenticated: true, details: "SIMULATION MODE — PioneerRx API calls are simulated", simulated: true };
  }

  try {
    const headers = generatePioneerRxHeaders(backend.apiKey, backend.sharedSecret);
    const authUrl = `${backend.baseUrl}/api/enterprise/isAuthenticated`;

    const authResponse = await fetch(authUrl, {
      method: "POST",
      headers,
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text().catch(() => "");
      return {
        success: false,
        authenticated: false,
        error: `Authentication failed: ${authResponse.status}`,
        details: errorText.substring(0, 200),
      };
    }

    const testResult = await callPioneerRxMethod(
      backend,
      "Test",
      [{ Name: "LocationName", Value: "SmartConnect RX" }],
      { useTestEndpoint: true },
    );

    return {
      success: true,
      authenticated: true,
      details: testResult.success
        ? "Test method executed successfully"
        : `Auth OK, test method: ${testResult.error}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function resolvePatientId(
  backend: PioneerRxBackend,
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  },
): Promise<string | null> {
  const result = await searchPioneerRxPatient(backend, {
    lastName: patient.lastName,
    firstName: patient.firstName,
    dateOfBirth: patient.dateOfBirth,
  });

  if (!result.success || result.data.length === 0) {
    return null;
  }

  const personID =
    result.data[0].personID || result.data[0].PersonID || result.data[0].patientID || result.data[0].PatientID;
  return personID ? String(personID) : null;
}

async function resolvePrescriberId(
  backend: PioneerRxBackend,
  prescriber: {
    firstName: string;
    lastName: string;
    npi?: string;
    dea?: string;
  },
): Promise<string | null> {
  const searchParams: { lastName?: string; firstName?: string; npi?: string; dea?: string } = {};

  if (prescriber.npi) {
    searchParams.npi = prescriber.npi;
  } else if (prescriber.dea) {
    searchParams.dea = prescriber.dea;
  } else {
    searchParams.lastName = prescriber.lastName;
    searchParams.firstName = prescriber.firstName;
  }

  const result = await searchPioneerRxPrescriber(backend, searchParams);

  if (!result.success || result.data.length === 0) {
    return null;
  }

  const personID =
    result.data[0].personID || result.data[0].PersonID || result.data[0].prescriberID || result.data[0].PrescriberID;
  return personID ? String(personID) : null;
}

export async function addPioneerRxPatient(
  backend: PioneerRxBackend,
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
  },
): Promise<
  | { success: true; patientId: string }
  | { success: false; error: string }
> {
  const employeeId = backend.employeeId || "2005";

  const genderMap: Record<string, string> = {
    male: "1",
    female: "2",
    m: "1",
    f: "2",
    other: "3",
    unknown: "0",
  };
  const genderCode = genderMap[(patient.gender || "").toLowerCase()] || "0";

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
    { Name: "FirstName", Value: patient.firstName },
    { Name: "LastName", Value: patient.lastName },
    { Name: "GenderID", Value: genderCode },
  ];

  if (patient.dateOfBirth) {
    const dob = new Date(patient.dateOfBirth);
    if (!isNaN(dob.getTime())) {
      params.push({ Name: "DateOfBirth", Value: `${dob.getMonth() + 1}/${dob.getDate()}/${dob.getFullYear()}` });
    }
  }

  if (patient.street) params.push({ Name: "AddressLine1", Value: patient.street });
  if (patient.city) params.push({ Name: "City", Value: patient.city });
  if (patient.state) params.push({ Name: "State", Value: patient.state });
  if (patient.zip) params.push({ Name: "ZipCode", Value: patient.zip });
  if (patient.phone) params.push({ Name: "PrimaryPhone", Value: patient.phone.replace(/\D/g, "") });
  if (patient.email) params.push({ Name: "Email", Value: patient.email });

  console.log(`[pioneerrx] Adding patient: ${patient.firstName} ${patient.lastName}`);

  const result = await callPioneerRxMethod(backend, "PatientAdd", params);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const patientData =
    (result.data.results?.patient as Array<Record<string, unknown>>)?.[0] ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>)?.[0];

  const newPatientId = patientData
    ? String(patientData.personID || patientData.PersonID || patientData.patientID || patientData.PatientID || "")
    : "";

  if (!newPatientId) {
    return {
      success: false,
      error: "PioneerRx did not return a patient ID after registration",
    };
  }

  return { success: true, patientId: newPatientId };
}

export async function submitPioneerRxEScript(
  backend: PioneerRxBackend,
  payload: {
    patient: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      patientId?: string;
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
      prescriberId?: string;
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
      icd10?: string;
      notes?: string;
    };
    rxNumber: string;
    pdfBase64?: string | null;
    signatureUrl?: string | null;
  },
): Promise<
  | {
      success: true;
      data: { rxTransactionID: string; rxID: string; rxNumber: number; refillNumber: number };
    }
  | { success: false; error: string; rawResponse?: string }
> {
  const employeeId = backend.employeeId || "2005";

  let patientId = payload.patient.patientId || null;
  let prescriberId = payload.prescriber.prescriberId || null;

  if (!patientId) {
    console.log("[pioneerrx] No PatientID provided, searching PioneerRx...");
    patientId = await resolvePatientId(backend, {
      firstName: payload.patient.firstName,
      lastName: payload.patient.lastName,
      dateOfBirth: payload.patient.dateOfBirth,
    });
    if (patientId) {
      console.log(`[pioneerrx] Found PatientID: ${patientId}`);
    } else {
      console.log("[pioneerrx] Patient not found, auto-registering in PioneerRx...");
      const addResult = await addPioneerRxPatient(backend, payload.patient);
      if (addResult.success) {
        patientId = addResult.patientId;
        console.log(`[pioneerrx] Patient auto-registered, PatientID: ${patientId}`);
      } else {
        return {
          success: false,
          error: `Failed to register patient "${payload.patient.firstName} ${payload.patient.lastName}" in PioneerRx: ${addResult.error}`,
        };
      }
    }
  }

  if (!prescriberId) {
    console.log("[pioneerrx] No WrittenByID provided, searching PioneerRx...");
    prescriberId = await resolvePrescriberId(backend, {
      firstName: payload.prescriber.firstName,
      lastName: payload.prescriber.lastName,
      npi: payload.prescriber.npi,
      dea: payload.prescriber.dea,
    });
    if (prescriberId) {
      console.log(`[pioneerrx] Found WrittenByID: ${prescriberId}`);
    } else {
      return {
        success: false,
        error: `Prescriber "${payload.prescriber.firstName} ${payload.prescriber.lastName}" (NPI: ${payload.prescriber.npi || "N/A"}) not found in PioneerRx. The prescriber must be registered in the pharmacy's PioneerRx system.`,
      };
    }
  }

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
    { Name: "PatientID", Value: patientId },
    { Name: "WrittenByID", Value: prescriberId },
    { Name: "DateWritten", Value: new Date().toLocaleDateString("en-US") },
    { Name: "Directions", Value: payload.medication.sig },
    { Name: "Quantity", Value: String(parseFloat(payload.medication.quantity) || 30) },
    { Name: "QuantityTypeID", Value: "1" },
    { Name: "NumberOfRefillsAllowed", Value: String(parseInt(payload.medication.refills) || 0) },
    { Name: "OriginTypeID", Value: "5" },
  ];

  if (payload.medication.ndc) {
    params.push({ Name: "MedicationNDC", Value: payload.medication.ndc.replace(/-/g, "") });
  }

  if (payload.medication.dispenseAsWritten) {
    params.push({ Name: "DispenseAsWritten", Value: "1" });
  }

  if (payload.medication.icd10) {
    params.push({ Name: "Icd10CodePrimary", Value: payload.medication.icd10 });
  }

  if (payload.pdfBase64) {
    params.push({ Name: "ScriptImage", Value: payload.pdfBase64 });
  }

  if (payload.medication.notes) {
    params.push({ Name: "InformationalComment", Value: payload.medication.notes });
  }

  if (payload.rxNumber) {
    params.push({ Name: "PrescriberOrderNumber", Value: payload.rxNumber });
  }

  console.log(
    `[pioneerrx] Submitting RxAddOnHold with ${params.length} params, employeeId=${employeeId}, patientId=${patientId}, prescriberId=${prescriberId}`,
  );

  const result = await callPioneerRxMethod(backend, "RxAddOnHold", params);

  if (!result.success) {
    return { success: false, error: result.error, rawResponse: result.rawResponse };
  }

  const rxTransaction =
    (result.data.results?.rxTransaction as Array<Record<string, unknown>>)?.[0] ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>)?.[0];

  if (!rxTransaction) {
    return {
      success: false,
      error: "PioneerRx did not return an rxTransaction in results",
      rawResponse: JSON.stringify(result.data).substring(0, 500),
    };
  }

  return {
    success: true,
    data: {
      rxTransactionID: String(rxTransaction.rxTransactionID || ""),
      rxID: String(rxTransaction.rxID || ""),
      rxNumber: Number(rxTransaction.rxNumber) || 0,
      refillNumber: Number(rxTransaction.refillNumber) || 0,
    },
  };
}

export async function fetchPioneerRxStatus(
  backend: PioneerRxBackend,
  rxTransactionID: string,
): Promise<
  | { success: true; data: PioneerRxStatusData }
  | { success: false; error: string; rawResponse?: string }
> {
  const employeeId = backend.employeeId || "2005";
  const cleanId = rxTransactionID.replace(/^RX-/i, "");

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
    { Name: "RxTransactionID", Value: cleanId },
  ];

  const result = await callPioneerRxMethod(backend, "GetRxTransaction", params);

  if (!result.success) {
    return { success: false, error: result.error, rawResponse: result.rawResponse };
  }

  const txData =
    (result.data.results?.rxTransaction as Array<Record<string, unknown>>)?.[0] ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>)?.[0];

  if (!txData) {
    return {
      success: false,
      error: "No transaction data found for this ID",
      rawResponse: JSON.stringify(result.data).substring(0, 500),
    };
  }

  return { success: true, data: txData as PioneerRxStatusData };
}

export async function searchPioneerRxPatient(
  backend: PioneerRxBackend,
  searchParams: {
    lastName?: string;
    firstName?: string;
    dateOfBirth?: string;
    phone?: string;
  },
): Promise<
  | { success: true; data: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const employeeId = backend.employeeId || "2005";

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
  ];

  if (searchParams.lastName) {
    params.push({ Name: "LastName", Value: searchParams.lastName });
  }
  if (searchParams.firstName) {
    params.push({ Name: "FirstName", Value: searchParams.firstName });
  }
  if (searchParams.dateOfBirth) {
    params.push({ Name: "DateOfBirth", Value: searchParams.dateOfBirth });
  }
  if (searchParams.phone) {
    params.push({ Name: "PhoneNumber", Value: searchParams.phone });
  }

  const result = await callPioneerRxMethod(backend, "PatientSearch", params);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const patients =
    (result.data.results?.patientSearchResults as Array<Record<string, unknown>>) ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>) ||
    [];

  return { success: true, data: patients };
}

export async function searchPioneerRxPrescriber(
  backend: PioneerRxBackend,
  searchParams: {
    lastName?: string;
    firstName?: string;
    npi?: string;
    dea?: string;
  },
): Promise<
  | { success: true; data: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const employeeId = backend.employeeId || "2005";

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
  ];

  if (searchParams.lastName) {
    params.push({ Name: "LastName", Value: searchParams.lastName });
  }
  if (searchParams.firstName) {
    params.push({ Name: "FirstName", Value: searchParams.firstName });
  }
  if (searchParams.npi) {
    params.push({ Name: "NPI", Value: searchParams.npi });
  }
  if (searchParams.dea) {
    params.push({ Name: "DEANumber", Value: searchParams.dea });
  }

  const result = await callPioneerRxMethod(backend, "PrescriberSearch", params);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const prescribers =
    (result.data.results?.prescriberSearchResults as Array<Record<string, unknown>>) ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>) ||
    [];

  return { success: true, data: prescribers };
}

export async function searchPioneerRxItem(
  backend: PioneerRxBackend,
  searchParams: {
    ndc?: string;
    gcn?: string;
    itemName?: string;
  },
): Promise<
  | { success: true; data: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const employeeId = backend.employeeId || "2005";

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
  ];

  if (searchParams.ndc) {
    params.push({ Name: "NDC", Value: searchParams.ndc.replace(/-/g, "") });
  }
  if (searchParams.gcn) {
    params.push({ Name: "GCN", Value: searchParams.gcn });
  }
  if (searchParams.itemName) {
    params.push({ Name: "ItemName", Value: searchParams.itemName });
  }

  const result = await callPioneerRxMethod(backend, "ItemSearch", params);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const items =
    (result.data.results?.itemSearchResults as Array<Record<string, unknown>>) ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>) ||
    [];

  return { success: true, data: items };
}

export async function fetchPioneerRxRefillQuery(
  backend: PioneerRxBackend,
  rxNumber: string,
): Promise<
  | { success: true; data: Array<Record<string, unknown>> }
  | { success: false; error: string }
> {
  const employeeId = backend.employeeId || "2005";

  const params: Array<{ Name: string; Value: string }> = [
    { Name: "RequestedByEmployeeID", Value: employeeId },
    { Name: "RxNumber", Value: rxNumber },
  ];

  const result = await callPioneerRxMethod(backend, "RefillQuery", params);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const refills =
    (result.data.results?.refillQuery as Array<Record<string, unknown>>) ||
    (result.data.results?.["1"] as Array<Record<string, unknown>>) ||
    [];

  return { success: true, data: refills };
}
