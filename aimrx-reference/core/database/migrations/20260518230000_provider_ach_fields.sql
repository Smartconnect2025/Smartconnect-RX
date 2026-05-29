-- Doug Rainey requirement (May 13 2026 email):
-- Add ACH/bank info collection to providers table + FMV disclosure consent.
-- Bank/routing numbers stored encrypted using existing AES-256-GCM helper (core/security/encryption.ts).
-- Idempotent — safe to re-run.

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS ach_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS ach_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS ach_routing_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ach_account_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ach_account_last4 TEXT,
  ADD COLUMN IF NOT EXISTS ach_account_type TEXT,
  ADD COLUMN IF NOT EXISTS ach_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fmv_disclosure_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fmv_disclosure_version TEXT;

-- Enforce checking/savings only on new writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'providers_ach_account_type_check'
  ) THEN
    ALTER TABLE providers
      ADD CONSTRAINT providers_ach_account_type_check
      CHECK (ach_account_type IS NULL OR ach_account_type IN ('checking', 'savings'));
  END IF;
END $$;

-- Enforce last4 is exactly 4 digits when present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'providers_ach_account_last4_check'
  ) THEN
    ALTER TABLE providers
      ADD CONSTRAINT providers_ach_account_last4_check
      CHECK (ach_account_last4 IS NULL OR ach_account_last4 ~ '^[0-9]{4}$');
  END IF;
END $$;

COMMENT ON COLUMN providers.ach_routing_encrypted IS 'AES-256-GCM encrypted routing number. NEVER log raw value. Decrypt only inside payout/admin flows.';
COMMENT ON COLUMN providers.ach_account_encrypted IS 'AES-256-GCM encrypted account number. NEVER log raw value. Decrypt only inside payout/admin flows.';
COMMENT ON COLUMN providers.ach_account_last4 IS 'Last 4 digits of account number, for masked UI display only.';
COMMENT ON COLUMN providers.fmv_disclosure_accepted_at IS 'Timestamp when provider acknowledged the AIMRx FMV disclosure at registration.';
COMMENT ON COLUMN providers.fmv_disclosure_version IS 'Version string of the disclosure text the provider accepted (for audit trail when wording changes).';
