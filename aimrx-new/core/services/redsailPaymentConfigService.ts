import { createAdminClient } from "@core/database/client";
import {
  encryptApiKey,
  decryptApiKey,
  isEncrypted,
} from "@/core/security/encryption";
import { maskCredential } from "@/core/services/pharmacyPaymentConfigService";

export type RedsailEnvironment = "ftr1" | "prv" | "production";

/**
 * Base URLs for each Emporos Payments environment. Used to derive the API
 * endpoint when no explicit override is configured.
 */
export const REDSAIL_BASE_URLS: Record<RedsailEnvironment, string> = {
  ftr1: "https://empftr1-payments-dev.emporos.io",
  prv: "https://payments-prv.emporos.io",
  production: "https://payments.emporos.io",
};

export type RedsailLinkAuthMode =
  | "SingleUseToken"
  | "LastNameAndDob"
  | "LastNameAndZipCode";

export interface RedsailPaymentConfigInput {
  pharmacyId: string;
  environment?: RedsailEnvironment;
  label?: string;
  tenantId?: string;
  siteId?: string;
  stationId?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcTokenUrl?: string;
  webhookAudience?: string;
  apiBaseUrl?: string;
  linkToPayAuthMode?: RedsailLinkAuthMode;
  isActive?: boolean;
}

export interface DecryptedRedsailConfig {
  id: string;
  pharmacyId: string;
  environment: RedsailEnvironment;
  isActive: boolean;
  isConnected: boolean;
  label: string | null;
  tenantId?: string;
  siteId?: string;
  stationId?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcTokenUrl?: string;
  webhookAudience?: string;
  apiBaseUrl?: string;
  linkToPayAuthMode: RedsailLinkAuthMode;
  connectedAt?: string;
  lastTestedAt?: string;
  lastError?: string;
}

/** Fields whose change invalidates a prior successful connection. */
const CONNECTIVITY_SENSITIVE_COLUMNS = [
  "environment",
  "tenant_id",
  "site_id",
  "station_id",
  "oidc_client_id",
  "oidc_token_url",
  "webhook_audience",
  "api_base_url",
] as const;

function decryptConfig(raw: Record<string, unknown>): DecryptedRedsailConfig {
  const config: DecryptedRedsailConfig = {
    id: raw.id as string,
    pharmacyId: raw.pharmacy_id as string,
    environment: (raw.environment as RedsailEnvironment) || "ftr1",
    isActive: raw.is_active as boolean,
    isConnected: raw.is_connected as boolean,
    label: (raw.label as string | null) ?? null,
    tenantId: (raw.tenant_id as string) || undefined,
    siteId: (raw.site_id as string) || undefined,
    stationId: (raw.station_id as string) || undefined,
    oidcClientId: (raw.oidc_client_id as string) || undefined,
    oidcTokenUrl: (raw.oidc_token_url as string) || undefined,
    webhookAudience: (raw.webhook_audience as string) || undefined,
    apiBaseUrl: (raw.api_base_url as string) || undefined,
    linkToPayAuthMode:
      (raw.link_to_pay_auth_mode as RedsailLinkAuthMode) || "SingleUseToken",
    connectedAt: (raw.connected_at as string) || undefined,
    lastTestedAt: (raw.last_tested_at as string) || undefined,
    lastError: (raw.last_error as string) || undefined,
  };

  if (
    raw.oidc_client_secret_encrypted &&
    isEncrypted(raw.oidc_client_secret_encrypted as string)
  ) {
    try {
      config.oidcClientSecret = decryptApiKey(
        raw.oidc_client_secret_encrypted as string,
      );
    } catch {
      /* ignore decrypt failures */
    }
  }

  return config;
}

export async function getActiveRedsailConfig(
  pharmacyId: string,
): Promise<DecryptedRedsailConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("redsail_payment_configs")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return decryptConfig(data[0]);
}

export async function getRedsailConfigById(
  configId: string,
): Promise<DecryptedRedsailConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("redsail_payment_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (error || !data) return null;
  return decryptConfig(data);
}

export async function getRedsailConfigsForPharmacy(
  pharmacyId: string,
): Promise<DecryptedRedsailConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("redsail_payment_configs")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(decryptConfig);
}

export async function upsertRedsailConfig(
  input: RedsailPaymentConfigInput,
): Promise<{ success: boolean; configId?: string; error?: string }> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    pharmacy_id: input.pharmacyId,
    environment: input.environment || "ftr1",
    label: input.label || null,
    updated_at: new Date().toISOString(),
  };

  if (input.tenantId !== undefined) updateData.tenant_id = input.tenantId || null;
  if (input.siteId !== undefined) updateData.site_id = input.siteId || null;
  if (input.stationId !== undefined) updateData.station_id = input.stationId || null;
  if (input.oidcClientId !== undefined)
    updateData.oidc_client_id = input.oidcClientId || null;
  if (input.oidcClientSecret) {
    updateData.oidc_client_secret_encrypted = encryptApiKey(input.oidcClientSecret);
  }
  // Only sent when explicitly provided so the payload stays compatible with
  // databases where the newer columns have not been migrated yet.
  if (input.oidcTokenUrl !== undefined)
    updateData.oidc_token_url = input.oidcTokenUrl || null;
  if (input.webhookAudience !== undefined)
    updateData.webhook_audience = input.webhookAudience || null;
  if (input.apiBaseUrl !== undefined)
    updateData.api_base_url = input.apiBaseUrl || null;
  if (input.linkToPayAuthMode !== undefined)
    updateData.link_to_pay_auth_mode = input.linkToPayAuthMode;

  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive;
  }

  // Fetch the full existing row so we can decide whether the edit touched any
  // connectivity-sensitive field. A pure label/cosmetic edit must NOT silently
  // drop a verified connection.
  const { data: existingRows } = await supabase
    .from("redsail_payment_configs")
    .select("*")
    .eq("pharmacy_id", input.pharmacyId)
    .order("created_at", { ascending: true })
    .limit(1);

  const existing = existingRows?.[0] as Record<string, unknown> | undefined;

  if (existing) {
    let connectivityChanged = false;
    for (const col of CONNECTIVITY_SENSITIVE_COLUMNS) {
      if (col in updateData) {
        const next = updateData[col] ?? null;
        const prev = (existing[col] as unknown) ?? null;
        if (next !== prev) {
          connectivityChanged = true;
          break;
        }
      }
    }
    // A new/changed secret always counts as a connectivity change.
    if ("oidc_client_secret_encrypted" in updateData) {
      connectivityChanged = true;
    }

    // Only force re-verification when something that affects connectivity moved.
    if (connectivityChanged) {
      updateData.is_connected = false;
    }

    const { error } = await supabase
      .from("redsail_payment_configs")
      .update(updateData)
      .eq("id", existing.id as string);

    if (error) return { success: false, error: error.message };
    return { success: true, configId: existing.id as string };
  }

  // Brand-new row: stays disconnected until verified (DB default is false).
  updateData.is_connected = false;

  const { data: newConfig, error } = await supabase
    .from("redsail_payment_configs")
    .insert(updateData)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, configId: newConfig.id };
}

/**
 * Records the outcome of a connectivity verification. Writes the lifecycle
 * columns (connected_at / last_tested_at / last_error) when they exist, but
 * degrades gracefully on databases where that migration has not yet been
 * applied — it retries with just `is_connected` so a verification can never be
 * blocked by a pending migration.
 */
export async function setRedsailConnected(
  configId: string,
  connected: boolean,
  errorMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const fullUpdate: Record<string, unknown> = {
    is_connected: connected,
    last_tested_at: now,
    last_error: connected ? null : errorMessage || "Connection check failed",
    updated_at: now,
  };
  if (connected) fullUpdate.connected_at = now;

  const { error } = await supabase
    .from("redsail_payment_configs")
    .update(fullUpdate)
    .eq("id", configId);

  if (!error) return { success: true };

  // Newer lifecycle columns missing → fall back to the always-present ones.
  if (error.code === "PGRST204" || /column/i.test(error.message)) {
    const { error: fallbackError } = await supabase
      .from("redsail_payment_configs")
      .update({ is_connected: connected, updated_at: now })
      .eq("id", configId);
    if (fallbackError) return { success: false, error: fallbackError.message };
    return { success: true };
  }

  return { success: false, error: error.message };
}

export async function setRedsailActive(
  pharmacyId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("redsail_payment_configs")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("pharmacy_id", pharmacyId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export { maskCredential };
