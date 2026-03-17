import { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

export type PharmacySystemType = "DigitalRx" | "PioneerRx" | "QS1" | "Liberty" | "Custom" | "BestRx";

export interface PharmacyBackendInfo {
  id: string;
  pharmacy_id: string;
  system_type: PharmacySystemType;
  api_key_encrypted: string;
  api_url: string | null;
  store_id: string | null;
  location_id: string | null;
  is_active: boolean;
}

export interface ResolvedPharmacyBackend {
  systemType: PharmacySystemType;
  apiKey: string;
  sharedSecret: string;
  baseUrl: string;
  storeId: string | null;
  locationId: string | null;
}

function decryptKey(encrypted: string): string {
  if (isEncrypted(encrypted)) {
    try {
      return decryptApiKey(encrypted);
    } catch (err) {
      console.error("⚠️ [pharmacy-dispatcher] Failed to decrypt API key:", err instanceof Error ? err.message : err);
      return encrypted;
    }
  }
  return encrypted;
}

function resolveRow(row: PharmacyBackendInfo): ResolvedPharmacyBackend {
  const rawKey = decryptKey(row.api_key_encrypted);
  const systemType = row.system_type as PharmacySystemType;

  let apiKey = rawKey;
  let sharedSecret = "";

  if (systemType === "PioneerRx") {
    const pipeIndex = rawKey.indexOf("|");
    if (pipeIndex > 0 && pipeIndex < rawKey.length - 1) {
      apiKey = rawKey.substring(0, pipeIndex);
      sharedSecret = rawKey.substring(pipeIndex + 1);
    } else if (pipeIndex >= 0) {
      console.error("[pharmacy-dispatcher] PioneerRx: INVALID api_key format — expected 'apiKey|sharedSecret' but got malformed value");
      apiKey = rawKey.replace(/\|/g, "");
    } else {
      console.error("[pharmacy-dispatcher] PioneerRx: INVALID api_key format — expected 'apiKey|sharedSecret' but no pipe separator found. Auth will fail.");
    }
  }

  return {
    systemType,
    apiKey,
    sharedSecret,
    baseUrl: row.api_url || "",
    storeId: row.store_id,
    locationId: row.location_id,
  };
}

export async function resolvePharmacyBackendByPharmacy(
  supabase: SupabaseClient,
  pharmacyId: string,
): Promise<ResolvedPharmacyBackend | null> {
  const { data } = await supabase
    .from("pharmacy_backends")
    .select("id, pharmacy_id, system_type, api_key_encrypted, api_url, store_id, location_id, is_active")
    .eq("pharmacy_id", pharmacyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;
  return resolveRow(data as PharmacyBackendInfo);
}

export async function resolvePharmacyBackendByType(
  supabase: SupabaseClient,
  pharmacyId: string,
  systemType: PharmacySystemType,
): Promise<ResolvedPharmacyBackend | null> {
  const { data } = await supabase
    .from("pharmacy_backends")
    .select("id, pharmacy_id, system_type, api_key_encrypted, api_url, store_id, location_id, is_active")
    .eq("pharmacy_id", pharmacyId)
    .eq("is_active", true)
    .eq("system_type", systemType)
    .single();

  if (!data) return null;
  return resolveRow(data as PharmacyBackendInfo);
}

export async function resolvePharmacyBackendAny(
  supabase: SupabaseClient,
  pharmacyId: string | null,
): Promise<ResolvedPharmacyBackend | null> {
  if (!pharmacyId) {
    console.warn("[pharmacy-dispatcher] No pharmacy_id provided, cannot resolve backend");
    return null;
  }

  return resolvePharmacyBackendByPharmacy(supabase, pharmacyId);
}

export async function resolvePharmacyBackendsBatchAll(
  supabase: SupabaseClient,
  pharmacyIds: string[],
): Promise<Map<string, ResolvedPharmacyBackend>> {
  const backendMap = new Map<string, ResolvedPharmacyBackend>();
  const uniqueIds = [...new Set(pharmacyIds.filter(Boolean))];

  if (uniqueIds.length === 0) return backendMap;

  const { data: backends } = await supabase
    .from("pharmacy_backends")
    .select("id, pharmacy_id, system_type, api_key_encrypted, api_url, store_id, location_id, is_active")
    .in("pharmacy_id", uniqueIds)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (backends) {
    for (const b of backends) {
      if (!backendMap.has(b.pharmacy_id)) {
        backendMap.set(b.pharmacy_id, resolveRow(b as PharmacyBackendInfo));
      }
    }
  }

  return backendMap;
}
