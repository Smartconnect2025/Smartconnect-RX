import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";
import {
  resolvePharmacyBackendsBatch,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
  isForwardStatusTransition,
  ResolvedBackend,
} from "@/app/api/prescriptions/_shared/digitalrx-helpers";
import { ensureTrackerRegistered } from "@/app/api/prescriptions/_shared/tracking-sync";
import { alertUnknownDigitalRxStatus, alertStuckOrder } from "@/core/services/admin-alerts";

// Statuses we re-poll on every reconcile sweep. "rejected" is included so
// that orders Greenwich has subsequently RETYPED (new RxNumber, status
// progresses past RPH REJECT → TYPED/PACKED) get picked up automatically.
// Diana Harr q2232755 was the canary: rejected May 7, retyped May 10, but
// without "rejected" in this list her row sat stale for 5 days and the
// every-4-hour sweep silently skipped her. Joseph: "nothing changed?????"
// (May 12 2026, immediately after the array-sort fix landed.)
const STUCK_STATUSES = ["submitted", "paused", "packed", "approved", "rejected"];

// ─────────────────────────────────────────────────────────────────────────────
// DEAD QUEUE IDS — Greenwich-cancelled orders, NEVER POLL
// ─────────────────────────────────────────────────────────────────────────────
// These 5 orders were cancelled by Greenwich (medication arrived too late to
// ship). They are marked "rejected" on our side and must STAY rejected. Joseph
// May 21 2026: "they are really cancelled we dont want to have a corn on them
// ... these are really cncelled dead orders". Excluded from polling at the
// SQL level so the every-4-hour reconcile sweep can never flip them back to
// "submitted" via Greenwich's stale status API.
const DEAD_QUEUE_IDS = [
  "2186204", // Andrew Wicks
  "2199336", // Charles Koch
  "2203179", // Michael Landow
  "2222233", // Scott Province
  "2233282", // Brian Bielot
];

// ─────────────────────────────────────────────────────────────────────────────
// RULE: NEVER POLL TEST PATIENTS
// ─────────────────────────────────────────────────────────────────────────────
// Test patients have stale/fake DigitalRx queue_ids that DBS no longer
// recognizes. Polling them every day produces 30–150 garbage error logs per
// day and floods the admin dashboard with false alarms. They are excluded
// from this cron unconditionally. If a real patient is ever miscategorized,
// the webhook channel still updates them — only the polling fallback is
// skipped here.
function isTestPatient(p: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): boolean {
  const first = (p.first_name || "").toLowerCase();
  const last = (p.last_name || "").toLowerCase();
  const email = (p.email || "").toLowerCase();

  // Name contains the word "test" at a word boundary (Test, TEST, Testing,
  // "AIMRX Test", "TEST Patient" — but NOT "Atest", "Contest", "Latest")
  if (/\btest/i.test(first) || /\btest/i.test(last)) return true;
  // First or last name is exactly "aimrx" (internal test accounts)
  if (first === "aimrx" || last === "aimrx") return true;

  // Email patterns — word-boundary "test" only, so "latest@", "contest@",
  // "fastest@" etc. do NOT trigger as test patients
  if (/(?:^|[^a-z0-9])test/i.test(email)) return true;
  if (/^joseph\+.*@smartconnects\.com$/i.test(email)) return true;
  if (email.startsWith("aimrx")) return true;

  return false;
}

let isRunning = false;

export async function reconcileDigitalRx() {
  if (isRunning) {
    console.log("[digitalrx-reconcile] Skipped — previous run still in progress");
    return;
  }
  isRunning = true;
  console.log("[digitalrx-reconcile] Starting DigitalRx reconciliation...");
  let run: Awaited<ReturnType<typeof logCronRun>> | null = null;
  const diagnostics: string[] = [];

  try {
    run = await logCronRun("digitalrx-reconcile");
    const supabase = createCronClient();

    // ─── RULE: Resolve test-patient IDs FIRST so they're excluded at SQL ─
    // level. This prevents starvation where stale test prescriptions would
    // otherwise occupy the oldest slots and crowd real patients out of the
    // 50-row poll window forever.
    const { data: allPatients } = await supabase
      .from("patients")
      .select("id, first_name, last_name, email");
    const testPatientIds: string[] = [];
    const prefetchedPatients = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
    for (const p of allPatients || []) {
      prefetchedPatients.set(p.id, { first_name: p.first_name, last_name: p.last_name, email: p.email });
      if (isTestPatient(p)) testPatientIds.push(p.id);
    }
    if (testPatientIds.length > 0) {
      diagnostics.push(`RULE: Excluding ${testPatientIds.length} test patients from polling (SQL-level)`);
      console.log(`[digitalrx-reconcile] Rule applied: excluding ${testPatientIds.length} test patient IDs at SQL level`);
    }

    let pQuery = supabase
      .from("prescriptions")
      .select("id, queue_id, status, tracking_number, pharmacy_id, medication, patient_id, submitted_to_pharmacy_at")
      .in("status", STUCK_STATUSES)
      .not("queue_id", "is", null)
      .neq("queue_id", "")
      .order("updated_at", { ascending: true })
      .limit(50);
    if (testPatientIds.length > 0) {
      pQuery = pQuery.not("patient_id", "in", `(${testPatientIds.join(",")})`);
    }
    // RULE: Exclude permanently-dead Greenwich-cancelled queue_ids at SQL level
    // so they can never be re-polled and flipped back to "submitted".
    if (DEAD_QUEUE_IDS.length > 0) {
      pQuery = pQuery.not("queue_id", "in", `(${DEAD_QUEUE_IDS.map((q) => `"${q}"`).join(",")})`);
      diagnostics.push(`RULE: Excluding ${DEAD_QUEUE_IDS.length} dead queue_ids from polling`);
    }
    const { data: prescriptions, error } = await pQuery;

    if (error) {
      const msg = `Query error: ${error.message}`;
      console.error("[digitalrx-reconcile]", msg);
      diagnostics.push(msg);
      await logDiagnostics(supabase, diagnostics, 0, 0);
      await run?.error(error.message);
      return;
    }

    if (!prescriptions || prescriptions.length === 0) {
      console.log("[digitalrx-reconcile] No stuck prescriptions found with queue_id");
      diagnostics.push("No prescriptions found in statuses [submitted, paused, packed, approved] with a queue_id");

      const { data: allStuck } = await supabase
        .from("prescriptions")
        .select("id, queue_id, status")
        .in("status", STUCK_STATUSES)
        .limit(20);

      if (allStuck && allStuck.length > 0) {
        const withoutQueueId = allStuck.filter(rx => !rx.queue_id);
        const withQueueId = allStuck.filter(rx => rx.queue_id);
        diagnostics.push(`Found ${allStuck.length} total stuck prescriptions: ${withQueueId.length} have queue_id, ${withoutQueueId.length} missing queue_id`);
        withoutQueueId.forEach(rx => {
          diagnostics.push(`  SKIPPED (no queue_id): ${rx.id} - status: ${rx.status}`);
        });
      } else {
        diagnostics.push("No prescriptions found in stuck statuses at all — all are up to date");
      }

      await logDiagnostics(supabase, diagnostics, 0, 0);
      await run?.success(0);
      return;
    }

    diagnostics.push(`Found ${prescriptions.length} stuck prescriptions to check`);
    prescriptions.forEach(rx => {
      diagnostics.push(`  Checking: ${rx.id} | queue_id: ${rx.queue_id} | status: ${rx.status} | pharmacy: ${rx.pharmacy_id || "none"} | tracking: ${rx.tracking_number || "none"}`);
    });

    const pharmacyIds = prescriptions
      .map((rx) => rx.pharmacy_id)
      .filter(Boolean) as string[];
    const backendMap = await resolvePharmacyBackendsBatch(supabase, pharmacyIds);

    diagnostics.push(`Resolved ${backendMap.size} pharmacy backends (including __default__ if available)`);

    let updated = 0;
    let failed = 0;
    const results: Array<{ patient: string; medication: string; status: string; outcome: string }> = [];
    // Collect backward-transition skips for a SINGLE summary system_logs row
    // at end-of-run. Per-row inserts in a 5-minute cron would otherwise
    // produce repeating noise for any genuinely stuck order (architect MINOR
    // #2). Diagnostics for the run still get the per-row detail.
    const backwardSkips: Array<{
      id: string;
      queue_id: string | null;
      from: string;
      to: string;
      trackingApplied: string | null;
    }> = [];

    const patientNameCache = new Map<string, string>();
    // Seed cache from prefetched patient info to avoid extra round-trips
    for (const [id, info] of prefetchedPatients.entries()) {
      patientNameCache.set(id, `${info.first_name || ""} ${info.last_name || ""}`.trim() || "Unknown");
    }
    async function getPatientName(patientId: string | null): Promise<string> {
      if (!patientId) return "Unknown";
      if (patientNameCache.has(patientId)) return patientNameCache.get(patientId)!;
      const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", patientId).single();
      const name = pat ? `${pat.first_name} ${pat.last_name}` : "Unknown";
      patientNameCache.set(patientId, name);
      return name;
    }

    for (const rx of prescriptions) {
      const patientName = await getPatientName(rx.patient_id);

      try {
        const backend: ResolvedBackend | undefined =
          (rx.pharmacy_id ? backendMap.get(rx.pharmacy_id) : undefined) ||
          backendMap.get("__default__");

        if (!backend) {
          const msg = `NO BACKEND for ${rx.id} (pharmacy_id: ${rx.pharmacy_id}) — cannot call DigitalRx API`;
          console.error("[digitalrx-reconcile]", msg);
          diagnostics.push(`  FAIL: ${msg}`);
          failed++;
          results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: "❌ No pharmacy backend configured" });
          run?.trackFailure({
            prescriptionId: rx.id,
            step: "resolve_backend",
            error: "No pharmacy backend found",
          });
          continue;
        }

        diagnostics.push(`  Calling DigitalRx API for ${rx.queue_id} via ${backend.baseUrl} (StoreID: ${backend.storeId})`);

        const apiResult = await fetchDigitalRxStatus(backend, rx.queue_id!);

        if (!apiResult.success) {
          const rawSnippet = ('rawResponse' in apiResult && apiResult.rawResponse) ? apiResult.rawResponse : null;
          const queueNotFound = 'queueNotFound' in apiResult && apiResult.queueNotFound === true;

          // ── Greenwich returned HTTP 200 + empty body ──
          // This can mean either (a) the queue ID is not yet picked up by the
          // pharmacist (totally normal, common for new orders) or (b) it has
          // been removed on their side. We CANNOT distinguish these two from
          // the response alone, so DO NOT flip the prescription status —
          // leave it as "submitted" and let the next cron tick try again.
          // Just log once per 24h per queue_id so the audit trail is quiet
          // but not silent (admin-only "system_logs" entry, no patient impact).
          if (queueNotFound) {
            diagnostics.push(`  ℹ️ Greenwich not-yet-acknowledged: ${patientName} (queue ${rx.queue_id}) — leaving as ${rx.status}, will retry next tick`);
            const { data: nfLogCheck } = await supabase
              .from("system_logs")
              .select("id")
              .eq("action", "DIGITALRX_QUEUE_AWAITING_PHARMACY")
              .ilike("details", `%${rx.queue_id}%`)
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1);
            if (!nfLogCheck || nfLogCheck.length === 0) {
              await supabase.from("system_logs").insert({
                user_id: null,
                user_email: "system@aimrx.com",
                user_name: "DigitalRx API Monitor",
                action: "DIGITALRX_QUEUE_AWAITING_PHARMACY",
                details: `Greenwich returned HTTP 200 + empty body for ${patientName} — ${rx.medication} (Queue: ${rx.queue_id}, Rx: ${rx.id}). Pharmacist has not picked up the order yet. Will keep retrying.`,
                status: "info",
              });
            }
            results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `ℹ️ Awaiting pharmacy acknowledgement` });
            continue;
          }

          const msg = `API FAILED for ${rx.id} (queue: ${rx.queue_id}): ${apiResult.error}${apiResult.errorText ? ` — ${apiResult.errorText}` : ""}`;
          console.error("[digitalrx-reconcile]", msg);
          if (rawSnippet) console.error("[digitalrx-reconcile] Raw response:", rawSnippet);
          diagnostics.push(`  FAIL: ${msg}`);
          if (rawSnippet) diagnostics.push(`  RAW RESPONSE: ${rawSnippet}`);

          const { data: failLogCheck } = await supabase
            .from("system_logs")
            .select("id")
            .eq("action", "DIGITALRX_API_ERROR")
            .ilike("details", `%${rx.queue_id}%`)
            .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!failLogCheck || failLogCheck.length === 0) {
            let patientName = "Unknown";
            if (rx.patient_id) {
              const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", rx.patient_id).single();
              if (pat) patientName = `${pat.first_name} ${pat.last_name}`;
            }
            await supabase.from("system_logs").insert({
              user_id: null,
              user_email: "system@aimrx.com",
              user_name: "DigitalRx API Monitor",
              action: "DIGITALRX_API_ERROR",
              details: `DigitalRx API failed for ${patientName} (Queue: ${rx.queue_id}, Rx: ${rx.id})\nError: ${apiResult.error}${rawSnippet ? `\n\nRaw response from server:\n${rawSnippet}` : ""}`,
              status: "error",
            });
          }

          const { data: repeatedFailures } = await supabase
            .from("system_logs")
            .select("id")
            .eq("action", "DIGITALRX_API_ERROR")
            .ilike("details", `%${rx.queue_id}%`)
            .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
          if (repeatedFailures && repeatedFailures.length >= 2) {
            const { data: escalationCheck } = await supabase
              .from("system_logs")
              .select("id")
              .eq("action", "ADMIN_ALERT_API_FAILURE_ESCALATION")
              .ilike("details", `%${rx.queue_id}%`)
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1);
            if (!escalationCheck || escalationCheck.length === 0) {
              let patientNameEsc = "Unknown";
              if (rx.patient_id) {
                const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", rx.patient_id).single();
                if (pat) patientNameEsc = `${pat.first_name} ${pat.last_name}`;
              }
              await supabase.from("system_logs").insert({
                user_id: null,
                user_email: "system@aimrx.com",
                user_name: "System Alert",
                action: "ADMIN_ALERT_API_FAILURE_ESCALATION",
                details: `⚠️ ESCALATION: DigitalRx API has failed ${repeatedFailures.length} times in 12h for ${patientNameEsc} — ${rx.medication} (Queue: ${rx.queue_id})\nWebhook may also be missing. Manual investigation required.`,
                status: "error",
              });
              diagnostics.push(`  ⚠️ API FAILURE ESCALATION: Queue ${rx.queue_id} failed ${repeatedFailures.length} times in 12h`);
              alertStuckOrder(patientNameEsc, rx.medication || "", rx.queue_id || "", rx.id, 0).catch(() => {});
            }
          }

          failed++;
          results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `❌ DigitalRx API error` });
          run?.trackFailure({
            prescriptionId: rx.id,
            step: "fetch_status",
            error: apiResult.error,
          });
          continue;
        }

        diagnostics.push(`  API RAW DATA: ${JSON.stringify(apiResult.data)}`);

        const { newStatus, trackingNumber, unrecognizedStatus } = mapDigitalRxStatus(
          apiResult.data,
          rx.status,
          rx.tracking_number,
        );

        if (unrecognizedStatus) {
          diagnostics.push(`  ⚠️ UNKNOWN STATUS "${unrecognizedStatus}" for ${rx.id}`);
          const { data: alertCheck } = await supabase
            .from("system_logs")
            .select("id")
            .eq("action", "ADMIN_ALERT_UNKNOWN_STATUS")
            .ilike("details", `%${rx.id}%`)
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1);
          if (!alertCheck || alertCheck.length === 0) {
            let patientName = "Unknown";
            if (rx.patient_id) {
              const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", rx.patient_id).single();
              if (pat) patientName = `${pat.first_name} ${pat.last_name}`;
            }
            const rawDataJson = JSON.stringify(apiResult.data).substring(0, 2000);
            await supabase.from("system_logs").insert({
              user_id: null, user_email: "system@aimrx.com", user_name: "System Alert",
              action: "ADMIN_ALERT_UNKNOWN_STATUS",
              details: `Unknown DigitalRx status "${unrecognizedStatus}" for ${patientName} — ${rx.medication} (${rx.id})\n\nFull DigitalRx response:\n${rawDataJson}`,
              status: "warning",
            });
            alertUnknownDigitalRxStatus(patientName, rx.medication || "", rx.queue_id || "", rx.id, unrecognizedStatus, apiResult.data as Record<string, unknown>).catch(() => {});
          }
        }

        if (STUCK_STATUSES.includes(rx.status) && rx.submitted_to_pharmacy_at) {
          const submittedAt = new Date(rx.submitted_to_pharmacy_at).getTime();
          const hoursStuck = (Date.now() - submittedAt) / (1000 * 60 * 60);
          const stuckThresholdHours =
            rx.status === "submitted" ? 6 :
            rx.status === "paused" ? 72 :
            24;
          if (hoursStuck >= stuckThresholdHours) {
            const { data: stuckAlertCheck } = await supabase
              .from("system_logs")
              .select("id")
              .eq("action", "ADMIN_ALERT_STUCK_ORDER")
              .ilike("details", `%${rx.id}%`)
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(1);
            if (!stuckAlertCheck || stuckAlertCheck.length === 0) {
              let patientName = "Unknown";
              if (rx.patient_id) {
                const { data: pat } = await supabase.from("patients").select("first_name, last_name").eq("id", rx.patient_id).single();
                if (pat) patientName = `${pat.first_name} ${pat.last_name}`;
              }
              diagnostics.push(`  ⚠️ STUCK ORDER ALERT: ${rx.id} stuck for ${Math.round(hoursStuck)} hours`);
              await supabase.from("system_logs").insert({
                user_id: null, user_email: "system@aimrx.com", user_name: "System Alert",
                action: "ADMIN_ALERT_STUCK_ORDER",
                details: `Order stuck ${Math.round(hoursStuck)} hours for ${patientName} — ${rx.medication} (${rx.id})`,
                status: "warning",
              });
              alertStuckOrder(patientName, rx.medication || "", rx.queue_id || "", rx.id, hoursStuck).catch(() => {});
            }
          }
        }

        const statusChanged = newStatus !== rx.status;
        const trackingChanged =
          trackingNumber && trackingNumber !== rx.tracking_number;

        // Forward-only status guard. The webhook enforces the same rule at
        // app/api/webhook/digitalrx/route.ts — backward transitions from
        // pharmacist un-pack/re-pack cycles or transient API blips MUST NOT
        // overwrite a more-advanced UI status. Tracking is still updated
        // (monotonic — Greenwich never un-assigns a tracking number).
        // Robert Huncher q2329204 (May 19 2026) was already at "packed" with
        // a freshly assigned tracking number; this guard ensures that the
        // status moves forward to "picked_up" and never regresses if a
        // subsequent poll returns a transient TYPED-only response.
        const statusIsForward =
          statusChanged && isForwardStatusTransition(rx.status, newStatus);
        const statusSkippedBackward = statusChanged && !statusIsForward;

        if (!statusIsForward && !trackingChanged) {
          if (statusSkippedBackward) {
            diagnostics.push(
              `  SKIP BACKWARD for ${rx.id}: ${rx.status} → ${newStatus} (would regress, holding at ${rx.status})`,
            );
            backwardSkips.push({
              id: rx.id,
              queue_id: rx.queue_id,
              from: rx.status,
              to: newStatus,
              trackingApplied: null,
            });
            results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `⏸️ Skipped backward (${rx.status} → ${newStatus})` });
          } else {
            diagnostics.push(`  NO CHANGE for ${rx.id}: mapped status=${newStatus}, tracking=${trackingNumber || "none"}`);
            results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `⏸️ No change (still ${rx.status})` });
          }
          continue;
        }

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (statusIsForward) {
          updateData.status = newStatus;
        } else if (statusSkippedBackward) {
          diagnostics.push(
            `  SKIP BACKWARD status for ${rx.id}: ${rx.status} → ${newStatus} (tracking ${trackingNumber} still being written)`,
          );
          backwardSkips.push({
            id: rx.id,
            queue_id: rx.queue_id,
            from: rx.status,
            to: newStatus,
            trackingApplied: trackingNumber,
          });
        }

        if (trackingChanged) {
          updateData.tracking_number = trackingNumber;
        }

        const { error: updateError } = await supabase
          .from("prescriptions")
          .update(updateData)
          .eq("id", rx.id);

        if (updateError) {
          const msg = `DB UPDATE FAILED for ${rx.id}: ${updateError.message}`;
          console.error("[digitalrx-reconcile]", msg);
          diagnostics.push(`  FAIL: ${msg}`);
          failed++;
          results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `❌ Database update failed` });
          run?.trackFailure({
            prescriptionId: rx.id,
            step: "update_db",
            error: updateError.message,
          });
          continue;
        }

        updated++;
        const msg = `UPDATED ${rx.id} (queue: ${rx.queue_id}): ${rx.status} → ${newStatus}${trackingNumber ? ` | tracking: ${trackingNumber}` : ""}`;
        console.log("[digitalrx-reconcile]", msg);
        diagnostics.push(`  SUCCESS: ${msg}`);
        results.push({ patient: patientName, medication: rx.medication || "N/A", status: rx.status, outcome: `✅ ${rx.status} → ${newStatus}${trackingNumber ? ` (tracking: ${trackingNumber})` : ""}` });

        const patientNameForLog = patientName;
        await supabase.from("system_logs").insert({
          user_id: null,
          user_email: "system@aimrx.com",
          user_name: "DigitalRx Update",
          action: "CRON_DIGITALRX_STATUS_CHANGED",
          details: `${patientNameForLog}: ${rx.status} → ${newStatus}\nMedication: ${rx.medication || "N/A"}\nQueue: ${rx.queue_id}${trackingNumber ? `\nTracking: ${trackingNumber}` : ""}`,
          status: "success",
        });

        run?.trackSuccess({
          prescriptionId: rx.id,
          oldStatus: rx.status,
          newStatus,
          trackingNumber: trackingNumber || null,
        });

        if (statusChanged || trackingChanged) {
          sendPatientStatusNotification(supabase, rx.id, newStatus, trackingNumber || null).catch((err) =>
            console.error(`[digitalrx-reconcile] Patient notification error for ${rx.id}:`, err)
          );
        }

        if (trackingChanged && trackingNumber) {
          ensureTrackerRegistered(rx.id, trackingNumber).catch((err) =>
            console.error(
              `[digitalrx-reconcile] EasyPost registration error for ${rx.id}:`,
              err,
            ),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[digitalrx-reconcile] Error for ${rx.id}:`, msg);
        diagnostics.push(`  ERROR: ${rx.id} — ${msg}`);
        failed++;
        run?.trackFailure({
          prescriptionId: rx.id,
          step: "process",
          error: msg,
        });
      }
    }

    await logDiagnostics(supabase, diagnostics, updated, failed, prescriptions.length, results);

    // Single summary row covering every backward-status skip in this run.
    // Per-row inserts would otherwise produce repeating noise for any
    // genuinely stuck order under the 5-minute schedule.
    if (backwardSkips.length > 0) {
      try {
        const summary = backwardSkips
          .map(
            (s) =>
              `${s.id} (queue ${s.queue_id || "n/a"}): ${s.from} → ${s.to}${s.trackingApplied ? ` (tracking ${s.trackingApplied} still applied)` : ""}`,
          )
          .join("\n");
        await supabase.from("system_logs").insert({
          user_id: null,
          user_email: "system@aimrx.com",
          user_name: "System",
          action: "CRON_STATUS_SKIP_BACKWARD",
          details: `Refused ${backwardSkips.length} backward status transition(s) this run:\n${summary}`,
          status: "info",
        });
      } catch (logErr) {
        console.error("[digitalrx-reconcile] Failed to write backward-skip summary log:", logErr);
      }
    }

    console.log(
      `[digitalrx-reconcile] Done. Updated ${updated}/${prescriptions.length}, failed ${failed}, backwardSkips ${backwardSkips.length}`,
    );
    await run?.success(prescriptions.length);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[digitalrx-reconcile] Fatal error:", msg);
    diagnostics.push(`FATAL: ${msg}`);
    try {
      const supabase = createCronClient();
      await logDiagnostics(supabase, diagnostics, 0, 0);
    } catch (_) {}
    await run?.error(msg);
  } finally {
    isRunning = false;
  }
}

async function sendPatientStatusNotification(
  supabase: ReturnType<typeof createCronClient>,
  prescriptionId: string,
  newStatus: string,
  trackingNumber: string | null,
) {
  const statusMap: Record<string, string> = {
    submitted: "pharmacy_processing",
    packed: "pharmacy_processing",
    approved: "pharmacy_processing",
    picked_up: "shipped",
    shipped: "shipped",
    delivered: "delivered",
    ready_pickup: "ready_for_pickup",
    ready_for_pickup: "ready_for_pickup",
  };

  const statusType = statusMap[newStatus];
  if (!statusType) return;

  const { data: alreadySent } = await supabase
    .from("system_logs")
    .select("id")
    .eq("action", "PATIENT_STATUS_EMAIL_SENT")
    .ilike("details", `%${prescriptionId}%`)
    .ilike("details", `%${statusType}%`)
    .limit(1);

  if (alreadySent && alreadySent.length > 0) {
    console.log(`[digitalrx-reconcile] Skipping duplicate ${statusType} email for ${prescriptionId} — already sent`);
    return;
  }

  const { data: rx } = await supabase
    .from("prescriptions")
    .select("patient_id, prescriber_id, medication, dosage, pharmacy_id")
    .eq("id", prescriptionId)
    .single();

  if (!rx?.patient_id) return;

  const { data: patient } = await supabase
    .from("patients")
    .select("email, first_name, last_name, phone")
    .eq("id", rx.patient_id)
    .single();

  if (!patient?.email) return;

  const { data: provider } = await supabase
    .from("providers")
    .select("prefix, first_name, last_name")
    .eq("user_id", rx.prescriber_id)
    .single();

  let pharmacyName: string | undefined;
  let pharmacyPhone: string | undefined;
  let pharmacyAddress: string | undefined;
  if (rx.pharmacy_id) {
    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("name, phone, address")
      .eq("id", rx.pharmacy_id)
      .single();
    pharmacyName = pharmacy?.name;
    pharmacyPhone = pharmacy?.phone;
    pharmacyAddress = pharmacy?.address;
  }

  const medication = [rx.medication, rx.dosage].filter(Boolean).join(" ");
  const providerName = provider ? `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}` : "Your Provider";
  const patientName = `${patient.first_name} ${patient.last_name}`;

  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://app.aimrx.com";

  try {
    const response = await fetch(`${APP_URL}/api/payments/send-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY || "",
      },
      body: JSON.stringify({
        patientEmail: patient.email,
        patientPhone: patient.phone || undefined,
        patientName,
        medication,
        providerName,
        statusType,
        trackingNumber: trackingNumber || undefined,
        pharmacyName,
        pharmacyPhone,
        pharmacyAddress,
        prescriptionId,
      }),
    });

    if (!response.ok) {
      console.error(`[digitalrx-reconcile] Status email failed for ${prescriptionId}: ${response.status}`);
    } else {
      console.log(`[digitalrx-reconcile] Status email sent: ${statusType} → ${patient.email} for ${prescriptionId}`);
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "system@aimrx.com",
        user_name: "Patient Notification",
        action: "PATIENT_STATUS_EMAIL_SENT",
        details: `${statusType} email sent for ${prescriptionId} to ${patient.email}`,
        status: "success",
      });
    }
  } catch (err) {
    console.error(`[digitalrx-reconcile] Status email error for ${prescriptionId}:`, err);
  }
}

async function logDiagnostics(
  supabase: ReturnType<typeof createCronClient>,
  diagnostics: string[],
  updated: number,
  failed: number,
  prescriptionCount?: number,
  results?: Array<{ patient: string; medication: string; status: string; outcome: string }>,
) {
  const total = prescriptionCount ?? 0;
  const lines: string[] = [];

  if (total === 0) {
    lines.push("No prescriptions waiting for pharmacy update.");
  } else {
    lines.push(`Checked ${total} prescription${total > 1 ? "s" : ""}:`);
    lines.push("");
    if (results && results.length > 0) {
      for (const r of results) {
        lines.push(`${r.outcome}`);
        lines.push(`  Patient: ${r.patient} | ${r.medication}`);
      }
    }
    if (updated > 0 || failed > 0) {
      lines.push("");
      const parts: string[] = [];
      if (updated > 0) parts.push(`${updated} updated`);
      if (failed > 0) parts.push(`${failed} failed`);
      const unchanged = total - updated - failed;
      if (unchanged > 0) parts.push(`${unchanged} unchanged`);
      lines.push(`Summary: ${parts.join(", ")}`);
    }
  }

  const details = lines.join("\n");

  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "DigitalRx Reconcile",
    action: "CRON_DIGITALRX_RECONCILE",
    details: details.slice(0, 4000),
    status: failed > 0 ? "error" : updated > 0 ? "success" : "info",
  });
}
