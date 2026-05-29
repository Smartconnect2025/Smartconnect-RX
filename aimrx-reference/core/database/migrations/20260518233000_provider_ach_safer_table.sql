-- Safer rewrite of 20260518230000_provider_ach_fields.sql
-- ARCHITECT REVIEW finding (May 18 2026): existing RLS on providers allows active
-- delegates (e.g. medical assistants) to SELECT every column of their supervisor's
-- row — which would expose bank info if ACH columns lived on providers.
-- Fix: move ACH + FMV consent into a dedicated table with strict RLS:
--   - SELECT: provider themselves + admins only (NO delegates)
--   - INSERT/UPDATE: provider themselves + admins only
--   - DELETE: admins only
-- Bank/routing numbers stored encrypted via core/security/encryption.ts (AES-256-GCM, iv:authTag:cipher hex).
-- Idempotent — safe to re-run.

-- 1. New dedicated table
CREATE TABLE IF NOT EXISTS provider_ach_info (
  provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_holder TEXT,
  routing_encrypted TEXT,
  account_encrypted TEXT,
  account_last4 TEXT,
  account_type TEXT,
  fmv_disclosure_accepted_at TIMESTAMPTZ,
  fmv_disclosure_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_ach_info_account_type_check
    CHECK (account_type IS NULL OR account_type IN ('checking', 'savings')),
  CONSTRAINT provider_ach_info_account_last4_check
    CHECK (account_last4 IS NULL OR account_last4 ~ '^[0-9]{4}$')
);

COMMENT ON TABLE provider_ach_info IS 'Sensitive bank/ACH info for providers. Separate from providers table because providers.* is readable by active delegates. This table is locked to owner + admin only.';
COMMENT ON COLUMN provider_ach_info.routing_encrypted IS 'AES-256-GCM encrypted routing number (iv:authTag:cipher hex). NEVER log raw value.';
COMMENT ON COLUMN provider_ach_info.account_encrypted IS 'AES-256-GCM encrypted account number (iv:authTag:cipher hex). NEVER log raw value.';
COMMENT ON COLUMN provider_ach_info.account_last4 IS 'Last 4 digits for masked UI display only.';

-- 2. Enable RLS + policies (owner + admin only)
ALTER TABLE provider_ach_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_ach_select_own_or_admin ON provider_ach_info;
CREATE POLICY provider_ach_select_own_or_admin ON provider_ach_info
  FOR SELECT
  USING (
    is_admin(auth.uid())
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS provider_ach_insert_own_or_admin ON provider_ach_info;
CREATE POLICY provider_ach_insert_own_or_admin ON provider_ach_info
  FOR INSERT
  WITH CHECK (
    is_admin(auth.uid())
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS provider_ach_update_own_or_admin ON provider_ach_info;
CREATE POLICY provider_ach_update_own_or_admin ON provider_ach_info
  FOR UPDATE
  USING (
    is_admin(auth.uid())
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS provider_ach_delete_admin ON provider_ach_info;
CREATE POLICY provider_ach_delete_admin ON provider_ach_info
  FOR DELETE
  USING (is_admin(auth.uid()));

-- 3. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_provider_ach_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provider_ach_info_updated_at_trigger ON provider_ach_info;
CREATE TRIGGER provider_ach_info_updated_at_trigger
  BEFORE UPDATE ON provider_ach_info
  FOR EACH ROW
  EXECUTE FUNCTION set_provider_ach_info_updated_at();

-- 4. Drop the columns we mistakenly added to providers (no data yet — only added in dev minutes ago)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'providers_ach_account_type_check') THEN
    ALTER TABLE providers DROP CONSTRAINT providers_ach_account_type_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'providers_ach_account_last4_check') THEN
    ALTER TABLE providers DROP CONSTRAINT providers_ach_account_last4_check;
  END IF;
END $$;

ALTER TABLE providers
  DROP COLUMN IF EXISTS ach_bank_name,
  DROP COLUMN IF EXISTS ach_account_holder,
  DROP COLUMN IF EXISTS ach_routing_encrypted,
  DROP COLUMN IF EXISTS ach_account_encrypted,
  DROP COLUMN IF EXISTS ach_account_last4,
  DROP COLUMN IF EXISTS ach_account_type,
  DROP COLUMN IF EXISTS ach_updated_at,
  DROP COLUMN IF EXISTS fmv_disclosure_accepted_at,
  DROP COLUMN IF EXISTS fmv_disclosure_version;
