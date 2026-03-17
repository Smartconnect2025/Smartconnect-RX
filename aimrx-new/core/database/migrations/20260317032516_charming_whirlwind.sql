ALTER TABLE "user_roles" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "platform_managers" ADD COLUMN "email" text;
ALTER TABLE "prescriptions" ADD COLUMN "easypost_tracker_id" text;
ALTER TABLE "prescriptions" ADD COLUMN "tracking_carrier" text;
ALTER TABLE "prescriptions" ADD COLUMN "last_tracking_event_id" text;