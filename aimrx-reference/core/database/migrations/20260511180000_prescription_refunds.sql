-- Accounting & Refunds tracking layer
-- Surfaces rejected/cancelled prescriptions to admins so refund liability is
-- visible and can be marked issued. The existing pharmacy-reports view hides
-- these statuses; this table is the persistent backing for the new tab.

CREATE TABLE IF NOT EXISTS prescription_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL UNIQUE REFERENCES prescriptions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('owed','issued','not_applicable')),
  refund_amount_cents integer NOT NULL DEFAULT 0,
  refund_method text NOT NULL CHECK (refund_method IN ('card','pot_credit','none')),
  issued_at timestamptz,
  issued_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_refunds_status
  ON prescription_refunds(status);
-- Note: prescription_id already has a unique index from the UNIQUE
-- constraint above, so no explicit btree index is needed.

-- Admin-only access via service role; no RLS policies needed because the
-- API routes use the server client with the service role key behind a role
-- check in app/api/admin/pharmacy-reports/refunds/*.

ALTER TABLE prescription_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY prescription_refunds_admin_select ON prescription_refunds
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY prescription_refunds_admin_all ON prescription_refunds
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─── BACKFILL ────────────────────────────────────────────────────────────
-- One row per existing rejected/cancelled prescription. Classification:
--   refund_method:
--     'card'       — payment_transactions.authnet_transaction_id IS NOT NULL
--     'pot_credit' — provider.pay_on_terms = true AND no card txn AND
--                    payment_status IN ('paid','rejected_refund_pending')
--     'none'       — neither (cancelled before charge, etc.)
--   status:
--     'issued'         — payment_transactions.refunded_at IS NOT NULL
--     'owed'           — payment_status IN ('paid','rejected_refund_pending')
--                        AND not already refunded
--     'not_applicable' — payment_status IN ('pending','unpaid','cancelled')
--                        with no refund owed
--   refund_amount_cents:
--     COALESCE(payment_transactions.refund_amount_cents,
--              ROUND(prescriptions.patient_price * 100) +
--              COALESCE(prescriptions.shipping_fee_cents, 0))

INSERT INTO prescription_refunds
  (prescription_id, status, refund_amount_cents, refund_method, issued_at, note)
SELECT
  p.id,
  CASE
    WHEN pt.refunded_at IS NOT NULL THEN 'issued'
    WHEN p.payment_status IN ('paid','rejected_refund_pending') THEN 'owed'
    ELSE 'not_applicable'
  END AS status,
  COALESCE(
    pt.refund_amount_cents,
    ROUND(COALESCE(NULLIF(p.patient_price::text,'')::numeric, 0) * 100)::int
      + COALESCE(p.shipping_fee_cents, 0)
  ) AS refund_amount_cents,
  CASE
    WHEN pt.authnet_transaction_id IS NOT NULL
      AND TRIM(pt.authnet_transaction_id) <> '' THEN 'card'
    WHEN pr.pay_on_terms = true
      AND p.payment_status IN ('paid','rejected_refund_pending') THEN 'pot_credit'
    ELSE 'none'
  END AS refund_method,
  pt.refunded_at AS issued_at,
  CASE
    WHEN pt.refunded_at IS NOT NULL THEN 'Backfilled from existing card refund'
    ELSE NULL
  END AS note
FROM prescriptions p
LEFT JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
LEFT JOIN providers pr ON pr.user_id = p.prescriber_id
WHERE p.status IN ('rejected','cancelled')
ON CONFLICT (prescription_id) DO NOTHING;
