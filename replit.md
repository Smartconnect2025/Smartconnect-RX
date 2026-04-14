# SmartConnect RX Monorepo

## Overview

SmartConnect RX is a pnpm workspace monorepo using TypeScript, designed to streamline prescription management, pharmacy integration, and payment processing. The primary application, SmartConnect RX, is a Next.js-based platform enabling robust prescription workflows, multi-pharmacy backend integration (DigitalRx, PioneerRx), and flexible payment gateway options (Authorize.Net, Stripe) configured per pharmacy. The system supports a tiered role hierarchy including platform administrators, pharmacy administrators, and providers, ensuring secure and scoped access to functionalities. The project aims to provide a scalable and customizable solution for pharmacies and healthcare providers.

## User Preferences

I prefer iterative development with clear, concise communication. Please ask before making major architectural changes or introducing new dependencies. Focus on delivering tested, functional code.

## System Architecture

The core application, SmartConnect RX, is built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, and ShadCN UI. Supabase is used for authentication and database management, integrated via `@supabase/ssr`, and Drizzle ORM for database interactions. Node.js v20 is the runtime environment.

**UI/UX Decisions:**
The application utilizes Tailwind CSS and ShadCN UI for a modern, responsive, and consistent user interface. Pharmacy-branded elements are dynamically applied to emails and certain UI components based on pharmacy configurations, including logos, primary colors, and names.

**Technical Implementations:**

*   **Authentication & Authorization:** Supabase handles user authentication. A custom middleware (`core/supabase/middleware.ts`) manages sessions, MFA status, and route access based on roles. A critical role mapping (`core/auth/auth-utils.ts`) distinguishes between "super\_admin" (platform-level) and "admin" (pharmacy-scoped) roles. MFA is implemented via SendGrid for email OTPs, with a development bypass. Row Level Security (RLS) is extensively used in Supabase, requiring server-side API routes (`createAdminClient()`) for sensitive data writes (e.g., provider profiles).
*   **Monorepo Structure:** The project is a pnpm workspace monorepo. It includes `aimrx-new` (the Next.js app), `artifacts` (deployable applications like `api-server` and `smartconnect-rx`), `lib` (shared libraries for API specs, generated clients, and database), and `scripts`.
*   **Pharmacy Backend Integration:** A `pharmacy-dispatcher.ts` routes prescription requests to the correct pharmacy system (DigitalRx or PioneerRx) based on per-pharmacy configurations stored in the `pharmacy_backends` table. Dedicated helper files (e.g., `digitalrx-helpers.ts`, `pioneerrx-helpers.ts`) manage API calls and status mappings for each system. Webhooks are implemented for real-time status updates from DigitalRx and PioneerRx.
*   **Payment Processing:** A dual-gateway payment system (Authorize.Net and Stripe) is implemented, allowing per-pharmacy configuration of credentials. Payments are processed directly through the pharmacy's merchant account, with fallbacks to system-level credentials. All sensitive credentials are encrypted at rest using AES-256-GCM. Post-payment flows include automatic prescription status updates, submission to the pharmacy backend, and branded confirmation emails.
*   **Role Hierarchy — 3 Layers (CRITICAL ARCHITECTURE):**
    1.  **Super Admin** (`admin` role in `user_roles` + NOT in `pharmacy_admins`): Full platform access. Can manage ALL pharmacies, ALL providers, ALL patients. Sees pharmacy dropdown when inviting providers. Can assign any provider to any pharmacy and any company.
    2.  **Pharmacy Admin** (`admin` role in `user_roles` + IS in `pharmacy_admins`): Scoped to their own pharmacy only. Can invite providers only to their pharmacy (pharmacy name shown as read-only, no dropdown). Can assign/change company names for their pharmacy's providers. Cannot see or manage other pharmacies' data.
    3.  **Provider** (`provider` role): Linked to a specific pharmacy via `provider_pharmacy_links`. Manages their own patients and prescriptions. Can see patients from other providers IF they share the same `company_name`.
    *   **Company-Based Patient Sharing:** Providers with the SAME `company_name` automatically share patient access via `provider_patient_mappings`. When a provider's company changes: (a) old non-owned patient mappings are removed, (b) new company's patients are granted. This logic works identically regardless of whether a super admin or pharmacy admin made the change.
    *   **Role Detection:** `user_roles.role = 'admin'` + NOT in `pharmacy_admins` table → super_admin; IS in `pharmacy_admins` → pharmacy admin. The `/api/admin/scope` endpoint returns `isSuperAdmin`, `isPharmacyAdmin`, `pharmacyId`, and `pharmacyName`.
    *   **API Guards:** All admin routes use `requireAnyAdmin()` or `requireSuperAdmin()`. Pharmacy admin routes additionally check `provider_pharmacy_links` to ensure the provider belongs to their pharmacy before allowing edits.
*   **API Architecture:** An `api-server` (Express) acts as a proxy, forwarding all `/api/` traffic to the Next.js application. OpenAPI 3.1 specifications are used with Orval for API client, Zod schema, and React Query hook generation, ensuring type-safe and consistent API interactions.
*   **Database:** PostgreSQL is used with Drizzle ORM for type-safe database access. Zod is integrated with Drizzle for schema validation.
*   **Deployment & Environment:** The application is configured to run on Replit, with specific fixes for CORS and MFA in development mode.

**Feature Specifications:**

*   **Multi-Order Cart System:** Providers can add multiple prescriptions to a cart in Step 2, review all items in Step 3, and submit them as a batch. Step 4 shows an itemized order summary with combined totals. A single payment covers all prescriptions — the `generate-link` API creates one `payment_transaction` and links all prescriptions via `payment_transaction_id`. On payment completion (Stripe webhook or verify-and-complete), all linked prescriptions are marked as paid and submitted to pharmacy. Session keys: `prescriptionCart` (CartItem[]), `prescriptionSharedFees` (SharedFees). Shared fees (shipping $25 default, oversight fees) are attached to the first prescription only.
*   **Prescription Workflow:** Supports creating, submitting, checking status, and managing prescriptions, integrated with pharmacy backends. The admin prescriptions page includes: group highlighting (5-color rotation for order_group_id), pricing section with single/group views, shipping address edit with "Save to Patient Record & Prescription" option, payment actions (Send Payment Link + Mark as Paid), manual status/tracking override section, and auto-tracking sync on modal open.
*   **Blueprint-Aligned API Routes:** `admin-override` (PATCH — manual status/tracking override with patient email notification), `sync-tracking` (POST — on-demand EasyPost tracking sync), `submission-groups` (GET — group mappings).
*   **DigitalRx Format Utilities:** `core/utils/digitalrx-format.ts` provides `formatPhoneForDigitalRx()` (strips to 10 digits) and `formatDobForDigitalRx()` (ensures YYYY-MM-DD). Drug names prefixed with "AIM-" per blueprint.
*   **Catalog Management:** Pharmacy-specific catalogs of medications and categories are managed, including image uploads and bulk import capabilities (e.g., Westside Compounding data import).
*   **Admin Panels:** Dedicated UI for platform admins (managing pharmacies, users, integrations) and pharmacy admins (managing their pharmacy's settings, payments, providers).
*   **Reporting:** Basic reporting functionalities for both platform and pharmacy levels.

## External Dependencies

*   **Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth
*   **ORM:** Drizzle ORM
*   **Styling:** Tailwind CSS, ShadCN UI
*   **Email Service:** SendGrid (for MFA OTPs and branded emails)
*   **Shipping API:** EasyPost (for shipping rate calculations, currently test API)
*   **Pharmacy Integration:**
    *   DigitalRx API
    *   PioneerRx API (Enterprise API with HMAC-SHA512 authentication, RxEvents webhooks)
*   **Payment Gateways:**
    *   Stripe API (primary — used for both "Send Link" and "Charge Now" flows)
    *   Authorize.Net API (legacy fallback)
*   **API Specification:** OpenAPI 3.1
*   **API Client Generation:** Orval
*   **Validation:** Zod
*   **Version Control:** GitHub

## PioneerRx Simulation Mode

When `PIONEERRX_SIMULATION_MODE=true` is set (env var), all PioneerRx API calls are simulated locally instead of hitting the live API. This is used when PioneerRx hasn't whitelisted the server's IP address.

**Simulated methods:**
- `PatientSearch` → Returns fake patient ID
- `PatientAdd` → Returns fake patient ID
- `PrescriberSearch` → Returns fake prescriber ID
- `RxAddOnHold` → Returns fake queue ID (`SIM-TX-*`)
- `GetRxTransaction` → Returns "Verified" (approved) status

**To disable:** Remove or set `PIONEERRX_SIMULATION_MODE=false`. This is currently enabled in both development (Replit) and production (Render).

## Render Production Environment

**Render env vars (11 total):** `INTERNAL_API_KEY`, `INTERNAL_API_SECRET`, `DATABASE_URL`, `EASYPOST_TEST_API_KEY`, `SENDGRID_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `PIONEERRX_WEBHOOK_PASSWORD`, `PIONEERRX_WEBHOOK_USERNAME`, `PIONEERRX_SIMULATION_MODE`.

**Still missing on Render:** `ENCRYPTION_KEY` (DigitalRx credential decryption), `STRIPE_SECRET_KEY` (system-level Stripe secret), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (system-level Stripe publishable key), `STRIPE_WEBHOOK_SECRET` (Stripe webhook signature validation).

## Stripe Payment Flow

**"Send Link" flow:** `generate-link` → patient page → `create-stripe-session` → Stripe Checkout → `webhooks/stripe` → marks paid → submits to pharmacy.

**"Charge Now" flow (admin/provider direct charge):** BillPatientModal loads Stripe Elements → `createPaymentMethod` → `charge-stripe` API creates PaymentIntent server-side with `confirm: true` → marks paid → submits to pharmacy → sends confirmation email.

**Key files:**
- `/api/payments/charge-stripe/route.ts` — Server-side Stripe PaymentIntent creation + confirmation
- `/api/payments/create-stripe-session/route.ts` — Stripe Checkout Session for patient links
- `/api/webhooks/stripe/route.ts` — Handles checkout.session.completed, refunds, failures
- `/api/payments/pharmacy-gateway/route.ts` — Returns pharmacy gateway type + Stripe publishable key
- `components/billing/BillPatientModal.tsx` — Stripe Elements card form for "Charge Now"

**Per-pharmacy credentials:** Stored encrypted in `pharmacy_payment_configs` table. System-level fallback via `STRIPE_SECRET_KEY` env var.