CREATE TYPE "public"."prescription_type" AS ENUM('prescription', 'refill');
CREATE TABLE "cron_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error_message" text,
	"records_processed" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);

ALTER TABLE "cron_job_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescriptions" ADD COLUMN "parent_prescription_id" uuid;
ALTER TABLE "prescriptions" ADD COLUMN "prescription_type" "prescription_type" DEFAULT 'prescription' NOT NULL;
ALTER TABLE "prescriptions" ADD COLUMN "refill_frequency_days" integer;
ALTER TABLE "prescriptions" ADD COLUMN "next_refill_date" timestamp with time zone;
ALTER TABLE "prescriptions" ADD COLUMN "total_refills_to_date" integer DEFAULT 0;
CREATE POLICY "cron_job_runs_select_policy" ON "cron_job_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "cron_job_runs_insert_policy" ON "cron_job_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "cron_job_runs_update_policy" ON "cron_job_runs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "cron_job_runs_delete_policy" ON "cron_job_runs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));