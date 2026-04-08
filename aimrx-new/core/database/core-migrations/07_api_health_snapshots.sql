
    CREATE TABLE IF NOT EXISTS public.api_health_snapshots (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      check_key text NOT NULL UNIQUE,
      pharmacy_id uuid,
      backend_id uuid,
      service_name text NOT NULL,
      category text NOT NULL,
      status text NOT NULL DEFAULT 'unknown',
      severity text NOT NULL DEFAULT 'info',
      response_time_ms integer,
      consecutive_failures integer NOT NULL DEFAULT 0,
      last_error text,
      checked_at timestamptz DEFAULT now() NOT NULL,
      metadata jsonb,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );
    ALTER TABLE public.api_health_snapshots ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_health_snapshots_select_policy') THEN
        CREATE POLICY api_health_snapshots_select_policy ON public.api_health_snapshots FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_health_snapshots_insert_policy') THEN
        CREATE POLICY api_health_snapshots_insert_policy ON public.api_health_snapshots FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_health_snapshots_update_policy') THEN
        CREATE POLICY api_health_snapshots_update_policy ON public.api_health_snapshots FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_health_snapshots_delete_policy') THEN
        CREATE POLICY api_health_snapshots_delete_policy ON public.api_health_snapshots FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
      END IF;
    END $$;
    GRANT ALL ON public.api_health_snapshots TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_health_snapshots TO authenticated;
  