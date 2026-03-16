CREATE TABLE "mfa_verification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	CONSTRAINT "mfa_verification_attempts_user_id_unique" UNIQUE("user_id")
);

ALTER TABLE "mfa_verification_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" ADD COLUMN "dea_number" text;
ALTER TABLE "prescriptions" ADD COLUMN "billing_status" text;
ALTER TABLE "prescriptions" ADD COLUMN "patient_copay" text;
ALTER TABLE "prescriptions" ADD COLUMN "delivery_date" text;
ALTER TABLE "prescriptions" ADD COLUMN "lot_number" text;
CREATE POLICY "mfa_attempts_select_policy" ON "mfa_verification_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "mfa_attempts_insert_policy" ON "mfa_verification_attempts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "mfa_attempts_update_policy" ON "mfa_verification_attempts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "mfa_attempts_delete_policy" ON "mfa_verification_attempts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));