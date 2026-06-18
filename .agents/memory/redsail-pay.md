---
name: RedSail Pay groundwork
description: Scope boundary and safety rules for the RedSail (Emporos Payments) patient-payment integration.
---

# RedSail Pay (Emporos Payments)

> **STATUS UPDATE (2026-06-18): RedSail is now the ONLY gateway.** Per the user
> (no live patients exist), Stripe and Authorize.Net were retired app-wide:
> `generate-link` hardcodes `payment_gateway="redsail"`; the patient page only
> calls `create-redsail-session`; the admin gateway dropdown offers only
> None + RedSail; the "Bill Patient" modal only sends a RedSail link. Legacy
> charge endpoints (`charge-stripe`, `charge-nonce`) now fail closed with 410
> unless the txn's gateway matches (it never will). `REDSAIL_ENABLED=true` is set
> in the Replit dev env. **Real payments still require:** (a) `REDSAIL_ENABLED=true`
> on the Render PROD env, and (b) a per-pharmacy RedSail config that is
> active+connected (real Emporos creds). Until (b), `create-redsail-session`
> fails closed — which is fine with no live patients. The two-stage framing
> below is historical; the gateway is now wired, not flag-gated off.

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

## Integration contract (from the Emporos Payments Domain Integrator Guide v1.8.0)
The guide is .NET/SDK-first and has hard external dependencies. Key facts:
- **Preferred path is a .NET SDK** (`Emporos.Payments.Sdk` NuGet, C#, .NET 8/Std2.0+).
  SmartConnect is Node/TypeScript, so SDK is not directly usable.
- **The HTTP API ("any language") is officially "Not Available Yet"** per the guide
  ("API Documentation … TBD Later"). Only one endpoint shape is shown:
  `POST /api/{tenantId}/sdk/transaction/initialize` (Bearer) → `{ urlCode }`, then
  payment URL `https://{paymentsDomain}/{tenantId}/pay/{urlCode}`. Link-to-Pay's
  HTTP endpoint/body is NOT documented (only the SDK method `CreateLinkToPayAsync`
  → `response.Data.LinkToPayUrl` + `LinkToPayCode`). Building Node now = reverse-
  engineering undocumented HTTP — risky on a LIVE payment path.
- **Integrator must run its own OIDC server** (OAuth2 client-credentials, JWT signed,
  `.well-known` at the configured level). JWT must carry `aud` containing
  `payments-domain` and a `tenant_id` claim (= the Tenant GUID). Emporos calls YOUR
  OIDC both for your outbound token AND to authenticate webhooks back to you.
- **Onboarding is manual via Emporos**: send Tenant-Onboarding CSV(s); Emporos sets
  gateway (GPI) credentials in test envs, adds your logo URL as a trusted source,
  takes your theme CSS, webhook URL, and OIDC details. Creds are not self-serve.
- **Hierarchy**: Integrator > Tenant(pharmacy, GUID) > Site(location, integrator sets
  SiteId) > Station(register, integrator sets numeric 0-16 digit StationId). Config
  precedence Station > Site > Tenant > Integrator.
- **Patient remote-pay = Link to Pay** (matches SmartConnect's payment-link flow).
  3 auth modes: LastNameAndDob, LastNameAndZipCode, SingleUseToken (no customer).
- **Webhooks**: `POST {yourWebhook}/webhooks/payments`, Bearer token, body has
  `eventName`/`eventId`/`eventDate`/`eventPayload`. Events: `payment.success`,
  `link_to_pay.fully_paid`, `card.boarded`/`updated`/`unboarded`. Retries via Service
  Bus + DLQ until 200.
- **Test cards**: Visa 4012000033330026, MC 5121212121212124, Disc 6510000000000810,
  Amex 3760000000000002 (cvv 1234), FSA 4005100001234504. CVV 123, any future exp.
- **Env base URLs (corrected from guide p.7)**: FTR1 `https://empftr1-payments-dev.emporos.io`,
  PRV `https://payments-prv.emporos.io` (code previously had wrong `empprv-payments`),
  PROD `https://payments.emporos.io`.
**Why this matters:** the integration cannot be flipped on from a config form alone —
it needs Emporos-side onboarding + an integrator-operated OIDC service + (for Node)
HTTP contracts Emporos hasn't published. Don't wire the live patient flow until those exist.

## Stage-2 framework wiring (built, flag-gated off)
- **Connector seam:** all RedSail transport goes through `IRedSailClient`
  (`core/services/redsail/`). `getRedsailClient()` selects by `REDSAIL_ADAPTER`
  (default `mock`); the real Emporos .NET-SDK/OIDC transport plugs in there with
  no caller changes. Mock is deterministic and only reports "connected" when real
  credentials are present.
- **Migration-before-flag rule:** the new redsail columns + `redsail_webhook_events`
  table do NOT exist in the live Supabase yet, and DDL can't be applied from the
  Replit env (direct host IPv6-only, port 5432 times out). Apply
  `core/database/migrations/20260603_redsail_framework.sql` (via Supabase SQL
  editor) BEFORE setting `REDSAIL_ENABLED=true`. All runtime writes to those new
  columns live only in the flag-gated path, so an un-applied migration is safe
  while the flag is off.
- **Real `http` transport + integrator OIDC now exist (still opt-in):**
  `getRedsailClient` selects `http` (`REDSAIL_ADAPTER=http`) → `HttpRedSailClient`;
  default is still `mock`, so the live patient path is unchanged until the flag +
  adapter are set AND a pharmacy is provisioned/connected. The integrator OIDC
  server lives in-codebase at `/api/redsail/oidc` (discovery `.well-known/openid-configuration`,
  `/jwks`, `/connect/token`); it signs RS256 client-credentials JWTs carrying
  `aud:["payments-domain"]` + `tenant_id`, and the webhook verifies inbound tokens
  against the same key. **The `tenant_id` claim (not the signature) is what binds a
  webhook token to a pharmacy** — the signing key is shared across configs, so each
  config only accepts tokens whose `tenant_id` == its Tenant GUID. The `/connect/token`
  endpoint maps a client to its tenant via `redsail_payment_configs.oidc_client_id`.
- **`REDSAIL_OIDC_PRIVATE_KEY` is a hard prod prerequisite for the `http` adapter:**
  PKCS#8 RSA PEM (or base64 of one). **Why:** JWKS must be STABLE — a per-restart
  ephemeral key (the dev fallback) would silently break Emporos token validation.
  Prod throws if it's unset; dev auto-generates ephemeral + warns.
- **Link-to-Pay HTTP path is NOT published by Emporos** (only the SDK shape +
  `transaction/initialize` are documented). The adapter posts the documented
  Transaction/Link-to-Pay body to `REDSAIL_LINK_TO_PAY_PATH` (templated
  `{tenantId}/{siteId}`, sensible default) and **fails loudly** if the response has
  no usable URL/code — it never fabricates a link. Optional `REDSAIL_PING_PATH`
  enables a real reachability check in `ping()`; without it `ping()` only proves
  token minting. Set these once Emporos confirms the real endpoints.
- **ENCRYPTION_KEY is now a hard prod prerequisite:** `core/security/encryption.ts`
  throws in `NODE_ENV=production` when `ENCRYPTION_KEY` is unset (no more shared dev
  fallback). **Why:** a shared deterministic key makes stored credentials trivially
  decryptable. **Caution:** this affects the EXISTING Stripe/Authorize.Net credential
  encrypt/decrypt paths too — if prod was silently running on the dev fallback,
  stored secrets were encrypted with it; set `ENCRYPTION_KEY` to that same value (or
  re-enter credentials) before deploying, or live credential decryption will break.
