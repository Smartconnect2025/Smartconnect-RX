CREATE TABLE IF NOT EXISTS platform_manager_pharmacies (
  platform_manager_id UUID NOT NULL REFERENCES platform_managers(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (platform_manager_id, pharmacy_id)
);

ALTER TABLE platform_manager_pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmp_select_policy" ON platform_manager_pharmacies AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmp_insert_policy" ON platform_manager_pharmacies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pmp_delete_policy" ON platform_manager_pharmacies AS PERMISSIVE FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
