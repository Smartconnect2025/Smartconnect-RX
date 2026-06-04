# SmartConnect RX ↔ Emporos (RedSail Pay) — Onboarding Request

**From:** SmartConnect RX (integrator)
**Production app:** https://app.smartconnects.com
**Purpose:** We have completed our side of the Emporos Payments Domain integration and are ready to begin testing in **FTR1 / PRV**. This document (1) summarizes what we have already built so you can verify our setup, (2) lists everything we will provide to you, and (3) lists exactly what we need back from you to start testing.

---

## 1. What we have already built (ready for your verification)

Our integration follows the Emporos Payments Domain Integrator Guide. The following is **live in production** and ready to test:

### Integrator-operated OIDC server (Client Credentials)
We host an OIDC token service that both (a) issues the tokens we use to call your payment API and (b) lets you mint tokens to call our webhook. All tokens are signed RS256, carry `aud` containing **`payments-domain`**, and include a **`tenant_id`** claim equal to the pharmacy's Tenant GUID.

| Item | Value |
|------|-------|
| OIDC issuer (base) | `https://app.smartconnects.com/api/redsail/oidc` |
| Discovery (.well-known) | `https://app.smartconnects.com/api/redsail/oidc/.well-known/openid-configuration` |
| Token endpoint | `https://app.smartconnects.com/api/redsail/oidc/connect/token` |
| JWKS (public keys) | `https://app.smartconnects.com/api/redsail/oidc/jwks` |
| Grant type | `client_credentials` |
| Signing algorithm | RS256 (public keys published at JWKS above) |
| Audience claim (`aud`) | `payments-domain` |
| Tenant claim | `tenant_id` (default; no custom prefix in use) |

### Webhook receiver (payment result callback)
| Item | Value |
|------|-------|
| Webhook URL | `https://app.smartconnects.com/api/webhooks/redsail` |
| Auth | Bearer token validated against our published JWKS; `aud` must contain `payments-domain`; `tenant_id` must match the pharmacy |
| Behavior | Idempotent (duplicate deliveries are safely ignored), per-pharmacy tenant isolation enforced, automatically reconciles the order/prescription on a successful payment event |

### Admin configuration (per pharmacy / per site)
Our admin can already store and manage, for each pharmacy: **Environment** (FTR1 / PRV / Production), **Tenant ID (GUID)**, **OIDC Client ID**, **OIDC Client Secret**, **Site ID**, and **Station ID**, plus a "Test / Verify connection" action. Environment base URLs are already wired:

- FTR1: `https://empftr1-payments-dev.emporos.io`
- PRV: `https://payments-prv.emporos.io`
- PROD: `https://payments.emporos.io`

---

## 2. What we will provide to you (integrator one-time setup)

Please tell us your preferred secure channel and we will send anything sensitive (e.g. the client secret) through it rather than email.

| Property | Value |
|----------|-------|
| Integrator name | **SmartConnect RX** |
| OIDC discovery URL | `https://app.smartconnects.com/api/redsail/oidc/.well-known/openid-configuration` |
| OIDC token endpoint | `https://app.smartconnects.com/api/redsail/oidc/connect/token` |
| OIDC JWKS URL | `https://app.smartconnects.com/api/redsail/oidc/jwks` |
| OIDC Client ID | _provided per pharmacy on request_ |
| OIDC Client Secret | _sent securely on request_ |
| Tenant ID claim type | `tenant_id` (default) |
| Webhook (callback) URL | `https://app.smartconnects.com/api/webhooks/redsail` |
| Default logo (hosted URL) | _can provide on request — please confirm you need it added as a trusted source_ |
| Theme CSS (branding) | _can provide our brand colors in your Theme CSS template on request_ |

---

## 3. What we need from you (to start testing in FTR1 / PRV)

Per the guide, in test environments **Emporos sets up the gateway credentials for us**. To begin, we need:

1. **Test environment access** — please confirm which to use first (FTR1 or PRV) and that our integrator/OIDC setup above has been registered as a trusted client.
2. **Tenant ID (GUID)** for our test pharmacy/site.
3. **Site ID** and **Station ID** (Terminal) to use for the test site.
4. **Gateway / payment-processor credentials** for the test environment (GPI Merchant ID, Terminal ID, Username, Password) — set up on your side per the guide.
5. **Hosted "Link to Pay" API contract for the test environment** — the exact endpoint path(s) and request/response payload we should call to generate a hosted payment link, plus the **webhook event payload** you will POST back to our callback (event types, field names, and the OIDC client/scope you will use to authenticate to our webhook).
6. **Confirmation of the API base URL** for the chosen environment (we currently use the URLs in section 1; please confirm or correct).
7. **Tenant claim prefix** — confirm whether we should use a plain `tenant_id` claim or a prefixed value (e.g. `my-prefix:<GUID>`). We currently send a plain `tenant_id`.

Once we have the above, we will plug the values into the pharmacy's **RedSail Pay** configuration, run the connection verification, and execute test transactions using your published test cards (Visa `4012000033330026`, MasterCard `5121212121212124`, Discover `6510000000000810`, Amex `3760000000000002`, FSA Debit `4005100001234504` — any future expiry).

---

**Summary:** Our OIDC server, webhook receiver, environment wiring, and per-pharmacy configuration are built and live. The only blockers to testing are the **test-environment access, Tenant/Site/Station IDs, gateway credentials, and the hosted Link-to-Pay + webhook payload contract** listed in section 3. Please provide those (and your preferred secure channel for secrets) and we can begin FTR1/PRV testing immediately.
