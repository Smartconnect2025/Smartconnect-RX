ALTER TABLE "user_roles" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "payment_transactions" ADD COLUMN "order_group_id" uuid;
ALTER TABLE "platform_managers" ADD COLUMN "email" text;
ALTER TABLE "prescriptions" ADD COLUMN "easypost_tracker_id" text;
ALTER TABLE "prescriptions" ADD COLUMN "tracking_carrier" text;
ALTER TABLE "prescriptions" ADD COLUMN "last_tracking_event_id" text;
ALTER TABLE "prescriptions" ADD COLUMN "order_group_id" uuid;
ALTER TABLE "pharmacies" ADD COLUMN "contact_email" text;