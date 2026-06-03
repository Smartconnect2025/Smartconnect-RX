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

export interface RedsailPaymentConfigInput {
  pharmacyId: string;
  environment?: RedsailEnvironment;
  label?: string;
  tenantId?: string;
  siteId?: string;
  stationId?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  webhookAudience?: string;
  apiBaseUrl?: string;
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
  webhookAudience?: string;
  apiBaseUrl?: string;
}

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
    webhookAudience: (raw.webhook_audience as string) || undefined,
    apiBaseUrl: (raw.api_base_url as string) || undefined,
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
  if (input.webhookAudience !== undefined)
    updateData.webhook_audience = input.webhookAudience || null;
  if (input.apiBaseUrl !== undefined)
    updateData.api_base_url = input.apiBaseUrl || null;

  // Credentials changed → require re-verification before going live.
  updateData.is_connected = false;
  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive;
  }

  const { data: existingRows } = await supabase
    .from("redsail_payment_configs")
    .select("id")
    .eq("pharmacy_id", input.pharmacyId)
    .order("created_at", { ascending: true })
    .limit(1);

  const existing = existingRows?.[0];

  if (existing) {
    const { error } = await supabase
      .from("redsail_payment_configs")
      .update(updateData)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };
    return { success: true, configId: existing.id };
  }

  const { data: newConfig, error } = await supabase
    .from("redsail_payment_configs")
    .insert(updateData)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, configId: newConfig.id };
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
