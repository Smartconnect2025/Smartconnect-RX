-- RedSail Pay (Emporos Payments) integration framework — schema additions.
--
-- Strictly ADDITIVE and IDEMPOTENT. Does NOT alter or drop anything used by the
-- live Stripe / Authorize.Net flow. Safe to apply to production at any time.
--
-- Apply this BEFORE flipping REDSAIL_ENABLED on. Until then none of the columns
-- or the table below are read or written by the running application (the RedSail
-- code paths are flag-gated off), so an un-applied migration cannot break the
-- existing payment flow.

-- ---------------------------------------------------------------------------
-- 1. Extra RedSail config fields (connection lifecycle + OIDC token endpoint).
-- ---------------------------------------------------------------------------
ALTER TABLE redsail_payment_configs
  ADD COLUMN IF NOT EXISTS oidc_token_url TEXT,
  ADD COLUMN IF NOT EXISTS link_to_pay_auth_mode TEXT NOT NULL DEFAULT 'SingleUseToken',
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- ---------------------------------------------------------------------------
-- 2. Correlation columns on payment_transactions so a RedSail link/payment can
--    be matched back to our transaction from a webhook. Nullable; only ever set
--    when a transaction is actually routed through RedSail.
-- ---------------------------------------------------------------------------
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS redsail_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS redsail_link_code TEXT,
  ADD COLUMN IF NOT EXISTS redsail_last_event_id TEXT,
  ADD COLUMN IF NOT EXISTS redsail_payload JSONB;

CREATE INDEX IF NOT EXISTS payment_transactions_redsail_link_code_idx
  ON payment_transactions (redsail_link_code);
CREATE INDEX IF NOT EXISTS payment_transactions_redsail_transaction_id_idx
  ON payment_transactions (redsail_transaction_id);

-- ---------------------------------------------------------------------------
-- 3. Inbound webhook event log — the idempotency ledger. A unique event_id
--    guarantees a redelivered webhook is processed at most once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redsail_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Idempotency key: the same Emporos event can be delivered more than once.
CREATE UNIQUE INDEX IF NOT EXISTS redsail_webhook_events_event_id_key
  ON redsail_webhook_events (event_id);

ALTER TABLE redsail_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS stays enabled (denies all non-service-role access by default). The webhook
-- receiver and admin tooling use the service role, which bypasses RLS. We only
-- add a read policy for platform admins when the helper function is present.
DO $$
DECLARE
  has_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) INTO has_is_admin;

  IF NOT has_is_admin THEN
    RAISE NOTICE 'Skipping redsail_webhook_events RLS policy: is_admin() missing (RLS stays enabled, service role bypasses).';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redsail_webhook_events'
      AND policyname = 'redsail_webhook_events_select_policy'
  ) THEN
    CREATE POLICY "redsail_webhook_events_select_policy"
      ON redsail_webhook_events AS PERMISSIVE FOR SELECT TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;
