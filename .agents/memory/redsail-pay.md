---
name: RedSail Pay groundwork
description: Scope and safety rules for the RedSail (Emporos Payments) patient-payment integration.
---

# RedSail Pay (Emporos Payments)

Goal: make RedSail Pay the patient payment method and hide Stripe/Authorize.Net
from the patient flow — but only once RedSail is actually provisioned and connected.

**What is built (safe groundwork only):**
- `redsail_payment_configs` table (additive, isolated from `pharmacy_payment_configs`;
  `is_active`/`is_connected` default FALSE).
- Config service, admin API route, and an admin "RedSail Pay" settings page.
- Feature flag `REDSAIL_ENABLED` (default OFF).

**Hard rules / why:**
- Do NOT wire `redsail` into generate-link / patient page / webhooks until real
  Emporos credentials (TenantId GUID, OIDC client/secret, sandbox), the .NET SDK,
  and OIDC trust are provisioned by the user's RedSail rep. Wiring earlier would be
  placeholder code that could disrupt the LIVE payment flow.
- Live over placeholder; fail loudly. The "test" action only validates
  format/GUID/presence and clearly states live verification is pending provisioning.
- App deploys to app.smartconnects.com via Render (GitHub auto-deploy). Dev talks to
  the SAME live Supabase, so applying the table once covers dev + prod.
