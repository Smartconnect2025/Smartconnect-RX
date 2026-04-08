import postgres from "postgres";
import type { HealthCheckResult } from "./checks";

let sql: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (!sql) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL not set");
    sql = postgres(dbUrl, { max: 2, idle_timeout: 30 });
  }
  return sql;
}

export async function upsertHealthSnapshots(checks: HealthCheckResult[]): Promise<void> {
  const db = getDb();

  for (const check of checks) {
    await db`
      INSERT INTO api_health_snapshots (
        check_key, pharmacy_id, backend_id, service_name, category,
        status, severity, response_time_ms, consecutive_failures,
        last_error, checked_at, metadata, updated_at
      ) VALUES (
        ${check.check_key},
        ${check.pharmacy_id},
        ${check.backend_id},
        ${check.service_name},
        ${check.category},
        ${check.status},
        ${check.severity},
        ${check.response_time_ms},
        ${check.consecutive_failures},
        ${check.last_error},
        ${check.checked_at},
        ${check.metadata ? JSON.stringify(check.metadata) : null}::jsonb,
        now()
      )
      ON CONFLICT (check_key) DO UPDATE SET
        pharmacy_id = EXCLUDED.pharmacy_id,
        backend_id = EXCLUDED.backend_id,
        service_name = EXCLUDED.service_name,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        severity = EXCLUDED.severity,
        response_time_ms = EXCLUDED.response_time_ms,
        consecutive_failures = EXCLUDED.consecutive_failures,
        last_error = EXCLUDED.last_error,
        checked_at = EXCLUDED.checked_at,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    `;
  }
}

export async function readHealthSnapshots(): Promise<HealthCheckResult[]> {
  const db = getDb();

  const rows = await db`
    SELECT
      check_key, pharmacy_id, backend_id, service_name, category,
      status, severity, response_time_ms, consecutive_failures,
      last_error, checked_at, metadata
    FROM api_health_snapshots
    ORDER BY category, service_name
  `;

  return rows.map((row) => ({
    check_key: row.check_key,
    pharmacy_id: row.pharmacy_id || null,
    backend_id: row.backend_id || null,
    service_name: row.service_name,
    category: row.category as "database" | "external" | "internal",
    status: row.status as "operational" | "degraded" | "error" | "unknown",
    severity: row.severity as "info" | "warning" | "critical",
    response_time_ms: row.response_time_ms ?? null,
    consecutive_failures: row.consecutive_failures ?? 0,
    last_error: row.last_error || null,
    checked_at: row.checked_at instanceof Date ? row.checked_at.toISOString() : String(row.checked_at),
    metadata: row.metadata || null,
  }));
}

export async function pruneStaleSnapshots(activeKeys: string[]): Promise<void> {
  if (activeKeys.length === 0) return;
  const db = getDb();
  await db`DELETE FROM api_health_snapshots WHERE check_key != ALL(${activeKeys})`;
}
