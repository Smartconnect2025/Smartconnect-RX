# AIM Rx Portal — Complete System Specification

**Version:** 1.0  
**Date:** April 14, 2026  
**Platform:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · Authorize.Net · DigitalRx · EasyPost · SendGrid · Twilio

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Authentication](#2-user-roles--authentication)
3. [Database Schema](#3-database-schema)
4. [API Routes Reference](#4-api-routes-reference)
5. [Frontend Pages & Navigation](#5-frontend-pages--navigation)
6. [Prescription Lifecycle](#6-prescription-lifecycle)
7. [Payment System](#7-payment-system)
8. [Pharmacy Integration (DigitalRx)](#8-pharmacy-integration-digitalrx)
9. [Shipping & Tracking](#9-shipping--tracking)
10. [Notification System (Email & SMS)](#10-notification-system-email--sms)
11. [Environment Variables](#11-environment-variables)
12. [Critical Business Rules](#12-critical-business-rules)

---

## 1. System Overview

AIM Rx Portal is a healthcare/pharmacy management platform connecting **Providers** (doctors), **Patients**, **Pharmacies**, and **Admins**. The core flow:

```
Provider prescribes → Patient pays → System submits to pharmacy → Pharmacy fills → Ships to patient
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js App Router)        │
│  Provider Dashboard │ Patient Portal │ Admin Panel      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    API ROUTES (app/api/)                 │
│  /prescriptions  /payments  /admin  /webhooks  /cron    │
└──────┬────────┬───────┬────────┬────────┬───────────────┘
       │        │       │        │        │
  ┌────▼──┐ ┌──▼───┐ ┌─▼──┐ ┌──▼───┐ ┌──▼────┐
  │Supa-  │ │Auth- │ │Digi│ │Easy- │ │Send-  │
  │base   │ │Net   │ │talRx│ │Post  │ │Grid/  │
  │(DB)   │ │(Pay) │ │(Rx) │ │(Ship)│ │Twilio │
  └───────┘ └──────┘ └────┘ └──────┘ └───────┘
```

### Key File Structure

```
app/
├── (features)/
│   ├── admin/              # Admin pages
│   ├── prescriptions/      # Provider prescription wizard
│   ├── payment/            # Patient payment pages
│   ├── provider/           # Provider profile/settings
│   ├── intake/             # Patient intake forms
│   └── basic-emr/          # Electronic Medical Records
├── api/
│   ├── admin/              # Admin API endpoints
│   ├── auth/               # Authentication endpoints
│   ├── payments/           # Payment processing
│   ├── prescriptions/      # Prescription management
│   ├── webhook/            # DigitalRx webhook
│   ├── webhooks/           # AuthNet + EasyPost webhooks
│   └── cron/               # Scheduled jobs
core/
├── config/envConfig.ts     # Environment variable registry
├── database/schema/        # Drizzle ORM table definitions
├── supabase/               # Supabase client setup
├── auth/                   # Auth utilities & guards
├── routing/                # Route guard & config
└── services/               # SMS, email, admin alerts
```

---

## 2. User Roles & Authentication

### 2.1 Roles

| Role | DB Value | Access |
|------|----------|--------|
| Patient | `user` | Intake forms, payment pages, order tracking, dashboard |
| Provider | `provider` | Prescribe medications, manage patients, EMR, billing |
| Admin | `admin` | Full system access, pharmacy management, user management |
| Super Admin | `super_admin` | Everything admin can do + manage other admins |
| Pharmacy Admin | `pharmacy_admin` | Prescription queue, fulfillment, status updates |

### 2.2 Authentication Stack

- **Identity Provider:** Supabase Auth (email/password)
- **Session:** JWT stored in cookies, refreshed via middleware on every request
- **MFA:** Email-based verification codes (custom implementation)
  - Codes sent via SendGrid
  - 5 failed attempts → lockout period
  - Stored in `mfa_verification_attempts` table
- **Session Timeout:** 8-hour max session duration enforced via signed `session_started` cookie
- **Inactivity:** Client-side `InactivityTimer` component handles idle timeout

### 2.3 Middleware Flow

Every request passes through `core/supabase/middleware.ts`:
1. Refresh Supabase session (`supabase.auth.getUser()`)
2. Check MFA status — redirect to `/auth/mfa-verify` if incomplete
3. Check session age — force re-login after 8 hours
4. Route guard (`core/routing/route-guard.ts`) checks role against `protectedRoutes` config

### 2.4 Route Protection Config

```typescript
// core/routing/routes-config.ts
Admin routes:    /admin/**        → requires: admin, super_admin, pharmacy_admin
Provider routes: /provider/**     → requires: provider
                 /prescriptions/**→ requires: provider
                 /basic-emr/**    → requires: provider
Patient routes:  /dashboard       → requires: user
                 /catalog         → requires: user
                 /intake/**       → requires: user
```

### 2.5 API Route Protection

```typescript
// core/auth/api-guards.ts
requireAuthentication()        // Ensures valid session
requireRole('admin')           // Ensures specific role
requireRole(['admin', 'provider']) // Ensures one of multiple roles
```

### 2.6 Row-Level Security (RLS)

PostgreSQL RLS policies use helper functions:
- `is_admin(auth.uid())` — checks if user is admin
- `is_provider(auth.uid())` — checks if user is provider
- `is_own_patient_record(patient_id)` — checks if patient owns this record
- `provider_has_patient_access(patient_id)` — checks provider-patient mapping
- `is_pharmacy_admin(pharmacy_id)` — checks pharmacy admin assignment

---

## 3. Database Schema

### 3.1 `user_roles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint` | Primary key, identity |
| `user_id` | `uuid` | FK → `auth.users.id`, UNIQUE |
| `role` | `enum` | `'user'`, `'admin'`, `'provider'` |
| `is_demo` | `boolean` | Default: false |

### 3.2 `patients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `provider_id` | `uuid` | FK → `providers.id` (primary provider) |
| `first_name` | `varchar(255)` | |
| `last_name` | `varchar(255)` | |
| `date_of_birth` | `date` | Format: `YYYY-MM-DD` |
| `phone` | `varchar` | 10-digit stripped |
| `email` | `varchar` | |
| `physical_address` | `jsonb` | `{address_line1, address_line2, city, state, postal_code}` |
| `billing_address` | `jsonb` | Same structure |
| `data` | `jsonb` | Intake questionnaire data |
| `stripe_customer_id` | `text` | Legacy Stripe reference |
| `is_active` | `boolean` | Default: true |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

### 3.3 `providers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `group_id` | `uuid` | FK → `groups.id` |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `email` | `text` | |
| `phone_number` | `text` | |
| `npi_number` | `text` | UNIQUE, validated against NPI registry |
| `dea_number` | `text` | |
| `specialties` | `jsonb` | Array of specialties |
| `medical_licenses` | `jsonb` | License details per state |
| `practice_address` | `jsonb` | Clinic address |
| `payment_details` | `jsonb` | Provider payment info |
| `tier_level` | `text` | References pricing tier |
| `is_active` | `boolean` | |
| `is_verified` | `boolean` | Admin-verified status |

### 3.4 `pharmacies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `name` | `text` | Display name |
| `slug` | `text` | UNIQUE, URL-safe identifier |
| `npi` | `text` | Pharmacy NPI |
| `dea_number` | `text` | |
| `ncpdp_number` | `text` | |
| `contact_email` | `text` | |
| `notification_emails` | `text` | Comma-separated list |
| `phone` | `text` | |
| `address` | `text` | |
| `is_active` | `boolean` | |

### 3.5 `pharmacy_backends`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `pharmacy_id` | `uuid` | FK → `pharmacies.id` |
| `system_type` | `enum` | `DigitalRx`, `PioneerRx`, `QS1`, `Liberty`, `Custom`, `BestRx` |
| `api_url` | `text` | Backend API base URL |
| `api_key_encrypted` | `text` | Encrypted API key |
| `store_id` | `text` | Pharmacy store identifier |
| `location_id` | `text` | |

### 3.6 `pharmacy_medications`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `pharmacy_id` | `uuid` | FK → `pharmacies.id` |
| `name` | `text` | Drug name |
| `strength` | `text` | e.g. "10mg" |
| `form` | `text` | e.g. "Injectable", "Tablet", "Capsule" |
| `ndc` | `text` | National Drug Code |
| `retail_price_cents` | `integer` | Pharmacy's price in cents |
| `aimrx_site_pricing_cents` | `integer` | Patient-facing price in cents |
| `in_stock` | `boolean` | |
| `preparation_time_days` | `integer` | |

### 3.7 `prescriptions` ⭐ (Core Table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `prescriber_id` | `uuid` | FK → `auth.users.id` (provider) |
| `patient_id` | `uuid` | FK → `patients.id` |
| `encounter_id` | `uuid` | FK → `encounters.id` |
| `appointment_id` | `uuid` | FK → `appointments.id` |
| `medication` | `text` | Drug name |
| `dosage` | `text` | e.g. "10mg" |
| `dosage_amount` | `text` | e.g. "10" |
| `dosage_unit` | `text` | e.g. "mg" |
| `vial_size` | `text` | e.g. "5mL" |
| `form` | `text` | e.g. "Injectable" |
| `quantity` | `integer` | |
| `refills` | `integer` | Default: 0 |
| `sig` | `text` | Patient instructions |
| `dispense_as_written` | `boolean` | DAW flag |
| `pharmacy_notes` | `text` | Notes for pharmacy |
| **Refill Tracking** | | |
| `parent_prescription_id` | `uuid` | Self-reference for refills |
| `prescription_type` | `enum` | `'prescription'`, `'refill'` |
| `refill_frequency_days` | `integer` | |
| `next_refill_date` | `timestamp` | |
| `total_refills_to_date` | `integer` | |
| **Pricing** | | |
| `patient_price` | `numeric(10,2)` | Medication price |
| `profit_cents` | `integer` | Oversight & Monitoring Fee (cents) — **charged to patient** |
| `shipping_fee_cents` | `integer` | Shipping fee (cents) |
| `total_paid_cents` | `integer` | Total amount paid |
| **Multi-Pharmacy** | | |
| `medication_id` | `uuid` | FK → `pharmacy_medications.id` |
| `pharmacy_id` | `uuid` | FK → `pharmacies.id` |
| `backend_id` | `uuid` | FK → `pharmacy_backends.id` |
| `order_group_id` | `uuid` | Groups prescriptions submitted together |
| **Payment** | | |
| `payment_status` | `text` | `unpaid`, `pending`, `paid`, `failed`, `refunded` |
| `order_progress` | `text` | `payment_pending`, `payment_received`, `provider_approved`, `pharmacy_processing`, `shipped` |
| `payment_transaction_id` | `uuid` | FK → `payment_transactions.id` |
| `stripe_payment_intent_id` | `text` | Legacy Stripe reference |
| **DigitalRx** | | |
| `queue_id` | `text` | UNIQUE — ID from DigitalRx API |
| `rx_number` | `text` | UNIQUE — Rx number from DigitalRx |
| `status` | `text` | `submitted` → `packed` → `approved` → `picked_up` → `delivered` |
| `billing_status` | `text` | `billed`, `cash`, `pending` |
| `patient_copay` | `text` | e.g. "15.00" |
| `delivery_date` | `text` | From DigitalRx webhook |
| `lot_number` | `text` | Medication lot number |
| **Tracking** | | |
| `tracking_number` | `text` | Carrier tracking number |
| `fedex_status` | `text` | "In Transit", "Delivered", etc. |
| `estimated_delivery` | `timestamp` | |
| `easypost_tracker_id` | `text` | EasyPost tracker reference |
| `tracking_carrier` | `text` | "FedEx", "UPS", "USPS", "DHL" |
| `tracking_url` | `text` | Direct link to carrier tracking |
| `last_tracking_event_id` | `text` | Dedup for webhook events |
| `last_tracking_check` | `timestamp` | |
| **Shipping Address** | | |
| `has_custom_address` | `boolean` | Default: false |
| `custom_address` | `jsonb` | Override shipping address |
| **Documents** | | |
| `pdf_storage_path` | `text` | Path in storage bucket |
| `pdf_document_id` | `uuid` | FK → `patient_documents.id` |
| **Timestamps** | | |
| `submitted_at` | `timestamp` | Creation time |
| `updated_at` | `timestamp` | |
| `submitted_to_pharmacy_at` | `timestamp` | When sent to pharmacy |

### 3.8 `payment_transactions` ⭐

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `prescription_id` | `uuid` | FK → `prescriptions.id` (primary Rx) |
| `total_amount_cents` | `integer` | Sum of all fees |
| `consultation_fee_cents` | `integer` | Oversight/monitoring fee portion |
| `medication_cost_cents` | `integer` | Medication price portion |
| `shipping_fee_cents` | `integer` | Shipping fee portion |
| `patient_id` | `uuid` | FK → `patients.id` |
| `patient_email` | `text` | |
| `patient_phone` | `text` | |
| `patient_name` | `text` | |
| `provider_id` | `uuid` | FK → `providers.id` |
| `provider_name` | `text` | |
| `pharmacy_id` | `uuid` | FK → `pharmacies.id` |
| `pharmacy_name` | `text` | |
| `authnet_ref_id` | `text` | UNIQUE — 20-char max ref for Authorize.Net |
| `authnet_transaction_id` | `text` | Authorize.Net transaction ID |
| `authnet_authorization_code` | `text` | |
| `authnet_response_code` | `text` | |
| `authnet_response_reason` | `text` | |
| `payment_token` | `text` | UNIQUE — magic link token (32-byte hex) |
| `payment_link_url` | `text` | Full URL sent to patient |
| `payment_link_expires_at` | `timestamp` | Link expiration |
| `payment_link_used_at` | `timestamp` | When patient opened link |
| `card_last_four` | `text` | PCI compliant — last 4 only |
| `card_type` | `text` | Visa, Mastercard, etc. |
| `payment_status` | `text` | `pending`, `completed`, `declined`, `failed`, `cancelled`, `refunded`, `partially_refunded`, `expired` |
| `order_progress` | `text` | `payment_pending`, `payment_received`, `provider_approved`, `pharmacy_processing`, `shipped`, `ready_for_pickup`, `completed` |
| `delivery_method` | `text` | `pickup`, `delivery`, `shipping` |
| `tracking_number` | `text` | |
| `tracking_url` | `text` | |
| `description` | `text` | Human-readable order description |
| `refund_amount_cents` | `integer` | |
| `refunded_at` | `timestamp` | |
| `paid_at` | `timestamp` | From Authorize.Net |
| `webhook_received_at` | `timestamp` | |
| `webhook_payload` | `jsonb` | Raw webhook data |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |
| `completed_at` | `timestamp` | |

### 3.9 `encounters`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `patient_id` | `uuid` | FK → `patients.id` |
| `provider_id` | `uuid` | FK → `providers.id` |
| `status` | `enum` | `upcoming`, `completed`, `in_progress` |
| `business_type` | `enum` | `appointment_based`, `order_based`, etc. |
| `appointment_id` | `uuid` | FK → `appointments.id` |
| `order_id` | `uuid` | FK → `orders.id` |

### 3.10 `appointments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `provider_id` | `uuid` | FK → `providers.id` |
| `patient_id` | `uuid` | FK → `patients.id` |
| `datetime` | `timestamp` | Appointment time |
| `duration` | `integer` | Minutes |
| `type` | `text` | video, phone, in-person |
| `reason` | `text` | |

### 3.11 `groups`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `name` | `text` | Group/clinic name |
| `platform_manager_id` | `uuid` | FK → `platform_managers.id` |

### 3.12 `tiers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `tier_name` | `text` | e.g. "Gold", "Silver" |
| `tier_code` | `text` | |
| `discount_percentage` | `decimal` | Provider discount |

### 3.13 `system_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Who triggered the action |
| `user_email` | `text` | |
| `user_name` | `text` | |
| `action` | `text` | e.g. `PATIENT_STATUS_EMAIL_SENT`, `PATIENT_SMS_SENT` |
| `details` | `text` | Human-readable description |
| `status` | `text` | `success`, `error` |
| `error_message` | `text` | If status=error |
| `created_at` | `timestamp` | |

---

## 4. API Routes Reference

### 4.1 Authentication

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/api/auth/me` | Session | Get current user info |
| `POST` | `/api/auth/logout` | Session | Sign out |
| `POST` | `/api/auth/send-reset-email` | None | Send password reset email |
| `POST` | `/api/auth/mfa/send-code` | Session | Send MFA verification code |
| `POST` | `/api/auth/mfa/verify-code` | Session | Verify MFA code |

### 4.2 Prescriptions

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/prescriptions/submit` | Provider | Create new prescription(s) |
| `GET` | `/api/prescriptions/submission-groups` | Provider | Get grouped prescriptions |
| `POST` | `/api/prescriptions/status-batch` | Provider/Admin | Check multiple Rx statuses |
| `POST` | `/api/prescriptions/sync-tracking` | Admin | Trigger tracking sync for a Rx |
| `PATCH` | `/api/prescriptions/[id]/update` | Provider | Update Rx details |
| `PATCH` | `/api/prescriptions/[id]/update-address` | Provider/Admin | Update shipping address |
| `POST` | `/api/prescriptions/[id]/check-status` | Provider/Admin | Check DigitalRx status |
| `POST` | `/api/prescriptions/[id]/mark-paid` | Admin | Manually mark as paid |
| `POST` | `/api/prescriptions/[id]/submit-to-pharmacy` | Provider/Admin/Internal | Send Rx to pharmacy |
| `PATCH` | `/api/prescriptions/[id]/admin-override` | Admin | Override status/tracking |
| `GET/POST` | `/api/prescriptions/[id]/pdf` | Provider | Generate/get Rx PDF |

### 4.3 Payments

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/payments/generate-link` | Provider | Create payment link for patient |
| `GET` | `/api/payments/check-link/[prescriptionId]` | Provider | Check if link already exists |
| `DELETE` | `/api/payments/check-link/[prescriptionId]` | Provider | Cancel existing payment link |
| `GET` | `/api/payments/details/[token]` | None | Get payment page data (public) |
| `GET` | `/api/payments/status/[token]` | None | Get order tracking data (public) |
| `POST` | `/api/payments/get-hosted-token` | None | Get Authorize.Net hosted form token |
| `POST` | `/api/payments/charge-nonce` | Provider | Direct card charge via Accept.js nonce |
| `GET` | `/api/payments/authnet-config` | Provider | Get Accept.js client config |
| `POST` | `/api/payments/verify-and-complete` | None | Verify payment after hosted form redirect |
| `POST` | `/api/payments/refund-partial` | Admin | Issue partial refund |
| `POST` | `/api/payments/send-payment-email` | Internal | Send payment link email |
| `POST` | `/api/payments/send-confirmation-email` | Internal | Send payment confirmation email |
| `POST` | `/api/payments/send-status-email` | Internal | Send status update email |

### 4.4 Webhooks

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/webhook/digitalrx` | Secret/Basic Auth | DigitalRx status updates |
| `POST` | `/api/webhooks/authnet` | Signature | Authorize.Net payment events |
| `POST` | `/api/webhooks/easypost` | HMAC-SHA256 | EasyPost tracking updates |

### 4.5 Cron Jobs

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET/POST` | `/api/cron/digitalrx-reconcile` | Bearer token | Reconcile Rx statuses with DigitalRx |
| `GET/POST` | `/api/cron/tracking-sync` | Bearer token | Sync tracking for up to 50 active Rxs |

### 4.6 Admin

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET/POST` | `/api/admin/pharmacies` | Admin | List/create pharmacies |
| `PUT/DELETE` | `/api/admin/pharmacies/[id]` | Admin | Update/delete pharmacy |
| `GET/POST` | `/api/admin/medications` | Admin | List/create medications |
| `PATCH/DELETE` | `/api/admin/medications/[id]` | Admin | Update/delete medication |
| `POST` | `/api/admin/medications/bulk-upload` | Admin | CSV/JSON bulk upload |
| `GET` | `/api/admin/patients` | Admin | List all patients |
| `PATCH` | `/api/admin/patients/[id]` | Admin | Update patient |
| `GET` | `/api/admin/providers` | Admin | List providers |
| `PATCH` | `/api/admin/providers/[id]` | Admin | Update provider |
| `POST` | `/api/admin/providers/tier-assignment` | Admin | Assign pricing tier |
| `GET/POST` | `/api/admin/groups` | Admin | Manage clinic groups |
| `GET/POST` | `/api/admin/tiers` | Admin | Manage pricing tiers |
| `POST` | `/api/admin/reset-mfa` | Super Admin | Reset user MFA |
| `POST` | `/api/admin/invite-doctor` | Admin | Invite new provider |
| `GET` | `/api/admin/system-logs` | Admin | View system logs |
| `GET` | `/api/admin/api-health` | Admin | Check external API statuses |
| `POST` | `/api/admin/trigger-cron` | Admin | Manually trigger cron job |

### 4.7 Provider

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET/PUT` | `/api/provider/profile` | Provider | Get/update provider profile |
| `GET` | `/api/provider/pharmacy` | Provider | Get assigned pharmacy info |
| `GET` | `/api/provider/tier` | Provider | Get current pricing tier |
| `GET` | `/api/provider/verify-npi` | Provider | Validate NPI number |

### 4.8 Basic EMR

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/basic-emr/patients` | Provider | Create EMR patient |
| `GET/PATCH` | `/api/basic-emr/patients/[id]` | Provider | Get/update patient chart |
| `GET/POST` | `/api/basic-emr/patients/[id]/encounters` | Provider | List/create encounters |
| `GET/PATCH/DELETE` | `/api/basic-emr/encounters/[id]` | Provider | Manage encounter |
| `GET/POST` | `/api/basic-emr/orders` | Provider | Manage clinical orders |
| `GET/POST` | `/api/basic-emr/vitals` | Provider | Manage vital signs |
| `GET/POST` | `/api/basic-emr/conditions` | Provider | Manage conditions |
| `GET/POST` | `/api/basic-emr/medications` | Provider | Manage medication list |
| `GET/POST` | `/api/basic-emr/allergies` | Provider | Manage allergies |

---

## 5. Frontend Pages & Navigation

### 5.1 Public Pages (No Auth Required)

| Route | Purpose |
|-------|---------|
| `/` | Landing page (unauthenticated), role-based dashboard (authenticated) |
| `/auth/login` | Login |
| `/auth/register` | Register |
| `/auth/forgot-password` | Password recovery |
| `/auth/reset-password` | Reset password (with token) |
| `/auth/confirm` | Email confirmation handler |
| `/about` | About page |
| `/faqs` | FAQs |
| `/catalog-preview` | Public medication catalog |
| `/policies/privacy` | Privacy policy |
| `/policies/terms` | Terms of service |
| `/policies/refund` | Refund policy |
| `/policies/telemedicine-consent` | Telemedicine consent |
| `/payment/[token]` | Patient payment page (magic link) |
| `/payment/success/[token]` | Post-payment confirmation |
| `/payment/track/[token]` | Public order tracking (30s auto-refresh) |

### 5.2 Provider Pages

| Route | Purpose |
|-------|---------|
| `/prescriptions` | Prescription dashboard |
| `/prescriptions/new/step1` | Step 1: Select patient |
| `/prescriptions/new/step2` | Step 2: Select medication(s) & dosage |
| `/prescriptions/new/step3` | Step 3: Review & submit |
| `/prescriptions/new/step4` | Step 4: Collect payment |
| `/prescriptions/new/success` | Submission confirmation |
| `/provider/dashboard` | Provider home |
| `/provider/catalog` | Medication catalog & pricing |
| `/provider/profile` | Profile settings |
| `/provider/professional-info` | NPI, DEA, licenses |
| `/provider/practice-details` | Practice/clinic info |
| `/provider/availability` | Schedule management |
| `/provider/payment-billing` | Billing settings |
| `/refills` | Manage refills |
| `/settings/security` | MFA & password |

### 5.3 Patient Pages

| Route | Purpose |
|-------|---------|
| `/intake/patient-information` | Step 1: Personal info |
| `/intake/medical-history` | Step 2: Health history |
| `/intake/insurance` | Step 3: Insurance info |
| `/intake/consent` | Step 4: Consents |

### 5.4 Admin Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard (metrics) |
| `/admin/prescriptions` | Pharmacy fulfillment queue |
| `/admin/patients` | Patient management |
| `/admin/providers` | Provider management |
| `/admin/medications` | Medication inventory |
| `/admin/medication-catalog` | Catalog & pricing config |
| `/admin/categories` | Medication categories |
| `/admin/pharmacy-management` | Pharmacy management |
| `/admin/pharmacy-orders` | Cross-pharmacy order tracking |
| `/admin/pharmacy-reports` | Analytics & reporting |
| `/admin/groups` | Clinic group management |
| `/admin/tiers` | Pricing tier management |
| `/admin/tags` | System tagging |
| `/admin/super-admins` | Super admin management |
| `/admin/platform-managers` | Platform manager management |
| `/admin/api-logs` | System monitoring |
| `/admin/settings` | Global settings |

### 5.5 EMR Pages

| Route | Purpose |
|-------|---------|
| `/basic-emr` | EMR patient list |
| `/basic-emr/patients/new` | Add new patient |
| `/basic-emr/patients/[id]` | Patient chart |
| `/basic-emr/patients/[id]/edit` | Edit patient data |
| `/basic-emr/patients/[id]/encounters/[encounterId]` | Encounter detail |
| `/basic-emr/provider/review-orders` | Order review interface |

---

## 6. Prescription Lifecycle

### 6.1 Status Flow

```
                    ┌──────────────┐
                    │   Created    │  Step 3 submission
                    │  (pending    │
                    │   payment)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Payment    │  Patient pays or
                    │   Received   │  provider charges
                    └──────┬───────┘
                           │ (auto-submit to pharmacy)
                    ┌──────▼───────┐
                    │  Submitted   │  Sent to DigitalRx
                    │  to Pharmacy │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Packed     │  Pharmacy is filling
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Approved   │  Pharmacist verified
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Picked Up   │  Shipped / handed
                    │  (Shipped)   │  to carrier
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Delivered   │  Final state
                    └──────────────┘

                    ┌──────────────┐
                    │   Rejected   │  Pharmacy denied
                    └──────────────┘
```

### 6.2 Prescription Wizard (4 Steps)

**Step 1 — Patient Selection** (`/prescriptions/new/step1`)
- Search existing patients or create new one
- Optionally upload signed prescription PDF
- Data stored in session/context

**Step 2 — Medication Selection** (`/prescriptions/new/step2`)
- Browse pharmacy medication catalog (filtered by pharmacy)
- Enter dosage, quantity, refills, SIG instructions, pharmacy notes
- Add multiple medications to cart
- Each item shows price breakdown

**Step 3 — Review & Submit** (`/prescriptions/new/step3`)
- Review all patient info, shipping address, medications
- System generates `order_group_id` (UUID) for the batch
- Creates records in `prescriptions` table via `POST /api/prescriptions/submit`
- Auto-generates PDF for each prescription
- Status set to `pending_payment`
- Fee allocation: Oversight fee + shipping fee applied to FIRST item only; rest get $0

**Step 4 — Collect Payment** (`/prescriptions/new/step4`)
- Provider chooses: "Send Payment Link" or "Charge Now"
- Uses `BillPatientModal` component
- Prescriptions are NOT sent to pharmacy until payment succeeds

### 6.3 Group Prescriptions

Multiple medications prescribed in one session share the same `order_group_id`:

```
Prescription A: medication=$50, profit_cents=1500, shipping_fee_cents=2000
Prescription B: medication=$30, profit_cents=0,    shipping_fee_cents=0
Prescription C: medication=$25, profit_cents=0,    shipping_fee_cents=0
─────────────────────────────────────────────────────────────────────
Total:                    $105 + $15 oversight + $20 shipping = $140
```

One `payment_transaction` record covers ALL items. One payment link, one charge.

### 6.4 Total Price Calculation

```
Patient Total = SUM(patient_price) + SUM(shipping_fee_cents / 100) + SUM(profit_cents / 100)
```

Where:
- `patient_price` = medication cost (from `pharmacy_medications.aimrx_site_pricing_cents`)
- `profit_cents` = "Oversight & Monitoring Fee" — **IS charged to patient**
- `shipping_fee_cents` = shipping cost

---

## 7. Payment System

### 7.1 Payment Gateway: Authorize.Net

Two flows available:

#### Flow A: Patient-Initiated (Hosted Payment Page)

```
1. Provider clicks "Send Payment Link"
2. POST /api/payments/generate-link
   → Creates payment_transaction record
   → Generates payment_token (32-byte hex)
   → Sends email with link: /payment/{token}
3. Patient opens link
   → GET /api/payments/details/{token} (loads order details)
   → POST /api/payments/get-hosted-token (gets Authorize.Net formToken)
   → Authorize.Net Accept Hosted form displayed in iframe
4. Patient pays
   → Redirect to /payment/success/{token}
   → POST /api/payments/verify-and-complete
   → Queries Authorize.Net API to confirm capture
   → Updates DB: payment_status=completed, prescriptions→paid
   → Auto-submits each Rx to pharmacy
   → Sends confirmation email
```

#### Flow B: Provider Direct Charge (Accept.js)

```
1. Provider clicks "Charge Now" in BillPatientModal
2. GET /api/payments/authnet-config (loads Accept.js SDK)
3. Accept.js encrypts card data → returns opaqueData (nonce)
4. POST /api/payments/charge-nonce
   → Sends createTransactionRequest to Authorize.Net
   → On success: updates DB, marks all group Rxs as paid
   → Auto-submits each Rx to pharmacy
   → Sends confirmation email
```

#### Webhook Redundancy

```
POST /api/webhooks/authnet
  → Listens for: net.authorize.payment.authcapture.created
  → Verifies HMAC-SHA512 signature using AUTHNET_SIGNATURE_KEY
  → Updates payment_transaction if not already completed
  → Ensures no payment is missed even if patient closes browser
```

### 7.2 Payment Transaction Fields

```typescript
// Status values
payment_status: 'pending' | 'completed' | 'declined' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'expired'

// Progress values
order_progress: 'payment_pending' | 'payment_received' | 'provider_approved' | 'pharmacy_processing' | 'shipped' | 'ready_for_pickup' | 'completed'

// Delivery method
delivery_method: 'pickup' | 'delivery' | 'shipping'
```

### 7.3 Refunds

```
POST /api/payments/refund-partial
  → Admin only
  → Accepts: transaction_id, amount_cents, reason
  → Calls Authorize.Net refund API
  → Updates refund_amount_cents and refunded_at
  → Can partially refund individual items in a group (e.g., pharmacy rejection)
```

### 7.4 `generate-link` Route Logic

```
Input: prescriptionId OR prescriptionIds[]
1. Validate all Rxs belong to same patient/provider
2. Check none are already paid
3. Check for existing pending transaction (idempotent — resends email if found)
4. Calculate total: SUM(patient_price) + SUM(shipping_fee_cents/100) + SUM(profit_cents/100)
5. Create payment_transaction record
6. Set payment_transaction_id on all prescriptions
7. Generate payment_token, build URL
8. Send payment link email via SendGrid
9. Optionally send SMS via Twilio
```

---

## 8. Pharmacy Integration (DigitalRx)

### 8.1 Submission Flow

```
POST /api/prescriptions/[id]/submit-to-pharmacy
  1. Auth: provider/admin session OR x-internal-secret header
  2. Fetch prescription + patient + provider + pharmacy_medication
  3. Get pharmacy_backend config (API key, store_id, base URL)
  4. Set prescription status → "submitting_to_pharmacy"
  5. Build DigitalRx payload
  6. POST to {DIGITALRX_BASE_URL}/RxWebRequest
  7. On success: status → "submitted", store QueueID
  8. On failure: status → "submission_failed"
```

### 8.2 DigitalRx API Payload

```json
{
  "StoreID": "12345",
  "Patient": {
    "FirstName": "John",
    "LastName": "Smith",
    "DateOfBirth": "01/15/1990",
    "Sex": "M",
    "Address1": "123 Main St",
    "City": "Jackson",
    "State": "MS",
    "Zip": "39201",
    "Phone": "7693041830",
    "Email": "john@example.com"
  },
  "Doctor": {
    "FirstName": "Jane",
    "LastName": "Doe",
    "NPI": "1234567890",
    "DEA": "AD1234563",
    "Address1": "456 Medical Blvd",
    "Phone": "6015551234",
    "SignatureURL": "https://..."
  },
  "RxClaim": {
    "DrugName": "AIM-Testosterone Cypionate 200mg/mL",
    "Quantity": "1",
    "Refills": "0",
    "NDC": "12345-6789-01",
    "Instruction": "Inject 0.5mL intramuscularly once weekly",
    "Notes": "...",
    "DispenseAsWritten": false
  },
  "PDFFile": "base64-encoded-string..."
}
```

**Critical Rules:**
- Drug names MUST be prefixed with `"AIM-"` for DigitalRx
- DOB format: `MM/DD/YYYY` for DigitalRx (stored as `YYYY-MM-DD` in DB)
- Phone: stripped to 10 digits

### 8.3 DigitalRx Webhook

```
POST /api/webhook/digitalrx
  Auth: DIGITALRX_WEBHOOK_SECRET header OR Basic Auth
  
  Receives status updates from DigitalRx pharmacy system.
  
  Status Canonicalization:
    "submitted"  → "submitted"
    "packed"     → "packed"
    "approved"   → "approved"
    "picked up"  → "picked_up" (shipped)
    "delivered"  → "delivered"
    "billing"    → "submitted"
    "processing" → "packed"
    "rejected"   → "rejected"
    "cancelled"  → "rejected"
  
  On update:
    1. Canonicalize status
    2. Check status ordinal (never go backward)
    3. Update prescription.status
    4. If tracking_number arrives → call ensureTrackerRegistered (EasyPost)
    5. Send patient status email + SMS
```

### 8.4 Cron: DigitalRx Reconciliation

```
GET/POST /api/cron/digitalrx-reconcile
  Auth: Bearer INTERNAL_API_KEY
  
  Periodically queries DigitalRx for status updates on all
  submitted prescriptions to catch any missed webhooks.
```

---

## 9. Shipping & Tracking

### 9.1 Carrier Detection

```typescript
// core/services/easypost-helpers.ts
function detectCarrier(trackingNumber: string): string {
  FedEx:  12–22 digits OR 34 digits           → "FedExDefault"
  UPS:    starts with "1Z" + 16 alphanumeric   → "UPS"
  USPS:   starts with 94/93/92/91/70/23/13     → "USPS"
  DHL:    10–11 digits                          → "DHLExpress"
}
```

### 9.2 EasyPost Integration (Primary)

```
When tracking_number is set on a prescription:
  1. detectCarrier(tracking_number)
  2. Create EasyPost Tracker:
     POST https://api.easypost.com/v2/trackers
     { tracking_code, carrier }
  3. Store: easypost_tracker_id, tracking_carrier, tracking_url
  4. EasyPost sends webhook updates → /api/webhooks/easypost
```

### 9.3 Tracking Update Paths

**Path 1: EasyPost Webhook (Real-time)**
```
POST /api/webhooks/easypost
  Auth: HMAC-SHA256 signature in x-hmac-signature header
  Secret: EASYPOST_WEBHOOK_SECRET
  
  On event:
    1. Verify HMAC signature
    2. Extract status, carrier, ETA from event
    3. Dedup via last_tracking_event_id
    4. Update prescription fields:
       - fedex_status (carrier status text)
       - estimated_delivery
       - tracking_carrier
       - tracking_url
       - last_tracking_event_id
    5. If status=delivered → send delivered notification
    6. If status=unknown + no carrier → alertBadTrackingNumber()
```

**Path 2: Cron Sync (Batch, every N minutes)**
```
GET/POST /api/cron/tracking-sync
  Auth: Bearer INTERNAL_API_KEY
  
  1. Query prescriptions with tracking_number + not delivered (limit 50)
  2. For each: poll EasyPost tracker status
  3. Update DB fields
  4. Send notifications for status changes
```

**Path 3: On-Demand (Admin-triggered)**
```
POST /api/prescriptions/sync-tracking
  Auth: Admin session
  
  Triggered from admin prescription detail modal
  when Rx has tracking but is not yet delivered.
```

### 9.4 Tracking URLs by Carrier

```
FedEx:  https://www.fedex.com/fedextrack/?trknbr={trackingNumber}
UPS:    https://www.ups.com/track?tracknum={trackingNumber}
USPS:   https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}
DHL:    https://www.dhl.com/en/express/tracking.html?AWB={trackingNumber}
Default: https://parcelsapp.com/en/tracking/{trackingNumber}
```

### 9.5 Address Update

```
PATCH /api/prescriptions/[id]/update-address
  Auth: Provider/Admin
  
  Body: { address_line1, city, state, postal_code, ... , saveToPatient?: boolean }
  
  1. Sets has_custom_address=true
  2. Stores address in custom_address (jsonb)
  3. If saveToPatient=true → also updates patients.physical_address
  4. Sends pharmacy notification email to:
     - PHARMACY_NOTIFICATION_EMAILS env var
     - pharmacy.contact_email
     - pharmacy.notification_emails
```

### 9.6 Bad Tracking Alert

```
If EasyPost returns status="unknown" with no recognized carrier:
  → alertBadTrackingNumber() sends admin email to ADMIN_ALERT_EMAIL
  → Logged as ADMIN_ALERT_BAD_TRACKING (24h dedup window)
```

---

## 10. Notification System (Email & SMS)

### 10.1 Email via SendGrid

All emails use SendGrid API. From address: `support@aimrx.com` (configurable).

| Email Type | Trigger | Route |
|------------|---------|-------|
| Payment Link | Provider sends bill | `/api/payments/send-payment-email` |
| Payment Confirmation | Successful payment | `/api/payments/send-confirmation-email` |
| Pharmacy Processing | DigitalRx status → submitted/packed/approved | `/api/payments/send-status-email` |
| Shipped | Status → picked_up | `/api/payments/send-status-email` |
| Delivered | Status → delivered | `/api/payments/send-status-email` |
| Ready for Pickup | Pharmacy signals pickup ready | `/api/payments/send-status-email` |
| Password Reset | User requests reset | `/api/auth/send-reset-email` |
| MFA Code | Login requires MFA | `/api/auth/mfa/send-code` |
| Provider Invite | Admin invites doctor | `/api/admin/invite-doctor` |
| Address Change | Shipping address updated | `/api/prescriptions/[id]/update-address` |
| Admin Alert | Bad tracking number | `core/services/admin-alerts.ts` |

### 10.2 Status Email Structure

```
POST /api/payments/send-status-email
  Auth: x-internal-api-key header
  
  Body: {
    patientEmail, patientName, patientPhone?,
    medication, providerName,
    statusType: "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup",
    trackingNumber?, trackingUrl?,
    pharmacyName?, pharmacyPhone?, pharmacyAddress?,
    prescriptionId?
  }
  
  Features:
  - HTML email with AIM branding, gradient header, progress steps
  - Plain text fallback
  - 60-minute dedup window (prevents duplicate sends)
  - Auto-sends SMS if Twilio configured + patient phone available
  - Logged to system_logs
```

### 10.3 Email Progress Steps

Each status email includes a visual progress indicator:

```
pharmacy_processing:
  ✓ Prescription Received
  ✓ Payment Confirmed
  ✓ Pharmacy Preparing Your Order  ← You are here
  ○ Shipped with Tracking
  ○ Delivered

shipped:
  ✓ Prescription Received
  ✓ Payment Confirmed
  ✓ Pharmacy Prepared
  ✓ Shipped with Tracking  ← You are here
  ○ Delivered

delivered:
  ✓ Prescription Received
  ✓ Payment Confirmed
  ✓ Pharmacy Prepared
  ✓ Shipped
  ✓ Delivered  ← You are here
```

### 10.4 SMS via Twilio

```typescript
// core/services/sms.ts

sendPaymentLinkSms(to, patientName, medication, amount, paymentUrl, providerName?)
  → "AIM Medical: Hi {name}, your prescription for {med} is ready. 
     Amount due: ${amount}. Pay securely here: {url}. 
     Questions? Call (769) 304-1830. Reply STOP to opt out."

sendStatusSms(to, patientName, medication, statusType, trackingNumber?)
  → pharmacy_processing: "...is being prepared by the pharmacy."
  → shipped: "...has shipped! Tracking: {number}"
  → delivered: "...has been delivered."
  → ready_for_pickup: "...is ready for pickup at the pharmacy."
```

Phone formatting: strips to digits → if 10 digits → `+1XXXXXXXXXX` (E.164)

### 10.5 Email Dedup

```typescript
checkEmailDedup(email, type, dedupKey, windowMinutes)
  → Checks system_logs for matching email+type+key within window
  → Returns { allowed: boolean, reason?: string }
  → Default window: 60 minutes
```

---

## 11. Environment Variables

### 11.1 Required

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |

### 11.2 Payment (Authorize.Net)

| Variable | Purpose |
|----------|---------|
| `AUTHNET_API_LOGIN_ID` | API Login ID |
| `AUTHNET_TRANSACTION_KEY` | Transaction key |
| `AUTHNET_SIGNATURE_KEY` | HMAC signature key (webhook verification) |
| `AUTHNET_PUBLIC_KEY` | Accept.js client-side key |
| `AUTHNET_ENVIRONMENT` | `sandbox` or `production` |

### 11.3 Email & SMS

| Variable | Purpose |
|----------|---------|
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender email (default: support@aimrx.com) |
| `SENDGRID_FROM_NAME` | Sender name (default: AIM RX Portal) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sending phone number |

### 11.4 Pharmacy & Shipping

| Variable | Purpose |
|----------|---------|
| `DIGITALRX_API_KEY` | DigitalRx API key |
| `NEXT_PUBLIC_DIGITALRX_BASE_URL` | DigitalRx API base URL |
| `DIGITALRX_WEBHOOK_SECRET` | Webhook auth secret |
| `EASYPOST_API_KEY` | EasyPost API key |
| `EASYPOST_WEBHOOK_SECRET` | EasyPost webhook HMAC secret |
| `FEDEX_API_KEY` | FedEx API key (legacy) |
| `FEDEX_API_SECRET` | FedEx API secret (legacy) |
| `FEDEX_ACCOUNT_NUMBER` | FedEx account number |
| `FEDEX_API_URL` | FedEx API URL |

### 11.5 Internal & Security

| Variable | Purpose |
|----------|---------|
| `INTERNAL_API_KEY` | Secure internal route calls (cron, email) |
| `INTERNAL_API_SECRET` | Service-to-service auth |
| `SESSION_SECRET` | Admin action verification (MFA reset) |
| `NEXT_PUBLIC_SITE_URL` | Base URL of the application |
| `PHARMACY_NOTIFICATION_EMAILS` | Admin emails for pharmacy notifications |
| `ADMIN_ALERT_EMAIL` | Alert recipient (default: joseph@smartconnects.com) |

### 11.6 Optional Integrations

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe (legacy payment method) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `DOSESPOT_CLINIC_ID` | DoseSpot e-prescribing |
| `DOSESPOT_CLINIC_KEY` | DoseSpot clinic key |
| `DOSESPOT_SUBSCRIPTION_KEY` | DoseSpot subscription |
| `DOSESPOT_BASE_URL` | DoseSpot API URL |
| `KLAVIYO_API_KEY` | Klaviyo CRM |
| `JUNCTION_API_KEY` | Junction Health / Vital |
| `DATABASE_URL` | Direct database connection (Drizzle migrations) |

---

## 12. Critical Business Rules

### 12.1 Payment Rules

1. **Prescriptions are NEVER sent to pharmacy before payment is confirmed.** The system auto-submits only after `verify-and-complete` or `charge-nonce` succeeds.
2. **One payment covers ALL grouped prescriptions.** When multiple Rxs share the same `order_group_id`, one `payment_transaction` handles the total.
3. **Total = SUM(patient_price) + SUM(profit_cents/100) + SUM(shipping_fee_cents/100).** All three fee types are charged to the patient.
4. **`profit_cents` is labeled "Oversight & Monitoring Fee"** in patient-facing UI but is stored as `profit_cents` in the database and `consultation_fee_cents` in payment_transactions.
5. **Oversight fee and shipping fee are applied to the FIRST item only** in a group to avoid double-charging.
6. **Payment links are idempotent.** Calling `generate-link` again for the same group resends the email rather than creating a duplicate transaction.

### 12.2 Data Format Rules

1. **DOB:** Store as `YYYY-MM-DD` in database. Format as `MM/DD/YYYY` for DigitalRx API calls.
2. **Phone:** Strip to 10 digits for storage. Format as `+1XXXXXXXXXX` for Twilio (E.164).
3. **Drug names:** Must be prefixed with `"AIM-"` when submitting to DigitalRx.
4. **Prices:** Stored in cents (`integer`) for `profit_cents`, `shipping_fee_cents`, `total_paid_cents`. Stored as `numeric(10,2)` for `patient_price`.
5. **Authorize.Net ref IDs:** Max 20 characters.

### 12.3 Status Rules

1. **Status transitions are one-directional.** The DigitalRx webhook enforces ordinal comparison — status can never go backward.
2. **`status` field (DigitalRx lifecycle):** `submitted` → `packed` → `approved` → `picked_up` → `delivered`
3. **`order_progress` field (patient-facing):** `payment_pending` → `payment_received` → `provider_approved` → `pharmacy_processing` → `shipped` → `completed`
4. **`payment_status` field:** `unpaid` → `pending` → `paid` (or `failed`/`refunded`)

### 12.4 Notification Rules

1. **60-minute dedup window** on all status emails to prevent spam.
2. **SMS is only sent if Twilio is configured** (all 3 env vars present).
3. **All notifications are logged** to `system_logs` table with action codes.
4. **Bad tracking numbers** trigger admin alerts with 24-hour dedup.

### 12.5 Admin Prescriptions Table

The admin prescription queue (`/admin/prescriptions`) displays:

| Column | Source |
|--------|--------|
| Date | `prescriptions.submitted_at` |
| Provider | `providers.first_name + last_name` |
| Patient | `patients.first_name + last_name` |
| Medication | `prescriptions.medication` |
| Qty/Refills | `prescriptions.quantity` / `prescriptions.refills` |
| Price | `prescriptions.patient_price` |
| Pharmacy | `pharmacies.name` |
| SIG | `prescriptions.sig` |
| Status | `prescriptions.status` (color-coded badge) |

Features:
- 15-second auto-refresh
- Group color coding (same `order_group_id` → same highlight color)
- Row striping for readability
- Click row → detail modal with all prescription data
- Status badge colors: green=delivered, blue=submitted, purple=packed, amber=approved, indigo=shipped, red=rejected

### 12.6 Admin Filter

Only hides patients with last name "harton" from admin views.

### 12.7 Confirmation Email Content

Confirmation emails sent after payment MUST show ALL medications in the group with correct totals, including:
- Each medication name, dosage, quantity
- Individual medication prices
- Oversight & Monitoring Fee total
- Shipping Fee total
- Grand total

### 12.8 Support Contact

All patient-facing communications include:
- **Phone:** (769) 304-1830
- **Hours:** Mon–Fri 9AM–6PM CST
- **Email:** support@aimrx.com

---

## Appendix A: Progress Tracker Component (Patient-Facing)

The `PrescriptionProgressTracker` component shows 7 steps:

```
1. Order Created    (ClipboardList icon)
2. Payment          (CreditCard icon)      ← shows pending/paid badge
3. Sent to Pharmacy (Send icon)
4. Processing       (Package icon)
5. Approved         (ShieldCheck icon)
6. Shipped          (Truck icon)
7. Delivered        (PackageCheck icon)
```

Status mapping:
- `delivered`/`completed` → step 7
- `shipped`/`picked_up` → step 6
- `approved` → step 5
- `packed`/`processing`/`compounding` → step 4
- `submitted` (with payment) → step 3
- `payment_received`/`billed`/`paid` → step 2
- `billing`/`payment_pending` → step 1

When payment is pending, a warning banner shows:
> "Order will NOT be sent to the pharmacy until payment is received."

## Appendix B: Order Tracking Page (Patient-Facing)

The public tracking page (`/payment/track/[token]`) shows:

1. **Order Details Card:** Patient name, provider, pharmacy, medications list
2. **Progress Bar:** 5 stages (Payment Pending → Payment Received → Sent to Pharmacy → Pharmacy Processing → Shipped/Ready)
3. **Shipping Card:** Tracking number + clickable tracking link
4. **Timeline Info:** Expected 5–10 business days, 30-second auto-refresh notice
5. **Refund Display:** Shows refund amount and net charged if any items were refunded
6. **Per-item Status:** For groups, each medication shows individual status badge (Rejected items are highlighted red with refund info)

## Appendix C: Pharmacy Backend Systems

The system supports multiple pharmacy backend integrations:

| System | Enum Value | Status |
|--------|-----------|--------|
| DigitalRx | `DigitalRx` | Active (primary) |
| PioneerRx | `PioneerRx` | Available |
| QS1 | `QS1` | Available |
| Liberty | `Liberty` | Available |
| Custom | `Custom` | Available |
| BestRx | `BestRx` | Available |

Each pharmacy can have its own backend configuration stored in `pharmacy_backends` with encrypted API keys.
