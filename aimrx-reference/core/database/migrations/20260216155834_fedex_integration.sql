ALTER TABLE "prescriptions" ADD COLUMN "fedex_status" text;
ALTER TABLE "prescriptions" ADD COLUMN "estimated_delivery" timestamp with time zone;
ALTER TABLE "prescriptions" ADD COLUMN "last_tracking_check" timestamp with time zone;