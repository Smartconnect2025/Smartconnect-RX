# AIM E-Prescribing Portal - System Architecture Documentation

**Version:** 1.0
**Date:** December 2025
**Status:** MVP Baseline
**Project:** AIM E-Prescribing Portal

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Overall System Design](#overall-system-design)
3. [Technology Stack](#technology-stack)
4. [System Components](#system-components)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Integration Architecture](#integration-architecture)
7. [API Management](#api-management)
8. [Security & Access Control](#security--access-control)
9. [Database Architecture](#database-architecture)
10. [Deployment & Hosting](#deployment--hosting)
11. [System Constraints & Assumptions](#system-constraints--assumptions)

---

## 1. Executive Summary

The AIM E-Prescribing Portal is a Next.js 15-based healthcare application that enables healthcare providers to electronically prescribe medications and track prescription fulfillment status. The system integrates with DigitalRX's prescription submission and status tracking APIs, providing real-time updates on prescription processing, billing, shipping, and delivery status.

**Key Capabilities:**
- Electronic prescription submission to pharmacy backend (DigitalRX)
- Real-time prescription status tracking
- Patient management and medical records
- Role-based access control (Providers, Pharmacy Admins, Super Admins)
- Multi-pharmacy support (Greenwich, CLOVERx, Experience Care)

---

## 2. Overall System Design

### 2.1 Architecture Pattern

The system follows a **feature-first, layered architecture** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (Next.js 15 App Router, React 19, Tailwind CSS v4)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  (Feature Modules, Business Logic, State Management)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API/Service Layer                         │
│  (Next.js API Routes, External API Integrations)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  (Supabase PostgreSQL, Drizzle ORM)                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 High-Level System Flow

```
Provider → Next.js Frontend → API Routes → DigitalRX API
                                    ↓
                            Supabase Database
                                    ↓
                        Real-time Subscriptions
                                    ↓
                          Status Updates (30s)
```

---

## 3. Technology Stack

### 3.1 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.4.5 | React framework with App Router |
| **React** | 19 | UI library |
| **TypeScript** | Latest | Type-safe development |
| **Tailwind CSS** | v4 | Utility-first styling |
| **ShadCN UI** | Latest | Component library (Radix UI primitives) |
| **React Hook Form** | Latest | Form state management |
| **Zod** | Latest | Schema validation |
| **Zustand** | Latest | Global state management |
| **Sonner** | Latest | Toast notifications |

### 3.2 Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js API Routes** | 15.4.5 | Server-side API endpoints |
| **Node.js** | 18+ | Runtime environment |
| **Supabase** | Latest | Backend-as-a-Service (Auth + Database) |
| **Drizzle ORM** | Latest | Type-safe database ORM |
| **PostgreSQL** | 15+ | Relational database |

### 3.3 External Services & APIs

| Service | Purpose | Integration Type |
|---------|---------|------------------|
| **DigitalRX API** | Prescription submission & status tracking | REST API |
| **Supabase Auth** | User authentication & authorization | SDK |
| **Supabase Realtime** | Live database subscriptions | WebSocket |
| **Stripe** | Payment processing | REST API + SDK |
| **Twilio** | SMS notifications | REST API |
| **SendGrid** | Email notifications | REST API |

### 3.4 Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript Compiler** - Type checking
- **Drizzle Kit** - Database migrations

---

## 4. System Components

### 4.1 Core Modules

#### 4.1.1 Authentication & Authorization (`core/auth`)
- Supabase Auth integration
- Role-based access control (RBAC)
- User context management via `useUser()` hook
- Session management

#### 4.1.2 Database Layer (`core/database`)
- Supabase client initialization
- Drizzle ORM schema definitions
- Type-safe database operations
- Migration management

#### 4.1.3 Routing & Middleware (`core/routing`)
- Protected route enforcement
- Role-based route access
- User type detection (provider, admin, pharmacy_admin)

### 4.2 Feature Modules

All features follow modular structure in `features/` directory:

```
features/
├── basic-emr/           # Patient management & medical records
├── prescriptions/       # E-prescribing workflows
├── telehealth/          # Video calling & appointments
├── product-catalog/     # Medications & supplements
├── vitals/             # Health data from wearables
├── labs/               # Lab test ordering & results
└── symptoms-tracking/   # Mood & symptom logging
```

Each feature module contains:
- `README.md` - Feature documentation
- `index.ts` - Barrel exports
- `components/` - UI components
- `hooks/` - React hooks
- `services/` - Business logic & API calls
- `store/` - Zustand state management
- `types.ts` - TypeScript definitions
- `utils.ts` - Helper functions

### 4.3 UI Components

#### Reusable Components (`components/ui/`)
ShadCN UI components built on Radix UI primitives:
- Forms, inputs, buttons, dialogs
- Tables, badges, cards
- Navigation, layouts

#### Layout Components (`components/layout/`)
- `DefaultLayout` - Provider dashboard layout
- `AdminHeader` - Conditional navigation based on user role
- `Sidebar` - Role-based navigation menu

---

## 5. Data Flow Architecture

### 5.1 Prescription Submission Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Provider submits prescription via multi-step wizard       │
│    - Step 1: Select/create patient                           │
│    - Step 2: Select medication from catalog                  │
│    - Step 3: Enter dosage, quantity, refills, sig            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Frontend validates form data (React Hook Form + Zod)      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. POST to /api/prescriptions/submit                         │
│    Payload: patient, prescriber, medication details          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. API Route transforms to DigitalRX format                  │
│    {                                                          │
│      StoreID: "190190",                                       │
│      VendorName: "SmartRx Demo",                             │
│      Patient: { FirstName, LastName, DOB, Sex },             │
│      Doctor: { DoctorFirstName, DoctorLastName, DoctorNpi }, │
│      RxClaim: { RxNumber, DrugName, Qty, DateWritten }       │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. POST to DigitalRX /RxWebRequest endpoint                  │
│    Headers: Authorization: {API_KEY}                          │
│    URL: https://www.dbswebserver.com/DBSRestApi/API/         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. DigitalRX returns { QueueID, Message }                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Save to Supabase prescriptions table                      │
│    - queue_id (from DigitalRX)                               │
│    - status: "submitted"                                     │
│    - All prescription details                                 │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Log to system_logs table                                  │
│    Action: PRESCRIPTION_SUBMITTED                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 9. Return success response to frontend                       │
│    { success: true, queue_id, prescription_id }              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 10. Redirect to /prescriptions page with success toast       │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Status Tracking Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Prescriptions page loads for provider                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Load prescriptions from Supabase                          │
│    WHERE prescriber_id = current_user.id                     │
│    ORDER BY submitted_at DESC                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Trigger status update fetch                               │
│    POST /api/prescriptions/status-batch                      │
│    { user_id: current_user.id }                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. For each prescription with queue_id:                      │
│    POST to DigitalRX /RxRequestStatus                        │
│    { StoreID: "190190", QueueID: prescription.queue_id }     │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. DigitalRX returns status data:                            │
│    {                                                          │
│      BillingStatus: "Billed" | "Cash",                       │
│      PatPay: "15.00",                                         │
│      PackDateTime: ISO-8601,                                 │
│      ApprovedDate: ISO-8601,                                 │
│      TrackingNumber: "1Z999AA10123456784",                   │
│      RxNumber: "12343",                                      │
│      PickupDate: ISO-8601,                                   │
│      DeliveredDate: ISO-8601 | null                          │
│    }                                                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Map DigitalRX status to display status:                   │
│    - DeliveredDate exists → "Delivered"                      │
│    - PickupDate exists → "Shipped"                           │
│    - ApprovedDate exists → "Approved"                        │
│    - PackDateTime exists → "Processing"                      │
│    - BillingStatus exists → "Billing"                        │
│    - Default → "Submitted"                                   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Update Supabase prescriptions table                       │
│    SET status = mapped_status,                               │
│        tracking_number = TrackingNumber                      │
│    WHERE id = prescription_id                                │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Return batch results to frontend                          │
│    { success: true, statuses: [...] }                        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 9. Update UI with real-time status and tracking numbers      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 10. Auto-refresh every 30 seconds                            │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Real-time Data Synchronization

```
┌──────────────────────────────────────────────────────────────┐
│ Supabase Realtime Subscription                               │
│                                                               │
│ Channel: "prescriptions-changes"                             │
│ Event: postgres_changes                                      │
│ Filter: prescriber_id = current_user.id                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ On INSERT/UPDATE/DELETE → Reload prescriptions               │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Integration Architecture

### 6.1 DigitalRX API Integration

#### 6.1.1 Connection Details

**Environment:** Sandbox
**Base URL:** `https://www.dbswebserver.com/DBSRestApi/API`
**Authentication:** API Key in Authorization header
**API Key:** `12345678901234567890` (Sandbox)

#### 6.1.2 Available Stores

| Store Name | Store ID | Purpose |
|------------|----------|---------|
| Greenwich | 190190 | Primary pharmacy (currently active) |
| CLOVERx | 190660 | Secondary pharmacy |
| Experience Care | 190670 | Tertiary pharmacy |

#### 6.1.3 Endpoints

**1. Prescription Submission**

```
POST /RxWebRequest
Authorization: {API_KEY}
Content-Type: application/json

Request Body:
{
  "StoreID": "190190",
  "VendorName": "SmartRx Demo",
  "Patient": {
    "FirstName": "John",
    "LastName": "Doe",
    "DOB": "1985-09-25",
    "Sex": "M"
  },
  "Doctor": {
    "DoctorFirstName": "Jane",
    "DoctorLastName": "Smith",
    "DoctorNpi": "1234567890"
  },
  "RxClaim": {
    "RxNumber": "RX1735123456789",
    "DrugName": "Lisinopril",
    "Qty": "30",
    "DateWritten": "2025-12-17"
  }
}

Response (Success):
{
  "QueueID": "12345",
  "Message": "Request submitted successfully"
}
```

**2. Status Check**

```
POST /RxRequestStatus
Authorization: {API_KEY}
Content-Type: application/json

Request Body:
{
  "StoreID": "190190",
  "QueueID": "12345"
}

Response (Success):
{
  "BillingStatus": "Billed",
  "PatPay": "15.00",
  "PackDateTime": "2025-11-07T10:30:00Z",
  "ApprovedDate": "2025-11-07T11:00:00Z",
  "TrackingNumber": "1Z999AA10123456784",
  "RxNumber": "12343",
  "PickupDate": "2025-11-07T14:00:00Z",
  "DeliveredDate": null
}
```

#### 6.1.4 Error Handling

| Status Code | Meaning | Handling Strategy |
|-------------|---------|-------------------|
| 200 | Success | Process response data |
| 400 | Bad Request | Validate payload format |
| 401 | Unauthorized | Check API key configuration |
| 404 | Not Found | Verify endpoint URL |
| 500 | Server Error | Retry with exponential backoff |

#### 6.1.5 Field Validation & Constraints

**Required Fields:**
- `StoreID` - Must match API key (190190)
- `VendorName` - Identifies the submitting system
- `Patient.FirstName` - Patient's first name
- `Patient.LastName` - Patient's last name
- `Patient.DOB` - Format: YYYY-MM-DD
- `Doctor.DoctorNpi` - 10-digit NPI number
- `RxClaim.RxNumber` - Unique prescription identifier
- `RxClaim.DrugName` - Medication name
- `RxClaim.Qty` - String representation of quantity
- `RxClaim.DateWritten` - Format: YYYY-MM-DD

**Data Validation Patterns:**
- DOB: ISO 8601 date format (YYYY-MM-DD)
- NPI: 10 digits, defaults to "1234567890" if not provided
- RxNumber: Auto-generated as `RX{timestamp}`
- Qty: Numeric string (e.g., "30", "90")

### 6.2 Supabase Integration

#### 6.2.1 Authentication Flow

```
1. User enters credentials
2. Supabase Auth validates
3. Session token stored in httpOnly cookie
4. Middleware validates token on protected routes
5. User context available via useUser() hook
```

#### 6.2.2 Database Connection

- **Type:** PostgreSQL 15+
- **Access:** Supabase client (service role key for server, anon key for client)
- **ORM:** Drizzle for type-safe queries
- **Migration:** Drizzle Kit for schema changes

#### 6.2.3 Realtime Subscriptions

```typescript
supabase
  .channel("prescriptions-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "prescriptions",
    filter: "prescriber_id=eq.{user_id}"
  }, (payload) => {
    // Handle real-time update
  })
  .subscribe();
```

### 6.3 Third-Party Service Integrations

| Service | Purpose | Integration Status |
|---------|---------|-------------------|
| **Stripe** | Payment processing | ✅ Configured (Test mode) |
| **Twilio** | SMS notifications | ✅ Configured |
| **SendGrid** | Email notifications | ✅ Configured |
| **Junction Health** | Vitals/labs integration | ❌ Not configured |
| **Merchant X** | Payment processing | ❌ Not configured |

---

## 7. API Management

### 7.1 Internal API Routes

All API routes located in `app/api/`:

#### Prescription Management
- `POST /api/prescriptions/submit` - Submit new prescription to DigitalRX
- `POST /api/prescriptions/status` - Check single prescription status
- `POST /api/prescriptions/status-batch` - Check multiple prescription statuses

#### Provider Management
- `GET /api/provider/pharmacy` - Get pharmacy admin status
- `POST /api/admin/test-digitalrx` - Test DigitalRX API connectivity

#### System Administration
- `GET /api/admin/api-health` - Check all API integrations health
- `POST /api/admin/seed-aim` - Seed AIM pharmacy data
- `POST /api/admin/seed-grinethch` - Seed Greenwich pharmacy data

#### Webhooks
- `POST /api/webhook/digitalrx` - Receive DigitalRX status updates (future)

### 7.2 Authentication Methods

#### API Key Authentication (DigitalRX)
```typescript
headers: {
  "Authorization": process.env.DIGITALRX_API_KEY,
  "Content-Type": "application/json"
}
```

#### Bearer Token Authentication (Supabase)
```typescript
headers: {
  "Authorization": `Bearer ${session.access_token}`,
  "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}
```

### 7.3 Key Management

#### Environment Variables Storage

**Location:** `.env` file (not committed to git)

**Critical Keys:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://psftyvmqepctqgzvatge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={public_anon_key}
SUPABASE_SERVICE_ROLE_KEY={sensitive_service_key}

# DigitalRX
DIGITALRX_API_KEY=12345678901234567890

# Stripe
STRIPE_SECRET_KEY=sk_test_{test_key}
STRIPE_PUBLISHABLE_KEY=pk_test_{test_key}

# Twilio
TWILIO_ACCOUNT_SID={account_sid}
TWILIO_AUTH_TOKEN={auth_token}
TWILIO_PHONE_NUMBER={phone_number}
```

**Key Security Practices:**
- Service role keys only used server-side
- Public keys prefixed with `NEXT_PUBLIC_`
- No keys committed to version control
- Sandbox/test keys used for development

---

## 8. Security & Access Control

### 8.1 Role-Based Access Control (RBAC)

#### User Roles

| Role | Database Table | Permissions |
|------|----------------|-------------|
| **Provider** | `providers` | Create/view own prescriptions, manage own patients |
| **Pharmacy Admin** | `pharmacy_admins` | Manage medications, view incoming prescriptions for assigned pharmacy |
| **Super Admin** | `users.role = 'admin'` | Full system access, manage all pharmacies, view logs |
| **Patient** | `patients` | View own prescriptions, book appointments (future) |

#### Role Detection Logic

```typescript
// Super Admin: users.role = 'admin'
const isSuperAdmin = user.role === 'admin';

// Pharmacy Admin: exists in pharmacy_admins table
const { data } = await supabase
  .from('pharmacy_admins')
  .select('pharmacy_id')
  .eq('user_id', user.id)
  .single();
const isPharmacyAdmin = !!data;

// Provider: exists in providers table
const { data } = await supabase
  .from('providers')
  .select('id')
  .eq('user_id', user.id)
  .single();
const isProvider = !!data;
```

#### Conditional Navigation

**Provider Navigation:**
- Dashboard
- Patients
- Prescriptions
- New Prescription
- Appointments
- Messages

**Pharmacy Admin Navigation:**
- Manage Medications
- Medication Catalog
- Incoming Prescriptions

**Super Admin Navigation:**
- Dashboard
- Incoming Queue
- API & Logs
- Integration Settings
- Doctors Management
- Medication Catalog

### 8.2 Data Access Policies

#### Row-Level Security (RLS)

Supabase RLS policies enforce data access:

**Prescriptions:**
- Providers: Can only read/write their own prescriptions
- Pharmacy Admins: Can read prescriptions for their pharmacy
- Super Admins: Can read all prescriptions

**Patients:**
- Providers: Can only access their own patients
- Super Admins: Can access all patients

**System Logs:**
- Super Admins only

### 8.3 HIPAA Compliance Considerations

**Current Baseline (V1.0):**
- ✅ Role-based access control implemented
- ✅ Supabase provides encryption at rest and in transit
- ✅ Audit logging via system_logs table
- ✅ Session management with secure cookies
- ⚠️ MFA available but not enforced
- ⚠️ No comprehensive audit trail for data access
- ⚠️ Business Associate Agreement (BAA) required with Supabase

**Required for Production:**
- Enforce MFA for all users
- Implement comprehensive audit logging
- Sign BAAs with all service providers
- Conduct security risk assessment
- Implement data backup and disaster recovery
- Add encryption for PHI at application level
- Implement automatic session timeout
- Add data breach notification procedures

### 8.4 Authentication Security

**Session Management:**
- JWT tokens stored in httpOnly cookies
- 24-hour session expiration (configurable)
- Automatic token refresh
- Secure session invalidation on logout

**Password Requirements:**
- Minimum 8 characters
- Enforced by Supabase Auth
- Password reset via email verification

**Multi-Factor Authentication:**
- Available via Supabase Auth
- TOTP-based (Google Authenticator, Authy)
- Not currently enforced

---

## 9. Database Architecture

### 9.1 Schema Overview

**ORM:** Drizzle ORM with PostgreSQL
**Location:** `core/database/schema/`
**Type Safety:** Full TypeScript inference

### 9.2 Core Tables

#### users (Supabase Auth)
```sql
- id: uuid (PK)
- email: text
- role: text ('user' | 'provider' | 'admin')
- created_at: timestamp
```

#### providers
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- first_name: text
- last_name: text
- npi: text (10 digits)
- dea: text
- specialization: text
- phone: text
- created_at: timestamp
```

#### patients
```sql
- id: uuid (PK)
- prescriber_id: uuid (FK → providers.id)
- first_name: text
- last_name: text
- email: text
- phone: text
- date_of_birth: date
- gender: text
- address: jsonb
- created_at: timestamp
```

#### prescriptions
```sql
- id: uuid (PK)
- prescriber_id: uuid (FK → providers.id)
- patient_id: uuid (FK → patients.id)
- queue_id: text (unique, from DigitalRX)
- medication: text
- dosage: text
- dosage_amount: text
- dosage_unit: text
- vial_size: text
- form: text
- quantity: integer
- refills: integer
- sig: text
- dispense_as_written: boolean
- pharmacy_notes: text
- patient_price: text
- status: text (submitted → billing → approved → processing → shipped → delivered)
- tracking_number: text
- submitted_at: timestamp
- updated_at: timestamp
```

#### medications
```sql
- id: uuid (PK)
- pharmacy_id: uuid (FK → pharmacies.id)
- name: text
- category: text
- description: text
- price_cents: integer
- stock_quantity: integer
- is_prescription_required: boolean
- is_active: boolean
- created_at: timestamp
```

#### pharmacies
```sql
- id: uuid (PK)
- name: text
- store_id: text (DigitalRX Store ID)
- address: jsonb
- phone: text
- backend_system: text (FK → pharmacy_backends.id)
- is_active: boolean
- created_at: timestamp
```

#### pharmacy_admins
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- pharmacy_id: uuid (FK → pharmacies.id)
- created_at: timestamp
```

#### system_logs
```sql
- id: uuid (PK)
- user_id: uuid
- user_email: text
- user_name: text
- action: text
- details: text
- queue_id: text
- status: text
- created_at: timestamp
```

### 9.3 Relationships

```
users (1) ──→ (1) providers
providers (1) ──→ (N) patients
providers (1) ──→ (N) prescriptions
patients (1) ──→ (N) prescriptions
pharmacies (1) ──→ (N) medications
pharmacies (1) ──→ (N) pharmacy_admins
users (1) ──→ (N) pharmacy_admins
```

### 9.4 Indexes

**Performance-critical indexes:**
- `prescriptions.prescriber_id` - Fast provider prescription lookup
- `prescriptions.queue_id` - Unique constraint, fast status checks
- `prescriptions.status` - Filter by status
- `patients.prescriber_id` - Fast provider patient lookup
- `pharmacy_admins.user_id` - Role detection
- `pharmacy_admins.pharmacy_id` - Pharmacy access control

### 9.5 Migration Strategy

**Tool:** Drizzle Kit

**Commands:**
```bash
npm run db:generate migration_name    # Generate migration from schema
npm run db:migrate                     # Apply pending migrations
npm run db:check                       # Check migration status
```

**Migration Files:** `core/database/migrations/`

---

## 10. Deployment & Hosting

### 10.1 Hosting Environment

**Platform:** Specode AI Projects
**Base URL:** `https://3002.app.specode.ai`
**Server:** Linux 6.8.0-71-generic
**Node Version:** 18+
**Process Manager:** PM2 (managed by platform)

### 10.2 Build & Deployment

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm start
```

**Development:**
- Dev server runs automatically
- Port: 3002
- Hot reload enabled

### 10.3 Environment Configuration

**Configuration Method:** `.env` file (managed via Specode settings UI)

**Critical Environment Variables:**
- Database connection (Supabase)
- API keys (DigitalRX, Stripe, Twilio)
- Service credentials (SendGrid)

### 10.4 CI/CD

**Version Control:** Git
**Commit Tracking:** All changes tracked via git commits
**Deployment:** Manual deployment via Specode platform
**Linting:** Pre-commit hooks run `npm run lint`

---

## 11. System Constraints & Assumptions

### 11.1 Current Constraints

**Performance:**
- Status updates poll every 30 seconds (not push-based)
- Batch status checks process prescriptions sequentially
- No caching layer for DigitalRX responses

**Functionality:**
- Patient gender defaults to "M" in DigitalRX submissions
- No refill request workflow
- No prescription cancellation
- No insurance verification
- No prescription signing/attestation

**Data:**
- RxNumber generated as timestamp (not human-readable)
- No prescription PDF generation
- No e-signature capture on prescriptions

**Integration:**
- DigitalRX webhook support prepared but not active
- No real-time push notifications from DigitalRX
- Junction Health integration not configured

### 11.2 Assumptions

**DigitalRX API:**
- Sandbox environment matches production behavior
- QueueID remains stable for prescription lifecycle
- Status fields (PackDateTime, ApprovedDate, etc.) update reliably
- API uptime and performance are adequate for production use

**User Behavior:**
- Providers have valid NPI and DEA numbers
- Patients provide accurate demographic information
- Medication names in catalog match DigitalRX drug database
- Providers understand dosage format requirements

**Security:**
- Supabase RLS policies are sufficient for data isolation
- Session management via cookies is secure
- HTTPS encryption is enforced at infrastructure level

**Compliance:**
- Current implementation is for MVP/testing only
- HIPAA compliance requires additional security measures
- BAAs must be signed before production use with PHI

### 11.3 Known Technical Debt

1. **Error Handling:** Limited retry logic for DigitalRX API failures
2. **Logging:** Console-based logging needs structured logging solution
3. **Testing:** No automated test suite (unit, integration, E2E)
4. **Monitoring:** No application performance monitoring (APM)
5. **Caching:** No caching strategy for frequently accessed data
6. **Validation:** Client-side validation only, needs server-side validation
7. **Documentation:** API documentation not auto-generated from code

### 11.4 Scalability Considerations

**Current Limits:**
- Batch status checks: ~100 prescriptions per request (no pagination)
- Realtime subscriptions: Connection limit per user
- API rate limiting: Not implemented (dependent on DigitalRX limits)

**Future Scaling Needs:**
- Background job queue for status polling
- Redis caching layer
- CDN for static assets
- Database read replicas
- Load balancing for multiple instances

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-17 | System | Initial MVP baseline documentation |

---

**Document Classification:** Internal Use Only
**Next Review Date:** Q1 2026
**Document Owner:** AIM E-Prescribing Portal Team
