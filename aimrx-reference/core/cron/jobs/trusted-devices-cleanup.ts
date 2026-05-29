import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";

/**
 * Step 14 (nightly trusted-device cleanup): hard-delete rows from
 * `trusted_devices` that are either revoked or expired AND have been
 * in that terminal state for more than RETENTION_DAYS. The full
 * grant/use/revoke history is preserved permanently in
 * `system_logs` (Step 9) so this only trims the live "current state"
 * table — the audit trail is untouched.
 *
 * Why a 30-day buffer instead of deleting the moment a row revokes:
 * if a user calls support saying "I don't recognize that device that
 * was on my account last week," support needs to be able to look it
 * up. 30 days covers a full HIPAA-style "did anything weird happen
 * recently" window. Anything older than that lives only in the
 * append-only audit log.
 *
 * Safety:
 *   - SELECT first, DELETE by id list — never a blind WHERE-only
 *     delete. We log the count and a sample of ids per run so any
 *     anomaly is easy to spot in cron_job_runs.details.
 *   - Idempotent: running twice in the same minute is a no-op the
 *     second time.
 *   - Re-entrancy guard (isRunning) so an unusually slow run can't
 *     overlap with the next minute's tick.
 */

const RETENTION_DAYS = 30;
const SELECT_BATCH_LIMIT = 500;

let isRunning = false;

export async function cleanupTrustedDevices() {
  if (isRunning) {
    console.log(
      "[trusted-devices-cleanup] Skipped — previous run still in progress",
    );
    return;
  }
  isRunning = true;
  console.log("[trusted-devices-cleanup] Starting nightly cleanup...");
  let run: Awaited<ReturnType<typeof logCronRun>> | null = null;

  try {
    run = await logCronRun("trusted-devices-cleanup");
    const supabase = createCronClient();

    const cutoffIso = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Pull deletable ids in two passes (revoked-old, expired-old)
    // and union them. PostgREST has no native OR across two range
    // filters in a single .or() that's both readable and indexed,
    // so two small SELECTs are cheaper and clearer.
    const { data: revokedOld, error: revokedErr } = await supabase
      .from("trusted_devices")
      .select("id")
      .not("revoked_at", "is", null)
      .lt("revoked_at", cutoffIso)
      .limit(SELECT_BATCH_LIMIT);

    if (revokedErr) throw new Error(`select revoked failed: ${revokedErr.message}`);

    const { data: expiredOld, error: expiredErr } = await supabase
      .from("trusted_devices")
      .select("id")
      .is("revoked_at", null)
      .lt("expires_at", cutoffIso)
      .limit(SELECT_BATCH_LIMIT);

    if (expiredErr) throw new Error(`select expired failed: ${expiredErr.message}`);

    const ids = Array.from(
      new Set([
        ...((revokedOld ?? []) as Array<{ id: string }>).map((r) => r.id),
        ...((expiredOld ?? []) as Array<{ id: string }>).map((r) => r.id),
      ]),
    );

    if (ids.length === 0) {
      console.log("[trusted-devices-cleanup] Nothing to purge.");
    } else {
      const { error: deleteErr } = await supabase
        .from("trusted_devices")
        .delete()
        .in("id", ids);

      if (deleteErr) throw new Error(`delete failed: ${deleteErr.message}`);

      console.log(
        `[trusted-devices-cleanup] Purged ${ids.length} rows (>${RETENTION_DAYS}d revoked or expired).`,
      );
      run.trackSuccess({
        purged_count: ids.length,
        retention_days: RETENTION_DAYS,
        cutoff: cutoffIso,
        sample_ids: ids.slice(0, 10),
        revoked_old_count: (revokedOld ?? []).length,
        expired_old_count: (expiredOld ?? []).length,
      });
    }

    // Task #83 canary: count the previous 24h of fingerprint-mismatch
    // events and write ONE aggregated system_logs row. Lets ops spot a
    // regression at a glance (Admin > System Logs filter on action)
    // without rerunning ad-hoc SQL. Runs on EVERY nightly tick — even
    // when there are no rows to purge — so the daily timeseries has no
    // gaps. Fire-and-forget: a failed write must NOT abort the run.
    try {
      const windowEndIso = new Date().toISOString();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: mismatchCount, error: mismatchErr } = await supabase
        .from("system_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", "TRUSTED_DEVICE_FINGERPRINT_MISMATCH")
        .gte("created_at", since);
      if (mismatchErr) {
        console.warn(
          "[trusted-devices-cleanup] mismatch-count query failed:",
          mismatchErr.message,
        );
      } else {
        const total = mismatchCount ?? 0;
        const { error: insertErr } = await supabase
          .from("system_logs")
          .insert({
            user_id: null,
            user_email: null,
            user_name: null,
            action: "TRUSTED_DEVICE_MISMATCH_DAILY_SUMMARY",
            details: `Trusted device fingerprint mismatch — 24h summary | count=${total} | window_start=${since} | window_end=${windowEndIso}`,
            status: "success",
            ip_address: null,
            user_agent: null,
          });
        if (insertErr) {
          // Supabase commonly returns { error } without throwing — guard
          // explicitly so a silent insert failure doesn't masquerade as a
          // successful canary write and quietly lose the daily signal.
          console.warn(
            "[trusted-devices-cleanup] Mismatch canary insert failed:",
            insertErr.message,
          );
        } else {
          console.log(
            `[trusted-devices-cleanup] Mismatch canary written: count=${total} since=${since}`,
          );
        }
      }
    } catch (canaryErr) {
      const m =
        canaryErr instanceof Error ? canaryErr.message : String(canaryErr);
      console.warn("[trusted-devices-cleanup] canary write threw:", m);
    }

    await run.success(ids.length);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trusted-devices-cleanup] Run failed:", message);
    if (run) await run.error(message);
  } finally {
    isRunning = false;
  }
}
