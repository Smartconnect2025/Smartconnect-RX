-- ============================================================================
-- Trusted Devices table — Step 1 of 14 ("Remember This Device" feature)
-- ============================================================================
-- Stores per-browser trust records that allow skipping 2FA for up to 90 days.
-- HARD RULES:
--   * token_hash stores SHA-256(token + server pepper) hex digest only.
--     The plaintext token is NEVER stored or logged.
--   * Default-deny: empty rows or any check failure means 2FA is required.
--   * RLS pattern mirrors mfa_codes / mfa_verification_attempts exactly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash               text NOT NULL UNIQUE,
  device_fingerprint_hash  text NOT NULL,
  user_agent               text,
  ip_first_seen            text,
  ip_last_seen             text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  last_used_at             timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  revoked_at               timestamptz,
  revoked_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason            text
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_token_hash_uniq
  ON public.trusted_devices (token_hash);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user
  ON public.trusted_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires_at
  ON public.trusted_devices (expires_at);

-- Hot lookup path: active (non-revoked, non-expired) devices for a user
CREATE INDEX IF NOT EXISTS idx_trusted_devices_active
  ON public.trusted_devices (user_id)
  WHERE revoked_at IS NULL;

-- Row-Level Security
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_admin" ON public.trusted_devices;
CREATE POLICY "select_own_or_admin" ON public.trusted_devices
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "insert_own_or_admin" ON public.trusted_devices;
CREATE POLICY "insert_own_or_admin" ON public.trusted_devices
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "update_own_or_admin" ON public.trusted_devices;
CREATE POLICY "update_own_or_admin" ON public.trusted_devices
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "delete_own_or_admin" ON public.trusted_devices;
CREATE POLICY "delete_own_or_admin" ON public.trusted_devices
  FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR is_admin(auth.uid()));
