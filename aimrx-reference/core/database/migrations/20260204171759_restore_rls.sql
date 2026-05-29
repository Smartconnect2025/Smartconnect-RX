ALTER TABLE "user_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_patient_mappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_availability_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conditions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "allergies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vitals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emr_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addendums" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_diagnoses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medication_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pharmacies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pharmacy_backends" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pharmacy_medications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_pharmacy_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pharmacy_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "symptoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_pharmacy_links" ADD CONSTRAINT "provider_pharmacy_links_provider_id_pharmacy_id_pk" PRIMARY KEY("provider_id","pharmacy_id");
ALTER TABLE "pharmacy_admins" ADD CONSTRAINT "pharmacy_admins_user_id_pharmacy_id_pk" PRIMARY KEY("user_id","pharmacy_id");
CREATE INDEX "idx_provider_patient_mappings_provider_id" ON "provider_patient_mappings" USING btree ("provider_id");
CREATE INDEX "idx_provider_patient_mappings_patient_id" ON "provider_patient_mappings" USING btree ("patient_id");
ALTER TABLE "provider_patient_mappings" ADD CONSTRAINT "provider_patient_unique" UNIQUE("provider_id","patient_id");
CREATE POLICY "user_addresses_select_policy" ON "user_addresses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_addresses"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_addresses_insert_policy" ON "user_addresses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_addresses"."user_id" = auth.uid());
CREATE POLICY "user_addresses_update_policy" ON "user_addresses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_addresses"."user_id" = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK ("user_addresses"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_addresses_delete_policy" ON "user_addresses" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_addresses"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "mfa_codes_select_policy" ON "mfa_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "mfa_codes_insert_policy" ON "mfa_codes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "mfa_codes_update_policy" ON "mfa_codes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "mfa_codes_delete_policy" ON "mfa_codes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "access_requests_select_policy" ON "access_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "access_requests_insert_policy" ON "access_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "access_requests_update_policy" ON "access_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "access_requests_delete_policy" ON "access_requests" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "payment_transactions_select_policy" ON "payment_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("payment_transactions"."patient_id")
      OR public.is_own_provider_record("payment_transactions"."provider_id")
      OR public.provider_has_patient_access("payment_transactions"."patient_id")
      OR public.is_pharmacy_admin("payment_transactions"."pharmacy_id")
    );
CREATE POLICY "payment_transactions_insert_policy" ON "payment_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record("payment_transactions"."provider_id")
          AND public.provider_has_patient_access("payment_transactions"."patient_id"))
    );
CREATE POLICY "payment_transactions_update_policy" ON "payment_transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record("payment_transactions"."provider_id")
          AND public.provider_has_patient_access("payment_transactions"."patient_id"))
      OR public.is_pharmacy_admin("payment_transactions"."pharmacy_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record("payment_transactions"."provider_id")
          AND public.provider_has_patient_access("payment_transactions"."patient_id"))
      OR public.is_pharmacy_admin("payment_transactions"."pharmacy_id")
    );
CREATE POLICY "payment_transactions_delete_policy" ON "payment_transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "providers_select_policy" ON "providers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR "providers"."user_id" = auth.uid()
      OR "providers"."is_active" = true
    );
CREATE POLICY "providers_insert_policy" ON "providers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR "providers"."user_id" = auth.uid()
    );
CREATE POLICY "providers_update_policy" ON "providers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR "providers"."user_id" = auth.uid()
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR "providers"."user_id" = auth.uid()
    );
CREATE POLICY "providers_delete_policy" ON "providers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "patients_select_policy" ON "patients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR "patients"."user_id" = auth.uid()
      OR public.provider_has_patient_access("patients"."id")
    );
CREATE POLICY "patients_insert_policy" ON "patients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR "patients"."user_id" = auth.uid()
    );
CREATE POLICY "patients_update_policy" ON "patients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR "patients"."user_id" = auth.uid()
      OR public.provider_has_patient_access("patients"."id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR "patients"."user_id" = auth.uid()
      OR public.provider_has_patient_access("patients"."id")
    );
CREATE POLICY "patients_delete_policy" ON "patients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "ppm_select_policy" ON "provider_patient_mappings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_patient_mappings"."provider_id")
        OR public.is_own_patient_record("provider_patient_mappings"."patient_id")
      );
CREATE POLICY "ppm_insert_policy" ON "provider_patient_mappings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_patient_mappings"."provider_id")
      );
CREATE POLICY "ppm_update_policy" ON "provider_patient_mappings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "ppm_delete_policy" ON "provider_patient_mappings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "appointments_select_policy" ON "appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("appointments"."patient_id")
      OR public.provider_has_patient_access("appointments"."patient_id")
    );
CREATE POLICY "appointments_insert_policy" ON "appointments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("appointments"."patient_id")
      OR public.provider_has_patient_access("appointments"."patient_id")
    );
CREATE POLICY "appointments_update_policy" ON "appointments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("appointments"."patient_id")
      OR public.provider_has_patient_access("appointments"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("appointments"."patient_id")
      OR public.provider_has_patient_access("appointments"."patient_id")
    );
CREATE POLICY "appointments_delete_policy" ON "appointments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "provider_availability_select_policy" ON "provider_availability" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "provider_availability_insert_policy" ON "provider_availability" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_availability"."provider_id")
    );
CREATE POLICY "provider_availability_update_policy" ON "provider_availability" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_availability"."provider_id")
    );
CREATE POLICY "provider_availability_delete_policy" ON "provider_availability" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_availability"."provider_id")
    );
CREATE POLICY "provider_availability_exceptions_select_policy" ON "provider_availability_exceptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_availability_exceptions"."provider_id")
      );
CREATE POLICY "provider_availability_exceptions_insert_policy" ON "provider_availability_exceptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_availability_exceptions"."provider_id")
      );
CREATE POLICY "provider_availability_exceptions_update_policy" ON "provider_availability_exceptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_availability_exceptions"."provider_id")
      );
CREATE POLICY "provider_availability_exceptions_delete_policy" ON "provider_availability_exceptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR public.is_own_provider_record("provider_availability_exceptions"."provider_id")
      );
CREATE POLICY "app_settings_select_policy" ON "app_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "app_settings_insert_policy" ON "app_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "app_settings_update_policy" ON "app_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "app_settings_delete_policy" ON "app_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "provider_settings_select_policy" ON "provider_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_settings"."provider_id")
    );
CREATE POLICY "provider_settings_insert_policy" ON "provider_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_settings"."provider_id")
    );
CREATE POLICY "provider_settings_update_policy" ON "provider_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_settings"."provider_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_own_provider_record("provider_settings"."provider_id")
    );
CREATE POLICY "provider_settings_delete_policy" ON "provider_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "encounters_select_policy" ON "encounters" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("encounters"."patient_id")
      OR public.provider_has_patient_access("encounters"."patient_id")
    );
CREATE POLICY "encounters_insert_policy" ON "encounters" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("encounters"."patient_id")
    );
CREATE POLICY "encounters_update_policy" ON "encounters" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("encounters"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("encounters"."patient_id")
    );
CREATE POLICY "encounters_delete_policy" ON "encounters" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "medications_select_policy" ON "medications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("medications"."patient_id")
      OR public.provider_has_patient_access("medications"."patient_id")
    );
CREATE POLICY "medications_insert_policy" ON "medications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("medications"."patient_id")
    );
CREATE POLICY "medications_update_policy" ON "medications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("medications"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("medications"."patient_id")
    );
CREATE POLICY "medications_delete_policy" ON "medications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "conditions_select_policy" ON "conditions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("conditions"."patient_id")
      OR public.provider_has_patient_access("conditions"."patient_id")
    );
CREATE POLICY "conditions_insert_policy" ON "conditions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("conditions"."patient_id")
    );
CREATE POLICY "conditions_update_policy" ON "conditions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("conditions"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("conditions"."patient_id")
    );
CREATE POLICY "conditions_delete_policy" ON "conditions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "allergies_select_policy" ON "allergies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("allergies"."patient_id")
      OR public.provider_has_patient_access("allergies"."patient_id")
    );
CREATE POLICY "allergies_insert_policy" ON "allergies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("allergies"."patient_id")
    );
CREATE POLICY "allergies_update_policy" ON "allergies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("allergies"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("allergies"."patient_id")
    );
CREATE POLICY "allergies_delete_policy" ON "allergies" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "vitals_select_policy" ON "vitals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("vitals"."patient_id")
      OR public.provider_has_patient_access("vitals"."patient_id")
    );
CREATE POLICY "vitals_insert_policy" ON "vitals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("vitals"."patient_id")
    );
CREATE POLICY "vitals_update_policy" ON "vitals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("vitals"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("vitals"."patient_id")
    );
CREATE POLICY "vitals_delete_policy" ON "vitals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "emr_orders_select_policy" ON "emr_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("emr_orders"."patient_id")
      OR public.provider_has_patient_access("emr_orders"."patient_id")
    );
CREATE POLICY "emr_orders_insert_policy" ON "emr_orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("emr_orders"."patient_id")
    );
CREATE POLICY "emr_orders_update_policy" ON "emr_orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("emr_orders"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("emr_orders"."patient_id")
    );
CREATE POLICY "emr_orders_delete_policy" ON "emr_orders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "addendums_select_policy" ON "addendums" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = "addendums"."encounter_id"
        AND (
          public.is_own_patient_record(e.patient_id)
          OR public.provider_has_patient_access(e.patient_id)
        )
      )
    );
CREATE POLICY "addendums_insert_policy" ON "addendums" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = "addendums"."encounter_id"
        AND public.provider_has_patient_access(e.patient_id)
      )
    );
CREATE POLICY "addendums_update_policy" ON "addendums" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = "addendums"."encounter_id"
        AND public.provider_has_patient_access(e.patient_id)
      )
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = "addendums"."encounter_id"
        AND public.provider_has_patient_access(e.patient_id)
      )
    );
CREATE POLICY "addendums_delete_policy" ON "addendums" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "billing_diagnoses_select_policy" ON "billing_diagnoses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_diagnoses"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_diagnoses_insert_policy" ON "billing_diagnoses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_diagnoses"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_diagnoses_update_policy" ON "billing_diagnoses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_diagnoses"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_diagnoses"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_diagnoses_delete_policy" ON "billing_diagnoses" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "billing_groups_select_policy" ON "billing_groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = "billing_groups"."encounter_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_groups_insert_policy" ON "billing_groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = "billing_groups"."encounter_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_groups_update_policy" ON "billing_groups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = "billing_groups"."encounter_id"
        AND p.user_id = auth.uid()
      )
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM encounters e
        JOIN providers p ON p.id = e.provider_id
        WHERE e.id = "billing_groups"."encounter_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_groups_delete_policy" ON "billing_groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "billing_procedures_select_policy" ON "billing_procedures" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_procedures"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_procedures_insert_policy" ON "billing_procedures" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_procedures"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_procedures_update_policy" ON "billing_procedures" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_procedures"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM billing_groups bg
        JOIN encounters e ON e.id = bg.encounter_id
        JOIN providers p ON p.id = e.provider_id
        WHERE bg.id = "billing_procedures"."billing_group_id"
        AND p.user_id = auth.uid()
      )
    );
CREATE POLICY "billing_procedures_delete_policy" ON "billing_procedures" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "patient_documents_select_policy" ON "patient_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_own_patient_record("patient_documents"."patient_id")
      OR public.provider_has_patient_access("patient_documents"."patient_id")
    );
CREATE POLICY "patient_documents_insert_policy" ON "patient_documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("patient_documents"."patient_id")
    );
CREATE POLICY "patient_documents_update_policy" ON "patient_documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("patient_documents"."patient_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR public.provider_has_patient_access("patient_documents"."patient_id")
    );
CREATE POLICY "patient_documents_delete_policy" ON "patient_documents" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "prescriptions_select_policy" ON "prescriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR "prescriptions"."prescriber_id" = auth.uid()
      OR public.is_own_patient_record("prescriptions"."patient_id")
      OR public.provider_has_patient_access("prescriptions"."patient_id")
      OR public.is_pharmacy_admin("prescriptions"."pharmacy_id")
    );
CREATE POLICY "prescriptions_insert_policy" ON "prescriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR ("prescriptions"."prescriber_id" = auth.uid()
          AND public.provider_has_patient_access("prescriptions"."patient_id"))
    );
CREATE POLICY "prescriptions_update_policy" ON "prescriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR ("prescriptions"."prescriber_id" = auth.uid()
          AND public.provider_has_patient_access("prescriptions"."patient_id"))
      OR public.is_pharmacy_admin("prescriptions"."pharmacy_id")
    ) WITH CHECK (
      public.is_admin(auth.uid())
      OR ("prescriptions"."prescriber_id" = auth.uid()
          AND public.provider_has_patient_access("prescriptions"."patient_id"))
      OR public.is_pharmacy_admin("prescriptions"."pharmacy_id")
    );
CREATE POLICY "prescriptions_delete_policy" ON "prescriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "medication_catalog_select_policy" ON "medication_catalog" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "medication_catalog_insert_policy" ON "medication_catalog" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "medication_catalog_update_policy" ON "medication_catalog" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "medication_catalog_delete_policy" ON "medication_catalog" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacies_select_policy" ON "pharmacies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "pharmacies_insert_policy" ON "pharmacies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pharmacies_update_policy" ON "pharmacies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacies_delete_policy" ON "pharmacies" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_backends_select_policy" ON "pharmacy_backends" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_backends_insert_policy" ON "pharmacy_backends" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_backends_update_policy" ON "pharmacy_backends" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_backends_delete_policy" ON "pharmacy_backends" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_medications_select_policy" ON "pharmacy_medications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_provider()
      OR public.is_pharmacy_admin("pharmacy_medications"."pharmacy_id")
    );
CREATE POLICY "pharmacy_medications_insert_policy" ON "pharmacy_medications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin("pharmacy_medications"."pharmacy_id")
    );
CREATE POLICY "pharmacy_medications_update_policy" ON "pharmacy_medications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin("pharmacy_medications"."pharmacy_id")
    );
CREATE POLICY "pharmacy_medications_delete_policy" ON "pharmacy_medications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
      public.is_admin(auth.uid())
      OR public.is_pharmacy_admin("pharmacy_medications"."pharmacy_id")
    );
CREATE POLICY "provider_pharmacy_links_select_policy" ON "provider_pharmacy_links" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR "provider_pharmacy_links"."provider_id" = auth.uid()
        OR public.is_pharmacy_admin("provider_pharmacy_links"."pharmacy_id")
      );
CREATE POLICY "provider_pharmacy_links_insert_policy" ON "provider_pharmacy_links" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "provider_pharmacy_links_update_policy" ON "provider_pharmacy_links" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "provider_pharmacy_links_delete_policy" ON "provider_pharmacy_links" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_admins_select_policy" ON "pharmacy_admins" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR "pharmacy_admins"."user_id" = auth.uid()
      );
CREATE POLICY "pharmacy_admins_insert_policy" ON "pharmacy_admins" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_admins_update_policy" ON "pharmacy_admins" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "pharmacy_admins_delete_policy" ON "pharmacy_admins" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "tiers_select_policy" ON "tiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "tiers_insert_policy" ON "tiers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "tiers_update_policy" ON "tiers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "tiers_delete_policy" ON "tiers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "system_logs_select_policy" ON "system_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "system_logs_insert_policy" ON "system_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "system_logs_update_policy" ON "system_logs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "system_logs_delete_policy" ON "system_logs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "goal_progress_select_policy" ON "goal_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = "goal_progress"."goal_id"
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "goal_progress_insert_policy" ON "goal_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = "goal_progress"."goal_id"
        AND g.user_id = auth.uid()
      )
    );
CREATE POLICY "goal_progress_update_policy" ON "goal_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = "goal_progress"."goal_id"
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = "goal_progress"."goal_id"
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "goal_progress_delete_policy" ON "goal_progress" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM goals g
        WHERE g.id = "goal_progress"."goal_id"
        AND (g.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "goals_select_policy" ON "goals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("goals"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "goals_insert_policy" ON "goals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("goals"."user_id" = auth.uid());
CREATE POLICY "goals_update_policy" ON "goals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("goals"."user_id" = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK ("goals"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "goals_delete_policy" ON "goals" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("goals"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "resources_select_policy" ON "resources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "resources_insert_policy" ON "resources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "resources_update_policy" ON "resources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "resources_delete_policy" ON "resources" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "tags_select_policy" ON "tags" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "tags_insert_policy" ON "tags" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "tags_update_policy" ON "tags" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "tags_delete_policy" ON "tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "notification_actions_select_policy" ON "notification_actions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.id = "notification_actions"."notification_id"
        AND (n.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "notification_actions_insert_policy" ON "notification_actions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "notification_actions_update_policy" ON "notification_actions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "notification_actions_delete_policy" ON "notification_actions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "notifications_select_policy" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notifications"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notifications_insert_policy" ON "notifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notifications"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notifications_update_policy" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notifications"."user_id" = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK ("notifications"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notifications_delete_policy" ON "notifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("notifications"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "order_activities_select_policy" ON "order_activities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = "order_activities"."order_id"
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "order_activities_insert_policy" ON "order_activities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "order_activities_update_policy" ON "order_activities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "order_activities_delete_policy" ON "order_activities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "order_line_items_select_policy" ON "order_line_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = "order_line_items"."order_id"
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "order_line_items_insert_policy" ON "order_line_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = "order_line_items"."order_id"
        AND o.user_id = auth.uid()
      )
    );
CREATE POLICY "order_line_items_update_policy" ON "order_line_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = "order_line_items"."order_id"
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = "order_line_items"."order_id"
        AND (o.user_id = auth.uid() OR public.is_admin(auth.uid()))
      )
    );
CREATE POLICY "order_line_items_delete_policy" ON "order_line_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "orders_select_policy" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("orders"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders_insert_policy" ON "orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("orders"."user_id" = auth.uid());
CREATE POLICY "orders_update_policy" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("orders"."user_id" = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK ("orders"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders_delete_policy" ON "orders" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("orders"."user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "categories_select_policy" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "categories_insert_policy" ON "categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "categories_update_policy" ON "categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "categories_delete_policy" ON "categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "products_select_policy" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "products_insert_policy" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "products_update_policy" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "products_delete_policy" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "symptoms_select_policy" ON "symptoms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "symptoms_insert_policy" ON "symptoms" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "symptoms_update_policy" ON "symptoms" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "symptoms_delete_policy" ON "symptoms" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));