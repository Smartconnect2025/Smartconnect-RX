-- ============================================================================
-- Trusted Devices — Step 2 of 14: revoke-on-password-change trigger
-- ============================================================================
-- When a user's password changes (self-service reset, admin reset, Supabase
-- dashboard, recovery flow, future SSO migration — anything that touches
-- auth.users.encrypted_password), every still-active trusted_devices row for
-- that user is revoked atomically in the same transaction.
--
-- This replaces what would otherwise be 5–6 scattered "remember to also wipe
-- trusted devices" calls in application code.
--
-- HARD RULES:
--   * SECURITY DEFINER + fixed search_path so the function can write to
--     public.trusted_devices regardless of the role performing the password
--     UPDATE (typically supabase_auth_admin or the user's own JWT).
--   * AFTER UPDATE OF encrypted_password + WHEN (OLD.encrypted_password IS
--     DISTINCT FROM NEW.encrypted_password) so unrelated auth.users updates
--     (email change, metadata, last_sign_in_at) do not fire the trigger and
--     no-op password writes are short-circuited.
--   * revoked_by stays NULL — system action, not a user action. auth.uid() is
--     unreliable for password changes that come from server-side flows or the
--     Supabase dashboard.
--   * Idempotent: WHERE revoked_at IS NULL skips already-revoked rows.
--   * No logging of user_id, password hash, or any credential material.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_revoke_trusted_devices_on_password_change ON auth.users;
DROP FUNCTION IF EXISTS public.revoke_trusted_devices_on_password_change();

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
     AND revoked_at IS NULL
     AND expires_at > now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.revoke_trusted_devices_on_password_change() OWNER TO postgres;

CREATE TRIGGER trg_revoke_trusted_devices_on_password_change
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW
WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
EXECUTE FUNCTION public.revoke_trusted_devices_on_password_change();
