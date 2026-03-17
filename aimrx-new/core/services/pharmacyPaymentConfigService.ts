import { createAdminClient } from "@core/database/client";
import {
  encryptApiKey,
  decryptApiKey,
  isEncrypted,
} from "@/core/security/encryption";

export interface PharmacyPaymentConfigInput {
  pharmacyId: string;
  gateway: "stripe" | "authorizenet";
  environment?: "sandbox" | "production";
  label?: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  authnetApiLoginId?: string;
  authnetTransactionKey?: string;
  authnetSignatureKey?: string;
}

export interface DecryptedPaymentConfig {
  id: string;
  pharmacyId: string;
  gateway: "stripe" | "authorizenet";
  isActive: boolean;
  environment: string;
  label: string | null;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  authnetApiLoginId?: string;
  authnetTransactionKey?: string;
  authnetSignatureKey?: string;
}

export async function getActivePaymentConfig(
  pharmacyId: string,
): Promise<DecryptedPaymentConfig | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pharmacy_payment_configs")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return decryptConfig(data);
}

export async function getPaymentConfigById(
  configId: string,
): Promise<DecryptedPaymentConfig | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pharmacy_payment_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (error || !data) return null;

  return decryptConfig(data);
}

export async function getPaymentConfigsForPharmacy(
  pharmacyId: string,
): Promise<DecryptedPaymentConfig[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pharmacy_payment_configs")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(decryptConfig);
}

export async function upsertPaymentConfig(
  input: PharmacyPaymentConfigInput,
): Promise<{ success: boolean; configId?: string; error?: string }> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    pharmacy_id: input.pharmacyId,
    gateway: input.gateway,
    is_active: true,
    environment: input.environment || "sandbox",
    label: input.label || null,
    updated_at: new Date().toISOString(),
  };

  if (input.gateway === "stripe") {
    if (input.stripeSecretKey) {
      updateData.stripe_secret_key_encrypted = encryptApiKey(input.stripeSecretKey);
    }
    if (input.stripePublishableKey) {
      updateData.stripe_publishable_key = input.stripePublishableKey;
    }
    if (input.stripeWebhookSecret) {
      updateData.stripe_webhook_secret_encrypted = encryptApiKey(input.stripeWebhookSecret);
    }
    updateData.authnet_api_login_id_encrypted = null;
    updateData.authnet_transaction_key_encrypted = null;
    updateData.authnet_signature_key_encrypted = null;
  } else {
    if (input.authnetApiLoginId) {
      updateData.authnet_api_login_id_encrypted = encryptApiKey(input.authnetApiLoginId);
    }
    if (input.authnetTransactionKey) {
      updateData.authnet_transaction_key_encrypted = encryptApiKey(input.authnetTransactionKey);
    }
    if (input.authnetSignatureKey) {
      updateData.authnet_signature_key_encrypted = encryptApiKey(input.authnetSignatureKey);
    }
    updateData.stripe_secret_key_encrypted = null;
    updateData.stripe_publishable_key = null;
    updateData.stripe_webhook_secret_encrypted = null;
  }

  const { data: existing } = await supabase
    .from("pharmacy_payment_configs")
    .select("id")
    .eq("pharmacy_id", input.pharmacyId)
    .eq("gateway", input.gateway)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("pharmacy_payment_configs")
      .update(updateData)
      .eq("id", existing.id);

    if (error) return { success: false, error: error.message };

    await supabase
      .from("pharmacy_payment_configs")
      .update({ is_active: false })
      .eq("pharmacy_id", input.pharmacyId)
      .neq("id", existing.id);

    return { success: true, configId: existing.id };
  } else {
    const { data: newConfig, error } = await supabase
      .from("pharmacy_payment_configs")
      .insert(updateData)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    await supabase
      .from("pharmacy_payment_configs")
      .update({ is_active: false })
      .eq("pharmacy_id", input.pharmacyId)
      .neq("id", newConfig.id);

    return { success: true, configId: newConfig.id };
  }
}

export async function deactivatePaymentConfig(
  configId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("pharmacy_payment_configs")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", configId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

function decryptConfig(raw: Record<string, unknown>): DecryptedPaymentConfig {
  const config: DecryptedPaymentConfig = {
    id: raw.id as string,
    pharmacyId: raw.pharmacy_id as string,
    gateway: raw.gateway as "stripe" | "authorizenet",
    isActive: raw.is_active as boolean,
    environment: raw.environment as string,
    label: raw.label as string | null,
  };

  if (raw.stripe_secret_key_encrypted && isEncrypted(raw.stripe_secret_key_encrypted as string)) {
    try {
      config.stripeSecretKey = decryptApiKey(raw.stripe_secret_key_encrypted as string);
    } catch { /* ignore decrypt failures */ }
  }

  if (raw.stripe_publishable_key) {
    config.stripePublishableKey = raw.stripe_publishable_key as string;
  }

  if (raw.stripe_webhook_secret_encrypted && isEncrypted(raw.stripe_webhook_secret_encrypted as string)) {
    try {
      config.stripeWebhookSecret = decryptApiKey(raw.stripe_webhook_secret_encrypted as string);
    } catch { /* ignore decrypt failures */ }
  }

  if (raw.authnet_api_login_id_encrypted && isEncrypted(raw.authnet_api_login_id_encrypted as string)) {
    try {
      config.authnetApiLoginId = decryptApiKey(raw.authnet_api_login_id_encrypted as string);
    } catch { /* ignore decrypt failures */ }
  }

  if (raw.authnet_transaction_key_encrypted && isEncrypted(raw.authnet_transaction_key_encrypted as string)) {
    try {
      config.authnetTransactionKey = decryptApiKey(raw.authnet_transaction_key_encrypted as string);
    } catch { /* ignore decrypt failures */ }
  }

  if (raw.authnet_signature_key_encrypted && isEncrypted(raw.authnet_signature_key_encrypted as string)) {
    try {
      config.authnetSignatureKey = decryptApiKey(raw.authnet_signature_key_encrypted as string);
    } catch { /* ignore decrypt failures */ }
  }

  return config;
}

export function maskCredential(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return "••••••••";
  return value.substring(0, 4) + "••••" + value.substring(value.length - 4);
}
