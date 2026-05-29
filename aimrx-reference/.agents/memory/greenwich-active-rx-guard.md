---
name: Greenwich Active_Rx reject guard
description: Both DigitalRx ingestion paths (webhook + reconcile cron) must verify Active_Rx is explicitly inactive before honoring a reject keyword. Truthy/absent Active_Rx with a reject word is a transient state that must be ignored.
---

## Rule
When Greenwich/DBS sends a rejection keyword (`rph reject`, `rejected`, `reject`, `cancelled`, `canceled`, `denied`, `void`, `voided`), only flip the row to `status='rejected'` if `Active_Rx` (or `active_rx` / `ActiveRx`) is **explicitly** one of `"0" | "false" | "no"` (case-insensitive, also matches numeric `0` / boolean `false` via stringification).

If `Active_Rx` is `"1"` / truthy / absent → REFUSE the rejection.

## Why
Greenwich's status API can emit a rejection word during transient pharmacist workflow states (re-routing, license check, prior-auth review) while `Active_Rx="1"` — the Rx is still alive in their queue, often actively being TYPED. Combined with the "rejected always wins" override in `isForwardStatusTransition` (helpers.ts line 78, webhook line 171), a single transient reject blip permanently locks the row: subsequent TYPED/PACKED polls can never advance it because rejected has no ordinal and `newOrd > currentOrd` always fails. Lives-of-people rule: a stuck `rejected` row in the UI tells the patient and provider the order is dead when Greenwich is actually filling it.

## Multi-entry selection (Amanda Holiday q2408203/2408204, May 28 2026)
Greenwich returns an ARRAY of Rx lines per queue ID — one per pharmacist action (original, retype, void, duplicate). Picking the single newest-by-RxDate line is WRONG when the newest is a rejected DUPLICATE sitting next to an older line Greenwich actually kept and advanced. Amanda's queue: line 581511 TYPED + approved@12:57PM (typed 10:43:20, Active_Rx=1) AND line 581517 RPH REJECT (typed 10:44:06 — 46s later, Active_Rx=1). Newest-wins picked the reject.

`pickAuthoritativeEntry(entries)` in digitalrx-helpers.ts replaces the blind newest-wins selector:
1. If any line is a reject word AND `Active_Rx` explicitly inactive (0/false/no) → genuine kill, use newest such line.
2. Else ignore every alive-reject line and use the newest NON-reject line (recovers Amanda; Diana Harr's TYPED retype still wins because it's the newest non-reject).
3. Else (all lines are alive-rejects) fall back to newest overall — the downstream mapDigitalRxStatus Active_Rx guard still refuses to write `rejected`.

**Why:** `Active_Rx="1"` on a reject line means Greenwich still considers the Rx alive — it's a duplicate/transient reject, not a kill. A real kill sets Active_Rx=0. Selecting the alive line at the source means we never even enter the rejected-recovery path for duplicates.

## Single source of truth for reject words
`REJECT_STATUS_WORDS` + `isRejectStatusWord()` in digitalrx-helpers.ts is the ONLY reject-keyword list. mapDigitalRxStatus's two former inline duplicate lists were consolidated to call it (May 28 2026) — drift between guard sites is the root bug class behind these incidents. Any new reject keyword goes in this one set. The webhook (`app/api/webhook/digitalrx/route.ts`) still has its own list in a separate file — consolidate if touched.

## How to apply
- THREE writers can map a Greenwich response to `rejected` — all three must be guarded:
  1. `app/api/prescriptions/_shared/digitalrx-helpers.ts` `mapDigitalRxStatus` — used by the 5-min reconcile cron AND the browser-driven `status-batch` polling endpoint. On refused reject: re-derive `newStatus` from the highest-ordinal non-reject signal in the same response (workflow token `Statuswf="typed"`→`packed`, OR date fields PackDateTime/ApprovedDate/PickupDate/DeliveredDate). Only fall back to `currentStatus` when NO positive signal is present. **This recovery is required** — without it, a row already at `rejected` stays stuck even after Greenwich's response carries TYPED + Active_Rx=1 (Joseph's "if they undrejected let it be" rule, May 28 2026, post-Emily Freeman).
  2. `app/api/webhook/digitalrx/route.ts` POST handler — for live pharmacy push events. On refused reject: re-derive from the most-advanced non-reject signal — workflow token (`Statuswf="typed"` → `packed`) OR date fields (PackDateTime → packed, ApprovedDate → approved, Tracking/PickupDate → picked_up, DeliveredDate → delivered) — whichever yields a higher STATUS_ORDINAL. Fall back to `submitted` only if both are absent.
  3. `app/api/prescriptions/status-batch/route.ts` — UI-triggered batch poll. Inherits the guard via `mapDigitalRxStatus`, but ALSO writes a `BATCH_DIGITALRX_STATUS_CHANGED` audit row on every status flip (added May 28 2026 — Emily Freeman investigation revealed this endpoint had been writing silently for months, with zero `system_logs` trail, making mystery flips impossible to trace).

- Forensic rule: if a prescription's status changes with no `system_logs` audit row, the writer is one of these three paths. All three now log. If a future flip has no log, suspect a NEW unguarded writer was added — find and guard it.

- "Rejected always wins" override in `isForwardStatusTransition` (and webhook's `isForwardTransition`) must stay — it's the only way a legitimate explicit reject (Active_Rx=0) can override a row already at `packed`/`approved`. With the Active_Rx guard upstream, the override is safe.

- Do NOT add a new code path that writes `status='rejected'` to the prescriptions table without going through one of the two guarded paths above. The only other writer is `app/api/payments/refund-partial/route.ts` (admin refund — orthogonal).

- If a new rejection-like keyword is added to either mapping table (e.g., "expired"), the Active_Rx guard must be extended in lockstep.
