import { createAdminClient } from "@core/database/client";
import {
  encryptApiKey,
  decryptApiKey,
  isEncrypted,
} from "@/core/security/encryption";
import { Pool } from "pg";

function getLocalPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

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

async function queryPaymentConfigs(where: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pharmacy_payment_configs")
    .select("*");

  if (!error && data) {
    return data;
  }

  if (error?.message?.includes("schema cache")) {
    const pool = getLocalPool();
    try {
      const { rows } = await pool.query(
        `SELECT * FROM pharmacy_payment_configs WHERE ${where}`,
        params
      );
      return rows;
    } finally {
      await pool.end();
    }
  }

  return [];
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

  if (!error && data) return decryptConfig(data);

  if (error?.message?.includes("schema cache")) {
    const pool = getLocalPool();
    try {
      const { rows } = await pool.query(
        "SELECT * FROM pharmacy_payment_configs WHERE pharmacy_id = $1 AND is_active = true LIMIT 1",
        [pharmacyId]
      );
      if (rows[0]) return decryptConfig(rows[0]);
    } finally {
      await pool.end();
    }
  }

  return null;
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

  if (!error && data) return decryptConfig(data);

  if (error?.message?.includes("schema cache")) {
    const pool = getLocalPool();
    try {
      const { rows } = await pool.query(
        "SELECT * FROM pharmacy_payment_configs WHERE id = $1 LIMIT 1",
        [configId]
      );
      if (rows[0]) return decryptConfig(rows[0]);
    } finally {
      await pool.end();
    }
  }

  return null;
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

  if (!error && data) return data.map(decryptConfig);

  if (error?.message?.includes("schema cache")) {
    const pool = getLocalPool();
    try {
      const { rows } = await pool.query(
        "SELECT * FROM pharmacy_payment_configs WHERE pharmacy_id = $1 ORDER BY created_at DESC",
        [pharmacyId]
      );
      return rows.map(decryptConfig);
    } finally {
      await pool.end();
    }
  }

  return [];
}

export async function upsertPaymentConfig(
  input: PharmacyPaymentConfigInput,
): Promise<{ success: boolean; configId?: string; error?: string }> {
  const pool = getLocalPool();
  try {
    const stripeSecretEnc = input.stripeSecretKey ? encryptApiKey(input.stripeSecretKey) : null;
    const stripePubKey = input.stripePublishableKey || null;
    const stripeWebhookEnc = input.stripeWebhookSecret ? encryptApiKey(input.stripeWebhookSecret) : null;
    const authnetLoginEnc = input.authnetApiLoginId ? encryptApiKey(input.authnetApiLoginId) : null;
    const authnetTxnEnc = input.authnetTransactionKey ? encryptApiKey(input.authnetTransactionKey) : null;
    const authnetSigEnc = input.authnetSignatureKey ? encryptApiKey(input.authnetSignatureKey) : null;

    const { rows: existing } = await pool.query(
      "SELECT id FROM pharmacy_payment_configs WHERE pharmacy_id = $1 AND gateway = $2 LIMIT 1",
      [input.pharmacyId, input.gateway]
    );

    let configId: string;

    if (existing[0]) {
      configId = existing[0].id;
      const setClauses: string[] = [
        "is_active = true",
        "environment = $1",
        "label = $2",
        "updated_at = NOW()",
      ];
      const params: (string | null)[] = [
        input.environment || "sandbox",
        input.label || null,
      ];

      if (input.gateway === "stripe") {
        if (stripeSecretEnc) { setClauses.push(`stripe_secret_key_encrypted = $${params.length + 1}`); params.push(stripeSecretEnc); }
        if (stripePubKey) { setClauses.push(`stripe_publishable_key = $${params.length + 1}`); params.push(stripePubKey); }
        if (stripeWebhookEnc) { setClauses.push(`stripe_webhook_secret_encrypted = $${params.length + 1}`); params.push(stripeWebhookEnc); }
        setClauses.push(`authnet_api_login_id_encrypted = NULL`);
        setClauses.push(`authnet_transaction_key_encrypted = NULL`);
        setClauses.push(`authnet_signature_key_encrypted = NULL`);
      } else {
        if (authnetLoginEnc) { setClauses.push(`authnet_api_login_id_encrypted = $${params.length + 1}`); params.push(authnetLoginEnc); }
        if (authnetTxnEnc) { setClauses.push(`authnet_transaction_key_encrypted = $${params.length + 1}`); params.push(authnetTxnEnc); }
        if (authnetSigEnc) { setClauses.push(`authnet_signature_key_encrypted = $${params.length + 1}`); params.push(authnetSigEnc); }
        setClauses.push(`stripe_secret_key_encrypted = NULL`);
        setClauses.push(`stripe_publishable_key = NULL`);
        setClauses.push(`stripe_webhook_secret_encrypted = NULL`);
      }

      params.push(configId);
      await pool.query(
        `UPDATE pharmacy_payment_configs SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
        params
      );

      await pool.query(
        "UPDATE pharmacy_payment_configs SET is_active = false, updated_at = NOW() WHERE pharmacy_id = $1 AND id != $2",
        [input.pharmacyId, configId]
      );
    } else {
      const { rows: inserted } = await pool.query(
        `INSERT INTO pharmacy_payment_configs
         (pharmacy_id, gateway, is_active, environment, label,
          stripe_secret_key_encrypted, stripe_publishable_key, stripe_webhook_secret_encrypted,
          authnet_api_login_id_encrypted, authnet_transaction_key_encrypted, authnet_signature_key_encrypted)
         VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          input.pharmacyId,
          input.gateway,
          input.environment || "sandbox",
          input.label || null,
          input.gateway === "stripe" ? stripeSecretEnc : null,
          input.gateway === "stripe" ? stripePubKey : null,
          input.gateway === "stripe" ? stripeWebhookEnc : null,
          input.gateway === "authorizenet" ? authnetLoginEnc : null,
          input.gateway === "authorizenet" ? authnetTxnEnc : null,
          input.gateway === "authorizenet" ? authnetSigEnc : null,
        ]
      );
      configId = inserted[0].id;

      await pool.query(
        "UPDATE pharmacy_payment_configs SET is_active = false, updated_at = NOW() WHERE pharmacy_id = $1 AND id != $2",
        [input.pharmacyId, configId]
      );
    }

    return { success: true, configId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end();
  }
}

export async function deactivatePaymentConfig(
  configId: string,
): Promise<{ success: boolean; error?: string }> {
  const pool = getLocalPool();
  try {
    await pool.query(
      "UPDATE pharmacy_payment_configs SET is_active = false, updated_at = NOW() WHERE id = $1",
      [configId]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end();
  }
}

export async function deactivateAllGatewaysForPharmacy(
  pharmacyId: string,
): Promise<{ success: boolean; error?: string }> {
  const pool = getLocalPool();
  try {
    await pool.query(
      "UPDATE pharmacy_payment_configs SET is_active = false, updated_at = NOW() WHERE pharmacy_id = $1 AND is_active = true",
      [pharmacyId]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await pool.end();
  }
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
