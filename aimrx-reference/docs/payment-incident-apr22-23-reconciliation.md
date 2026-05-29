# Payment Incident Reconciliation Runbook — Apr 22-23, 2026

**Owner:** Payments / on-call
**Audience:** operator running the reconciliation against the production database after this remediation deploys.
**Pre-condition:** the `incident remediation` commits are deployed to production. The `PAYMENT_JANITOR_ENABLED` env var is **NOT** yet set to `true` — keep it unset (or `false`) for the entire duration of this runbook so the cron does not race the human investigation.

---

## 1. Scope

This runbook reconciles every `payment_transactions` row that was left in a non-terminal state during the Apr 22-23, 2026 outage window, and any row in the same posture that has accumulated since. The remediation deploy fixes the *forward* path; this runbook closes out the *backlog*.

A row is in scope if it satisfies:

```sql
SELECT id,
       payment_token,
       authnet_ref_id,
       provider_id,
       patient_email,
       total_amount_cents,
       payment_status,
       updated_at,
       payment_link_expires_at,
       charge_attempt_started_at,
       verify_required_at,
       last_gateway_error_code,
       last_gateway_error_at,
       reconciliation_note
FROM payment_transactions
WHERE payment_status IN ('pending', 'processing')
  AND created_at >= '2026-04-22'::date
ORDER BY updated_at DESC;
```

> **Important:** the filter is `payment_status IN ('pending','processing')`, **not** `processing` alone. The Apr 22-23 stuck rows were ultimately written back to `pending` by the pre-incident stale-claim recovery path, so the incident-window backlog lives almost entirely in `pending`. A `processing`-only filter under-reports.

Save the result as `apr_22_23_backlog.csv` — this is the working set for the rest of the runbook.

---

## 2. Authorize.Net merchant-side lookup

For each row in the working set, you need to know whether Authorize.Net actually captured a charge for the row's `authnet_ref_id`. Two equally good methods; pick whichever is faster for the size of the backlog.

### 2a. UI (small backlog, <50 rows)

1. Log in to the Merchant Interface for the AIMRX account.
2. **Search → Transaction Search** with date range Apr 22 00:00 ET through *today* 23:59 ET.
3. For each row's `authnet_ref_id`, paste it into the **Invoice Number** field and search.
4. Record the outcome in the CSV (see column schema in §4).

### 2b. API (large backlog, ≥50 rows)

```bash
# requires AUTHNET_API_LOGIN_ID and AUTHNET_TRANSACTION_KEY in the shell.
curl -s https://api.authorize.net/xml/v1/request.api \
  -H 'Content-Type: application/json' \
  -d '{
    "getUnsettledTransactionListRequest": {
      "merchantAuthentication": {
        "name": "'"$AUTHNET_API_LOGIN_ID"'",
        "transactionKey": "'"$AUTHNET_TRANSACTION_KEY"'"
      }
    }
  }' | jq '.transactions[] | select(.invoiceNumber|IN($refs[]))'
```

Repeat for `getSettledBatchListRequest` over the Apr 22 → today date range, then `getTransactionListRequest` per batch ID.

---

## 3. Decision tree per row

For each row in the working set, classify into exactly one bucket:

### Bucket 1 — CAPTURED
**Definition:** Authorize.Net shows a transaction whose `invoiceNumber` matches `authnet_ref_id`, status `authorizedPendingCapture` / `capturedPendingSettlement` / `settledSuccessfully`, amount within $0.01 of `total_amount_cents / 100`.

**Action:** drive the standard verify cycle — the existing `/api/payments/verify-and-complete` endpoint is idempotent and handles the post-capture work (prescription updates, pharmacy submission, receipt email).

```bash
curl -s -X POST "$SITE_URL/api/payments/verify-and-complete" \
  -H 'Content-Type: application/json' \
  -d "{\"paymentToken\":\"<paymentToken>\"}"
```

Record the response's `transactionId` and `pharmacySubmitted` flag in the CSV. If `pharmacySubmitted=false`, escalate to the pharmacy-ops on-call before continuing.

### Bucket 2 — NO CHARGE
**Definition:** No Authorize.Net transaction exists for this `authnet_ref_id`, AND the gateway query itself returned cleanly (resultCode=Ok on both unsettled and at least one settled batch search).

**Action:** soft-mark the row expired with an explicit reconciliation note so the audit trail captures *who* decided the row's fate.

```sql
UPDATE payment_transactions
SET payment_status = 'expired',
    reconciliation_note = 'apr22_23_incident_no_charge_at_processor',
    updated_at = now()
WHERE id = '<row.id>'
  AND payment_status IN ('pending','processing');
```

If a patient *thought* they paid (e.g. they have a screenshot, an angry email), follow up: send them a fresh payment link via `/api/payments/create-link`. Do **not** mark the original row anything other than `expired` — never recycle a row that was the subject of a confused customer interaction.

### Bucket 3 — AMBIGUOUS
**Definition:** any of:
* The gateway query itself failed (timeout, non-Ok response on both unsettled and settled walks).
* Authorize.Net shows a transaction with the matching `invoiceNumber` but the amount diverges by more than $0.01 (a real billing discrepancy — escalate immediately).
* Authorize.Net shows two or more transactions with the same `invoiceNumber` (a real double-charge — escalate immediately and start the refund procedure for the duplicate).

**Action:** do **NOT** UPDATE the row. Leave it as-is, set the breadcrumb so it's flagged for re-review:

```sql
UPDATE payment_transactions
SET verify_required_at = now(),
    reconciliation_note = 'apr22_23_incident_ambiguous_manual_followup',
    updated_at = now()
WHERE id = '<row.id>';
```

Add the row to the *Ambiguous* tab of the working CSV and assign a named owner. **No auto-action** is appropriate.

---

## 4. CSV report schema

Required columns (one row per `payment_transactions.id`):

| column | source | notes |
|---|---|---|
| `id` | DB | primary key |
| `payment_token` | DB | for follow-up curl |
| `authnet_ref_id` | DB | the search key on Authorize.Net |
| `provider_id` | DB | for who-to-notify |
| `patient_email` | DB | for who-to-notify |
| `amount_cents` | DB | `total_amount_cents` |
| `db_status_before` | DB | `payment_status` at the start of reconciliation |
| `last_db_update` | DB | `updated_at` |
| `db_breadcrumbs` | DB | `last_gateway_error_code`, `verify_required_at` |
| `processor_status` | Authorize.Net | `none` / `authorized_pending_capture` / `captured_pending_settlement` / `settled` / `voided` / `refunded` / `query_failed` |
| `processor_amount` | Authorize.Net | dollars, or empty |
| `processor_trans_id` | Authorize.Net | empty if no match |
| `bucket` | derived | `1_captured` / `2_no_charge` / `3_ambiguous` |
| `action_taken` | reconciler | what you did |
| `db_status_after` | DB | what `payment_status` is now |
| `reconciler` | reconciler | your name |
| `reconciled_at` | reconciler | ISO timestamp |

Save the CSV under `docs/incident-reports/apr22-23-reconciliation-<YYYYMMDD>.csv` (gitignored from production but committed to the audit repo) and link it from the post-mortem doc.

---

## 5. Sign-off checklist

Before flipping `PAYMENT_JANITOR_ENABLED=true`:

- [ ] Every row in the working set is classified into bucket 1, 2, or 3.
- [ ] Every bucket-1 row's verify response was 200 with `success: true`. Failures escalated.
- [ ] Every bucket-2 row's `payment_status` is now `expired` with `reconciliation_note` populated.
- [ ] Every bucket-3 row has an assigned named owner and an open follow-up ticket.
- [ ] The CSV is saved and linked from the incident post-mortem.
- [ ] On-call lead has reviewed and signed the CSV.

Then, in the production environment:

```bash
# enable the janitor cron going forward
PAYMENT_JANITOR_ENABLED=true
```

Verify the next janitor run logs to `system_logs` with `action='CRON_PAYMENT_JANITOR'` and reasonable cohort sizes (single-digit on a healthy day).

---

## 6. Rollback

If the janitor misbehaves after enable, the safe rollback is:

```bash
PAYMENT_JANITOR_ENABLED=false
```

The cron's auth check returns 503 in this state and no payment row is touched. Then re-open this runbook, identify what cohort it mishandled, and patch the cron route before re-enabling.

The hot-path remediation (CAS, in-flight guard, decision tree, breadcrumb, soft-mark) has *no* env gate and remains in effect — those are pure correctness fixes and reverting them re-opens the original incident primitive.
