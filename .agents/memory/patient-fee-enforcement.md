---
name: Patient fee server enforcement
description: How per-pharmacy patient fees are charged/suppressed, and the cross-cutting invariant for any new prescription fee column.
---

# Patient fee enforcement (SmartConnect RX)

Per-pharmacy flags on `pharmacies` (`show_delivery_fee`, `show_technology_fee`,
`show_provider_fee`) gate whether each patient fee is charged AND shown. Default
OFF — a pharmacy bills nothing until an admin enables a fee. The flat Technology
fee maps to `prescriptions.platform_fee_cents` (constant `PLATFORM_FEE_CENTS`,
read from `core/services/pharmacy-fee-flags.ts`).

The client preview (step2/step3) is non-authoritative. The server is the guard:
every order-creation path (`/api/prescriptions/submit`,
`/api/delegate/submit-refill`, `core/cron/jobs/refill-check`) reads the flags by
`pharmacy_id` and forces an OFF fee to $0.

**Rule — flat fees are clamped, never client-trusted:** the Technology fee is set
to exactly `PLATFORM_FEE_CENTS` when the flag is ON and the item carries it
(first-item semantics in multi-item carts), else $0. Never write
`body.platform_fee_cents` straight through — a caller could inject an arbitrary
amount.

**Invariant — new prescription fee columns must be wired into the charge, not
just stored:** the amount the patient is actually charged is computed in
`app/api/payments/generate-link/route.ts` (the server-authoritative total drives
the Stripe/Authorize.Net charge). Any new per-prescription fee column has to be
SELECTed and summed there (and mirrored onto `payment_transactions`) or it gets
stored on the prescription but never billed.
**Why:** the Technology fee was initially saved to `platform_fee_cents` and
included in `total_paid_cents`, but generate-link only summed
patient_price + shipping + profit, so it was silently never charged.

**Fail-open design:** `getPharmacyFeeFlags` defaults all flags to true (charge)
on null/read error; only an explicit `false` disables. Intentional — a transient
read glitch should not silently drop a pharmacy's revenue. It is NOT a strict
"OFF can never charge" guarantee.
