---
name: RedSail Pay groundwork
description: Scope boundary and safety rules for the RedSail (Emporos Payments) patient-payment integration.
---

# RedSail Pay (Emporos Payments)

Goal: make RedSail Pay the patient payment method and hide Stripe/Authorize.Net
from the patient flow — but only once RedSail is actually provisioned and connected.

**Hard boundary (why the integration ships in two stages):**
The patient-facing half (link generation routing, webhook handling with OIDC
bearer-token validation, real connection verification, the Emporos .NET sidecar
contract) is BLOCKED on external provisioning the user does not yet have: a real
Tenant GUID, OIDC client/secret + issuer/audience, sandbox access, and SDK access
from their RedSail rep. Building it before then means placeholder code in the LIVE
payment path — violates "functional over placeholder; fail loudly" and risks the
live flow. So stage 1 = admin config groundwork only; stage 2 = wiring, after creds.

**Rules:**
- Keep RedSail config isolated from the existing payment-config storage so the
  live Stripe/Authorize.Net flow is never touched. Config persists inert
  (active/connected default false) until stage 2.
- The "test"/verify action is format/readiness validation only until the real SDK
  exists; it must clearly say live verification is pending provisioning, and must
  never flip "connected" true on its own.
- A pharmacy should only route patients to RedSail when its config is active AND
  connected AND the global feature flag is on.

**Deploy:** app.smartconnects.com via Render (GitHub auto-deploy). Dev and prod
share the same live Supabase, so creating the table once covers both.
