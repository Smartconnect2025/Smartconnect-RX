import crypto from "crypto";
import { decryptApiKey, isEncrypted } from "@/core/security/encryption";

export interface HealthCheckResult {
  check_key: string;
  pharmacy_id: string | null;
  backend_id: string | null;
  service_name: string;
  category: "database" | "external" | "internal";
  status: "operational" | "degraded" | "error" | "unknown";
  severity: "info" | "warning" | "critical";
  response_time_ms: number | null;
  consecutive_failures: number;
  last_error: string | null;
  checked_at: string;
  metadata: Record<string, unknown> | null;
}

function classifySeverity(status: string): "info" | "warning" | "critical" {
  if (status === "error") return "critical";
  if (status === "degraded") return "warning";
  return "info";
}

export async function checkSupabase(
  supabase: { from: (table: string) => { select: (cols: string, opts?: { head: boolean; count: string }) => Promise<{ error: { message: string } | null; count: number | null }> } },
): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  const startTime = Date.now();
  try {
    const { error } = await supabase
      .from("pharmacies")
      .select("id", { head: true, count: "exact" } as unknown as undefined);
    const responseTime = Date.now() - startTime;
    const status = error ? "error" : responseTime > 3000 ? "degraded" : "operational";
    return {
      check_key: "supabase-database",
      pharmacy_id: null,
      backend_id: null,
      service_name: "Supabase Database",
      category: "database",
      status,
      severity: classifySeverity(status),
      response_time_ms: responseTime,
      consecutive_failures: 0,
      last_error: error?.message || null,
      checked_at: now,
      metadata: null,
    };
  } catch (err) {
    return {
      check_key: "supabase-database",
      pharmacy_id: null,
      backend_id: null,
      service_name: "Supabase Database",
      category: "database",
      status: "error",
      severity: "critical",
      response_time_ms: Date.now() - startTime,
      consecutive_failures: 0,
      last_error: err instanceof Error ? err.message : "Unknown error",
      checked_at: now,
      metadata: null,
    };
  }
}

export async function checkStripe(): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return {
      check_key: "stripe-payments",
      pharmacy_id: null,
      backend_id: null,
      service_name: "Stripe Payments",
      category: "external",
      status: "unknown",
      severity: "warning",
      response_time_ms: null,
      consecutive_failures: 0,
      last_error: "STRIPE_SECRET_KEY not configured",
      checked_at: now,
      metadata: null,
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTime = Date.now() - startTime;
    const status = response.ok
      ? responseTime > 3000
        ? "degraded"
        : "operational"
      : "error";

    return {
      check_key: "stripe-payments",
      pharmacy_id: null,
      backend_id: null,
      service_name: "Stripe Payments",
      category: "external",
      status,
      severity: classifySeverity(status),
      response_time_ms: responseTime,
      consecutive_failures: 0,
      last_error: response.ok ? null : `HTTP ${response.status}`,
      checked_at: now,
      metadata: { endpoint: "https://api.stripe.com/v1/balance" },
    };
  } catch (err) {
    return {
      check_key: "stripe-payments",
      pharmacy_id: null,
      backend_id: null,
      service_name: "Stripe Payments",
      category: "external",
      status: "error",
      severity: "critical",
      response_time_ms: Date.now() - startTime,
      consecutive_failures: 0,
      last_error: err instanceof Error ? err.message : "Connection failed",
      checked_at: now,
      metadata: { endpoint: "https://api.stripe.com/v1/balance" },
    };
  }
}

interface PharmacyBackendRow {
  id: string;
  pharmacy_id: string;
  system_type: string;
  api_key_encrypted: string;
  api_url: string | null;
  store_id: string | null;
  location_id: string | null;
  pharmacy_name?: string;
}

export async function checkDigitalRx(
  backend: PharmacyBackendRow,
): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  const checkKey = `digitalrx-${backend.pharmacy_id}`;
  const baseUrl = (backend.api_url || "https://www.dbswebserver.com/DBSRestApi/API").replace(/\/+$/, "");

  let apiKey = backend.api_key_encrypted;
  if (isEncrypted(apiKey)) {
    try {
      apiKey = decryptApiKey(apiKey);
    } catch {
      return {
        check_key: checkKey,
        pharmacy_id: backend.pharmacy_id,
        backend_id: backend.id,
        service_name: `DigitalRx — ${backend.pharmacy_name || "Unknown"}`,
        category: "external",
        status: "error",
        severity: "critical",
        response_time_ms: null,
        consecutive_failures: 0,
        last_error: "Failed to decrypt API key",
        checked_at: now,
        metadata: { endpoint: baseUrl },
      };
    }
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTime = Date.now() - startTime;
    const status = response.ok
      ? responseTime > 3000
        ? "degraded"
        : "operational"
      : "degraded";

    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `DigitalRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status,
      severity: classifySeverity(status),
      response_time_ms: responseTime,
      consecutive_failures: 0,
      last_error: response.ok ? null : `HTTP ${response.status}`,
      checked_at: now,
      metadata: { endpoint: baseUrl, pharmacyName: backend.pharmacy_name },
    };
  } catch (err) {
    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `DigitalRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status: "degraded",
      severity: "warning",
      response_time_ms: Date.now() - startTime,
      consecutive_failures: 0,
      last_error: err instanceof Error ? err.message : "Connection failed",
      checked_at: now,
      metadata: { endpoint: baseUrl, pharmacyName: backend.pharmacy_name },
    };
  }
}

export async function checkPioneerRx(
  backend: PharmacyBackendRow,
): Promise<HealthCheckResult> {
  const now = new Date().toISOString();
  const checkKey = `pioneerrx-${backend.pharmacy_id}`;

  if (!backend.api_url) {
    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `PioneerRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status: "error",
      severity: "critical",
      response_time_ms: null,
      consecutive_failures: 0,
      last_error: "API URL not configured",
      checked_at: now,
      metadata: { pharmacyName: backend.pharmacy_name },
    };
  }

  let rawKey = backend.api_key_encrypted;
  if (isEncrypted(rawKey)) {
    try {
      rawKey = decryptApiKey(rawKey);
    } catch {
      return {
        check_key: checkKey,
        pharmacy_id: backend.pharmacy_id,
        backend_id: backend.id,
        service_name: `PioneerRx — ${backend.pharmacy_name || "Unknown"}`,
        category: "external",
        status: "error",
        severity: "critical",
        response_time_ms: null,
        consecutive_failures: 0,
        last_error: "Failed to decrypt API key",
        checked_at: now,
        metadata: { pharmacyName: backend.pharmacy_name },
      };
    }
  }

  const parts = rawKey.split("|");
  if (parts.length < 2) {
    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `PioneerRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status: "error",
      severity: "critical",
      response_time_ms: null,
      consecutive_failures: 0,
      last_error: "Invalid API key format — shared secret missing",
      checked_at: now,
      metadata: { pharmacyName: backend.pharmacy_name },
    };
  }

  const apiKey = parts[0];
  const sharedSecret = parts[1];
  const baseUrl = backend.api_url.replace(/\/+$/, "");

  const startTime = Date.now();
  try {
    const timestamp = new Date().toISOString();
    const saltedValue = timestamp + sharedSecret;
    const encoded = Buffer.from(saltedValue, "utf16le");
    const signature = crypto
      .createHash("sha512")
      .update(encoded)
      .digest("base64");

    const testUrl = `${baseUrl}/api/enterprise/isAuthenticated`;

    const response = await fetch(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "prx-api-key": apiKey,
        "prx-timestamp": timestamp,
        "prx-signature": signature,
      },
      signal: AbortSignal.timeout(15000),
    });

    const responseTime = Date.now() - startTime;
    const status = response.ok
      ? responseTime > 5000
        ? "degraded"
        : "operational"
      : "error";

    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `PioneerRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status,
      severity: classifySeverity(status),
      response_time_ms: responseTime,
      consecutive_failures: 0,
      last_error: response.ok ? null : `HTTP ${response.status}`,
      checked_at: now,
      metadata: { endpoint: testUrl, pharmacyName: backend.pharmacy_name },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return {
      check_key: checkKey,
      pharmacy_id: backend.pharmacy_id,
      backend_id: backend.id,
      service_name: `PioneerRx — ${backend.pharmacy_name || "Unknown"}`,
      category: "external",
      status: "error",
      severity: "critical",
      response_time_ms: Date.now() - startTime,
      consecutive_failures: 0,
      last_error: message.includes("timeout") ? "Connection timed out — check IP whitelisting" : message,
      checked_at: now,
      metadata: { pharmacyName: backend.pharmacy_name },
    };
  }
}
