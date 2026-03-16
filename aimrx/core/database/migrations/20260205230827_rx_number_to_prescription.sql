ALTER TABLE "prescriptions" ADD COLUMN "rx_number" text;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_rx_number_unique" UNIQUE("rx_number");