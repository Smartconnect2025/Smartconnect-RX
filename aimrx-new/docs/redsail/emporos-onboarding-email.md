**To:** Michael Clark, Product Manager — Emporos (RedSail Technologies, LLC)
**From:** SmartConnect RX
**Subject:** SmartConnect RX × Emporos Payments — ready to start FTR1/PRV testing

---

Hi Michael,

Our side of the Emporos Payments Domain integration is built and live, and we're ready to start testing. Quick summary below.

**What we've built (live at https://app.smartconnects.com):**
- Integrator OIDC server (client_credentials, RS256, `aud` = `payments-domain`, `tenant_id` claim) — discovery: `/api/redsail/oidc/.well-known/openid-configuration`, token: `/api/redsail/oidc/connect/token`, JWKS: `/api/redsail/oidc/jwks`
- Webhook receiver: `/api/webhooks/redsail` (token-validated, tenant-isolated, idempotent)
- Per-pharmacy config for Environment, Tenant ID, Client ID/Secret, Site ID, Station ID

**What we'll provide you:** Integrator name SmartConnect RX, the OIDC URLs above, and the **OIDC Client ID + Secret we've generated** — tell me your preferred secure channel for the secret. Logo and brand CSS available on request.

**What we need from you to test (FTR1 or PRV — your call):**
1. Confirm our OIDC client is registered as trusted
2. Tenant ID (GUID)
3. Site ID + Station/Terminal ID
4. Gateway credentials (GPI Merchant ID, Terminal ID, Username, Password)
5. The Link-to-Pay API + webhook payload contract (endpoints, fields, event types)
6. Confirm the API base URL and whether `tenant_id` should be plain or prefixed

Once we have those we'll configure the pharmacy, verify the connection, and run test transactions. Happy to jump on a quick call if easier.

Best regards,

[Your name]
SmartConnect RX
[Phone] · [Email]
