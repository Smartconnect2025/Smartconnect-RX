---
name: AimRx/SmartConnect prescription submission flow (DigitalRx + PioneerRx)
description: How new prescriptions actually reach the pharmacy; which route is two-way vs dead code. Prevents mis-"fixing" the legacy /submit path.
---

# Prescription submission is two-stage; the real pharmacy call is POST-payment

**Stage 1 — create:** Frontend new-Rx flow (`prescriptions/new/step3`) POSTs to
`/api/prescriptions/submit`. This route resolves the backend with
`resolvePharmacyBackendAny` but then only **inserts** the prescription as
`pending_payment` with `queue_id = null`.

- TRAP: `submit/route.ts` has a `requiresPayment = true` **hardcoded** constant,
  so its `if (!requiresPayment) { ...DigitalRx fetch... }` block is **dead code
  that never runs**. The DigitalRx-only payload/fetch in this file is legacy and
  is NOT the submission path. Do NOT "add a PioneerRx branch" here thinking new
  Rx's submit from this route — they don't. Do NOT delete the DigitalRx path
  expecting behavior change either.

**Stage 2 — submit to pharmacy (the real, two-way call):** After payment, the
Stripe webhook (`app/api/webhooks/stripe/route.ts`) and AuthNet webhook
(`app/api/webhooks/authnet/route.ts`) and the payment-reconcile cron call
`/api/prescriptions/[id]/submit-to-pharmacy`. THAT route branches properly:
`if (backend.systemType === "PioneerRx") submitToPioneerRx(...) else if "DigitalRx" submitToDigitalRx(...)`.
PioneerRx uses `submitPioneerRxEScript` from `_shared/pioneerrx-helpers.ts`.

**Status checks** (`status-batch`, `[id]/check-status`) also branch both systems
via `_shared/pharmacy-dispatcher.ts` + pioneerrx-helpers/digitalrx-helpers.

# Health monitoring (API & Logs page)
`core/services/health/{checks.ts,runner.ts}` dynamically discovers all active
`pharmacy_backends`, runs `checkDigitalRx`/`checkPioneerRx` by `system_type`, plus
Supabase + Stripe. The "X/N operational" count is dynamic. Page
`admin/api-logs/page.tsx` is a superset of the AimRx reference (all sections present).
`api_health_snapshots` table does NOT exist on live but is never read at runtime
(health is computed live + cached in memory) — harmless.

# Live DB state (verified May 2026, via Supabase REST)
`pharmacy_backends` had 1 DigitalRx (api_url null → default dbswebserver) + 2 active
PioneerRx (api_url https://apitest.pioneerrx.com). Dev runs `PIONEERRX_SIMULATION_MODE=true`.
**Why this matters:** the two-way DigitalRx+PioneerRx system is already fully built
and live-configured; verify before assuming work is needed.
