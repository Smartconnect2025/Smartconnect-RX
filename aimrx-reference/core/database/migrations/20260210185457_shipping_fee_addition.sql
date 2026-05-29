ALTER TABLE "providers" ADD COLUMN "default_shipping_fee" integer DEFAULT 40;
ALTER TABLE "prescriptions" ADD COLUMN "shipping_fee_cents" integer DEFAULT 0;