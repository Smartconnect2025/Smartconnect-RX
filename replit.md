# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## SmartConnect RX (Main Application)

**Location:** `/home/runner/workspace/aimrx-new/`
**Run command:** `cd /home/runner/workspace/aimrx-new && PORT=5000 npx next dev -p 5000 -H 0.0.0.0`

### Stack
- Next.js 15 with App Router (NOT Pages Router)
- React 19, TypeScript
- Tailwind CSS v4, ShadCN UI
- Supabase (auth + database) via `@supabase/ssr` (NOT `@supabase/auth-helpers`)
- Drizzle ORM
- Node.js v20

### TypeScript Path Aliases
- `@/*` = `./`
- `@core/*` = `./core/`
- `@features/*` = `./features/`

### Supabase Instance
- URL: `https://pxehuvreezdpiusgwbct.supabase.co` (project ref: `pxehuvreezdpiusgwbct`)
- Admin user ID: `c6e644ab-6ed4-4007-9184-7c27d5762ac6`

### Test Accounts
- Admin: `joseph+200@smartconnects.com` / `Admin123!`
- Provider: `joseph+201@smartconnects.com` / `Provider123!`

### Required Secrets
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (admin operations)
- `SESSION_SECRET` — random string for session signing
- `SENDGRID_API_KEY` — for MFA email codes (from noreply@aimrx.com)
- `EASYPOST_TEST_API_KEY` — shipping API

### Auth Pipeline
1. `middleware.ts` (root) → handles CORS preflight, then calls `updateSession()`
2. `core/supabase/middleware.ts` `updateSession()` → creates Supabase client from cookies, calls `supabase.auth.getUser()`, checks MFA status, checks route access
3. Route access defined in `core/routing/routes-config.ts` — admin routes need admin role, provider routes need provider role
4. Role fetched from `user_roles` table in database

### MFA Flow
- Email OTP via SendGrid from `noreply@aimrx.com`
- Codes stored in `mfa_codes` table, 10-minute expiry
- Attempts limited (locks after too many failures)
- **MFA is bypassed in development mode** (login page sets `totp_verified=true` cookie directly)

### Replit Environment Fixes Applied
1. **CORS**: Root `middleware.ts` allows `*.replit.dev`, `*.repl.co`, `*.replit.app` origins
2. **MFA bypass**: `app/auth/login/page.tsx` skips MFA in development mode
3. **allowedDevOrigins**: `next.config.ts` includes Replit domains (spock, riker, picard)

### Pharmacy Backend Integration (Multi-System Support)
- **Supported systems**: DigitalRx, PioneerRx (QS1, Liberty, BestRx, Custom defined in enum but not yet implemented)
- **Architecture**: `pharmacy_backends` table stores per-pharmacy credentials; `pharmacy-dispatcher.ts` auto-routes to correct system
- **Key files**:
  - `app/api/prescriptions/_shared/pharmacy-dispatcher.ts` — resolves which backend system a pharmacy uses
  - `app/api/prescriptions/_shared/digitalrx-helpers.ts` — DigitalRx API calls, status mapping
  - `app/api/prescriptions/_shared/pioneerrx-helpers.ts` — PioneerRx API calls (HMAC-SHA512 auth), status mapping, price check
  - `app/api/prescriptions/[id]/submit-to-pharmacy/route.ts` — submits paid Rx (dispatches to DigitalRx or PioneerRx)
  - `app/api/prescriptions/submit/route.ts` — creates Rx (pending payment)
  - `app/api/prescriptions/[id]/check-status/route.ts` — checks status from correct backend
  - `app/api/prescriptions/status-batch/route.ts` — batch status check (both systems)
  - `app/api/webhook/digitalrx/route.ts` — DigitalRx status webhooks
  - `app/api/webhook/pioneerrx/route.ts` — PioneerRx status webhooks
  - `app/api/admin/pioneer-test/route.ts` — test PioneerRx connection (admin only)
- **PioneerRx auth**: API key stored as `api_key|shared_secret` in `api_key_encrypted` field (pipe-separated)
- **PioneerRx signature**: SHA512 hash of (ISO timestamp + shared secret), UTF-16-LE encoded, base64 output
- **Admin UI**: Pharmacy management page has DigitalRx/PioneerRx selector with separate Shared Secret field for PioneerRx
- **Integration Settings**: `/admin/settings` page with DigitalRx and Pioneer RX tabs — shows API configs, webhook URLs, connection tests, and endpoint reference
  - `app/(features)/admin/settings/page.tsx` — tabbed integration settings UI
  - `app/api/admin/test-pioneer-connection/route.ts` — tests Pioneer RX API connectivity using `/api/v1/Test/IsAvailableWithAuth`

### Payment Processing (Dual Gateway: Authorize.Net + Stripe, Per-Pharmacy Config)
- **Architecture**: Per-pharmacy payment gateway configuration. Each pharmacy sets its own Stripe or Authorize.Net credentials; payments go directly to that pharmacy's merchant account. Falls back to system-level env var credentials if no pharmacy config exists.
- **Gateway values**: `authorizenet` (default) or `stripe`
- **Per-pharmacy config**:
  - `pharmacy_payment_configs` table: stores encrypted credentials per pharmacy+gateway (unique constraint), with `is_active` flag, `environment` (sandbox/production)
  - `payment_transactions.payment_config_id` FK links each transaction to the config used
  - `core/services/pharmacyPaymentConfigService.ts` — CRUD, encrypt/decrypt, mask helpers
  - `app/api/admin/pharmacy-payment-config/route.ts` — admin CRUD + test connection API (admin/pharmacy-admin only)
  - `app/api/payments/pharmacy-gateway/route.ts` — lightweight gateway detection for providers (any authenticated user)
  - `app/(features)/admin/pharmacy-payment-settings/page.tsx` — pharmacy admin UI for configuring payment credentials
- **Key payment files**:
  - `app/api/payments/generate-link/route.ts` — looks up pharmacy config, auto-selects gateway, stores `payment_config_id`
  - `app/api/payments/get-hosted-token/route.ts` — uses pharmacy's AuthNet credentials (falls back to env vars)
  - `app/api/payments/create-stripe-session/route.ts` — uses pharmacy's Stripe key (falls back to env vars)
  - `app/api/webhooks/authnet/route.ts` — tries all pharmacy signature keys + system key for verification
  - `app/api/webhooks/stripe/route.ts` — tries all pharmacy webhook secrets + system secret for verification
  - `components/billing/BillPatientModal.tsx` — auto-detects gateway from pharmacy config, shows badge
  - `app/api/payments/send-confirmation-email/route.ts` — branded emails with pharmacy name/logo
- **DB columns**: `payment_gateway`, `payment_config_id`, `authnet_ref_id`, `authnet_transaction_id`, `stripe_payment_intent_id`, `stripe_session_id`
- **Env vars (system fallback)**: `AUTHNET_API_LOGIN_ID`, `AUTHNET_TRANSACTION_KEY`, `AUTHNET_SIGNATURE_KEY`, `AUTHNET_ENVIRONMENT`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Encryption**: All pharmacy credentials encrypted at rest using AES-256-GCM (`core/security/encryption.ts`), requires `ENCRYPTION_KEY` env var
- **Post-payment flow**: Both webhooks auto-update prescription status → auto-submit to pharmacy → send branded confirmation email with pharmacy name/logo

### Critical Files (DO NOT modify without understanding the auth system)
- `core/supabase/middleware.ts` — session management
- `core/routing/routes-config.ts` — route access rules
- `core/config/envConfig.ts` — environment configuration

### Replit Routing Architecture
- Port 80 (main proxy) → api-server artifact (port 8080, kind="api") handles `/api/` paths
- smartconnect-rx artifact (kind="web") handles page routes
- api-server now proxies everything to Next.js port 5000

### GitHub Repository
- `https://github.com/Smartconnect2025/Smartconnect-RX` (main branch)

## Monorepo Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── aimrx-new/                 # SmartConnect RX Next.js app
├── artifacts/                 # Deployable applications
│   ├── api-server/            # Express proxy → Next.js port 5000
│   └── smartconnect-rx/       # Web artifact (page routing)
├── lib/                       # Shared libraries
│   ├── api-spec/              # OpenAPI spec + Orval codegen config
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod schemas from OpenAPI
│   └── db/                    # Drizzle ORM schema + DB connection
├── scripts/                   # Utility scripts
├── pnpm-workspace.yaml        # pnpm workspace
├── tsconfig.base.json         # Shared TS options
├── tsconfig.json              # Root TS project references
└── package.json               # Root package
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

HTTP proxy forwarding all traffic to Next.js at localhost:5000. Listens on port 8080.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run via `pnpm --filter @workspace/scripts run <script>`.
