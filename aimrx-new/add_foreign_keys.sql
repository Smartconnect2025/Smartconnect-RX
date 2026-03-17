-- ============================================
-- SmartConnect RX: Foreign Key Constraints
-- Run this in Supabase SQL Editor
-- ============================================

DO $$ BEGIN
  ALTER TABLE public."addendums"
    ADD CONSTRAINT "addendums_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."allergies"
    ADD CONSTRAINT "allergies_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."allergies"
    ADD CONSTRAINT "allergies_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."appointments"
    ADD CONSTRAINT "appointments_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."appointments"
    ADD CONSTRAINT "appointments_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."billing_groups"
    ADD CONSTRAINT "billing_groups_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."billing_diagnoses"
    ADD CONSTRAINT "billing_diagnoses_billing_group_id_billing_groups_fk"
    FOREIGN KEY ("billing_group_id") REFERENCES public."billing_groups"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."billing_procedures"
    ADD CONSTRAINT "billing_procedures_billing_group_id_billing_groups_fk"
    FOREIGN KEY ("billing_group_id") REFERENCES public."billing_groups"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."conditions"
    ADD CONSTRAINT "conditions_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."conditions"
    ADD CONSTRAINT "conditions_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."emr_orders"
    ADD CONSTRAINT "emr_orders_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."emr_orders"
    ADD CONSTRAINT "emr_orders_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."emr_orders"
    ADD CONSTRAINT "emr_orders_ordered_by_users_fk"
    FOREIGN KEY ("ordered_by") REFERENCES auth.users("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."encounters"
    ADD CONSTRAINT "encounters_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."encounters"
    ADD CONSTRAINT "encounters_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."encounters"
    ADD CONSTRAINT "encounters_finalized_by_users_fk"
    FOREIGN KEY ("finalized_by") REFERENCES auth.users("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."encounters"
    ADD CONSTRAINT "encounters_appointment_id_appointments_fk"
    FOREIGN KEY ("appointment_id") REFERENCES public."appointments"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."encounters"
    ADD CONSTRAINT "encounters_order_id_orders_fk"
    FOREIGN KEY ("order_id") REFERENCES public."orders"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."goals"
    ADD CONSTRAINT "goals_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."goal_progress"
    ADD CONSTRAINT "goal_progress_goal_id_goals_fk"
    FOREIGN KEY ("goal_id") REFERENCES public."goals"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."groups"
    ADD CONSTRAINT "groups_platform_manager_id_platform_managers_fk"
    FOREIGN KEY ("platform_manager_id") REFERENCES public."platform_managers"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."medications"
    ADD CONSTRAINT "medications_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."medications"
    ADD CONSTRAINT "medications_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."notifications"
    ADD CONSTRAINT "notifications_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."notification_actions"
    ADD CONSTRAINT "notification_actions_notification_id_notifications_fk"
    FOREIGN KEY ("notification_id") REFERENCES public."notifications"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."orders"
    ADD CONSTRAINT "orders_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."orders"
    ADD CONSTRAINT "orders_shipping_address_id_user_addresses_fk"
    FOREIGN KEY ("shipping_address_id") REFERENCES public."user_addresses"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."orders"
    ADD CONSTRAINT "orders_billing_address_id_user_addresses_fk"
    FOREIGN KEY ("billing_address_id") REFERENCES public."user_addresses"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."order_line_items"
    ADD CONSTRAINT "order_line_items_order_id_orders_fk"
    FOREIGN KEY ("order_id") REFERENCES public."orders"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."order_line_items"
    ADD CONSTRAINT "order_line_items_product_id_products_fk"
    FOREIGN KEY ("product_id") REFERENCES public."products"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."order_activities"
    ADD CONSTRAINT "order_activities_order_id_orders_fk"
    FOREIGN KEY ("order_id") REFERENCES public."orders"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."patient_documents"
    ADD CONSTRAINT "patient_documents_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."patient_documents"
    ADD CONSTRAINT "patient_documents_prescription_id_prescriptions_fk"
    FOREIGN KEY ("prescription_id") REFERENCES public."prescriptions"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."patient_documents"
    ADD CONSTRAINT "patient_documents_uploaded_by_users_fk"
    FOREIGN KEY ("uploaded_by") REFERENCES auth.users("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."patients"
    ADD CONSTRAINT "patients_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."patients"
    ADD CONSTRAINT "patients_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."payment_transactions"
    ADD CONSTRAINT "payment_transactions_prescription_id_prescriptions_fk"
    FOREIGN KEY ("prescription_id") REFERENCES public."prescriptions"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."payment_transactions"
    ADD CONSTRAINT "payment_transactions_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."payment_transactions"
    ADD CONSTRAINT "payment_transactions_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."payment_transactions"
    ADD CONSTRAINT "payment_transactions_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."pharmacy_admins"
    ADD CONSTRAINT "pharmacy_admins_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."pharmacy_admins"
    ADD CONSTRAINT "pharmacy_admins_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."pharmacy_backends"
    ADD CONSTRAINT "pharmacy_backends_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."pharmacy_medications"
    ADD CONSTRAINT "pharmacy_medications_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_prescriber_id_users_fk"
    FOREIGN KEY ("prescriber_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_appointment_id_appointments_fk"
    FOREIGN KEY ("appointment_id") REFERENCES public."appointments"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_medication_id_pharmacy_medications_fk"
    FOREIGN KEY ("medication_id") REFERENCES public."pharmacy_medications"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."prescriptions"
    ADD CONSTRAINT "prescriptions_backend_id_pharmacy_backends_fk"
    FOREIGN KEY ("backend_id") REFERENCES public."pharmacy_backends"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."products"
    ADD CONSTRAINT "products_category_id_categories_fk"
    FOREIGN KEY ("category_id") REFERENCES public."categories"("id")
    ON DELETE NO ACTION;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_availability"
    ADD CONSTRAINT "provider_availability_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_availability_exceptions"
    ADD CONSTRAINT "provider_availability_exceptions_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_patient_mappings"
    ADD CONSTRAINT "provider_patient_mappings_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_patient_mappings"
    ADD CONSTRAINT "provider_patient_mappings_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_pharmacy_links"
    ADD CONSTRAINT "provider_pharmacy_links_provider_id_users_fk"
    FOREIGN KEY ("provider_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_pharmacy_links"
    ADD CONSTRAINT "provider_pharmacy_links_pharmacy_id_pharmacies_fk"
    FOREIGN KEY ("pharmacy_id") REFERENCES public."pharmacies"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."providers"
    ADD CONSTRAINT "providers_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."providers"
    ADD CONSTRAINT "providers_group_id_groups_fk"
    FOREIGN KEY ("group_id") REFERENCES public."groups"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."provider_settings"
    ADD CONSTRAINT "provider_settings_provider_id_providers_fk"
    FOREIGN KEY ("provider_id") REFERENCES public."providers"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."system_logs"
    ADD CONSTRAINT "system_logs_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."user_roles"
    ADD CONSTRAINT "user_roles_user_id_users_fk"
    FOREIGN KEY ("user_id") REFERENCES auth.users("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."vitals"
    ADD CONSTRAINT "vitals_patient_id_patients_fk"
    FOREIGN KEY ("patient_id") REFERENCES public."patients"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public."vitals"
    ADD CONSTRAINT "vitals_encounter_id_encounters_fk"
    FOREIGN KEY ("encounter_id") REFERENCES public."encounters"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Done! Refresh Schema Visualizer to see relationships.