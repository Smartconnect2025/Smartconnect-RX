# AimRX - Pharmacy Management Portal

## Overview
AimRX is a healthcare/pharmacy management application (AIM Rx Portal) built with Next.js 15. It enables providers to manage patients, write prescriptions, submit them to compounding pharmacies, and bill patients.

## Tech Stack
- **Framework**: Next.js 15.4.10, React 19, TypeScript
- **Styling**: Tailwind CSS v4, ShadCN UI (Radix UI)
- **Database**: Supabase (PostgreSQL) with Drizzle ORM
- **State Management**: Zustand
- **Forms**: React Hook Form with Zod validation
- **Auth**: Supabase Auth with role-based access control + custom MFA
- **Payments**: Stripe (keys not yet configured)
- **Email**: SendGrid (optional)
- **Rich Text**: TipTap editor
- **Charts**: Recharts
- **Deployment**: Render (aimrx-dev.onrender.com, aimrx.onrender.com)

## Project Structure
```
app/                    # Next.js App Router pages and API routes
  (features)/           # Protected feature routes
  api/                  # API routes
  auth/                 # Authentication pages
  intake/               # Patient intake form
core/                   # Core utilities and infrastructure
  auth/                 # Auth utilities, guards, MFA
  config/               # Environment config (envConfig.ts)
  database/             # Drizzle schema, migrations, seeds
  services/             # Business services
  supabase/             # Supabase client/server helpers
features/               # Self-contained feature modules
  admin-dashboard/      # Admin dashboard
  basic-emr/            # Patient management, encounters
  provider-dashboard/   # Provider-facing dashboard
components/             # Global reusable components
  ui/                   # ShadCN UI components
contexts/               # React contexts (PharmacyContext)
hooks/                  # Global custom hooks
```

## Environment Variables
**Required (configured):**
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

**Required for payments (not yet configured):**
- STRIPE_SECRET_KEY
- STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET

**Optional integrations:**
- SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- DIGITALRX_API_KEY, DIGITALRX_BASE_URL
- FEDEX_API_KEY, FEDEX_API_SECRET, FEDEX_ACCOUNT_NUMBER
- DOSESPOT_* keys
- DATABASE_URL (for Drizzle migrations)

## Deployment Workflow (Replit → Dev → Production)

### GitHub Branches
- **main** — development branch, watched by Render AimRX-dev
- **production** — production branch, watched by Render AimRx-prod

### Workflow
1. Fix code in Replit
2. Push to `main` branch on GitHub (GITHUB_TOKEN stored as secret)
3. Trigger Render Dev deploy via deploy hook (RENDER_DEV_DEPLOY_HOOK stored as secret)
4. Test on `aimrx-dev.onrender.com`
5. When approved, create pull request from `main` → `production` on GitHub
6. Merge pull request on GitHub → Render Prod auto-deploys to `app.aimrx.com`

### Render Services
- **AimRX-dev**: `aimrx-dev.onrender.com` — deploys from `main` branch
- **AimRx-prod**: `app.aimrx.com` — deploys from `production` branch
- Git credentials: `tomasg@topflightapps.com`

### Secrets for Deployment
- GITHUB_TOKEN — fine-grained token for Smartconnect2025/AimRX (Contents read/write)
- RENDER_DEV_DEPLOY_HOOK — Render deploy hook URL for AimRX-dev

## Key Commands
- `npm run dev` - Start development server (port 5000)
- `npm run build` - Build for production
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed the database

## Database Notes
- DATABASE_URL points to local Replit Postgres (empty, unused by app)
- SUPABASE_DATABASE_URL is the real Supabase connection string (use this for migrations/direct SQL)
- dea_number column added to providers table on Supabase via SUPABASE_DATABASE_URL

## Completed Fixes (Session March 2, 2026)
- H2: Patient sex hardcoded "M" → reads gender, maps male→M, female→F, unknown→U (case-insensitive)
- H3: DigitalRx payload alignment — full patient/doctor/drug fields, removed fake NPI fallback
- H4: Signature pad UX — smoother drawing, touch support, placeholder, resize handling
- DEA Number: Full feature — schema, type, UI (NPISection), form defaults/reset, service save, both prescription routes
- Security: Medications admin route — enforces admin/super_admin role check (was defaulting to platform admin)
- Security: Reset password route — no longer leaks password in response, added input validation, extended to super_admin

## Completed Features (Session March 3, 2026)
- Logo: Horizontal AIM logo (Vitruvian Man + AIM text) in all headers, 56px height
- Group Management Enhancement (Jerry's CRM request):
  - Providers table: Group column with assignment dialog, group filter dropdown
  - Groups page: Expandable rows showing assigned providers, add/remove providers
  - Provider quick-create form: Group dropdown alongside Tier Level
  - Dashboard: Group Performance section (provider count, orders, revenue per group)
  - New API: /api/admin/group-metrics for dashboard performance data
  - Role fix: admin endpoints accept both admin and super_admin roles
  - Provider API returns group_name and platform_manager_name
  - CSV export in Reporting already includes Group and Platform Manager columns
- Reporting & Analytics page redesign:
  - Interactive Recharts visualizations: revenue trend (area), order status (donut), top providers (bar), pharmacy comparison (bar)
  - Animated count-up KPI cards: total orders, revenue, avg order value, active providers, top medication
  - Tab interface: Overview (charts) | Details (tables)
  - Collapsible filters panel with Clear Filters button
  - Global view mode toggle (By Provider / Pharmacy Only) accessible from any tab
  - Polished status badges with dot indicators, alternating table row colors
  - Refresh + Export always accessible in header bar
  - Charts component: app/(features)/admin/pharmacy-reports/AnalyticsCharts.tsx

## Completed Features (Session March 4, 2026)
- Patient Medications Tab (features/basic-emr/components/MedicationsTab.tsx) — major upgrade:
  - KPI stat cards with animated counters (Active Rx, Active Meds, In Transit, Completed)
  - Dual data source: prescription orders from `prescriptions` table + manually added meds from `medications` table
  - Expandable prescription cards with status icons, color-coded status badges, dosage/form/date metadata
  - Click-to-expand detail panels with SIG instructions, quantity/refills, prescriber info, FedEx tracking links
  - Add/Edit medication modal integration (MedicationModal.tsx) for manually tracked medications
  - Search/filter across both prescription and medication data
  - Proper empty states vs search-no-results states
  - Responsive design, loading skeletons, alternating table row colors
  - Accessibility: aria-expanded, aria-controls, role="region" on accordion panels, focus-visible styles
  - Performance: supabase client memoized via useRef, fetch guard prevents concurrent requests

## Completed Features (Session March 6, 2026)
- Provider Product Catalog (`/provider/catalog`) — standalone browsable catalog for providers:
  - Beautiful hero header with gradient, product count, and in-stock count stats
  - Category cards with color-coded gradients and icons (Weight Loss/GLP-1, Peptides, Sexual Health, Traditional Rx, etc.)
  - Real-time search across name, category, strength, and form
  - Pharmacy filter pills (when multiple pharmacies available)
  - Sort options: A-Z, Price Low→High, Price High→Low
  - Grid/List view toggle
  - Product cards with: name, strength, form, vial size, pricing, category badge, pharmacy badge, stock status
  - Inline expandable details: NDC, prep time, description, dosage instructions
  - Tier discount badge showing provider's discount percentage
  - "Prescribe" button pre-fills prescription form and routes to Step 1
  - "Catalog" nav link added to ProviderHeader (between Dashboard and Prescriptions)
  - Protected by middleware — requires provider role
  - Files: app/(features)/provider/catalog/page.tsx, components/layout/ProviderHeader.tsx

## Completed Features (Session March 6, 2026 — continued)
- Categories Management Page (`/admin/categories`):
  - "Manage Categories" tab added to AdminNavigationTabs with LayoutGrid icon
  - Full CRUD: create, edit, delete categories with dialog forms
  - Auto-generated slugs from category names
  - Color picker and description fields
  - Category image upload/change/remove via /api/admin/upload (type=category)
  - Reorder categories with up/down arrow buttons (sequential API calls, optimistic UI)
  - Toggle active/inactive status per category
  - Per-pharmacy medication counts — expand any category to see how many meds each pharmacy has
  - Categories API enhanced: returns medication_count + pharmacy_counts[] per category (matched by category name from pharmacy_medications table)
  - Files: app/(features)/admin/categories/page.tsx, components/layout/AdminNavigationTabs.tsx, app/api/admin/categories/route.ts

## Remaining Issues (Priority Order)
### Critical
- DigitalRx webhook (app/api/webhook/digitalrx/route.ts) — no auth/signature validation
### High
- H5: Encryption fallback — generates key if ENCRYPTION_KEY missing instead of failing
- H6: Silent pharmacy failure — webhook error handling swallows errors
- H7: Mark-paid doesn't recalculate existing transaction totals
- H8: MFA brute force — no rate limiting on verification endpoint, 1-hour code expiry
### Medium
- Payment race condition — webhook + mark-paid can run simultaneously without locking
- Authorize.Net webhook signature bypass if AUTHNET_SIGNATURE_KEY not set
- Hardcoded credentials in seed routes
- Stack trace exposure in development mode responses
- EMR billing ownership check commented out

## Push Workflow
- Use /tmp/aimrx-push (shallow clone of GitHub repo) to push changes
- Copy changed files from workspace → /tmp/aimrx-push, commit, push
- Trigger deploy: curl "$RENDER_DEV_DEPLOY_HOOK"
- Always run `npx tsc --noEmit` before pushing to avoid failed builds on Render

## Notes
- Stripe keys removed from required env vars in core/config/envConfig.ts to allow app to start without them
- Next.js config updated with Replit dev origins for preview compatibility
- Workflow configured to run on port 5000
