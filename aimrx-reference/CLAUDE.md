# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

### Testing

No test framework is currently configured in this project.

## Architecture Overview

This is a Next.js 15 healthcare/pharmacy portal (AIM Rx Portal) built with a feature-first
architecture pattern. It enables providers to manage patients, write prescriptions, submit them to
compounding pharmacies (via DigitalRx), and bill patients (via Authorize.net).

### Tech Stack

- **Framework**: Next.js 15.4.10, React 19, TypeScript 5.9
- **Styling**: Tailwind CSS v4, ShadCN UI components (Radix UI)
- **Database**: Supabase (PostgreSQL) with Drizzle ORM for schema management
- **State Management**: Zustand for complex state
- **Forms**: React Hook Form with Zod validation
- **Authentication**: Supabase Auth with role-based access control + custom MFA (email codes)
- **Payments**: Authorize.net (Accept Hosted / hosted payment pages)
- **Pharmacy Integration**: DigitalRx API (prescription submission & status polling)
- **Email**: SendGrid for transactional emails (payment links, confirmations)
- **Rich Text**: TipTap editor (encounter notes)
- **Charts**: Recharts (dashboards)
- **Notifications**: Sonner (toast notifications)
- **Deployment**: Render (aimrx-dev.onrender.com, aimrx.onrender.com)

### Directory Structure

```
app/                    # Next.js App Router pages and API routes
  (features)/           # Protected feature routes (grouped route)
  admin/                # Admin-only utility pages
  api/                  # API routes
  auth/                 # Authentication pages (login, register, MFA, etc.)
  intake/               # Patient intake form (multi-step)
core/                   # Core utilities and shared infrastructure
  auth/                 # Auth utilities, guards, user provider, MFA
  config/               # Environment config
  constants/            # Enums, US states, timezones
  database/             # Drizzle schema, migrations, seeds
  integrations/         # Third-party integrations (Specode iframe tracking)
  routing/              # Role-based routing, route guards, route config
  security/             # Encryption utilities
  services/             # Business services (MFA, pricing, CRM, storage)
  supabase/             # Supabase client/server/middleware helpers
  utils/                # Shared utility functions
features/               # Self-contained feature modules
  admin-dashboard/      # Admin dashboard with pharmacy/provider management
  basic-emr/            # Patient management, encounters, medical records
  intake/               # Patient intake form logic
  notifications/        # Real-time notification system
  patient-dashboard/    # Patient-facing dashboard
  provider-availability/# Provider scheduling and availability
  provider-dashboard/   # Provider-facing dashboard
  provider-financial-dashboard/  # Provider financial reporting
  provider-profile/     # Provider profile management (NPI, license, signature)
  shared/               # Shared medical forms
components/             # Global reusable components
  ui/                   # ShadCN UI components
  layout/               # Layout components (headers, footer, DefaultLayout)
  billing/              # BillPatientModal (Authorize.net integration)
  prescriptions/        # PrescriptionPdfUpload
  stripe/               # StripeCardInput (legacy/unused)
contexts/               # React contexts (PharmacyContext)
hooks/                  # Global custom hooks
utils/                  # Utility functions (date, phone, tailwind)
scripts/                # Database scripts, seeding, admin utilities
```

### Feature Architecture

Each feature in `features/` follows a modular pattern:

- `index.ts` - Barrel exports (required)
- `components/` - Feature-specific components
- `hooks/` - Feature-specific hooks
- `services/` - Business logic and API calls
- `store/` - Zustand state management
- `types.ts` - Type definitions

### Database

- **Schema**: Drizzle ORM schemas in `core/database/schema/` (38 tables)
- **Key tables**: `prescriptions`, `patients`, `providers`, `pharmacies`, `pharmacy_backends`,
  `encounters`, `medication_catalog`, `pharmacy_medications`, `payment_transactions`,
  `provider_pharmacy_links`, `tiers`, `system_logs`, `mfa_codes`
- **Queries**: Use Supabase client for all CRUD operations (never raw Drizzle queries at runtime)
- **Types**: Import types from Drizzle schemas using `InferSelectModel`/`InferInsertModel`
- **Migrations**: Use Drizzle Kit for schema changes (`core/database/migrations/`)

### Key Application Flows

**Prescription Flow** (multi-step):
1. Step 1: Select patient (or create new)
2. Step 2: Enter medication details, pricing, oversight fees, select pharmacy
3. Step 3: Review and submit → saved with status `pending_payment`
4. Provider bills patient via Authorize.net payment link
5. Patient pays → webhook updates status to `payment_received`
6. Prescription submitted to pharmacy via DigitalRx API
7. Status polling tracks fulfillment (Billing → Approved → Processing → Shipped → Delivered)

**Payment Flow**:
- Provider clicks "Bill Patient" → generates Authorize.net hosted payment page URL
- Payment link emailed to patient via SendGrid
- Patient pays on hosted page → Authorize.net webhook notifies app
- App auto-submits prescription to pharmacy after successful payment

**Auth Flow**:
- Supabase Auth for email/password registration and login
- Custom email-based MFA (2FA) via `core/services/mfa/`
- Role-based access: `user` (patient), `provider` (doctor), `admin`, `super_admin`
- Middleware handles session refresh and CORS

### API Routes

```
/api/prescriptions/
  submit                          # POST - Create new prescription
  status-batch                    # POST - Batch status check from DigitalRx
  [id]/update                     # PATCH - Edit prescription (pending_payment only)
  [id]/mark-paid                  # POST - Manually mark as paid
  [id]/submit-to-pharmacy         # POST - Submit to DigitalRx
  [id]/check-status               # GET - Check single prescription status
  [id]/pdf                        # GET - Get signed PDF URL

/api/payments/
  generate-link                   # POST - Generate Authorize.net payment link
  check-link/[prescriptionId]     # GET - Check if payment link exists
  details/[token]                 # GET - Get payment details by token
  status/[token]                  # GET - Check payment status
  get-hosted-token                # POST - Get Authorize.net hosted page token
  send-payment-email              # POST - Send payment link via SendGrid
  send-confirmation-email         # POST - Send payment confirmation

/api/admin/                       # Admin-only endpoints (providers, pharmacies, medications, etc.)
/api/provider/                    # Provider endpoints (check-active, pharmacy, tier)
/api/patients/[id]/               # Patient endpoints (documents, payment-method)
/api/webhook/digitalrx            # DigitalRx status webhook
/api/webhooks/authnet             # Authorize.net payment webhook
/api/access-requests/             # Doctor/pharmacy access requests
```

### Authentication & Routing

- Role-based access control: `user`, `provider`, `admin`
- Route protection via middleware (`middleware.ts`) handles session refresh + CORS
- Role-based routing config in `core/routing/routes-config.ts`
- User context available via `useUser()` hook from `@core/auth`
- Provider active status checked before prescription creation

### Path Aliases (tsconfig)

```
@/*        → ./*
@core/*    → ./core/*
@features/* → ./features/*
@types/*   → ./types/*
```

### Styling & Components

- Tailwind CSS v4 with design tokens in `app/theme.css`
- ShadCN UI components in `components/ui/`
- Form components use React Hook Form + Zod validation
- Layout components: `DefaultLayout`, `RoleBasedHeader`, `AdminHeader`, `ProviderHeader`

### Development Patterns

1. **Feature First**: New functionality goes in `features/` directory
2. **Separation**: Keep Next.js routing (`app/`) separate from React logic (`features/`)
3. **Type Safety**: Use Drizzle-generated types throughout
4. **Clean Imports**: Use barrel files (`index.ts`) for feature exports
5. **Database**: Use Supabase for queries, Drizzle for schema/types only
6. **camelCase ↔ snake_case**: Frontend uses camelCase, DB/API uses snake_case. Map in API routes.
7. **Cents for money**: All monetary values stored in cents (e.g. `profit_cents`, `shipping_fee_cents`)

### Important rules to follow

- Never commit or push to git, unless specifically asked.
- Never run `npm run dev`. The user will run it if they need to.
- Never run `npm run build`. If you want to test your code, run `npm run lint`
- Never run database related commands, unless specifically asked. The user handles migrations.

## Development Commands

### Core Development

```bash
npm run lint           # Run ESLint + TypeScript type checking (tsc --noEmit)
npm run lint:eslint    # ESLint only
npm run lint:types     # TypeScript type checking only
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without modifying
```

### Database Management (Drizzle ORM)

Only update the schemas, the user will generate the migrations
