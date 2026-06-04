**To:** Michael Clark, Product Manager — Emporos (RedSail Technologies, LLC)
**From:** SmartConnect RX
**Subject:** SmartConnect RX × Emporos Payments — our side is built, ready to start FTR1/PRV testing

---

Hi Michael,

Thanks again for your help getting us going on the Emporos Payments Domain integration. I'm writing to let you know that **we've completed our side of the build and are ready to begin testing in FTR1 (or PRV — your call on which to start with).** Below I've summarized what we've already stood up so your team can verify it, what we'll hand over to you, and the short list of items we need back from you to run our first test transactions.

Our production app lives at **https://app.smartconnects.com**.

## What we've already built (ready for your team to verify)

Everything below is live and follows the Payments Domain Integrator Guide:

**Integrator-operated OIDC server (Client Credentials).** We host the token service that issues the tokens we use to call your payment API, and that lets you mint tokens to call our webhook. All tokens are signed RS256, carry `aud` containing `payments-domain`, and include a `tenant_id` claim equal to the pharmacy's Tenant GUID.

- Discovery: `https://app.smartconnects.com/api/redsail/oidc/.well-known/openid-configuration`
- Token endpoint: `https://app.smartconnects.com/api/redsail/oidc/connect/token`
- JWKS (public keys): `https://app.smartconnects.com/api/redsail/oidc/jwks`
- Grant type: `client_credentials`; signing: RS256; audience: `payments-domain`; tenant claim: `tenant_id` (plain, no prefix)

**Webhook receiver (payment result callback).**

- URL: `https://app.smartconnects.com/api/webhooks/redsail`
- It validates the bearer token against our published JWKS, requires `aud` = `payments-domain`, and confirms the `tenant_id` matches the pharmacy. It's idempotent (duplicate deliveries are safely ignored) and automatically reconciles the order on a successful payment.

**Per-pharmacy/site configuration.** Our admin already stores and manages, per pharmacy: Environment (FTR1 / PRV / Production), Tenant ID (GUID), OIDC Client ID, OIDC Client Secret, Site ID, and Station ID, with a built-in "Verify connection" action. We have the environment base URLs wired (FTR1 `https://empftr1-payments-dev.emporos.io`, PRV `https://payments-prv.emporos.io`, PROD `https://payments.emporos.io`).

## What we'll provide to you

Our integrator name is **SmartConnect RX**. We'll supply the OIDC discovery/token/JWKS URLs above, our **OIDC Client ID**, and the **OIDC Client Secret** — just let me know your preferred secure channel for the secret and I'll send it that way rather than over email. We can also provide our **logo (hosted URL)** and **brand colors in your Theme CSS template** for the hosted payment UI whenever you need them; please confirm you'll add our logo URL as a trusted source.

## What we need from you to start testing

I understand that in the test environments your team sets up the gateway credentials for us. To get going we need:

1. Confirmation of which environment to start in (FTR1 or PRV) and that our integrator/OIDC setup above has been registered as a trusted client.
2. The **Tenant ID (GUID)** for our test pharmacy/site.
3. The **Site ID** and **Station/Terminal ID** for that test site.
4. The **gateway/payment-processor credentials** for the test environment (GPI Merchant ID, Terminal ID, Username, Password), set up on your side.
5. The **hosted "Link to Pay" API contract** for the test environment — the exact endpoint path(s) and request/response payload to generate a hosted payment link, plus the **webhook event payload** you'll POST back to our callback (event types, field names, and the OIDC client/scope you'll use to authenticate to our webhook).
6. Confirmation of the **API base URL** for the chosen environment (we currently use the URLs above).
7. Confirmation on the **tenant claim** — whether to send a plain `tenant_id` or a prefixed value (e.g. `my-prefix:<GUID>`). We currently send it plain.

Once we have those, we'll plug the values into the pharmacy's RedSail Pay configuration, run our connection verification, and execute test transactions using the test cards from the guide.

In short — our OIDC server, webhook receiver, environment wiring, and per-pharmacy configuration are done and live; the only thing standing between us and testing is the test-environment access plus the Tenant/Site/Station IDs, gateway credentials, and the Link-to-Pay + webhook payload contract above. Send those over (and let me know your secure channel for secrets) and we can begin right away.

Happy to hop on a quick call if that's easier. Thanks, Michael — looking forward to getting this across the line.

Best regards,

[Your name]
SmartConnect RX
[Phone] · [Email]
