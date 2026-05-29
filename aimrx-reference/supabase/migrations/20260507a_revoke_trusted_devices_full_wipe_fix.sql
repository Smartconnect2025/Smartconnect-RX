-- ============================================================================
-- Trusted Devices — Step 2 fix: revoke ALL rows on password change, not just
-- still-active ones. Plan said "wipe ALL trusted devices for that user."
-- The original 20260507_revoke_trusted_devices_on_password_change.sql skipped
-- rows where expires_at <= now(), leaving stale orphaned rows behind.
--
-- This migration replaces the function body with one that drops the
-- expires_at filter. The revoked_at IS NULL guard is kept so the trigger
-- stays idempotent and never re-stamps already-revoked rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.revoke_trusted_devices_on_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.trusted_devices
     SET revoked_at    = now(),
         revoke_reason = 'password_changed',
         revoked_by    = NULL
   WHERE user_id    = NEW.id
     AND revoked_at IS NULL;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.revoke_trusted_devices_on_password_change() OWNER TO postgres;
