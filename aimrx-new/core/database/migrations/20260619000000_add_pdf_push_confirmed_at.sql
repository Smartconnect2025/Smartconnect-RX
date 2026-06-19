-- Proof-of-send timestamp for the Rx PDF.
--
-- Set ONLY when the Rx PDF (base64) was actually attached to the pharmacy API
-- request (DigitalRx PDFFile / PioneerRx ScriptImage) in submit-to-pharmacy.
-- NULL means the order was sent without an attached document. Used for
-- support/auditing. Written best-effort and non-fatally, so it is nullable and
-- existing rows (and any legitimately PDF-less send) remain valid.
--
-- Idempotent (IF NOT EXISTS) so it is safe to re-run.
--
-- PRODUCTION: this is NOT auto-applied at deploy. Apply it to the live database
-- the same way the other dated migrations in this folder are applied, e.g.:
--   psql "$SUPABASE_DATABASE_URL" -f core/database/migrations/20260619000000_add_pdf_push_confirmed_at.sql

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pdf_push_confirmed_at timestamptz;
