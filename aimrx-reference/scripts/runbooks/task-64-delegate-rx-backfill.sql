-- =====================================================================
-- Task #64 — Delegate-submitted Greenwich Rx stuck-row backfill
-- (May 9 2026, Manning incident)
-- =====================================================================
--
-- BACKGROUND
--   Before the resolver fix, every Greenwich PDF regen for a delegate-
--   submitted prescription rendered the assistant's empty providers row
--   (NPI/DEA/signature_url all NULL), produced a sub-200KB stub PDF,
--   failed the hard-gate, and looped forever in payment-janitor cohort
--   G with status='payment_received' / payment_status='paid'.
--
--   This runbook (a) finds every such row that is currently stuck and
--   (b) safely unblocks each one by clearing the bad PDF + the stale
--   PDF-health stamps so the next janitor tick (≤60 s with the cohort
--   G interval) regens with the now-correct authorizing provider's
--   credentials and ships clean.
--
-- HARD RULES (do NOT deviate)
--   1. NEVER touch payment_transactions. The patient already paid;
--      double-charging or refunding is forbidden.
--   2. NEVER touch submitted_by_delegation_id. It is the only durable
--      audit trail of who actually submitted the Rx.
--   3. NEVER touch prescriber_id. Same reason.
--   4. Only ever clear the PDF tracking columns (pdf_storage_path,
--      pdf_validation_error, pdf_push_confirmed_at) — these are
--      regenerated automatically.
--   5. If the SCAN returns zero rows, do NOT run the unblock. The fix
--      itself prevents new stuck rows; the backfill only matters for
--      rows that pre-existed the deploy.
--
-- ---------------------------------------------------------------------
-- STEP 1 — SCAN: find delegate-submitted rows currently stuck
-- ---------------------------------------------------------------------
--
-- A row is "stuck on the Manning bug" iff ALL of:
--   * status IN ('payment_received', 'rejected')
--                                  - cohort G entry condition (payment_received)
--                                  - 'rejected' covers rows where Greenwich already
--                                    rejected the stub PDF before the resolver fix
--                                    landed; those still need re-submission with a
--                                    PDF rendered against the authorizing provider.
--   * payment_status = 'paid'      (patient already charged)
--   * submitted_by_delegation_id IS NOT NULL  (delegate-submitted)
--   * pharmacy is Greenwich        (only Greenwich enforces 200KB gate)
--   * AND any of:
--       - pdf_storage_path IS NULL (so no janitor regen has succeeded)
--       - pdf_validation_error IS NOT NULL (validator already rejected)
--       - the stored object in `patient-files` bucket is < 200_000 bytes
--         (the Manning-bug stub PDF is the literal failure signature; we read
--         the size directly from storage.objects.metadata->>'size')
--
-- The pharmacy filter uses the pharmacies table — adjust if the
-- Greenwich provider name changes.
--
WITH greenwich_delegate_paid AS (
  SELECT
    rx.id,
    rx.created_at,
    rx.updated_at,
    rx.status,
    rx.medication,
    rx.prescriber_id,
    rx.submitted_by_delegation_id,
    rx.pdf_storage_path,
    rx.pdf_validation_error,
    rx.patient_id,
    d.provider_id           AS authorizing_provider_id,
    ap.user_id              AS authorizing_provider_user_id,
    ap.first_name           AS ap_first_name,
    ap.last_name            AS ap_last_name,
    ap.npi_number           AS ap_npi,
    ap.signature_url        AS ap_sig,
    ap.dea_number           AS ap_dea
  FROM prescriptions rx
  JOIN delegations d ON d.id = rx.submitted_by_delegation_id
  LEFT JOIN providers ap ON ap.id = d.provider_id
  LEFT JOIN pharmacies ph ON ph.id = rx.pharmacy_id
  WHERE rx.status IN ('payment_received', 'rejected')
    AND rx.payment_status = 'paid'
    AND rx.submitted_by_delegation_id IS NOT NULL
    AND ph.name ILIKE '%greenwich%'
),
sized AS (
  SELECT
    g.*,
    NULLIF(so.metadata->>'size','')::bigint AS pdf_byte_size
  FROM greenwich_delegate_paid g
  LEFT JOIN storage.objects so
    ON so.bucket_id = 'patient-files'
   AND so.name      = g.pdf_storage_path
)
SELECT
  s.id                                AS prescription_id,
  s.created_at,
  s.updated_at,
  s.status,
  s.medication,
  s.prescriber_id                     AS assistant_user_id,
  s.submitted_by_delegation_id,
  s.authorizing_provider_id,
  s.authorizing_provider_user_id,
  s.ap_first_name || ' ' || s.ap_last_name AS authorizing_provider_name,
  CASE
    WHEN s.ap_npi IS NULL OR btrim(s.ap_npi) = '' THEN 'MISSING_NPI'
    WHEN s.ap_sig IS NULL OR btrim(s.ap_sig) = '' THEN 'MISSING_SIG'
    WHEN s.ap_dea IS NULL OR btrim(s.ap_dea) = '' THEN 'MISSING_DEA_OK_FOR_PEPTIDES'
    ELSE 'CREDENTIALS_OK'
  END                                  AS authorizing_provider_status,
  s.pdf_storage_path,
  s.pdf_byte_size,
  s.pdf_validation_error,
  pat.first_name || ' ' || pat.last_name AS patient_name,
  CASE
    WHEN s.pdf_storage_path IS NULL              THEN 'no_pdf'
    WHEN s.pdf_validation_error IS NOT NULL      THEN 'validator_rejected'
    WHEN s.pdf_byte_size IS NULL                 THEN 'storage_object_missing'
    WHEN s.pdf_byte_size < 200000                THEN 'stub_pdf_under_200kb'
    ELSE 'unknown_other'
  END                                  AS stuck_reason
FROM sized s
LEFT JOIN patients pat ON pat.id = s.patient_id
WHERE s.pdf_storage_path IS NULL
   OR s.pdf_validation_error IS NOT NULL
   OR s.pdf_byte_size IS NULL
   OR s.pdf_byte_size < 200000
ORDER BY s.created_at ASC;

-- ---------------------------------------------------------------------
-- STEP 2 — DECISION POINT (per row)
-- ---------------------------------------------------------------------
--
-- For each row returned above:
--   * If authorizing_provider_status = 'CREDENTIALS_OK' or
--     'MISSING_DEA_OK_FOR_PEPTIDES' → safe to unblock (Step 3).
--   * If authorizing_provider_status = 'MISSING_NPI' or 'MISSING_SIG'
--     → DO NOT unblock yet. Have the authorizing provider complete
--     their profile first, then re-run from Step 1.
--   * Anything else → escalate; do not improvise.
--
-- ---------------------------------------------------------------------
-- STEP 3 — UNBLOCK (one row at a time, by ID)
-- ---------------------------------------------------------------------
--
-- Replace <PRESCRIPTION_ID> with the prescription_id from Step 1.
-- Run as a single statement so the WHERE precondition is checked
-- atomically with the update. The updated_at backdate is a 2-minute
-- offset so cohort G's COHORT_G_HOLD_MS = 60s gate picks the row up
-- on the very next janitor tick (no waiting through the hold window).
--
-- DO NOT batch-update with a WHERE-only filter. One-at-a-time keeps
-- the audit trail readable and prevents accidental sweep of unrelated
-- rows that happen to match the broad cohort filter.
--
-- Two unblock variants — pick the one that matches Step 1's reported
-- `status` for the row.
--
-- ── Variant A: status = 'payment_received' (cohort G picks up) ──────
/*
UPDATE prescriptions
SET
  pdf_storage_path        = NULL,
  pdf_validation_error    = NULL,
  pdf_push_confirmed_at   = NULL,
  updated_at              = now() - interval '2 minutes'
WHERE id = '<PRESCRIPTION_ID>'
  AND status = 'payment_received'
  AND payment_status = 'paid'
  AND submitted_by_delegation_id IS NOT NULL
RETURNING id, status, payment_status, updated_at;
*/
--
-- ── Variant B: status = 'rejected' (Greenwich already kicked it back) ──
-- Demote back to 'payment_received' so cohort G re-runs the resolver
-- against the now-correct authorizing provider, regens a healthy PDF,
-- and resubmits. The patient already paid; we are NOT re-charging.
-- Mirrors the manual flow ops uses via /api/prescriptions/[id]/resend-rejected
-- but in raw SQL for runbook reproducibility.
-- Note: prescriptions has NO `rejection_reason` or `rejected_at` column
-- as of May 2026 — rejection metadata lives on the related queue
-- record at the pharmacy side. Status flip + PDF tracking reset is
-- sufficient; the next janitor tick will re-run the resolver, regen,
-- and re-submit.
/*
UPDATE prescriptions
SET
  status                  = 'payment_received',
  pdf_storage_path        = NULL,
  pdf_validation_error    = NULL,
  pdf_push_confirmed_at   = NULL,
  queue_id                = NULL,
  submitted_to_pharmacy_at = NULL,
  updated_at              = now() - interval '2 minutes'
WHERE id = '<PRESCRIPTION_ID>'
  AND status = 'rejected'
  AND payment_status = 'paid'
  AND submitted_by_delegation_id IS NOT NULL
RETURNING id, status, payment_status, updated_at;
*/

-- ---------------------------------------------------------------------
-- STEP 4 — VERIFY
-- ---------------------------------------------------------------------
--
-- Within ~60 s the payment-janitor cohort G should pick the row up,
-- regen the PDF against the authorizing provider's credentials, pass
-- the 200KB hard-gate, submit to Greenwich, and flip the row to
-- status='submitted' with a queue_id.
--
-- Verify with:
--
SELECT id, status, payment_status, queue_id, pdf_storage_path,
       pdf_push_confirmed_at, updated_at
FROM prescriptions
WHERE id = '<PRESCRIPTION_ID>';

-- And confirm the system_logs trail shows the new resolver firing:
--
SELECT created_at, action, details
FROM system_logs
WHERE created_at > now() - interval '15 minutes'
  AND (
        action IN (
          'PRESCRIPTION_PDF_DELEGATE_RESOLVED',
          'PRESCRIPTION_SUBMITTED_AFTER_PAYMENT'
        )
     OR details ILIKE '%<PRESCRIPTION_ID>%'
  )
ORDER BY created_at DESC;

-- =====================================================================
-- KNOWN SINGLE-CASE EXECUTION (May 9 2026)
--   prescription_id 7967ee2b-0d8d-4c1d-a5c3-045777cf907e (William
--   Manning, $96, Whipps as authorizer) was unblocked manually as part
--   of the Task #64 deploy. After the resolver fix, no new rows should
--   land in this state. If Step 1 returns rows on a subsequent run,
--   investigate before unblocking — there may be a regression.
-- =====================================================================
