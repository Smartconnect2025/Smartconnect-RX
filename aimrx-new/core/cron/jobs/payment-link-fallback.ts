/**
 * payment-link-fallback
 * ─────────────────────
 * Server-side safety net for the post-submit → payment-link → email flow.
 *
 * THE PROBLEM (Matthew Stephens incident, May 19 2026):
 * The browser step-4 page (`/prescriptions/new/step4`) is what calls
 * `/api/payments/generate-link`. That endpoint inserts the
 * `payment_transactions` row AND fires `/api/payments/send-payment-email`.
 * If the submitter closes the tab between step 3 (PRESCRIPTION_SUBMITTED)
 * and step 4 (generate-link), the prescription sits forever in
 * `payment_status='unpaid' / order_progress='payment_pending'` with NO
 * payment row and the patient NEVER receives the link.
 *
 * THE FIX:
 * Every 5 minutes, scan for prescriptions stuck in that exact state for
 * more than 10 minutes (grace window: legitimate slow clickers on step 4
 * finish well within 10 min). For each one, POST server-to-server to
 * `/api/payments/generate-link` using `x-internal-api-key`. That endpoint
 * already:
 *   - validates the group is fully covered (we pre-gather siblings),
 *   - computes server-authoritative totals from `prescriptions.patient_price
 *     + shipping_fee_cents + profit_cents` when client cents are 0,
 *     so we can safely pass {consultationFeeCents:0, medicationCostCents:0,
 *     shippingFeeCents:0, sendEmail:true},
 *   - inserts the `payment_transactions` row,
 *   - fire-and-forgets `/api/payments/send-payment-email`,
 *   - writes PATIENT_NOTIFICATION_SENT to system_logs.
 *
 * SAFETY (CRITICAL — Joseph's "don't break anything" rule):
 *   1. Skips pay-on-terms providers entirely (those go through a different
 *      auto-bill path; we don't email those patients).
 *   2. Skips test patients (reuses isTestPatient() from digitalrx-reconcile;
 *      Joseph's "NEVER POLL TEST PATIENTS" hard rule).
 *   3. Skips rows already linked to a payment_transactions row.
 *   4. Skips group-orders where siblings have partial linkage (let admin
 *      decide). Logs `skipped_group_partial`.
 *   5. Skips rows whose patient has no email (logs `skipped_no_email`).
 *   6. Re-entrancy guard (`isRunning`) so overlapping 5-min ticks no-op.
 *   7. Per-row try/catch — one row's failure never aborts the sweep.
 *   8. Hard cap of 50 rows per tick (mirrors digitalrx-reconcile).
 *   9. Suppresses empty-tick `system_logs` writes so 288 ticks/day don't
 *      flood the audit trail (same pattern as payment-reconcile).
 *  10. The /api/payments/generate-link route already has CAS guards
 *      (payment_status='pending' → 'link_generating') so concurrent calls
 *      from a still-open step-4 tab vs. this cron cannot double-insert.
 *      Whichever loses gets 409 and harmlessly returns.
 */

import { createCronClient } from "../supabase";
import { logCronRun } from "../logger";

// ─── Test-patient detection — DUPLICATED FROM digitalrx-reconcile.ts ──
// Intentionally inlined (not imported) so this cron's behavior is fully
// self-contained and a future edit to digitalrx-reconcile's helper can
// never silently change the email cohort. If the rule ever needs to
// change, update both places consciously.
function isTestPatient(p: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): boolean {
  const first = (p.first_name || "").toLowerCase();
  const last = (p.last_name || "").toLowerCase();
  const email = (p.email || "").toLowerCase();
  if (/\btest/i.test(first) || /\btest/i.test(last)) return true;
  if (first === "aimrx" || last === "aimrx") return true;
  if (/(?:^|[^a-z0-9])test/i.test(email)) return true;
  if (/^joseph\+.*@smartconnects\.com$/i.test(email)) return true;
  if (email.startsWith("aimrx")) return true;
  return false;
}

const GRACE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// LOOKBACK_WINDOW_MS widened from 24h → 30d on May 19 2026 after we
// discovered 20 real (non-test, non-pay-on-terms) patients had been
// silently stuck for up to 76 days because nothing was watching. With
// a 30-day window, even a multi-day Render outage or cron crash can't
// drop a future submission past the safety net.
const LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// RECOVERY_FLOOR_ISO is a hard floor on `submitted_at`: the cron will
// NEVER auto-recover any prescription submitted before this instant,
// regardless of the rolling lookback window above. This was added with
// the 30-day widening so the existing 20-patient backlog stays out of
// the auto-email sweep — Joseph (CEO) explicitly said he'll handle
// those manually because emailing a 10-week-old prescription as if it
// were fresh would shock patients who've moved on. Anything submitted
// AFTER this instant is fair game for the cron forever.
//
// If you ever need the cron to reach further back (e.g. to recover a
// new batch of accidentally-stuck rows), LOWER this constant — never
// remove the floor entirely.
const RECOVERY_FLOOR_ISO = "2026-05-19T21:30:00.000Z";

const MAX_ROWS_PER_TICK = 50;

let isRunning = false;

type Outcome =
  | "recovered"
  | "skipped_pay_on_terms"
  | "skipped_test_patient"
  | "skipped_no_email"
  | "skipped_group_partial"
  | "skipped_preflight_linked"
  | "error_missing_internal_key"
  | "error_generate_link_http"
  | "error_generate_link_throw"
  | "error_no_provider_row";

interface RowOutcome {
  prescription_id: string;
  outcome: Outcome;
  detail?: string;
}

interface CandidateRow {
  id: string;
  patient_id: string;
  prescriber_id: string;
  order_group_id: string | null;
  submitted_at: string;
  patient_price: string | null;
  shipping_fee_cents: number | null;
  profit_cents: number | null;
}

interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface ProviderRow {
  user_id: string;
  pay_on_terms: boolean | null;
}

interface SiblingRow {
  id: string;
  payment_status: string | null;
  status: string | null;
  payment_transaction_id: string | null;
}

// payment_transactions states that mean "this prescription has a LIVE link
// or already-collected payment in flight" — i.e. a fresh link from us
// would be a duplicate. Anything outside this set (expired, failed,
// voided, cancelled, refunded) means the prior tx is dead and a new link
// is the correct recovery action.
const LIVE_TX_STATES = new Set([
  "pending",
  "processing",
  "completed",
  "paid",
]);

export async function recoverMissedPaymentLinks() {
  if (isRunning) {
    console.log(
      "[payment-link-fallback] Skipped — previous run still in progress",
    );
    return;
  }
  isRunning = true;
  console.log("[payment-link-fallback] Starting sweep...");

  let run: Awaited<ReturnType<typeof logCronRun>> | null = null;
  const outcomes: RowOutcome[] = [];

  try {
    run = await logCronRun("payment-link-fallback");
    const supabase = createCronClient();

    // ── CRITICAL guard: without INTERNAL_API_KEY every POST to
    // /api/payments/generate-link returns 401 and the fallback silently
    // fails forever. Abort the tick loudly so operators see it in logs
    // and `cron_job_runs.status='error'` rather than wasting work.
    const internalApiKey = process.env.INTERNAL_API_KEY || "";
    if (!internalApiKey) {
      const msg =
        "INTERNAL_API_KEY env var is not set — payment-link-fallback cannot " +
        "authenticate to /api/payments/generate-link. Aborting tick.";
      console.error(`[payment-link-fallback] ${msg}`);
      await supabase.from("system_logs").insert({
        action: "CRON_PAYMENT_LINK_FALLBACK",
        status: "error",
        details: msg,
      });
      await run.error(msg);
      return;
    }

    const now = Date.now();
    const graceCutoffIso = new Date(now - GRACE_WINDOW_MS).toISOString();
    const lookbackCutoffIso = new Date(
      now - LOOKBACK_WINDOW_MS,
    ).toISOString();

    // ── Step 1: find stalled rows ────────────────────────────────────
    // Predicates:
    //   - submitted_at IN [now-24h, now-10min]
    //   - payment_transaction_id IS NULL  (no link ever generated)
    //   - payment_status IN ('pending','unpaid')
    //     ─ The schema default is 'unpaid' but post-submit flow flips to
    //       'pending' (verified May 19 2026 against Stephens's stuck row).
    //       Including BOTH so we don't miss rows in either state. We
    //       deliberately exclude 'paid','failed','expired','link_generating'.
    //   - order_progress = 'payment_pending'
    //   - status NOT IN ('cancelled','rejected','refunded','void')
    const candidateQuery = await supabase
      .from("prescriptions")
      .select(
        "id, patient_id, prescriber_id, order_group_id, submitted_at, " +
          "patient_price, shipping_fee_cents, profit_cents",
      )
      .is("payment_transaction_id", null)
      .in("payment_status", ["pending", "unpaid"])
      .eq("order_progress", "payment_pending")
      .not("status", "in", "(cancelled,rejected,refunded,void)")
      .lt("submitted_at", graceCutoffIso)
      .gt("submitted_at", lookbackCutoffIso)
      .order("submitted_at", { ascending: true })
      .limit(MAX_ROWS_PER_TICK);

    const candidateError = candidateQuery.error;
    const candidateRows = candidateQuery.data as CandidateRow[] | null;

    if (candidateError) {
      console.error(
        "[payment-link-fallback] candidate fetch error:",
        candidateError,
      );
      await run.error(`candidate fetch: ${candidateError.message}`);
      return;
    }

    if (!candidateRows || candidateRows.length === 0) {
      // Suppress empty-tick log noise (288 ticks/day at 5-min cadence).
      console.log("[payment-link-fallback] No stalled rows. Done.");
      await run.success(0);
      return;
    }

    console.log(
      `[payment-link-fallback] Found ${candidateRows.length} candidate rows`,
    );

    // ── Step 2: bulk fetch patient + provider info ──────────────────
    const patientIds = Array.from(
      new Set(candidateRows.map((r) => r.patient_id).filter(Boolean)),
    );
    const prescriberIds = Array.from(
      new Set(candidateRows.map((r) => r.prescriber_id).filter(Boolean)),
    );

    const [{ data: patientsData }, { data: providersData }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .in("id", patientIds.length > 0 ? patientIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("providers")
        .select("user_id, pay_on_terms")
        .in("user_id", prescriberIds.length > 0 ? prescriberIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const patientMap = new Map<string, PatientRow>(
      ((patientsData as PatientRow[] | null) || []).map((p) => [p.id, p]),
    );
    const providerMap = new Map<string, ProviderRow>(
      ((providersData as ProviderRow[] | null) || []).map((p) => [p.user_id, p]),
    );

    // ── Step 3: classify each row + recover the ones that qualify ────
    // internalApiKey was already validated as non-empty at the top of the
    // function — re-read here for tighter scope when building the request.
    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      "http://localhost:5000";

    let recoveredCount = 0;

    for (const row of candidateRows) {
      try {
        const patient = patientMap.get(row.patient_id);
        const provider = providerMap.get(row.prescriber_id);

        if (!provider) {
          outcomes.push({
            prescription_id: row.id,
            outcome: "error_no_provider_row",
          });
          continue;
        }

        if (provider.pay_on_terms === true) {
          outcomes.push({
            prescription_id: row.id,
            outcome: "skipped_pay_on_terms",
          });
          continue;
        }

        if (
          patient &&
          isTestPatient({
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.email,
          })
        ) {
          outcomes.push({
            prescription_id: row.id,
            outcome: "skipped_test_patient",
          });
          continue;
        }

        if (!patient?.email) {
          outcomes.push({
            prescription_id: row.id,
            outcome: "skipped_no_email",
          });
          continue;
        }

        // Group-order handling: if this rx is in an order_group_id, gather
        // every eligible sibling and bill the full set together. The
        // generate-link route rejects partial-group bills (422) so we MUST
        // pass the complete set or skip entirely.
        let rxIdsToBill: string[] = [row.id];
        if (row.order_group_id) {
          const { data: siblings } = await supabase
            .from("prescriptions")
            .select("id, payment_status, status, payment_transaction_id")
            .eq("order_group_id", row.order_group_id);

          if (!siblings || siblings.length === 0) {
            // Shouldn't happen — but be defensive
            outcomes.push({
              prescription_id: row.id,
              outcome: "skipped_group_partial",
              detail: "no siblings found despite order_group_id set",
            });
            continue;
          }

          const siblingRows = siblings as SiblingRow[];
          const eligible = siblingRows.filter((s) => {
            const st = (s.status || "").toLowerCase();
            return (
              s.payment_status !== "paid" &&
              st !== "cancelled" &&
              st !== "rejected" &&
              st !== "void"
            );
          });

          // If any eligible sibling is linked to a LIVE payment_transactions
          // row (pending/processing/completed/paid), the group is in a
          // mixed state and a new link would either duplicate-charge or
          // collide with the existing flow. Skip — admin decision.
          //
          // Crucially: linkage to a DEAD tx (expired/failed/voided) does
          // NOT block recovery — we still want to issue a fresh link in
          // that case. Without this filter, every prescription with an old
          // failed payment attempt would stay stuck forever (architect
          // MEDIUM finding, May 19 2026).
          const linkedTxIds = Array.from(
            new Set(
              eligible
                .map((s) => s.payment_transaction_id)
                .filter((v): v is string => !!v),
            ),
          );

          let liveLinkedExists = false;
          if (linkedTxIds.length > 0) {
            const { data: linkedTxs } = await supabase
              .from("payment_transactions")
              .select("id, payment_status")
              .in("id", linkedTxIds);
            liveLinkedExists = (linkedTxs || []).some((t) =>
              LIVE_TX_STATES.has((t.payment_status || "").toLowerCase()),
            );
          }

          if (liveLinkedExists) {
            outcomes.push({
              prescription_id: row.id,
              outcome: "skipped_group_partial",
              detail:
                "sibling in same order_group_id has a LIVE payment_transaction",
            });
            continue;
          }

          rxIdsToBill = eligible.map((s) => s.id);
          if (rxIdsToBill.length === 0) {
            outcomes.push({
              prescription_id: row.id,
              outcome: "skipped_group_partial",
              detail: "no eligible siblings in group",
            });
            continue;
          }
        }

        // ── Step 3.5: PRE-FLIGHT re-read ─────────────────────────────
        // Close the double-email race window: between the candidate query
        // (top of tick) and now, a still-open Step-4 tab may have fired
        // its own POST and the row may already have a payment_transaction
        // _id. Re-read the row IDs we're about to bill and abort if ANY
        // of them is now linked. The generate-link route itself also has
        // CAS guards, but we'd rather not even fire the POST (no log
        // noise, no duplicate email send-attempt).
        const { data: preflight } = await supabase
          .from("prescriptions")
          .select("id, payment_transaction_id")
          .in("id", rxIdsToBill);
        const stillUnlinked =
          preflight &&
          preflight.length === rxIdsToBill.length &&
          preflight.every((r) => r.payment_transaction_id == null);
        if (!stillUnlinked) {
          outcomes.push({
            prescription_id: row.id,
            outcome: "skipped_preflight_linked",
            detail: "row(s) acquired a payment_transaction_id mid-sweep",
          });
          continue;
        }

        // ── Step 4: call generate-link server-to-server ───────────────
        // We pass money fields as 0; the route falls back to server-
        // authoritative DB totals (patient_price + shipping_fee_cents +
        // profit_cents) when client cents sum to 0. See generate-link
        // /route.ts lines 644-673.
        const response = await fetch(
          `${appUrl}/api/payments/generate-link`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-api-key": internalApiKey,
            },
            body: JSON.stringify({
              prescriptionId: rxIdsToBill[0],
              prescriptionIds: rxIdsToBill,
              consultationFeeCents: 0,
              medicationCostCents: 0,
              shippingFeeCents: 0,
              sendEmail: true,
              sendReceiptToPatient: true,
            }),
          },
        );

        if (!response.ok) {
          const errText = await response
            .text()
            .catch(() => "<unreadable response>");
          outcomes.push({
            prescription_id: row.id,
            outcome: "error_generate_link_http",
            detail: `status=${response.status} body=${errText.slice(0, 200)}`,
          });
          console.error(
            `[payment-link-fallback] generate-link HTTP ${response.status} for rx=${row.id}: ${errText.slice(0, 200)}`,
          );
          continue;
        }

        recoveredCount += 1;
        outcomes.push({
          prescription_id: row.id,
          outcome: "recovered",
          detail:
            rxIdsToBill.length > 1
              ? `grouped with ${rxIdsToBill.length - 1} sibling(s)`
              : undefined,
        });
        console.log(
          `[payment-link-fallback] Recovered rx=${row.id} (group_size=${rxIdsToBill.length})`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        outcomes.push({
          prescription_id: row.id,
          outcome: "error_generate_link_throw",
          detail: msg.slice(0, 200),
        });
        console.error(
          `[payment-link-fallback] throw on rx=${row.id}:`,
          err,
        );
      }
    }

    // ── Step 5: emit ONE summary log row when something happened ─────
    // Only write to system_logs when we actually recovered something or
    // hit a real error — pure "skipped" sweeps stay silent so the audit
    // trail doesn't drown in 288 ticks/day.
    const hadRecovery = outcomes.some((o) => o.outcome === "recovered");
    const hadError = outcomes.some((o) => o.outcome.startsWith("error_"));

    if (hadRecovery || hadError) {
      const summary = outcomes.reduce<Record<string, number>>((acc, o) => {
        acc[o.outcome] = (acc[o.outcome] || 0) + 1;
        return acc;
      }, {});

      const summaryStr = Object.entries(summary)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");

      const recoveredIds = outcomes
        .filter((o) => o.outcome === "recovered")
        .map((o) => o.prescription_id);

      const errorDetails = outcomes
        .filter((o) => o.outcome.startsWith("error_"))
        .slice(0, 5)
        .map((o) => `${o.prescription_id}:${o.outcome}${o.detail ? " " + o.detail : ""}`);

      await supabase.from("system_logs").insert({
        action: "CRON_PAYMENT_LINK_FALLBACK",
        status: hadError ? "error" : "success",
        details:
          `${summaryStr} | recovered_ids=${recoveredIds.join(",") || "none"}` +
          (errorDetails.length > 0
            ? ` | errors=${errorDetails.join(" ; ")}`
            : ""),
      });
    }

    console.log(
      `[payment-link-fallback] Done. recovered=${recoveredCount} total=${outcomes.length}`,
    );
    await run.success(recoveredCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payment-link-fallback] Fatal error:", msg);
    if (run) await run.error(msg);
  } finally {
    isRunning = false;
  }
}
