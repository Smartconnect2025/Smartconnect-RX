-- Per-pharmacy patient fee visibility flags + Technology Platform Access Fee column.
-- Default OFF: a pharmacy charges nothing until an admin enables a fee via the
-- "Patient Fees" switches in Pharmacy Management.

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS show_delivery_fee   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_technology_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_provider_fee   boolean NOT NULL DEFAULT false;

-- Technology Platform Access Fee charged on a prescription (in cents).
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer DEFAULT 0;

-- Mirror the Technology fee onto the payment record so the patient's charged
-- total and breakdown stay authoritative.
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer DEFAULT 0;
