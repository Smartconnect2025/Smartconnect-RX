/**
 * submit-to-pharmacy-core
 *
 * In-process implementation of the "submit a paid prescription to the
 * pharmacy" workflow. Single source of truth — called from:
 *   1. app/api/prescriptions/[id]/submit-to-pharmacy/route.ts (HTTP)
 *   2. app/api/prescriptions/[id]/mark-paid/route.ts (direct call)
 *   3. core/cron/jobs/payment-janitor.ts cohort F (recovery retry)
 *
 * Why this exists (May 4, 2026 Felicia Rafeal incident):
 *   The previous implementation made `mark-paid` issue an internal HTTP
 *   self-call to the submit-to-pharmacy route. Both routes shared one
 *   serverless execution budget on Render, and the submit fetch had no
 *   AbortController. When DigitalRx or Supabase Storage hung, Render
 *   SIGKILLed the Node process before any catch/finally could run,
 *   leaving the row stuck in `submitting_to_pharmacy` with NO error log.
 *
 * Hardening in this module:
 *   - safeLog: wraps every system_logs insert in a 3s timeout + try/catch
 *     so logging cannot itself become the failure it is meant to diagnose.
 *   - withTimeout: races every long await against a per-step deadline so
 *     a hung dependency surfaces as a logged timeout, never a silent kill.
 *   - fetchWithTimeout: AbortController-backed fetch for both the submit
 *     POST and its response.json() parse.
 *   - Checkpoint console logs BEFORE every long await so the last visible
 *     log identifies WHICH step hung if the process is still SIGKILLed.
 *   - Every non-success exit writes a terminal system_logs entry tagged
 *     with the per-call requestId (UUID) so entry/exit logs can always
 *     be correlated.
 *   - PDF download timeout falls back to PDF=null + log + continue (does
 *     NOT block the order, preserving the "no PDF guard" behavior the
 *     user requested).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getPrescriptionPdfBase64 } from "@core/services/storage/prescriptionPdfStorage";
import { isEncrypted, decryptApiKey } from "@core/security/encryption";
import {
  formatPhoneForDigitalRx,
  formatDobForDigitalRx,
  formatDrugNameWithPrefix,
  formatDateMMDDYYYY,
  formatPatientDOB,
  quantityInMl,
  daysSupplyFromVialCount,
  classifyDosageForm,
  quantityForOral,
  daysSupplyForOral,
  formatBillToNote,
  truncateZip,
  GreenwichValidationError,
  GREENWICH_PHARMACY_ID,
  GREENWICH_STORE_ID,
  GREENWICH_CLINIC_NAME,
} from "@core/utils/digitalrx-format";

const DEFAULT_DIGITALRX_BASE_URL =
  process.env.NEXT_PUBLIC_DIGITALRX_BASE_URL ||
  "https://www.dbswebserver.com/DBSRestApi/API";
const VENDOR_NAME = process.env.NEXT_PUBLIC_VENDOR_NAME || "SmartRx Demo";

// Per-step timeouts. Sum (PDF + DigitalRx + json + DB margin) must sit
// safely under Render's request budget (~30s on free tier; ~60s on paid).
// Numbers chosen so a single hung dependency is logged + reverted before
// Render can SIGKILL the process.
const PDF_TIMEOUT_MS = 8000;
const DIGITALRX_FETCH_TIMEOUT_MS = 12000;
const DIGITALRX_PARSE_TIMEOUT_MS = 3000;
const SAFE_LOG_TIMEOUT_MS = 3000;

export interface SubmitContext {
  isInternalCall: boolean;
  isAdmin: boolean;
  authenticatedUserId: string | null;
  /** Per-call UUID — every log line for one execution carries this so
   * entry/checkpoint/exit can be grep'd together. */
  requestId: string;
  /** Caller-provided label (e.g. "mark-paid", "janitor-cohortF",
   * "admin-ui") for log clarity. */
  callerLabel: string;
}

export interface SubmitResult {
  ok: boolean;
  /** HTTP status the route wrapper should return when called over HTTP. */
  httpStatus: number;
  /** DigitalRx queue id when ok=true. */
  queueId?: string;
  /** Short machine-friendly result code so callers (mark-paid, janitor)
   * can branch without parsing English. */
  code:
    | "submitted"
    | "already_submitted"
    | "race_lost"
    | "not_found"
    | "forbidden"
    | "unauthorized"
    | "payment_not_completed"
    | "backend_missing"
    | "greenwich_validation_failed"
    | "missing_critical_fields"
    | "digitalrx_rejected"
    | "digitalrx_no_queue_id"
    | "pdf_timeout_fallback_taken"
    | "pdf_unhealthy_will_retry"
    | "pdf_content_invalid_will_retry"
    | "pdf_unavailable_will_retry"
    | "timeout"
    | "unknown_error";
  error?: string;
  details?: unknown;
}

// ---------- helpers ----------

export function newRequestId(): string {
  return crypto.randomUUID();
}

class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[${label}] timeout after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

/**
 * Race a promise against a wall-clock timeout. Note: the underlying
 * promise keeps running if it loses the race — Supabase Storage's
 * `.download()` does not yet support AbortController. The orphaned
 * download will be GC'd. The point of this helper is to ensure the
 * caller's await ALWAYS settles within `ms`, so the route can log a
 * timeout and revert before Render kills the process.
 */
export function withTimeout<T>(
  label: string,
  ms: number,
  promise: Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** AbortController-backed fetch with a hard timeout. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new TimeoutError(label, ms);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

interface SystemLogEntry {
  user_id: string | null;
  user_email: string;
  user_name: string;
  action: string;
  details: string;
  status: string;
  queue_id?: string | null;
}

/**
 * Fire-and-await a system_logs insert, but bounded by a 3s timeout and
 * fully exception-safe. Logging must NEVER cause the failure it is
 * meant to diagnose, so all errors are swallowed.
 */
export async function safeLog(
  supabase: SupabaseClient,
  entry: SystemLogEntry,
): Promise<void> {
  try {
    await withTimeout(
      `safeLog:${entry.action}`,
      SAFE_LOG_TIMEOUT_MS,
      Promise.resolve(supabase.from("system_logs").insert(entry)).then(
        ({ error }) => {
          if (error) {
            console.error(
              `[safeLog] system_logs insert failed (${entry.action}):`,
              error.message,
            );
          }
        },
      ),
    );
  } catch (err) {
    console.error(
      `[safeLog] swallowed (${entry.action}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

function buildLogIdentity(ctx: SubmitContext) {
  if (ctx.isInternalCall) {
    return {
      user_id: null,
      user_email: `internal-${ctx.callerLabel}`,
      user_name: ctx.callerLabel,
    };
  }
  return {
    user_id: ctx.authenticatedUserId,
    user_email: ctx.authenticatedUserId || "unknown",
    user_name: ctx.isAdmin ? "admin" : "provider",
  };
}

function isGreenwichSubmission(
  pharmacyId: string | null | undefined,
  storeId: string | null | undefined,
): boolean {
  return pharmacyId === GREENWICH_PHARMACY_ID && storeId === GREENWICH_STORE_ID;
}

// ---------- main entry point ----------

export async function submitPrescriptionToPharmacy(
  supabase: SupabaseClient,
  prescriptionId: string,
  ctx: SubmitContext,
): Promise<SubmitResult> {
  const reqTag = `[submit ${ctx.requestId.slice(0, 8)} ${prescriptionId.slice(0, 8)}]`;
  const logIdentity = buildLogIdentity(ctx);

  // Audit-log entry. Greenwich/Rahmany/Felicia incidents all showed a
  // route invocation with no log line — so this is the first thing we
  // do, before anything that can hang.
  await safeLog(supabase, {
    ...logIdentity,
    action: "PRESCRIPTION_SUBMIT_TO_PHARMACY_CALLED",
    details: `Entry: prescriptionId=${prescriptionId} via=${ctx.callerLabel} reqId=${ctx.requestId}`,
    status: "info",
  });

  /**
   * Helper: write a terminal failure log + revert claim if we hold one,
   * then return the SubmitResult. Centralized so EVERY non-success exit
   * path is covered (the Felicia regression came from exits with no log).
   */
  const exitFailure = async (
    code: SubmitResult["code"],
    httpStatus: number,
    error: string,
    opts: { revert?: boolean; details?: unknown; action?: string } = {},
  ): Promise<SubmitResult> => {
    const { revert = false, details, action = "PRESCRIPTION_SUBMIT_FAILED" } = opts;
    if (revert) {
      try {
        await withTimeout(
          "revertClaim",
          5000,
          Promise.resolve(
            supabase
              .from("prescriptions")
              .update({
                status: "payment_received",
                updated_at: new Date().toISOString(),
              })
              .eq("id", prescriptionId)
              .eq("status", "submitting_to_pharmacy"),
          ).then(() => undefined),
        );
      } catch (revertErr) {
        console.error(
          `${reqTag} revertClaim failed (non-fatal):`,
          revertErr instanceof Error ? revertErr.message : revertErr,
        );
      }
    }
    await safeLog(supabase, {
      ...logIdentity,
      action,
      details: `${error} | reqId=${ctx.requestId} prescriptionId=${prescriptionId} code=${code}`,
      status: "error",
    });
    return { ok: false, httpStatus, code, error, details };
  };

  try {
    // ─── Load prescription + patient ───────────────────────────────
    console.log(`${reqTag} step=load-prescription`);
    const { data: prescription, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select(`*, patients (*)`)
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      return exitFailure(
        "not_found",
        404,
        `Prescription not found: ${prescriptionError?.message || "no row"}`,
      );
    }

    // Provider ownership check
    if (
      !ctx.isInternalCall &&
      !ctx.isAdmin &&
      ctx.authenticatedUserId &&
      prescription.prescriber_id !== ctx.authenticatedUserId
    ) {
      return exitFailure(
        "forbidden",
        403,
        `Provider ownership check failed (auth=${ctx.authenticatedUserId} owner=${prescription.prescriber_id})`,
      );
    }

    // ─── Load provider, patient, medication catalog ────────────────
    // Manning-incident fix (May 9 2026, Task #64): for delegate
    // submissions we MUST load the AUTHORIZING provider's row, not the
    // assistant's. The assistant's row exists but has NPI / DEA /
    // signature_url all NULL. Loading it produced a DigitalRx Doctor
    // block with no NPI and a stub PDF that hit the 200KB hard-gate.
    //
    // Resolver returns null (never silently falls back to the assistant
    // row) when delegationId is set but the join is broken — that case
    // becomes a clean 404 here, which the janitor's cohort G then sees
    // as a still-held row and surfaces to operators.
    console.log(`${reqTag} step=load-provider+patient+medication`);
    const { resolveAuthorizingProvider } = await import(
      "@core/services/authorizing-provider"
    );
    const authResolved = await resolveAuthorizingProvider(supabase, {
      prescriberId: prescription.prescriber_id,
      delegationId: prescription.submitted_by_delegation_id,
    });
    // APPROVED EXCEPTION to Joseph's "nothing stops the order" rule
    // (May 9 2026, Task #64). When a row carries a
    // submitted_by_delegation_id but the resolver cannot follow the
    // join to a real authorizing provider, the ONLY two options are:
    //   (a) submit with the assistant's empty row → guaranteed
    //       Greenwich rejection (stub PDF < 200KB, no NPI / DEA /
    //       signature_url). This was the Manning bug.
    //   (b) refuse THIS submit attempt; row stays in
    //       status='payment_received', payment_status='paid'.
    //
    // We choose (b). This is NOT lost-order: the row remains visible
    // in payment-janitor cohort G, which retries on every tick. As
    // soon as ops repairs the delegation row (or reassigns to a
    // delegation with a healthy authorizing provider), the next tick
    // auto-resolves and the order ships. The patient is never
    // double-charged, the row is never archived, and operators are
    // alerted via the dedicated action code below — exactly the
    // self-healing behavior Joseph's rule mandates.
    //
    // Do NOT change this to a fall-back-to-prescriber_id silent path.
    // That path produces shipped-but-rejected orders that look "sent"
    // to providers but die at Greenwich's queue with no operator
    // signal — strictly worse than the visible cohort G retry loop.
    if (prescription.submitted_by_delegation_id && !authResolved) {
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_DELEGATE_AUTH_UNRESOLVED",
        details:
          `prescriptionId=${prescriptionId} delegationId=${prescription.submitted_by_delegation_id} ` +
          `prescriberUserId=${prescription.prescriber_id} ` +
          `Refusing to fall back to assistant row.`,
        status: "error",
      });
      return exitFailure(
        "not_found",
        404,
        "Authorizing provider could not be resolved for this delegate-submitted prescription.",
        { action: "PRESCRIPTION_SUBMIT_DELEGATE_AUTH_UNRESOLVED" },
      );
    }
    if (authResolved?.viaDelegation) {
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_PDF_DELEGATE_RESOLVED",
        details:
          `prescriptionId=${prescriptionId} delegationId=${authResolved.delegationId} ` +
          `authProviderUserId=${authResolved.provider.user_id} ` +
          `hasNpi=${!!authResolved.provider.npi_number} hasDea=${!!authResolved.provider.dea_number} hasSig=${!!authResolved.provider.signature_url}`,
        status: "info",
      });
    }
    // Re-load the FULL provider row by the resolved user_id so we keep
    // Supabase's inferred row type (downstream uses dozens of columns:
    // payment_details, medical_licenses, billing_address, tier_level …).
    // For non-delegate paths, authResolved.provider.user_id ===
    // prescription.prescriber_id so the lookup is identical to the
    // pre-Manning behavior.
    const providerLookupUserId =
      authResolved?.provider.user_id ?? prescription.prescriber_id;
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", providerLookupUserId)
      .single();

    const { data: patient } = await supabase
      .from("patients")
      .select("*")
      .eq("id", prescription.patient_id)
      .single();

    let pharmacyMedication: Record<string, unknown> | null = null;
    if (prescription.medication_id) {
      const { data: medData } = await supabase
        .from("pharmacy_medications")
        .select("*")
        .eq("id", prescription.medication_id)
        .single();
      pharmacyMedication = medData;
    }

    if (providerError || !provider) {
      return exitFailure(
        "not_found",
        404,
        `Provider not found for prescriber_id=${prescription.prescriber_id}`,
      );
    }

    // ─── Idempotency: already submitted? ───────────────────────────
    if (prescription.status === "submitted" && prescription.queue_id) {
      // Terminal log on idempotent no-op so every entry log pairs
      // with a terminal log for log-scan correctness.
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_ALREADY_SUBMITTED",
        details:
          `Idempotent no-op: prescriptionId=${prescriptionId} already in status=submitted ` +
          `with queueId=${prescription.queue_id}. reqId=${ctx.requestId}`,
        status: "info",
      });
      return {
        ok: true,
        httpStatus: 200,
        code: "already_submitted",
        queueId: prescription.queue_id,
      };
    }

    if (prescription.status === "submitting_to_pharmacy") {
      // Another caller (or a previous timed-out invocation) holds the
      // claim. Don't write a FAILED log — the janitor cohort F will
      // recover this if the holder really is dead. Just decline.
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_ALREADY_IN_FLIGHT",
        details: `Refusing — another process holds the submitting_to_pharmacy claim. reqId=${ctx.requestId}`,
        status: "warning",
      });
      return {
        ok: false,
        httpStatus: 409,
        code: "race_lost",
        error: "Prescription is currently being submitted by another process",
      };
    }

    // ─── Atomic claim ──────────────────────────────────────────────
    console.log(`${reqTag} step=claim-row`);
    const { data: claimResult } = await supabase
      .from("prescriptions")
      .update({
        status: "submitting_to_pharmacy",
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId)
      .neq("status", "submitted")
      .neq("status", "submitting_to_pharmacy")
      .select("id");

    if (!claimResult || claimResult.length === 0) {
      // Lost the race — re-check current status.
      const { data: currentRx } = await supabase
        .from("prescriptions")
        .select("status, queue_id")
        .eq("id", prescriptionId)
        .single();

      if (currentRx?.status === "submitted" && currentRx?.queue_id) {
        // Terminal log on idempotent race-winner path so log scans
        // can pair every entry with a terminal action.
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_SUBMIT_ALREADY_SUBMITTED",
          details:
            `Race resolved by concurrent submitter: prescriptionId=${prescriptionId} ` +
            `is now status=submitted with queueId=${currentRx.queue_id}. reqId=${ctx.requestId}`,
          status: "info",
        });
        return {
          ok: true,
          httpStatus: 200,
          code: "already_submitted",
          queueId: currentRx.queue_id,
        };
      }
      // Every non-success path must leave an audit trail — unlogged
      // exits were the root of the silent-fail pattern.
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_RACE_LOST",
        details:
          `Atomic claim update returned 0 rows for prescriptionId=${prescriptionId} ` +
          `(currentStatus=${currentRx?.status || "unknown"}). reqId=${ctx.requestId}`,
        status: "warning",
      });
      return {
        ok: false,
        httpStatus: 409,
        code: "race_lost",
        error: "Prescription is currently being submitted by another process",
      };
    }

    // From this point onward we OWN the submitting_to_pharmacy claim.
    // Every exit path below MUST either reach success or call exitFailure
    // with revert=true, otherwise the row will sit stuck.

    if (
      prescription.payment_status !== "paid" &&
      !ctx.isAdmin &&
      !ctx.isInternalCall
    ) {
      return exitFailure(
        "payment_not_completed",
        400,
        "Payment not completed",
        { revert: true },
      );
    }

    // ─── Resolve pharmacy backend ──────────────────────────────────
    console.log(`${reqTag} step=load-backend pharmacyId=${prescription.pharmacy_id}`);
    const { data: backend } = await supabase
      .from("pharmacy_backends")
      .select("api_key_encrypted, api_url, store_id")
      .eq("pharmacy_id", prescription.pharmacy_id)
      .eq("is_active", true)
      .eq("system_type", "DigitalRx")
      .single();

    if (!backend) {
      return exitFailure(
        "backend_missing",
        400,
        `Pharmacy backend not configured for pharmacy_id=${prescription.pharmacy_id}`,
        { revert: true },
      );
    }

    if (backend.api_url) {
      backend.api_url = backend.api_url
        .replace(/^https?\/\/:/, "https://")
        .replace(/^https?:\/\/:/, "https://")
        .replace(/^https?\/\/\/+/, "https://");
    }

    let DIGITALRX_API_KEY = backend.api_key_encrypted;
    if (isEncrypted(backend.api_key_encrypted)) {
      try {
        DIGITALRX_API_KEY = decryptApiKey(backend.api_key_encrypted);
      } catch (decryptError) {
        console.error(
          `${reqTag} decrypt failed, using raw value:`,
          decryptError instanceof Error ? decryptError.message : decryptError,
        );
        DIGITALRX_API_KEY = backend.api_key_encrypted;
      }
    }
    const DIGITALRX_BASE_URL =
      (backend.api_url && backend.api_url.trim()) || DEFAULT_DIGITALRX_BASE_URL;
    const STORE_ID = backend.store_id;

    // ─── Build payload context ─────────────────────────────────────
    const dateWritten = new Date().toISOString().split("T")[0];

    const customAddr = prescription.custom_address as
      | { street?: string; city?: string; state?: string; zipCode?: string; zip?: string }
      | null;
    const hasValidCustomAddress =
      prescription.has_custom_address &&
      customAddr &&
      customAddr.street &&
      customAddr.city &&
      customAddr.state &&
      (customAddr.zipCode || customAddr.zip);
    const patientAddress = hasValidCustomAddress
      ? customAddr
      : patient?.physical_address;

    const patientGenderRaw = (
      prescription.patients.data?.gender ||
      patient?.data?.gender ||
      ""
    )
      .toString()
      .toLowerCase();
    const patientSex =
      patientGenderRaw === "male"
        ? "M"
        : patientGenderRaw === "female"
          ? "F"
          : "U";

    // ─── Greenwich-only formatting ─────────────────────────────────
    const useGreenwichFormat = isGreenwichSubmission(
      prescription.pharmacy_id,
      backend.store_id,
    );
    let greenwichDrugName: string | null = null;
    let greenwichPatientDob: string | null = null;
    let greenwichDateWritten: string | null = null;
    let greenwichQty: string | null = null;
    let greenwichDaysSupply: 28 | 56 | 84 | 30 | 60 | 90 | null = null;
    let greenwichPatientZip: string | null = null;
    let greenwichNotes: string | null = null;

    if (useGreenwichFormat) {
      try {
        if (!pharmacyMedication?.name) {
          throw new GreenwichValidationError(
            "drugName",
            "Catalog medication name is missing (Option B requires the catalog field).",
          );
        }
        if (!pharmacyMedication?.vial_size) {
          throw new GreenwichValidationError(
            "vialSize",
            "Catalog vial_size is missing — required for Greenwich Qty/DaysSupply.",
          );
        }
        const greenwichForm = classifyDosageForm(pharmacyMedication.form as string);
        const vialCount = Number(prescription.quantity);
        greenwichDrugName = formatDrugNameWithPrefix(
          pharmacyMedication.name as string,
        );
        greenwichPatientDob = formatPatientDOB(
          prescription.patients.date_of_birth,
        );
        greenwichDateWritten = formatDateMMDDYYYY(dateWritten);
        if (greenwichForm === "injection") {
          greenwichQty = quantityInMl(
            vialCount,
            pharmacyMedication.vial_size as string,
          ).toString();
          greenwichDaysSupply = daysSupplyFromVialCount(vialCount);
        } else {
          greenwichQty = quantityForOral(
            vialCount,
            pharmacyMedication.vial_size as string,
          ).toString();
          greenwichDaysSupply = daysSupplyForOral(vialCount);
        }
        const rawZip = patientAddress?.zipCode || patientAddress?.zip;
        greenwichPatientZip = truncateZip(rawZip);
        const billToLine = formatBillToNote(GREENWICH_CLINIC_NAME);
        const existingNotes = (
          prescription.pharmacy_notes ||
          (pharmacyMedication?.notes as string) ||
          ""
        ).trim();
        greenwichNotes = existingNotes
          ? `${existingNotes}\n${billToLine}`
          : billToLine;
      } catch (err) {
        if (err instanceof GreenwichValidationError) {
          return exitFailure(
            "greenwich_validation_failed",
            422,
            `Greenwich validation: ${err.message}`,
            {
              revert: true,
              details: { field: err.field },
              action: "PRESCRIPTION_SUBMIT_VALIDATION_FAILED",
            },
          );
        }
        throw err;
      }
    }

    // ─── PDF availability wait ── close the create→mark-paid race.
    // The frontend (step3/page.tsx) calls /api/prescriptions/submit
    // FIRST, then uploads the PDF in a separate /api/prescriptions/[id]/pdf
    // request 1-2 seconds later. For pay-on-terms providers the submit
    // route auto-fires mark-paid → submit-to-pharmacy in-process, which
    // races ahead of the PDF upload. Result (May 4-7 2026): 7 of 29
    // submissions reached Greenwich with NO PDF — Wicks, Welzel, Vogt,
    // Province, Polansky/Hayley, Lee, Landow, Harr, Koch, Paesani all
    // sat in Greenwich's queue tagged "NO RX IMAGE ATTACHED" until the
    // pharmacy emailed for replacements.
    //
    // Fix (May 8 2026, Joseph "always sent and always correct" rule):
    // wait up to 20s for the upload to land. The "ship without PDF" path
    // was REMOVED — if the wait times out, we fall through to the
    // Greenwich health block (which will regenerate from row data) or to
    // the hard-gate below for non-Greenwich. NEVER ship a Greenwich
    // order without confirming a healthy PDF is in place.
    if (!prescription.pdf_storage_path) {
      const PDF_WAIT_MAX_MS = 20000;
      const PDF_WAIT_INTERVAL_MS = 500;
      const waitStart = Date.now();
      console.log(`${reqTag} step=wait-for-pdf maxMs=${PDF_WAIT_MAX_MS}`);
      let polledPath: string | null = null;
      while (Date.now() - waitStart < PDF_WAIT_MAX_MS) {
        await new Promise((r) => setTimeout(r, PDF_WAIT_INTERVAL_MS));
        const { data: row } = await supabase
          .from("prescriptions")
          .select("pdf_storage_path")
          .eq("id", prescriptionId)
          .single();
        if (row?.pdf_storage_path) {
          polledPath = row.pdf_storage_path;
          break;
        }
      }
      const waitedMs = Date.now() - waitStart;
      if (polledPath) {
        (prescription as { pdf_storage_path: string | null }).pdf_storage_path =
          polledPath;
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
          details: `step=pdf-wait-resolved waitedMs=${waitedMs} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
          status: "info",
        });
      } else {
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_SUBMIT_PDF_WAIT_TIMEOUT",
          details: `step=pdf-wait-timeout waitedMs=${waitedMs} prescriptionId=${prescriptionId} reqId=${ctx.requestId} — Greenwich will regen from row; non-Greenwich will hold for retry`,
          status: "warning",
        });
      }
    }

    // ─── PDF freshness check ── auto-regenerate pre-May-1-2026 Greenwich PDFs
    // so any prescription created before the new template shipped (and
    // stuck in pending_payment past that date) gets the current visual
    // format on its way out the door. No-op for non-Greenwich pharmacies
    // and for already-fresh PDFs. Failures fall back to the original
    // path silently — never blocks the submission.
    let effectivePdfPath: string | null = prescription.pdf_storage_path || null;
    if (effectivePdfPath) {
      try {
        const { ensureFreshGreenwichPdf } = await import(
          "@core/services/regenerate-stale-pdf"
        );
        const freshness = await ensureFreshGreenwichPdf(
          supabase,
          prescriptionId,
          effectivePdfPath,
          prescription.pharmacy_id,
        );
        if (freshness.regenerated) {
          console.log(
            `${reqTag} step=pdf-regenerated old=${effectivePdfPath} new=${freshness.storagePath}`,
          );
          await safeLog(supabase, {
            ...logIdentity,
            action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
            details: `step=pdf-regenerated reason=${freshness.reason} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
            status: "info",
          });
        }
        effectivePdfPath = freshness.storagePath;
      } catch (err) {
        console.warn(
          `${reqTag} pdf-freshness check failed (non-fatal):`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // ─── PDF HEALTH CHECK ── Trevor Haynes incident, May 7-8 2026.
    //
    // The Step 1 file picker lets providers attach ANY PDF (Trevor was
    // attaching phone-camera scans wrapped in a PDF). For Greenwich those
    // image-only wrappers (73-124KB) get rejected by the pharmacist as
    // "RX IMAGE WRONG FORMAT" and queue entries sit unfilled for days.
    //
    // The client-side fix in step3 already discards the user upload for
    // Greenwich, but this server-side gate is the LAST line of defense
    // covering refill cron, admin re-submit, orphan-heal, and any future
    // code path that reaches submit-to-pharmacy-core. If the PDF in
    // storage looks like the bug pattern, force-regenerate from scratch.
    //
    // HARD RULE (Joseph, May 8 2026 — voice-of-the-CEO):
    //   "if it is red you see it INTERNALLY and fix and send it green
    //    always ... nothing stopps the order ... lives of people we are
    //    dealing with ... order goes out but if red you see it internally
    //    and fix and send it green always."
    //
    // → Auto-heal silently. If regen fails, log loudly to system_logs
    //   (PRESCRIPTION_PDF_HEAL_FAILED) and PROCEED — never block.
    if (isGreenwichSubmission(prescription.pharmacy_id, backend.store_id)) {
      try {
        const { ensureHealthyGreenwichPdf } = await import(
          "@core/services/regenerate-stale-pdf"
        );
        const health = await ensureHealthyGreenwichPdf(
          supabase,
          prescriptionId,
          effectivePdfPath,
          prescription.pharmacy_id,
        );
        if (health.regenerated) {
          console.log(
            `${reqTag} step=pdf-healed old=${effectivePdfPath} new=${health.storagePath} reason=${health.reason}`,
          );
          await safeLog(supabase, {
            ...logIdentity,
            action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
            details: `step=pdf-healed reason=${health.reason} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
            status: "info",
          });
          effectivePdfPath = health.storagePath;
          // Mirror the new path onto the in-memory prescription so any
          // downstream consumer reading prescription.pdf_storage_path
          // (none today, but defensive) sees the healed path too.
          (prescription as { pdf_storage_path: string | null }).pdf_storage_path =
            health.storagePath;
        } else if (health.storagePath && health.storagePath !== effectivePdfPath) {
          // Healthy already → nothing to do; keep effectivePdfPath as-is.
          // (The regenerated=false / storagePath==current branch.)
        }
      } catch (err) {
        // Health check itself blew up — log loudly. We will fall through
        // to the hard-gate below which will revert + queue for retry.
        console.warn(
          `${reqTag} pdf-health check threw:`,
          err instanceof Error ? err.message : err,
        );
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_PDF_HEAL_FAILED",
          details: `prescriptionId=${prescriptionId} reason=health_check_threw err=${err instanceof Error ? err.message : err} reqId=${ctx.requestId}`,
          status: "error",
        });
      }

      // ─── Greenwich PDF HARD-GATE ── Joseph's "always sent and always
      // correct" rule (May 8 2026). After every fix attempt above, the
      // PDF must satisfy ALL THREE pillars before we ship:
      //   (1) SIZE  — file exists and is ≥ HEALTHY_PDF_MIN_BYTES
      //   (2) RACE  — pdf_storage_path is set (regen ran if upload missed)
      //   (3) CONTENT — pdf_validation_error is null (AIM prefix, name, etc.)
      // If ANY pillar still fails: revert the row to payment_received and
      // exit. The payment-janitor cron picks it up within 60s and retries
      // — so the order ALWAYS eventually goes out, but it NEVER goes out
      // wrong. That's the trade Joseph asked for: minutes of delay over
      // days of stuck-in-Greenwich-with-bad-PDF.
      const { getPdfSizeBytes, _PDF_HEALTH_MIN_BYTES, validateGreenwichPdfContent } = await import(
        "@core/services/regenerate-stale-pdf"
      );
      const { data: gateRow } = await supabase
        .from("prescriptions")
        .select("pdf_storage_path, pdf_validation_error")
        .eq("id", prescriptionId)
        .single();
      const gatePath = gateRow?.pdf_storage_path || effectivePdfPath || null;
      // Pillar 2 — RACE
      if (!gatePath) {
        return exitFailure(
          "pdf_unavailable_will_retry",
          409,
          "Greenwich PDF could not be produced (no upload, regen failed). Holding for retry.",
          { revert: true, action: "PRESCRIPTION_SUBMIT_PDF_HOLD" },
        );
      }
      // Pillar 1 — SIZE
      const gateSize = await getPdfSizeBytes(supabase, gatePath);
      if (gateSize === null || gateSize < _PDF_HEALTH_MIN_BYTES) {
        return exitFailure(
          "pdf_unhealthy_will_retry",
          409,
          `Greenwich PDF unhealthy (size=${gateSize ?? "missing"}b, min=${_PDF_HEALTH_MIN_BYTES}b). Holding for retry.`,
          { revert: true, action: "PRESCRIPTION_SUBMIT_PDF_HOLD" },
        );
      }
      // Pillar 3 — CONTENT
      // Blocker fix (May 8 2026 architect review, round 2): we ALWAYS
      // re-run the validator on every gate attempt, not just when the
      // column starts null. Reason: when a row was previously held with
      // pdf_validation_error="no_catalog_aim_prefix" and an admin later
      // linked the catalog medication, cohort G's retry must be able to
      // CLEAR the stale error column — otherwise the gate keeps failing
      // on the cached truth and the row is stuck forever.
      const priorContentError = gateRow?.pdf_validation_error ?? null;
      const contentError = await validateGreenwichPdfContent(
        supabase,
        prescriptionId,
      );
      if (contentError) {
        return exitFailure(
          "pdf_content_invalid_will_retry",
          409,
          `Greenwich PDF content invalid: ${contentError}. Holding for retry — fix underlying data (e.g. link catalog medication).`,
          { revert: true, action: "PRESCRIPTION_SUBMIT_PDF_HOLD" },
        );
      }
      // Round-3 fix (May 8 2026 architect review): if the content error
      // JUST cleared (was set, now null), the stored PDF in storage is
      // still the OLD wrong-content file — admin linked the catalog
      // medication but no one regenerated the PDF. Force a regen now so
      // the submission ships the freshly-correct PDF, not the stale one.
      // Non-blocking: if regen fails we still ship (Joseph's rule —
      // nothing stops the order; the cleared validator + size pillars
      // already prove minimum viability).
      if (priorContentError && !contentError) {
        try {
          const { ensureHealthyGreenwichPdf } = await import(
            "@core/services/regenerate-stale-pdf"
          );
          // ensureHealthyGreenwichPdf size-gates first; force a
          // regen-on-content-fix by passing null path so it falls through
          // to regenerateGreenwichPdfFromRow unconditionally.
          const regen = await ensureHealthyGreenwichPdf(
            supabase,
            prescriptionId,
            null,
            prescription.pharmacy_id,
          );
          if (regen.regenerated && regen.storagePath) {
            effectivePdfPath = regen.storagePath;
            (prescription as { pdf_storage_path: string | null }).pdf_storage_path =
              regen.storagePath;
          }
          await safeLog(supabase, {
            ...logIdentity,
            action: "PRESCRIPTION_PDF_CONTENT_HEAL",
            details: `prescriptionId=${prescriptionId} priorErr=${priorContentError} regenerated=${regen.regenerated} reason=${regen.reason} reqId=${ctx.requestId}`,
            status: regen.regenerated ? "info" : "warning",
          });
        } catch (err) {
          await safeLog(supabase, {
            ...logIdentity,
            action: "PRESCRIPTION_PDF_CONTENT_HEAL_FAILED",
            details: `prescriptionId=${prescriptionId} priorErr=${priorContentError} err=${err instanceof Error ? err.message : err} — proceeding with existing PDF, reqId=${ctx.requestId}`,
            status: "error",
          });
        }
      }
      // All three pillars green — adopt the gated path and continue.
      // Round-3 fix (architect review): if the content-heal block above
      // regenerated and updated effectivePdfPath, DO NOT overwrite it
      // with the pre-regen gatePath. Use the freshly regenerated path
      // so the DigitalRx payload ships the corrected PDF, not the stale
      // wrong-content one.
      const finalGatePath = effectivePdfPath || gatePath;
      effectivePdfPath = finalGatePath;
      (prescription as { pdf_storage_path: string | null }).pdf_storage_path =
        finalGatePath;
    } else {
      // ─── Non-Greenwich PDF HARD-GATE ── same principle: don't ship
      // without a PDF. We don't have a regen template for non-Greenwich
      // pharmacies, so the only fix is to wait for the upload. If the
      // 20s wait above didn't see it, hold and retry.
      if (!prescription.pdf_storage_path) {
        return exitFailure(
          "pdf_unavailable_will_retry",
          409,
          "PDF not yet uploaded after 20s wait. Holding for retry.",
          { revert: true, action: "PRESCRIPTION_SUBMIT_PDF_HOLD" },
        );
      }
    }

    // ─── PDF download (timeout-bounded; fallback to PDF=null on hang) ─
    let pdfBase64: string | null = null;
    if (effectivePdfPath) {
      console.log(
        `${reqTag} step=pdf-download path=${effectivePdfPath}`,
      );
      // Persist a breadcrumb to system_logs immediately before the
      // long await: if the process is SIGKILLed mid-fetch, this is
      // the last boundary the operator can see (console.log is lost
      // on serverless tear-down).
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
        details: `step=pdf-download timeoutMs=${PDF_TIMEOUT_MS} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
        status: "info",
      });
      try {
        const pdfDownloadStart = Date.now();
        const pdfResult = await withTimeout(
          "pdf-download",
          PDF_TIMEOUT_MS,
          getPrescriptionPdfBase64(supabase, effectivePdfPath),
        );
        pdfBase64 = pdfResult.base64 || null;
        // Post-return checkpoint: separates download/conversion failures from later submit failures.
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
          details: `step=pdf-download-returned hasPdf=${pdfBase64 !== null} bytes=${pdfBase64?.length ?? 0} elapsedMs=${Date.now() - pdfDownloadStart} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
          status: "info",
        });
        if (!pdfBase64) {
          console.warn(
            `${reqTag} pdf-download returned no base64:`,
            pdfResult.error,
          );
          // Clinton Wyer incident, May 14 2026 — when ensureHealthyGreenwichPdf
          // regenerates and uploads the PDF mere hundreds of ms before this
          // download fires, Supabase storage occasionally returns an empty
          // body / not-found on the first read (eventual-consistency window).
          // The file is real and healthy (1.2 MB confirmed in storage.objects)
          // but the order ships with NO PDF and stalls in Greenwich's queue.
          //
          // Joseph's directive (May 14 2026, post-Wyer): no email rescue, no
          // out-of-band channel — we are an order-forwarding app. Solve it
          // with timing. Bounded exponential backoff: up to 5 retries spaced
          // 500ms, 1s, 2s, 3s, 4s (total ~10.5s of recovery window). In
          // practice the file becomes visible inside the first 1–2 retries;
          // 5 attempts is the margin for cold-bucket / replication-lag tails.
          // Still non-blocking: if all retries fail we fall through to ship
          // without PDF (Joseph's "never block the order" rule). The order
          // ALWAYS goes out.
          const retryDelaysMs = [500, 1000, 2000, 3000, 4000];
          let lastErr: string | null | undefined = pdfResult.error;
          for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
            await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
            const retryStart = Date.now();
            const retry = await withTimeout(
              "pdf-download-retry",
              PDF_TIMEOUT_MS,
              getPrescriptionPdfBase64(supabase, effectivePdfPath),
            );
            pdfBase64 = retry.base64 || null;
            await safeLog(supabase, {
              ...logIdentity,
              action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
              details: `step=pdf-download-retry attempt=${attempt + 1}/${retryDelaysMs.length} waitedMs=${retryDelaysMs[attempt]} hasPdf=${pdfBase64 !== null} bytes=${pdfBase64?.length ?? 0} elapsedMs=${Date.now() - retryStart} prevErr=${lastErr ?? "(empty)"} retryErr=${retry.error ?? "(none)"} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
              status: pdfBase64 !== null ? "info" : "warning",
            });
            if (pdfBase64) break;
            lastErr = retry.error;
          }
        }
      } catch (err) {
        // Per user policy: PDF guard removed — submission proceeds
        // without PDF if download hangs or fails. Log so operators
        // can spot the pattern, but do NOT block the order.
        await safeLog(supabase, {
          ...logIdentity,
          action: "PRESCRIPTION_SUBMIT_PDF_TIMEOUT",
          details: `PDF download ${isTimeoutError(err) ? "timed out" : "failed"} after ${PDF_TIMEOUT_MS}ms — proceeding without PDF. reqId=${ctx.requestId} prescriptionId=${prescriptionId} err=${err instanceof Error ? err.message : err}`,
          status: "warning",
        });
        pdfBase64 = null;
      }
    }

    // ─── Build DigitalRx payload ───────────────────────────────────
    const digitalRxPayload = {
      StoreID: STORE_ID,
      VendorName: VENDOR_NAME,
      Patient: {
        FirstName: prescription.patients.first_name,
        LastName: prescription.patients.last_name,
        DOB: useGreenwichFormat
          ? greenwichPatientDob
          : formatDobForDigitalRx(prescription.patients.date_of_birth),
        Sex: patientSex,
        PatientStreet: patientAddress?.street,
        PatientCity: patientAddress?.city,
        PatientState: patientAddress?.state,
        PatientZip: useGreenwichFormat
          ? greenwichPatientZip
          : patientAddress?.zipCode || patientAddress?.zip,
        PatientPhone: formatPhoneForDigitalRx(patient?.phone),
      },
      Doctor: {
        DoctorFirstName: provider.first_name,
        DoctorLastName: provider.last_name,
        DoctorNpi: provider.npi_number,
        DoctorDea: provider.dea_number,
        DoctorStreet: provider.physical_address?.street,
        DoctorCity: provider.physical_address?.city,
        DoctorState: provider.physical_address?.state,
        DoctorZip:
          provider.physical_address?.zipCode || provider.physical_address?.zip,
        DoctorPhone: formatPhoneForDigitalRx(provider.phone_number),
      },
      RxClaim: {
        DrugName: useGreenwichFormat
          ? greenwichDrugName
          : prescription.medication
            ? prescription.medication.startsWith("AIM-")
              ? prescription.medication
              : `AIM-${prescription.medication}`
            : "",
        Qty: useGreenwichFormat ? greenwichQty : prescription.quantity.toString(),
        DateWritten: useGreenwichFormat ? greenwichDateWritten : dateWritten,
        DaysSupply: useGreenwichFormat
          ? greenwichDaysSupply !== null
            ? String(greenwichDaysSupply)
            : null
          : undefined,
        RequestedBy:
          ((provider as { prefix?: string | null }).prefix || "Dr.") +
          " " +
          provider.first_name +
          " " +
          provider.last_name,
        Refills: prescription.refills.toString(),
        DrugNDC: pharmacyMedication?.ndc as string | undefined,
        Instructions: useGreenwichFormat
          ? prescription.sig?.trim() ||
            (pharmacyMedication?.dosage_instructions as string)?.trim() ||
            null
          : prescription.sig ||
            (pharmacyMedication?.dosage_instructions as string),
        Notes: useGreenwichFormat
          ? greenwichNotes
          : prescription.pharmacy_notes || (pharmacyMedication?.notes as string),
        Daw: prescription.dispense_as_written ? "Y" : "N",
      },
      DocSignature: provider.signature_url,
      PDFFile: pdfBase64,
    };

    // ─── Validate critical payload fields ──────────────────────────
    const criticalErrors: string[] = [];
    if (!digitalRxPayload.StoreID)
      criticalErrors.push("StoreID missing — pharmacy backend not configured");
    if (!digitalRxPayload.Patient.FirstName)
      criticalErrors.push("Patient FirstName missing");
    if (!digitalRxPayload.Patient.LastName)
      criticalErrors.push("Patient LastName missing");
    if (!digitalRxPayload.RxClaim.DrugName)
      criticalErrors.push("DrugName missing");

    if (criticalErrors.length > 0) {
      return exitFailure(
        "missing_critical_fields",
        400,
        `Missing critical fields: ${criticalErrors.join(", ")}`,
        {
          revert: true,
          details: criticalErrors,
          action: "PRESCRIPTION_SUBMIT_VALIDATION_FAILED",
        },
      );
    }

    // ─── Submit to DigitalRx (timeout-bounded) ─────────────────────
    console.log(
      `${reqTag} step=digitalrx-submit url=${DIGITALRX_BASE_URL}/RxWebRequest hasPdf=${!!pdfBase64}`,
    );
    // Durable breadcrumb at the critical boundary — DigitalRx fetch
    // was the await that hung in the original incident. If a SIGKILL
    // fires while parked here, this is the row the operator needs.
    await safeLog(supabase, {
      ...logIdentity,
      action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
      details:
        `step=digitalrx-submit timeoutMs=${DIGITALRX_FETCH_TIMEOUT_MS} ` +
        `hasPdf=${!!pdfBase64} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
      status: "info",
    });
    let digitalRxResponse: Response;
    try {
      digitalRxResponse = await fetchWithTimeout(
        `${DIGITALRX_BASE_URL}/RxWebRequest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: DIGITALRX_API_KEY,
          },
          body: JSON.stringify(digitalRxPayload),
        },
        DIGITALRX_FETCH_TIMEOUT_MS,
        "digitalrx-submit",
      );
    } catch (err) {
      const code: SubmitResult["code"] = isTimeoutError(err)
        ? "timeout"
        : "unknown_error";
      return exitFailure(
        code,
        504,
        `DigitalRx submit ${isTimeoutError(err) ? "timed out" : "errored"} after ${DIGITALRX_FETCH_TIMEOUT_MS}ms: ${err instanceof Error ? err.message : err}`,
        {
          revert: true,
          action: isTimeoutError(err)
            ? "PRESCRIPTION_SUBMIT_TIMEOUT"
            : "PRESCRIPTION_SUBMIT_FAILED",
        },
      );
    }

    if (!digitalRxResponse.ok) {
      let errorText = "Unknown error";
      try {
        errorText = await withTimeout(
          "digitalrx-error-body",
          DIGITALRX_PARSE_TIMEOUT_MS,
          digitalRxResponse.text(),
        );
      } catch {
        // keep default
      }
      let detailMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        detailMessage =
          parsed.Message || parsed.message || parsed.error || errorText;
      } catch {
        // keep raw text
      }
      return exitFailure(
        "digitalrx_rejected",
        digitalRxResponse.status,
        `DigitalRx rejected: ${detailMessage}`,
        {
          revert: true,
          details: errorText,
        },
      );
    }

    // ─── Parse response (timeout-bounded) ──────────────────────────
    console.log(`${reqTag} step=digitalrx-parse-response`);
    // Third long-await boundary — parsing a large response can
    // also hang under memory pressure.
    await safeLog(supabase, {
      ...logIdentity,
      action: "PRESCRIPTION_SUBMIT_CHECKPOINT",
      details:
        `step=digitalrx-parse timeoutMs=${DIGITALRX_PARSE_TIMEOUT_MS} ` +
        `responseStatus=${digitalRxResponse.status} prescriptionId=${prescriptionId} reqId=${ctx.requestId}`,
      status: "info",
    });
    let digitalRxData: Record<string, unknown>;
    try {
      digitalRxData = await withTimeout(
        "digitalrx-parse",
        DIGITALRX_PARSE_TIMEOUT_MS,
        digitalRxResponse.json() as Promise<Record<string, unknown>>,
      );
    } catch (err) {
      return exitFailure(
        "timeout",
        504,
        `DigitalRx response.json() ${isTimeoutError(err) ? "timed out" : "errored"} after ${DIGITALRX_PARSE_TIMEOUT_MS}ms: ${err instanceof Error ? err.message : err}`,
        {
          revert: true,
          action: "PRESCRIPTION_SUBMIT_TIMEOUT",
        },
      );
    }

    const queueId =
      (digitalRxData.QueueID as string | undefined) ||
      (digitalRxData.queueId as string | undefined) ||
      (digitalRxData.ID as string | undefined);

    if (!queueId) {
      return exitFailure(
        "digitalrx_no_queue_id",
        500,
        "DigitalRx did not return a QueueID",
        { revert: true, details: digitalRxData },
      );
    }

    // ─── Apply success update with status precondition guard ───────
    // Preserves the Greenwich/Rahmany recovery behavior: if the row
    // status changed underneath us mid-call (e.g., operator reset to
    // payment_received), do NOT overwrite — log the queue_id for manual
    // reconciliation and return 409.
    console.log(`${reqTag} step=apply-success queueId=${queueId}`);
    const submittedAt = new Date().toISOString();
    const nextRefillDate =
      prescription.refill_frequency_days && prescription.refills > 0
        ? new Date(
            Date.now() + prescription.refill_frequency_days * 86400000,
          ).toISOString()
        : null;

    // pdf_push_confirmed_at — May 8 2026 (Greenwich race-victim bug class).
    // Set ONLY when DigitalRx returned a QueueID AND the request body
    // contained a non-null PDFFile. Leaving this NULL on a submitted+ row
    // is the single signal the admin badge uses to flag race victims (PDF
    // ≥200KB on our side but never reached Greenwich because the submit
    // fired before the upload completed). Do NOT set this if pdfBase64
    // was null — that's the whole point of the column.
    const { data: updatedRows, error: updateError } = await supabase
      .from("prescriptions")
      .update({
        queue_id: queueId,
        status: "submitted",
        order_progress: "pharmacy_processing",
        submitted_to_pharmacy_at: submittedAt,
        ...(pdfBase64 ? { pdf_push_confirmed_at: submittedAt } : {}),
        ...(nextRefillDate ? { next_refill_date: nextRefillDate } : {}),
      })
      .eq("id", prescriptionId)
      .eq("status", "submitting_to_pharmacy")
      .select("id");

    if (updateError) {
      // We GOT a queue_id from Greenwich but couldn't write it to our
      // DB — log for manual reconciliation. Don't revert (the prescription
      // IS in the pharmacy queue; the row just doesn't reflect it yet).
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_DB_WRITE_FAILED",
        details: `Greenwich queue_id=${queueId} issued for ${prescriptionId} but local DB update failed: ${updateError.message}. RECONCILE MANUALLY. reqId=${ctx.requestId}`,
        queue_id: queueId,
        status: "error",
      });
      return {
        ok: false,
        httpStatus: 500,
        code: "unknown_error",
        error: "Failed to update prescription after Greenwich accepted it",
        queueId,
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Status changed under us — preserve the Rahmany/Greenwich
      // recovery semantic. Log the queue_id for manual reconciliation.
      await safeLog(supabase, {
        ...logIdentity,
        action: "PRESCRIPTION_SUBMIT_RACE_LOST",
        details: `Greenwich issued queue_id=${queueId} for ${prescriptionId} but local status had changed away from submitting_to_pharmacy. Reconcile manually. reqId=${ctx.requestId}`,
        queue_id: queueId,
        status: "warning",
      });
      return {
        ok: false,
        httpStatus: 409,
        code: "race_lost",
        error:
          "Status changed during submission; queue_id issued but not applied. Reconcile manually.",
        queueId,
      };
    }

    // ─── Success ───────────────────────────────────────────────────
    await safeLog(supabase, {
      user_id: prescription.prescriber_id,
      user_email: provider.email || "unknown@example.com",
      user_name: `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}`,
      action: "PRESCRIPTION_SUBMITTED_AFTER_PAYMENT",
      details: `DigitalRx: ${prescription.medication} for ${prescription.patients.first_name} ${prescription.patients.last_name} | reqId=${ctx.requestId}`,
      queue_id: queueId,
      status: "success",
    });

    return {
      ok: true,
      httpStatus: 200,
      code: "submitted",
      queueId,
    };
  } catch (error) {
    // Outer safety net — ANY uncaught throw lands here. Revert the
    // claim if we hold one (best-effort) and log so the silent-fail
    // pattern can never recur.
    console.error(
      `${reqTag} OUTER CATCH — uncaught error:`,
      error instanceof Error ? error.stack : error,
    );
    return exitFailure(
      isTimeoutError(error) ? "timeout" : "unknown_error",
      500,
      `Unexpected error: ${error instanceof Error ? error.message : "unknown"}`,
      {
        revert: true,
        action: isTimeoutError(error)
          ? "PRESCRIPTION_SUBMIT_TIMEOUT"
          : "PRESCRIPTION_SUBMIT_FAILED",
      },
    );
  }
}
