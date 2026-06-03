-- RedSail Pay (Emporos Payments) configuration table.
-- Additive and idempotent: does NOT touch pharmacy_payment_configs or any live
-- payment flow. Safe to apply to production at any time.

CREATE TABLE IF NOT EXISTS redsail_payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,

  environment TEXT NOT NULL DEFAULT 'ftr1',

  tenant_id TEXT,
  site_id TEXT,
  station_id TEXT,

  oidc_client_id TEXT,
  oidc_client_secret_encrypted TEXT,

  webhook_audience TEXT,
  api_base_url TEXT,

  is_active BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT false,

  label TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redsail_payment_configs_pharmacy_id_idx
  ON redsail_payment_configs (pharmacy_id);

ALTER TABLE redsail_payment_configs ENABLE ROW LEVEL SECURITY;

-- Policies depend on the public.is_admin / public.is_pharmacy_admin helper
-- functions. If they are absent on this database, we still keep RLS ENABLED
-- (which denies all non-service-role access by default) and skip the policies,
-- so the migration can never half-fail. The admin API uses the service role,
-- which bypasses RLS regardless.
DO $$
DECLARE
  has_is_admin boolean;
  has_is_pharmacy_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) INTO has_is_admin;
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_pharmacy_admin'
  ) INTO has_is_pharmacy_admin;

  IF NOT (has_is_admin AND has_is_pharmacy_admin) THEN
    RAISE NOTICE 'Skipping RedSail RLS policies: helper functions missing (RLS stays enabled, service role bypasses).';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redsail_payment_configs'
      AND policyname = 'redsail_payment_configs_select_policy'
  ) THEN
    CREATE POLICY "redsail_payment_configs_select_policy"
      ON redsail_payment_configs AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()) OR public.is_pharmacy_admin(pharmacy_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redsail_payment_configs'
      AND policyname = 'redsail_payment_configs_insert_policy'
  ) THEN
    CREATE POLICY "redsail_payment_configs_insert_policy"
      ON redsail_payment_configs AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK (public.is_admin(auth.uid()) OR public.is_pharmacy_admin(pharmacy_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redsail_payment_configs'
      AND policyname = 'redsail_payment_configs_update_policy'
  ) THEN
    CREATE POLICY "redsail_payment_configs_update_policy"
      ON redsail_payment_configs AS PERMISSIVE FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()) OR public.is_pharmacy_admin(pharmacy_id))
      WITH CHECK (public.is_admin(auth.uid()) OR public.is_pharmacy_admin(pharmacy_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redsail_payment_configs'
      AND policyname = 'redsail_payment_configs_delete_policy'
  ) THEN
    CREATE POLICY "redsail_payment_configs_delete_policy"
      ON redsail_payment_configs AS PERMISSIVE FOR DELETE TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;
