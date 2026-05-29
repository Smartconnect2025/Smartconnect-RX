-- ============================================================================
-- Trusted Devices: prevent duplicate active rows per (user, fingerprint)
-- Task #49 — stop double-clicks on /api/auth/mfa/complete from inserting
-- multiple active trusted_devices rows for the same browser.
-- ============================================================================
-- Architect flagged MEDIUM in Phase 2 of Task #48: the endpoint is not
-- idempotent. Two near-simultaneous POSTs (double-click, network retry,
-- offline replay) hash to the same device_fingerprint_hash and would each
-- insert a row. The unique partial index lets the second insert fail with
-- 23505, which the application code converts into an in-place refresh of
-- expires_at + last_used_at + token_hash on the surviving row.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_user_fp_active_uniq
  ON public.trusted_devices (user_id, device_fingerprint_hash)
  WHERE revoked_at IS NULL;
