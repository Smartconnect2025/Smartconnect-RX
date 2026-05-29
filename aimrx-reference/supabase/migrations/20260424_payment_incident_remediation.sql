-- Payment incident remediation (Apr 22-23, 2026)
-- Adds five nullable columns to payment_transactions to support:
--   * charge_attempt_started_at: timestamp set by charge-nonce just before
--     the Authorize.Net call. Read by get-hosted-token and release-processing
--     to refuse a re-lease/release while a charge is in-flight (60s window).
--     Closes the residual double-charge window where compare-and-swap alone
--     is not enough.
--   * verify_required_at: timestamp set by charge-nonce when the gateway
--     call times out / 502s. Picked up by the payment-janitor cron to drive
--     a verify-and-complete attempt.
--   * last_gateway_error_code / last_gateway_error_at: forensic breadcrumbs
--     for the most recent gateway failure on this row.
--   * reconciliation_note: short audit string set by the reconciliation
--     runbook and the soft-mark-expired path in check-link, so that no
--     forensic evidence is destroyed during incident response.
--
-- All columns are nullable. No existing column is modified. No data loss.

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS charge_attempt_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_gateway_error_code text,
  ADD COLUMN IF NOT EXISTS last_gateway_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_note text;
