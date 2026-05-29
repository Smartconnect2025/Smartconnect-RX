-- 20260508120000_pdf_health_tracking.sql
-- May 8 2026 — Joseph clarified: badge must turn red whenever ANY of the
-- three healing layers fails to deliver a correct Electronic Rx to
-- Greenwich. Size alone (HEALTHY_PDF_MIN_BYTES=200_000) only catches
-- bug class #1 (image-only JPEG-in-PDF wrappers). It misses:
--   #2 race victims — PDF is ≥200KB in our storage but Greenwich
--       never received a copy because submit-to-pharmacy fired before
--       the upload completed (Wicks, Welzel, Vogt, Province, Polansky,
--       Lee, Landow, Harr, Koch, Paesani — all May 4-7 2026).
--   #3 wrong content but right size — e.g. drug name missing the "AIM "
--       prefix (Keith Robinson). PDF is 2.83 MB, looks healthy, but
--       Greenwich rejects it.
--
-- Two new columns let the badge see all three:
--
--   pdf_push_confirmed_at — written by submit-to-pharmacy-core ONLY
--     when DigitalRx returned a QueueID AND the request body contained
--     a non-null PDFFile. NULL on a submitted+ row means the PDF never
--     reached Greenwich (catches bug #2).
--
--   pdf_validation_error — written by the regen path in
--     regenerate-stale-pdf.ts when the inputs going into the Electronic
--     Rx PDF fail Greenwich requirements (catalog drug name missing
--     so no AIM prefix, NPI missing, patient name missing, etc.).
--     Cleared on a successful re-regen (catches bug #3).
--
-- Both columns are pure metadata — no FK, no defaults, no RLS change.
-- Adding them is non-destructive: existing rows get NULL for both and
-- the badge logic treats NULL pdf_validation_error as "no error" and
-- NULL pdf_push_confirmed_at as "still pending" only after the row
-- transitions to a submitted+ status.

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS pdf_push_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_validation_error  text;

COMMENT ON COLUMN prescriptions.pdf_push_confirmed_at IS
  'Set by submit-to-pharmacy-core when DigitalRx returned a QueueID AND PDFFile in the request body was non-null. NULL on a submitted+ row indicates the PDF never reached the pharmacy (race-condition victim). Used by the admin Incoming Queue badge.';

COMMENT ON COLUMN prescriptions.pdf_validation_error IS
  'Set by the regen path in core/services/regenerate-stale-pdf.ts when inputs into the Electronic Rx PDF fail Greenwich requirements (e.g. no catalog medication so the AIM prefix is missing). Cleared on next successful regen. Used by the admin Incoming Queue badge.';

-- Backfill: every Greenwich row currently at submitted+ status gets
-- pdf_push_confirmed_at = submitted_to_pharmacy_at (fallback chain
-- to submitted_at then updated_at then now()) so the new admin badge
-- shows green by default for historical orders. Without this backfill
-- every pre-May-8 row would surface as a "race victim" red badge,
-- which is operationally noisy — only NEW submissions going forward
-- need the strict pdf_push_confirmed_at-or-red rule. The 10 known
-- historical race victims (Wicks/Welzel/Vogt/Province/Polansky/Lee/
-- Landow/Harr/Koch/Paesani) are tracked separately for resend.
-- Idempotent: only writes rows whose column is still NULL.
UPDATE prescriptions
SET pdf_push_confirmed_at = COALESCE(submitted_to_pharmacy_at, submitted_at, updated_at, now())
WHERE pharmacy_id = '59623278-013e-407f-96af-b164144bdbc7'
  AND status NOT IN ('pending_payment','payment_received','submitting_to_pharmacy','cancelled','rejected')
  AND pdf_push_confirmed_at IS NULL;
