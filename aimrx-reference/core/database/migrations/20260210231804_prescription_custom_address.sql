ALTER TABLE "prescriptions" ADD COLUMN "has_custom_address" boolean DEFAULT false;
ALTER TABLE "prescriptions" ADD COLUMN "custom_address" jsonb;