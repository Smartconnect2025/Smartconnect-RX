-- ============================================================================
-- SmartConnect RX — additive schema for Payment-on-Terms + Provider Assistance
-- (delegation) attribution. Mirrors the AimRx upstream schema exactly.
--
-- SAFE / NON-DESTRUCTIVE: only ADDs columns (IF NOT EXISTS), with defaults.
-- Nothing is dropped or modified. Re-runnable.
--
-- Run this against the LIVE SmartConnect Supabase database (SQL editor or psql).
-- After this is applied, the Payment-on-Terms report tabs and the
-- "assistant submits under the provider's NPI" attribution will work.
-- ============================================================================

-- providers.prefix — display title before name (e.g. "Dr.", "NP", "PA").
-- Used so the prescription/report shows the supervising PROVIDER's name.
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS prefix text NOT NULL DEFAULT 'Dr.';

-- providers.pay_on_terms — when ON, the provider's orders are billed on terms
-- (auto-marked and submitted to pharmacy, settled later by the admin).
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS pay_on_terms boolean NOT NULL DEFAULT false;

-- prescriptions.submitted_by_delegation_id — set when an assistant (delegate)
-- submitted on behalf of the prescriber. NULL when the provider submitted
-- directly. ON DELETE SET NULL so the prescription survives if the delegation
-- is removed. This is what keeps the file in the PROVIDER's name/NPI while
-- recording which assistant actually submitted it.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS submitted_by_delegation_id uuid
  REFERENCES delegations(id) ON DELETE SET NULL;

-- prescriptions.pay_on_terms_settled_at — timestamp when the admin settled
-- (collected payment for) a pay-on-terms order. NULL = still owed.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS pay_on_terms_settled_at timestamptz;
