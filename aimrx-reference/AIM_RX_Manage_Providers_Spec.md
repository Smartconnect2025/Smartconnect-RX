# AIM Rx — Manage Providers (Admin Panel) Spec

> Complete documentation of the admin provider management system as currently implemented.
> Covers: database schema (providers, tiers, access_requests), two admin pages, all API routes, invitation flow, access request lifecycle, NPI verification, password reset, delete cascade, tier system, company assignment, revalidation, and all modals.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Admin Pages — Two Separate Views](#3-admin-pages--two-separate-views)
4. [Page 1: Manage Doctors (`/admin/doctors`)](#4-page-1-manage-doctors-admindoctors)
5. [Page 2: Provider Management (`/admin/providers`)](#5-page-2-provider-management-adminproviders)
6. [Invite New Provider Flow](#6-invite-new-provider-flow)
7. [Access Request Lifecycle](#7-access-request-lifecycle)
8. [NPI Verification](#8-npi-verification)
9. [Edit Provider](#9-edit-provider)
10. [Activate / Deactivate Provider](#10-activate--deactivate-provider)
11. [Reset Password](#11-reset-password)
12. [Delete Provider](#12-delete-provider)
13. [Tier System](#13-tier-system)
14. [Company Assignment & Patient Sync](#14-company-assignment--patient-sync)
15. [Revalidate All Providers](#15-revalidate-all-providers)
16. [Toggle Demo Mode](#16-toggle-demo-mode)
17. [API Routes Reference](#17-api-routes-reference)
18. [File Reference](#18-file-reference)
19. [Flow Diagrams](#19-flow-diagrams)

---

## 1. System Overview

The admin provider management system lets AIM Rx administrators manage healthcare providers (doctors) on the platform. It spans **two admin pages** with overlapping but distinct functionality:

1. **`/admin/doctors`** — The primary, full-featured page (2733 lines). Two tabs: "Providers" (existing) and "Pending Approval" (access requests). Supports invite, edit, delete, reset password, activate/deactivate with NPI verification, and access request approval/rejection.

2. **`/admin/providers`** — A secondary page using the feature-component pattern (`ProvidersManagement`). Adds company filtering, company assignment modal, revalidation, demo toggle, and a provider detail view. Uses the same `/api/admin/providers` API.

Both pages share the same `providers` table and API routes.

---

## 2. Database Schema

### 2.1 Providers Table

**File:** `core/database/schema/providers.ts`

| Column                     | Type                              | Default       | Description                                                   |
|----------------------------|-----------------------------------|---------------|---------------------------------------------------------------|
| `id`                       | `uuid`                            | `defaultRandom()` | Primary key                                                |
| `user_id`                  | `uuid` (FK → auth.users, unique)  | —             | Links to Supabase auth user                                   |
| `group_id`                 | `uuid` (FK → groups, nullable)    | `null`        | Group assignment for multi-provider clinics                   |
| **Personal Information**   |                                   |               |                                                               |
| `first_name`               | `text`                            | `null`        | Provider's first name                                         |
| `last_name`                | `text`                            | `null`        | Provider's last name                                          |
| `date_of_birth`            | `date`                            | `null`        | DOB                                                           |
| `gender`                   | `provider_gender` enum            | `null`        | `male` or `female`                                            |
| `avatar_url`               | `text`                            | `null`        | Profile picture URL                                           |
| `signature_url`            | `text`                            | `null`        | Signature image as base64 data URL                            |
| **Contact Information**    |                                   |               |                                                               |
| `email`                    | `text`                            | `null`        | Email address                                                 |
| `phone_number`             | `text`                            | `null`        | Phone number                                                  |
| `company_name`             | `text`                            | `null`        | Clinic/company name — used for patient group syncing          |
| `email_verified`           | `timestamp with tz`               | `null`        | When email was verified                                       |
| `phone_verified`           | `timestamp with tz`               | `null`        | When phone was verified                                       |
| **Professional Info**      |                                   |               |                                                               |
| `npi_number`               | `text` (unique)                   | `null`        | National Provider Identifier (10 digits)                      |
| `dea_number`               | `text`                            | `null`        | DEA Registration Number                                       |
| `specialties`              | `jsonb`                           | `null`        | Array of specialty objects                                    |
| `medical_licenses`         | `jsonb`                           | `null`        | Array of `{ licenseNumber, state }` objects                   |
| `board_certifications`     | `jsonb`                           | `null`        | Array of certification objects                                |
| `education_training`       | `jsonb`                           | `null`        | Array of education objects                                    |
| `languages_spoken`         | `jsonb`                           | `null`        | Array of language objects                                     |
| `professional_associations`| `jsonb`                           | `null`        | Array of association objects                                  |
| `years_of_experience`      | `integer`                         | `null`        | Years in practice                                             |
| `professional_bio`         | `text`                            | `null`        | Bio text                                                      |
| **Practice Details**       |                                   |               |                                                               |
| `practice_type`            | `practice_type` enum              | `null`        | `solo`, `group`, `hospital`, `clinic`, `telehealth`           |
| `practice_address`         | `jsonb`                           | `null`        | Practice location address object                              |
| `services_offered`         | `jsonb`                           | `null`        | Array of service objects                                      |
| `insurance_plans_accepted` | `jsonb`                           | `null`        | Array of insurance objects                                    |
| `hospital_affiliations`    | `jsonb`                           | `null`        | Array of affiliation objects                                  |
| **Address Information**    |                                   |               |                                                               |
| `physical_address`         | `jsonb`                           | `null`        | `{ street, city, state, zipCode, country }`                   |
| `billing_address`          | `jsonb`                           | `null`        | `{ street, city, state, zipCode, country }`                   |
| **Payment/Billing**        |                                   |               |                                                               |
| `tax_id`                   | `text`                            | `null`        | Tax ID/EIN for provider payments                              |
| `payment_details`          | `jsonb`                           | `null`        | `{ bank_name, account_holder_name, account_number, routing_number, account_type, swift_code }` |
| `payment_method`           | `text`                            | `null`        | `bank_transfer`, `check`, `paypal`, `stripe`                  |
| `payment_schedule`         | `text`                            | `null`        | `monthly`, `bi-weekly`, `weekly`                              |
| `tier_level`               | `text`                            | `null`        | Tier code assigned by admin (e.g. `tier1`)                    |
| `default_shipping_fee`     | `integer`                         | `25`          | Default shipping fee in dollars                               |
| **Legacy Fields**          |                                   |               |                                                               |
| `specialty`                | `text`                            | `null`        | Primary specialty (backward compat)                           |
| `licensed_states`          | `text[]`                          | `null`        | Array of state codes                                          |
| `service_types`            | `text[]`                          | `null`        | Array of service type strings                                 |
| `insurance_plans`          | `text[]`                          | `null`        | Array of insurance plan strings                               |
| **Status**                 |                                   |               |                                                               |
| `is_active`                | `boolean`                         | `true`        | Whether provider can create prescriptions                     |
| `is_verified`              | `boolean`                         | `false`       | Email MFA verification status                                 |
| **Timestamps**             |                                   |               |                                                               |
| `created_at`               | `timestamp with tz`               | `now()`       | When record was created                                       |
| `updated_at`               | `timestamp with tz`               | `now()`       | Last update timestamp                                         |

**RLS Policies:**
- **SELECT:** Admin, own profile (`user_id = auth.uid()`), or any active provider
- **INSERT:** Admin or self-registration (`user_id = auth.uid()`)
- **UPDATE:** Admin or own profile
- **DELETE:** Admin only

### 2.2 Tiers Table

**File:** `core/database/schema/tiers.ts`

| Column                | Type                     | Default       | Description                                  |
|-----------------------|--------------------------|---------------|----------------------------------------------|
| `id`                  | `uuid`                   | `defaultRandom()` | Primary key                             |
| `tier_name`           | `text` (unique, not null)| —             | Display name (e.g. "Tier 1")                 |
| `tier_code`           | `text` (unique, not null)| —             | Lookup code (e.g. "tier1")                   |
| `discount_percentage` | `decimal(5,2)` (not null)| —             | Discount rate (e.g. 10.00, 15.50)            |
| `description`         | `text`                   | `null`        | Optional description                         |
| `created_at`          | `timestamp with tz`      | `now()`       | Created timestamp                            |
| `updated_at`          | `timestamp with tz`      | `now()`       | Updated timestamp                            |

**RLS:** SELECT → all authenticated; INSERT/UPDATE/DELETE → admin only.

### 2.3 Access Requests Table

Stored in `access_requests` table (no Drizzle schema file — created via migration).

| Column            | Type         | Description                                           |
|-------------------|--------------|-------------------------------------------------------|
| `id`              | `uuid`       | Primary key                                           |
| `type`            | `text`       | `'doctor'` or `'pharmacy'`                            |
| `status`          | `text`       | `'pending'`, `'approved'`, `'rejected'`               |
| `first_name`      | `text`       | Applicant's first name                                |
| `last_name`       | `text`       | Applicant's last name                                 |
| `email`           | `text`       | Applicant's email                                     |
| `phone`           | `text`       | Applicant's phone                                     |
| `form_data`       | `jsonb`      | Full form submission (NPI, license, specialty, etc.)   |
| `reviewed_by`     | `uuid`       | Admin who reviewed (set on approve/reject)            |
| `reviewed_at`     | `timestamp`  | When reviewed                                         |
| `rejection_reason`| `text`       | Reason for rejection (if rejected)                    |
| `created_at`      | `timestamp`  | When submitted                                        |

### 2.4 Related Tables

| Table              | Relevance                                             |
|--------------------|-------------------------------------------------------|
| `user_roles`       | Stores `{ user_id, role: 'provider', is_demo }`       |
| `auth.users`       | Supabase auth — created during invite                 |
| `provider_pharmacy_links` | Cleaned up on provider delete                  |
| `pharmacy_admins`  | Cleaned up on provider delete                         |
| `encounters`       | Cleaned up on provider delete                         |
| `patients`         | Cleaned up on provider delete                         |

---

## 3. Admin Pages — Two Separate Views

| Feature                     | `/admin/doctors`         | `/admin/providers`           |
|-----------------------------|--------------------------|------------------------------|
| **Component**               | `ManageDoctorsPage`      | `ProvidersManagement`        |
| **File size**               | 2733 lines               | 615 lines                    |
| **Tabs**                    | Providers + Pending      | Single view                  |
| **Invite provider**         | Yes (full form)          | Yes (via ProviderFormDialog) |
| **Edit provider**           | Yes (full modal)         | No (view-only detail)        |
| **Delete provider**         | Yes (hard delete)        | Deactivate only              |
| **Reset password**          | Yes                      | No                           |
| **Activate/Deactivate**     | Yes (with NPI check)     | No                           |
| **Access requests**         | Yes (Pending tab)        | No                           |
| **NPI verification**        | Yes (3 contexts)         | No                           |
| **Company assignment**      | Via edit modal            | Dedicated modal              |
| **Company filter**          | No                       | Yes (dropdown)               |
| **Revalidate all**          | No                       | Yes                          |
| **Toggle demo mode**        | No                       | Yes                          |
| **Status filter**           | Yes (All/Active/Inactive)| No (status column only)      |
| **Navigation**              | `AdminNavigationTabs`    | —                            |

---

## 4. Page 1: Manage Doctors (`/admin/doctors`)

**File:** `app/(features)/admin/doctors/page.tsx` (2733 lines)

### 4.1 Layout

- **Route:** `/admin/doctors`
- **Auth:** Admin only (checks `user_roles` table)
- **Navigation:** `AdminNavigationTabs` component at top
- **Header:** "Manage Providers" + "Invite New Provider" button (blue)
- **Tabs:** "Providers ({count})" and "Pending Approval ({count})"

### 4.2 Providers Tab

**Data source:** `GET /api/admin/providers`

**Filters:**
- Search input — filters by `first_name`, `last_name`, or `email`
- Status dropdown — All / Active / Inactive (with counts)

**Table columns:**

| Column         | Content                                              |
|----------------|------------------------------------------------------|
| Provider       | `Dr. {first_name} {last_name}` + "Added {date}"     |
| Contact        | Email + phone number                                 |
| Tier / Company | Tier badge (blue) + Company badge (indigo)           |
| Status         | Active (green) or Inactive (gray) badge              |
| Actions        | Edit, Reset Password, Activate/Deactivate, Delete    |

**Action buttons (per row):**

| Button  | Icon    | Color   | Action                                     |
|---------|---------|---------|---------------------------------------------|
| Edit    | `Edit`  | Blue    | Opens edit modal with fresh data            |
| Key     | `Key`   | Purple  | Opens reset password dialog                 |
| Power   | `Power` | Yellow/Green | Opens activation modal (with NPI check) |
| Trash   | `Trash2`| Red     | Opens delete confirmation dialog            |

### 4.3 Pending Approval Tab

**Data source:** `GET /api/access-requests?type=doctor&status=pending`

**Filters:**
- Search input — filters by `first_name`, `last_name`, or `email`
- Status dropdown — disabled (always "Pending")

**Table columns:**

| Column    | Content                                                |
|-----------|--------------------------------------------------------|
| Name      | `Dr. {first_name} {last_name}` + "Approved" badge     |
| Email     | Applicant email                                        |
| Phone     | Phone or "N/A"                                         |
| NPI Number| From `form_data.npiNumber` (mono font)                 |
| Submitted | Date formatted                                         |
| Actions   | View, Approve, Reject buttons                          |

**Action buttons (per row):**

| Button  | Color  | Action                                              |
|---------|--------|-----------------------------------------------------|
| View    | Blue   | Opens detail modal (auto-verifies NPI)              |
| Approve | Green  | Pre-fills invite form → opens invite modal          |
| Reject  | Red    | Opens rejection confirmation dialog                 |

---

## 5. Page 2: Provider Management (`/admin/providers`)

**File:** `app/(features)/admin/providers/page.tsx` → `features/admin-dashboard/components/ProvidersManagement.tsx` (615 lines)

### 5.1 Layout

- **Route:** `/admin/providers`
- **Wrapper:** Suspense boundary, renders `ProvidersManagement` feature component
- **Header:** "Provider Management" + "Revalidate All" button + "Add Provider" button

### 5.2 Filters

- Search input — filters by name, email, specialty, or company name
- Company dropdown — All Companies / No Company / {each company name}
- Refresh button

### 5.3 Table Columns

| Column    | Content                                                |
|-----------|--------------------------------------------------------|
| Provider  | Avatar + Name + Email + DEMO badge (if demo)          |
| Company   | Company badge (clickable → assign modal) or "+ Assign" |
| Contact   | Phone number or "No phone"                            |
| Tier Level| Tier badge or "Not set"                               |
| NPI Number| NPI in mono font or "Not provided"                    |
| Verified  | Green check "Verified" or gray X "Not Verified"       |
| Status    | Active / Inactive / Pending badge                     |
| Actions   | View, Toggle Demo, Deactivate                         |

**Action buttons:**

| Button      | Icon      | Action                                    |
|-------------|-----------|-------------------------------------------|
| Eye         | `Eye`     | Opens `ProviderDetailView` modal          |
| UserCog     | `UserCog` | Toggle demo mode on/off                   |
| Trash       | `Trash2`  | Opens deactivation confirmation           |

### 5.4 Status Logic

The API computes status based on profile completeness:

```typescript
const hasPaymentDetails = provider.payment_details && Object.keys(provider.payment_details).length > 0;
const hasPhysicalAddress = provider.physical_address && Object.keys(provider.physical_address).length > 0;
const hasBillingAddress = provider.billing_address && Object.keys(provider.billing_address).length > 0;
const profileComplete = hasPaymentDetails && hasPhysicalAddress && hasBillingAddress;

if (!profileComplete) status = "pending";
else if (provider.is_active) status = "active";
else status = "inactive";
```

---

## 6. Invite New Provider Flow

**Trigger:** "Invite New Provider" button → opens invite modal

**API:** `POST /api/admin/invite-doctor`

### 6.1 Invite Form Fields

| Field            | Required | Source                                    |
|------------------|----------|-------------------------------------------|
| First Name       | Yes      | Text input                                |
| Last Name        | Yes      | Text input                                |
| Email            | Yes      | Text input                                |
| Phone            | No       | Text input                                |
| Company Name     | Yes      | Select existing or type new               |
| Password         | Yes      | Manual entry or "Generate" button         |
| Tier Level       | Yes      | Dropdown from tiers table (default: first)|
| NPI Number       | No       | Text input (with verify button)           |
| Medical License  | No       | Text input                                |
| License State    | No       | Text input                                |
| Practice Address | No       | Text input                                |
| City             | No       | Text input                                |
| State            | No       | Text input                                |
| Zip Code         | No       | Text input                                |

### 6.2 Company Name Modes

The company field supports two modes:
- **"Select"** — dropdown of existing company names (extracted from all providers)
- **"New"** — text input for a new company name

Toggle button switches between modes.

### 6.3 Password Generation

12-character random password with guaranteed:
- 1 uppercase letter
- 1 lowercase letter
- 1 number
- 1 symbol (`!@#$%^&*`)
- Shuffled for randomness

### 6.4 API Route: `POST /api/admin/invite-doctor`

**File:** `app/api/admin/invite-doctor/route.ts` (266 lines)

**Steps executed in order:**

1. **Auth check** — requires admin or super_admin role
2. **Validate** — firstName, lastName, email, password required
3. **Create auth user** — `supabaseAdmin.auth.admin.createUser()` with `email_confirm: true`
   - Detects duplicate users by error code/status/message
4. **Create user_roles record** — inserts `{ user_id, role: 'provider' }`
   - On failure: deletes auth user (cleanup)
5. **Create providers record** — inserts with `is_active: false` (pending profile completion)
   - Includes: name, email, phone, NPI, medical licenses, company, addresses
   - On failure: deletes user_roles + auth user (cleanup)
6. **Set tier level** — updates `providers.tier_level` if tier was specified
7. **Sync company patients** — calls RPC `sync_provider_to_group_patients` (non-fatal on error)
8. **Send welcome email** — via SendGrid with branded HTML template containing:
   - Login URL (`https://app.aimrx.com/auth/login`)
   - Email and temporary password
   - Next steps instructions (complete profile, change password)
   - Security notice about temporary password
   - Account activation notice (pending NPI/credential review)

### 6.5 Welcome Email Template

Branded HTML with gradient header (`#1E3A8A → #2563EB → #00AEEF`), AIM Rx logo, login credentials box, next steps list, security warning, and activation info.

**From:** `support@aimrx.com` / "AIM RX Portal"

---

## 7. Access Request Lifecycle

### 7.1 Submission (Public)

**API:** `POST /api/access-requests`

**File:** `app/api/access-requests/route.ts`

When a doctor submits an access request from the public site:

1. Request saved to `access_requests` table with `status: 'pending'`
2. **Admin notification email** sent to `support@aimrx.com` with all form data
3. **Applicant confirmation email** sent to the doctor — "Thank you for your interest, expect update in 24-48 hours"

**Form data stored in `form_data` JSONB:**
```typescript
{
  npiNumber, medicalLicense, licenseState, specialty,
  practiceName, practiceAddress, city, state, zipCode,
  yearsInPractice, patientsPerMonth, interestedIn,
  hearAboutUs, additionalInfo, companyName
}
```

### 7.2 Admin Views Request

**API:** `GET /api/access-requests?type=doctor&status=pending`

Returns all pending doctor access requests, ordered newest first.

### 7.3 View Details Modal

Clicking "View" on a pending request opens a detail modal showing:
- Personal Information (name, email, phone, company)
- Medical Credentials (NPI, license, state, specialty) — **NPI auto-verified on open**
- Practice Information (address, years in practice)
- Additional Information (patients/month, interests, how heard)
- Action buttons: Approve, Reject

### 7.4 Approve Flow

Clicking "Approve" on a pending request:

1. Row immediately gets green "Approved" badge (optimistic UI)
2. `approvingRequestId` stored for later
3. Auto-generates a 12-character secure password
4. Pre-fills the invite form with all data from the access request:
   - Name, email, phone, company, NPI, license, state, address fields
5. Opens the invite modal in "Approve Access Request" mode (green info banner)
6. Admin reviews, adjusts tier if needed, clicks "Invite Doctor"
7. Invite API creates auth user + provider record (same as normal invite)
8. After successful invite, `PATCH /api/access-requests/{id}` with `{ action: 'approve' }`
9. Access request status updated to `'approved'` with `reviewed_by` and `reviewed_at`
10. Switches to Providers tab to show newly created provider

### 7.5 Reject Flow

Clicking "Reject" opens confirmation dialog:

**API:** `PATCH /api/access-requests/{id}` with `{ action: 'reject' }`

Updates access request: `status: 'rejected'`, `reviewed_by`, `reviewed_at`, `rejection_reason: null`

Guard: Request must still be in `'pending'` status, otherwise returns error.

---

## 8. NPI Verification

**API:** `GET /api/admin/verify-npi?npi={number}`

**File:** `app/api/admin/verify-npi/route.ts` (85 lines)

### 8.1 How It Works

1. Validates NPI is exactly 10 digits
2. Calls the **CMS NPI Registry API** (server-side to avoid CORS)
3. If `result_count > 0`: returns `{ valid: true, providerName: "First Last" }`
4. If not found: checks test NPI list (`1111111111`) — accepts with `cmsVerified: false`
5. Otherwise: returns `{ valid: false, message: "NPI not found in CMS registry" }`

### 8.2 Three Verification Contexts

NPI verification is used in three places on `/admin/doctors`:

| Context                  | When                                              | State Variable           |
|--------------------------|----------------------------------------------------|--------------------------|
| Edit Modal               | Admin clicks "Verify NPI" in edit form             | `npiVerificationStatus`  |
| Activation Modal         | Auto-triggers when activating inactive provider    | `activationNpiStatus`    |
| Access Request Detail    | Auto-triggers when viewing request with NPI        | `accessRequestNpiStatus` |

### 8.3 Activation Guard

When activating a provider, the "Activate" button is **disabled** if:
- No NPI number on file
- NPI verification is in progress
- NPI verification returned invalid

Only providers with a valid NPI can be activated.

---

## 9. Edit Provider

**Trigger:** Edit button on Providers tab → opens edit modal

### 9.1 Data Fetch on Open

```typescript
const [providerResponse, tiersApiResponse] = await Promise.all([
  supabase.from("providers").select("*").eq("id", doctor.id).single(),
  fetch("/api/admin/providers"),
]);
```

Fetches fresh provider data + current tier assignment in parallel.

### 9.2 Editable Fields

| Field        | Editable | Notes                                       |
|--------------|----------|---------------------------------------------|
| First Name   | Yes      | Text input                                  |
| Last Name    | Yes      | Text input                                  |
| Email        | Read-only| Displayed but not editable                  |
| Phone        | Yes      | Text input                                  |
| Company Name | Yes      | Select existing or type new                 |
| Tier Level   | Yes      | Dropdown from tiers table                   |

### 9.3 Read-Only Sections in Edit Modal

- **NPI Number** — displayed with "Verify NPI" button
- **Medical Licenses** — list of `{ licenseNumber, state }` pairs
- **Physical Address** — formatted address block
- **Billing Address** — formatted address block + Tax ID

Note: "This information is managed by the provider and can only be updated by them through their profile."

### 9.4 Save Flow

Two API calls:

1. **Update provider record:**
   ```
   PATCH /api/admin/providers/{id}
   Body: { first_name, last_name, phone_number, company_name }
   ```

2. **Update tier assignment:**
   ```
   POST /api/admin/providers/tier-assignment
   Body: { providerId, tierCode }
   ```

---

## 10. Activate / Deactivate Provider

**Trigger:** Power button on Providers tab

### 10.1 Deactivation (Active → Inactive)

Simple confirmation dialog:
- "Are you sure you want to deactivate Dr. X? They will not be able to create prescriptions while inactive."
- Confirm → updates `providers.is_active = false`

### 10.2 Activation (Inactive → Active)

NPI verification modal:
1. If provider has NPI on file → auto-verifies against CMS registry
2. Shows verification status:
   - **No NPI:** amber warning — "No NPI number on file. Provider should complete their profile first." (Activate button disabled)
   - **Verifying:** blue spinner — "Verifying NPI with CMS registry..."
   - **Valid:** green check — "Valid NPI - {provider name}" (Activate button enabled)
   - **Invalid:** red X — error message (Activate button disabled)
3. Confirm → updates `providers.is_active = true`

**API:** Direct Supabase update:
```typescript
supabase.from("providers").update({ is_active: !doctor.is_active }).eq("id", doctor.id);
```

---

## 11. Reset Password

**Trigger:** Key button on Providers tab → opens reset password dialog

### 11.1 Dialog

- Shows provider name in header
- Password input (toggleable visibility)
- "Generate" button → creates 12-char random password
- Minimum 6 characters enforced

### 11.2 API: `POST /api/admin/reset-provider-password`

**File:** `app/api/admin/reset-provider-password/route.ts` (97 lines)

1. Auth check — admin or super_admin required
2. Validates email and password (min 6 chars)
3. Finds provider by email → gets `user_id`
4. Calls `supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })`
5. Returns success message with provider name

---

## 12. Delete Provider

**Trigger:** Trash button on Providers tab → opens delete confirmation dialog

### 12.1 Dialog

"Are you sure you want to delete Dr. X? This action cannot be undone."

### 12.2 API: `DELETE /api/admin/delete-provider?email={email}`

**File:** `app/api/admin/delete-provider/route.ts` (118 lines)

**Cascade delete sequence:**

1. Find provider by email → get `id` and `user_id`
2. Verify auth user exists
3. Delete related records (tracks errors but continues):
   - `encounters` where `provider_id = providerId`
   - `patients` where `provider_id = providerId`
   - `provider_pharmacy_links` where `provider_id = userIdToDelete`
   - `pharmacy_admins` where `user_id = userIdToDelete`
   - `providers` where `user_id = userIdToDelete`
   - `user_roles` where `user_id = userIdToDelete`
4. Delete auth user: `supabaseAdmin.auth.admin.deleteUser(userIdToDelete)`

**Note:** This is a hard delete. The `/admin/providers` page uses soft-delete (deactivation) instead.

---

## 13. Tier System

### 13.1 How Tiers Work

- Each provider has a `tier_level` column storing a `tier_code` (e.g. "tier1")
- The `tiers` table maps codes to display names and discount percentages
- Discount percentage affects medication pricing for the provider's patients

### 13.2 API: `GET /api/admin/tiers`

Returns all tiers from the database, ordered by `created_at` desc.

### 13.3 API: `POST /api/admin/tiers`

Creates a new tier with validation:
- Required: `tierName`, `tierCode`, `discountPercentage`
- `tierCode` auto-lowercased and spaces removed
- Discount must be 0-100
- Unique constraint on `tier_name` and `tier_code`

### 13.4 API: `POST /api/admin/providers/tier-assignment`

Updates a provider's tier:
```typescript
supabase.from("providers").update({ tier_level: tierCode }).eq("id", providerId);
```

### 13.5 API: `GET /api/admin/providers/{id}/tier`

Fetches a specific provider's tier info. Accessible to both admins and the provider themselves. Returns:
```json
{
  "tier_level": "Tier 1 (10%)",
  "tier_code": "tier1",
  "tier_details": { ... full tier object }
}
```

### 13.6 Tier Display Format

In the providers list, tiers show as: `"Tier Name (discount%)"` — e.g. "Tier 1 (10%)"

---

## 14. Company Assignment & Patient Sync

### 14.1 Company Assignment

Providers are grouped by `company_name`. When a provider's company changes, the system syncs patient access.

### 14.2 On Company Change (via PATCH /api/admin/providers/{id})

```typescript
if (oldCompanyName !== newCompanyName) {
  // If leaving old company: remove shared patient access
  if (oldCompanyName) {
    await supabase.rpc("remove_non_owned_patient_mappings", { p_provider_id: id });
  }
  // If joining new company: grant access to company's patients
  if (newCompanyName) {
    await supabase.rpc("sync_provider_to_group_patients", { p_provider_id: id });
  }
}
```

### 14.3 RPCs Used

| RPC Name                          | Purpose                                                |
|-----------------------------------|--------------------------------------------------------|
| `remove_non_owned_patient_mappings` | Removes patient access that came from the old company |
| `sync_provider_to_group_patients`   | Grants access to all patients belonging to the new company |

### 14.4 Company Assignment Modal (`/admin/providers`)

The ProvidersManagement page has a dedicated company assignment modal:
- Select from existing companies or type a new name
- "No Company (Unassigned)" option to remove assignment
- Uses the same `PATCH /api/admin/providers/{id}` endpoint

---

## 15. Revalidate All Providers

**Trigger:** "Revalidate All" button on `/admin/providers`

**API:** `POST /api/admin/providers/revalidate`

**File:** `app/api/admin/providers/revalidate/route.ts` (116 lines)

### 15.1 What It Does

Iterates through ALL providers and updates `is_verified` and `is_active` based on profile completeness:

```typescript
const isComplete = !!(hasPhysicalAddress && hasBillingAddress && hasBasicInfo);

// hasPhysicalAddress: street + city + state + (zipCode or zip) all non-empty
// hasBillingAddress: street + city + state + (zipCode or zip) all non-empty
// hasBasicInfo: first_name + last_name + date_of_birth + phone_number all non-empty

if (provider.is_verified !== isComplete || provider.is_active !== isComplete) {
  update({ is_verified: isComplete, is_active: isComplete });
}
```

### 15.2 Response

```json
{
  "success": true,
  "message": "Revalidation complete. 3 provider(s) updated.",
  "stats": {
    "total": 15,
    "updated": 3,
    "activated": 2,
    "deactivated": 1
  }
}
```

---

## 16. Toggle Demo Mode

**Page:** `/admin/providers` only

**Trigger:** UserCog button per provider row

**API:** `PATCH /api/admin/users/{userId}/demo` with `{ is_demo: true/false }`

Updates the `is_demo` column in `user_roles` table. Demo providers:
- Show an amber "DEMO" badge next to their name
- Are subject to `requireNonDemo()` API guard — prevents destructive operations
- The `useDemoGuard()` hook blocks UI actions with a toast message

---

## 17. API Routes Reference

| Route                                          | Method | Auth     | Purpose                                           |
|------------------------------------------------|--------|----------|---------------------------------------------------|
| `GET /api/admin/providers`                     | GET    | Admin    | List all providers with tier + status              |
| `PATCH /api/admin/providers/{id}`              | PATCH  | Admin    | Update provider fields + company sync              |
| `POST /api/admin/providers/tier-assignment`    | POST   | Admin    | Set provider's tier_level                          |
| `GET /api/admin/providers/{id}/tier`           | GET    | Admin/Provider | Get provider's tier details                  |
| `POST /api/admin/providers/revalidate`         | POST   | Admin    | Bulk revalidate all provider statuses              |
| `POST /api/admin/invite-doctor`                | POST   | Admin    | Create auth user + provider + send welcome email   |
| `DELETE /api/admin/delete-provider?email=X`    | DELETE | Admin    | Hard delete provider + cascade                     |
| `POST /api/admin/reset-provider-password`      | POST   | Admin    | Reset provider's password via admin client          |
| `GET /api/admin/verify-npi?npi=X`              | GET    | Auth     | Verify NPI against CMS registry                    |
| `GET /api/admin/tiers`                         | GET    | Admin    | List all tiers                                     |
| `POST /api/admin/tiers`                        | POST   | Admin    | Create new tier                                    |
| `GET /api/access-requests?type=X&status=X`     | GET    | Admin    | List access requests with filters                  |
| `POST /api/access-requests`                    | POST   | Public   | Submit new access request + send emails            |
| `PATCH /api/access-requests/{id}`              | PATCH  | Admin    | Approve or reject access request                   |
| `PATCH /api/admin/users/{userId}/demo`         | PATCH  | Admin    | Toggle demo mode                                   |

---

## 18. File Reference

| File                                                          | Purpose                                                    |
|---------------------------------------------------------------|------------------------------------------------------------|
| `app/(features)/admin/doctors/page.tsx`                       | Main admin doctors page (2733 lines) — providers tab, pending tab, all modals |
| `app/(features)/admin/providers/page.tsx`                     | Thin wrapper → loads ProvidersManagement component          |
| `features/admin-dashboard/components/ProvidersManagement.tsx` | Provider Management feature component (615 lines) — table, company assign, demo toggle |
| `features/admin-dashboard/components/ProviderDetailView.tsx`  | Read-only provider detail view modal                        |
| `features/admin-dashboard/components/ProviderFormDialog.tsx`  | Add provider form dialog                                    |
| `features/admin-dashboard/components/BaseTableManagement.tsx` | Reusable table component                                    |
| `core/database/schema/providers.ts`                           | Providers table schema + RLS policies                       |
| `core/database/schema/tiers.ts`                               | Tiers table schema + RLS policies                           |
| `app/api/admin/providers/route.ts`                            | GET: list providers with tier info + computed status         |
| `app/api/admin/providers/[id]/route.ts`                       | PATCH: update provider + company patient sync               |
| `app/api/admin/providers/tier-assignment/route.ts`            | POST: update provider's tier_level                          |
| `app/api/admin/providers/[id]/tier/route.ts`                  | GET: fetch provider's tier details                          |
| `app/api/admin/providers/revalidate/route.ts`                 | POST: bulk revalidate all provider statuses                 |
| `app/api/admin/invite-doctor/route.ts`                        | POST: create auth user + provider + send email              |
| `app/api/admin/delete-provider/route.ts`                      | DELETE: cascade delete provider                             |
| `app/api/admin/reset-provider-password/route.ts`              | POST: reset password via admin client                       |
| `app/api/admin/verify-npi/route.ts`                           | GET: verify NPI against CMS registry                        |
| `app/api/admin/tiers/route.ts`                                | GET/POST: list and create tiers                             |
| `app/api/access-requests/route.ts`                            | GET/POST: list and submit access requests                   |
| `app/api/access-requests/[id]/route.ts`                       | PATCH: approve or reject access request                     |
| `components/layout/AdminNavigationTabs.tsx`                   | Shared admin navigation tabs component                      |

---

## 19. Flow Diagrams

### 19.1 Invite New Provider

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN CLICKS "INVITE NEW PROVIDER"            │
│                                                                  │
│  Opens invite modal with empty form                              │
│  ├─ Fetches tiers from GET /api/admin/tiers                     │
│  └─ Fetches existing companies from GET /api/admin/providers    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN FILLS FORM & SUBMITS                    │
│                                                                  │
│  POST /api/admin/invite-doctor                                   │
│  ├─ 1. Create auth user (supabase.auth.admin.createUser)        │
│  ├─ 2. Create user_roles record (role: 'provider')              │
│  ├─ 3. Create providers record (is_active: false)               │
│  ├─ 4. Set tier_level on providers table                        │
│  ├─ 5. RPC: sync_provider_to_group_patients (if company set)   │
│  └─ 6. Send welcome email via SendGrid                          │
│                                                                  │
│  Cleanup on failure:                                             │
│  ├─ Role insert fails → delete auth user                        │
│  └─ Provider insert fails → delete role + auth user             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER RECEIVES EMAIL                       │
│                                                                  │
│  Email contains:                                                 │
│  ├─ Login URL: https://app.aimrx.com/auth/login                │
│  ├─ Email + temporary password                                  │
│  ├─ Next steps: complete profile, change password               │
│  └─ Note: account inactive until NPI verification               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER COMPLETES PROFILE                    │
│                                                                  │
│  Provider logs in → Settings → Profile                          │
│  ├─ Fills physical address                                      │
│  ├─ Fills billing address                                       │
│  ├─ Enters NPI number, medical licenses                         │
│  └─ Adds payment details                                        │
│                                                                  │
│  Admin clicks "Revalidate All" or reviews manually              │
│  Admin clicks "Activate" → NPI verified → provider is_active    │
└─────────────────────────────────────────────────────────────────┘
```

### 19.2 Access Request → Approval

```
┌─────────────────────────────────────────────────────────────────┐
│              DOCTOR SUBMITS ACCESS REQUEST (PUBLIC)              │
│                                                                  │
│  POST /api/access-requests                                       │
│  ├─ Saves to access_requests table (status: 'pending')          │
│  ├─ Sends admin notification email to support@aimrx.com         │
│  └─ Sends applicant confirmation email                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN REVIEWS ON PENDING TAB                        │
│                                                                  │
│  GET /api/access-requests?type=doctor&status=pending             │
│  ├─ Admin clicks "View" → detail modal (NPI auto-verified)     │
│  ├─ Admin clicks "Approve" →                                    │
│  │   ├─ Green badge on row (optimistic)                         │
│  │   ├─ Auto-generates secure password                          │
│  │   ├─ Pre-fills invite form with request data                 │
│  │   └─ Opens invite modal in approval mode                     │
│  └─ Admin clicks "Reject" →                                     │
│      ├─ Confirmation dialog                                      │
│      └─ PATCH /api/access-requests/{id} action='reject'         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ (if approved)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN CONFIRMS INVITATION                           │
│                                                                  │
│  Same invite flow as normal (POST /api/admin/invite-doctor)      │
│  After success:                                                  │
│  ├─ PATCH /api/access-requests/{id} action='approve'            │
│  │   └─ Sets status='approved', reviewed_by, reviewed_at        │
│  ├─ Switches to Providers tab                                    │
│  └─ Reloads both provider list and access request list          │
└─────────────────────────────────────────────────────────────────┘
```

### 19.3 Provider Lifecycle States

```
                    ┌───────────────┐
                    │  Auth User    │
                    │  Created      │
                    │  (invite)     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  is_active:   │
                    │    false      │  ← Profile incomplete
                    │  status:      │
                    │   "pending"   │
                    └───────┬───────┘
                            │ Provider completes profile
                            ▼
                    ┌───────────────┐
                    │  Profile      │
                    │  Complete     │  ← Has addresses + basic info
                    │  status:      │
                    │  "inactive"   │
                    └───────┬───────┘
                            │ Admin verifies NPI + activates
                            ▼
                    ┌───────────────┐
                    │  is_active:   │
                    │    true       │  ← Can create prescriptions
                    │  status:      │
                    │   "active"    │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Admin can:    Admin can:    Admin can:
        Deactivate    Reset Pwd     Delete
        (is_active    (new pwd)     (cascade
         → false)                    delete)
```

---

*Generated from source code as of the current codebase state.*
