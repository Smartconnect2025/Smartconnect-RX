---
name: Pay-on-terms checkout bypass
description: How net-terms providers skip the SmartConnect RX checkout screen, and the no-receipt invariant.
---

# Pay-on-terms checkout bypass (SmartConnect RX Step 4)

The full pay-on-terms backend (providers.pay_on_terms flag, check-pay-on-terms
endpoint, mark-paid bypass that records card_type "manual-payment" + submits to
pharmacy without a card charge, cron skip, settlement/reporting) existed long before
the front end ever used it. The Prescribe wizard Step 4 now calls check-pay-on-terms
on load and, when payOnTerms is true, auto-runs mark-paid so the provider never sees
the Collect Payment screen.

**Invariant — pay-on-terms sends NO patient receipt.**
The auto-bypass passes `suppressPatientNotifications: true` to mark-paid, which gates
the confirmation-email send. The NORMAL manual "Mark as Paid" flow does NOT pass the
flag and still emails the patient. Any future change to mark-paid must keep the
suppress path intact, or net-terms patients start getting receipts they shouldn't.

**Why:** net-terms = the practice is billed later on terms; the patient is not the
payer at point of sale, so no payment receipt should reach them.

**How to apply:** when touching mark-paid or Step 4 checkout, preserve the
suppressPatientNotifications gate and the client-side single-run guard (the mutating
mark-paid must run at most once per id set; reuse the existing payment_transaction on
retry rather than creating duplicates).
