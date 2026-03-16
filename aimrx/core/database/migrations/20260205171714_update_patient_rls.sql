ALTER POLICY "patients_insert_policy" ON "patients" TO authenticated WITH CHECK (
      public.is_admin(auth.uid())
      OR "patients"."user_id" = auth.uid()
      OR public.is_provider()
    );