-- Restrict pay_on_terms updates on providers to admins (or service_role).
-- Without this, the providers RLS update policy "update_own_or_admin" lets
-- a provider flip their own pay_on_terms via direct Supabase client calls,
-- which would let them auto-bill themselves.

CREATE OR REPLACE FUNCTION restrict_provider_pay_on_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  jwt_role text;
BEGIN
  IF OLD.pay_on_terms IS DISTINCT FROM NEW.pay_on_terms THEN
    BEGIN
      jwt_role := auth.role();
    EXCEPTION WHEN OTHERS THEN
      jwt_role := NULL;
    END;
    IF COALESCE(jwt_role, '') <> 'service_role' AND NOT is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only administrators can change pay_on_terms (jwt_role=%, uid=%)', jwt_role, auth.uid()
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS providers_pay_on_terms_admin_only ON providers;
CREATE TRIGGER providers_pay_on_terms_admin_only
BEFORE UPDATE OF pay_on_terms ON providers
FOR EACH ROW EXECUTE FUNCTION restrict_provider_pay_on_terms();
