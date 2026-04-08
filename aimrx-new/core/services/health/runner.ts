import { createCronClient } from "@core/cron/supabase";
import {
  checkSupabase,
  checkStripe,
  checkDigitalRx,
  checkPioneerRx,
  type HealthCheckResult,
} from "./checks";
import { upsertHealthSnapshots, readHealthSnapshots, pruneStaleSnapshots } from "./db";

interface PharmacyBackendRow {
  id: string;
  pharmacy_id: string;
  system_type: string;
  api_key_encrypted: string;
  api_url: string | null;
  store_id: string | null;
  location_id: string | null;
  pharmacy_name: string;
}

export interface HealthRunResult {
  overallStatus: "operational" | "degraded" | "critical";
  timestamp: string;
  healthChecks: HealthCheckResult[];
  summary: {
    total: number;
    operational: number;
    degraded: number;
    error: number;
    unknown: number;
  };
  cached?: boolean;
  fromSnapshot?: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResult: HealthRunResult | null = null;
let cachedAt = 0;

const failureTracker: Record<string, number> = {};

async function discoverBackends(supabase: ReturnType<typeof createCronClient>): Promise<PharmacyBackendRow[]> {
  const { data, error } = await supabase
    .from("pharmacy_backends")
    .select(`
      id,
      pharmacy_id,
      system_type,
      api_key_encrypted,
      api_url,
      store_id,
      location_id,
      pharmacy:pharmacies ( name )
    `)
    .eq("is_active", true);

  if (error || !data) {
    console.error("[health-runner] Failed to discover backends:", error?.message);
    return [];
  }

  return data.map((row: Record<string, unknown>) => {
    const pharmacy = row.pharmacy as { name: string } | { name: string }[] | null;
    const pharmacyName = Array.isArray(pharmacy) ? pharmacy[0]?.name : pharmacy?.name;
    return {
      id: row.id as string,
      pharmacy_id: row.pharmacy_id as string,
      system_type: row.system_type as string,
      api_key_encrypted: row.api_key_encrypted as string,
      api_url: row.api_url as string | null,
      store_id: row.store_id as string | null,
      location_id: row.location_id as string | null,
      pharmacy_name: pharmacyName || "Unknown Pharmacy",
    };
  });
}

function buildResult(healthChecks: HealthCheckResult[]): HealthRunResult {
  const errorCount = healthChecks.filter((c) => c.status === "error").length;
  const degradedCount = healthChecks.filter((c) => c.status === "degraded").length;
  const unknownCount = healthChecks.filter((c) => c.status === "unknown").length;
  const operationalCount = healthChecks.filter((c) => c.status === "operational").length;

  let overallStatus: "operational" | "degraded" | "critical" = "operational";
  if (errorCount > 0) overallStatus = "critical";
  else if (degradedCount > 0) overallStatus = "degraded";

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    healthChecks,
    summary: {
      total: healthChecks.length,
      operational: operationalCount,
      degraded: degradedCount,
      error: errorCount,
      unknown: unknownCount,
    },
  };
}

export async function runAllHealthChecks(): Promise<HealthRunResult> {
  const supabase = createCronClient();

  const backends = await discoverBackends(supabase);

  const checkPromises: Promise<HealthCheckResult>[] = [
    checkSupabase(supabase as unknown as Parameters<typeof checkSupabase>[0]),
    checkStripe(),
  ];

  for (const backend of backends) {
    if (backend.system_type === "DigitalRx") {
      checkPromises.push(checkDigitalRx(backend));
    } else if (backend.system_type === "PioneerRx") {
      checkPromises.push(checkPioneerRx(backend));
    }
  }

  const results = await Promise.allSettled(checkPromises);

  const healthChecks: HealthCheckResult[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      const check = result.value;
      if (check.status === "error" || check.status === "degraded") {
        failureTracker[check.check_key] = (failureTracker[check.check_key] || 0) + 1;
      } else {
        failureTracker[check.check_key] = 0;
      }
      check.consecutive_failures = failureTracker[check.check_key] || 0;
      return check;
    }
    const key = `unknown-${index}`;
    failureTracker[key] = (failureTracker[key] || 0) + 1;
    return {
      check_key: key,
      pharmacy_id: null,
      backend_id: null,
      service_name: `Unknown Check ${index}`,
      category: "internal" as const,
      status: "error" as const,
      severity: "critical" as const,
      response_time_ms: null,
      consecutive_failures: failureTracker[key],
      last_error: result.reason instanceof Error ? result.reason.message : "Check failed",
      checked_at: new Date().toISOString(),
      metadata: null,
    };
  });

  try {
    await upsertHealthSnapshots(healthChecks);
    const activeKeys = healthChecks.map((c) => c.check_key);
    await pruneStaleSnapshots(activeKeys);
  } catch (err) {
    console.error("[health-runner] Failed to persist snapshots:", err instanceof Error ? err.message : err);
  }

  const runResult = buildResult(healthChecks);

  cachedResult = runResult;
  cachedAt = Date.now();

  return runResult;
}

export async function getHealthChecks(forceRefresh = false): Promise<HealthRunResult> {
  if (!forceRefresh && cachedResult && (Date.now() - cachedAt) < CACHE_TTL_MS) {
    return { ...cachedResult, cached: true };
  }

  if (!forceRefresh) {
    try {
      const snapshots = await readHealthSnapshots();
      if (snapshots.length > 0) {
        const newest = snapshots.reduce((max, s) => {
          const t = new Date(s.checked_at).getTime();
          return t > max ? t : max;
        }, 0);

        if (Date.now() - newest < CACHE_TTL_MS * 3) {
          const result = { ...buildResult(snapshots), fromSnapshot: true };
          cachedResult = result;
          cachedAt = Date.now();
          return result;
        }
      }
    } catch (err) {
      console.error("[health-runner] Failed to read snapshots, running live checks:", err instanceof Error ? err.message : err);
    }
  }

  return runAllHealthChecks();
}
