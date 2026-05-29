# AIM E-Prescribing Portal - Workflow Documentation

**Version:** 1.0
**Date:** December 2025
**Status:** MVP Baseline
**Project:** AIM E-Prescribing Portal

---

## Table of Contents

1. [Document Overview](#document-overview)
2. [Workflow 1: Provider Onboarding](#workflow-1-provider-onboarding)
3. [Workflow 2: Pharmacy Admin Onboarding](#workflow-2-pharmacy-admin-onboarding)
4. [Workflow 3: Patient Management](#workflow-3-patient-management)
5. [Workflow 4: E-Prescription Creation & Submission](#workflow-4-e-prescription-creation--submission)
6. [Workflow 5: Prescription Status Tracking](#workflow-5-prescription-status-tracking)
7. [Workflow 6: Provider Dashboard View](#workflow-6-provider-dashboard-view)
8. [Workflow 7: Admin Incoming Queue Management](#workflow-7-admin-incoming-queue-management)
9. [Workflow 8: Pharmacy Medication Catalog Management](#workflow-8-pharmacy-medication-catalog-management)
10. [Workflow 9: Medication Creation by Pharmacy Admin](#workflow-9-medication-creation-by-pharmacy-admin)
11. [Cross-Workflow Integration Points](#cross-workflow-integration-points)
12. [Error Handling Patterns](#error-handling-patterns)

---

## 1. Document Overview

This document provides detailed step-by-step workflows for all major user journeys in the AIM E-Prescribing Portal. Each workflow includes:

- **Purpose & Trigger** - What initiates the workflow
- **Actors** - Who is involved
- **Preconditions** - Required state before workflow begins
- **Step-by-Step Flow** - Detailed sequential steps
- **Success Criteria** - What defines successful completion
- **Failure Paths** - How errors are handled
- **Integration Points** - External systems involved
- **Assumptions & Constraints** - Known limitations

---

## 2. Workflow 1: Provider Onboarding

### Purpose & Trigger
**Purpose:** Enable healthcare providers to register and gain access to the e-prescribing system.

**Trigger:** Provider navigates to `/auth/request-doctor-access` or `/auth/register` with provider intent.

### Actors
- **Primary:** Healthcare Provider (new user)
- **Secondary:** System (automated verification)
- **Future:** Super Admin (manual approval - not implemented)

### Preconditions
- Provider has valid email address
- Provider has NPI number (National Provider Identifier)
- Provider has DEA number (Drug Enforcement Administration)

### Step-by-Step Flow

#### Step 1: Initial Registration
```
User Action: Navigate to registration page
System Action: Display provider registration form

Form Fields:
- Email address (required)
- Password (required, min 8 characters)
- First Name (required)
- Last Name (required)
- NPI Number (optional - 10 digits)
- DEA Number (optional)
- Specialization (optional)
- Phone Number (optional)
```

**Validation:**
- Email format validation (Zod schema)
- Password strength requirements
- NPI format (10 digits if provided)
- All required fields populated

**Integration:** None at this step

#### Step 2: Supabase Account Creation
```
System Action: POST to Supabase Auth API
  - createUserWithEmailAndPassword()
  - Set user.role = 'provider'

API Endpoint: Supabase Auth (handled by SDK)
Request:
{
  email: "provider@example.com",
  password: "SecurePass123",
  options: {
    data: {
      role: 'provider'
    }
  }
}

Response (Success):
{
  user: { id: "uuid", email: "...", role: "provider" },
  session: { access_token: "...", refresh_token: "..." }
}

Response (Failure):
{
  error: {
    message: "User already registered" | "Invalid email format" | "Password too weak"
  }
}
```

**Error Handling:**
- **Email already exists:** Display "Account already exists. Please login."
- **Weak password:** Display "Password must be at least 8 characters"
- **Network error:** Display "Unable to connect. Please try again."

#### Step 3: Provider Profile Creation
```
System Action: INSERT into providers table
  - Link to user_id from Supabase Auth
  - Store provider-specific data (NPI, DEA, specialization)

Database Query:
INSERT INTO providers (
  user_id,
  first_name,
  last_name,
  npi,
  dea,
  specialization,
  phone,
  created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, NOW()
);

Integration: Supabase PostgreSQL via Drizzle ORM
```

**Error Handling:**
- **Database constraint violation:** Rollback, show generic error
- **User created but provider insert fails:** Orphaned auth user (needs cleanup)

#### Step 4: Session Initialization
```
System Action:
1. Store session token in httpOnly cookie
2. Set user context in application state
3. Redirect to provider dashboard

Redirect URL: /dashboard
Cookie: sb-access-token (httpOnly, secure, sameSite)
```

#### Step 5: First-Time Setup Guide (Future Enhancement)
```
Not Implemented: Onboarding wizard for:
- Adding first patient
- Creating first prescription
- Configuring notification preferences
```

### Success Criteria
✅ User account created in Supabase Auth
✅ Provider profile created in providers table
✅ Session established
✅ User redirected to /dashboard
✅ User can navigate provider features

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Email validation fails | "Invalid email format" | User corrects email |
| Email already exists | "Account exists. Please login." | Redirect to login page |
| Password too weak | "Password must be at least 8 characters" | User enters stronger password |
| Network failure during signup | "Connection error. Please try again." | Retry signup |
| Provider insert fails | "Registration incomplete. Contact support." | Manual admin intervention required |

### Integration Points
- **Supabase Auth:** User account creation
- **Supabase Database:** Provider profile storage
- **Session Management:** Cookie-based authentication

### Assumptions & Constraints
- ✅ Self-registration allowed (no admin approval required)
- ⚠️ NPI/DEA validation not implemented (future: verify against NPPES)
- ⚠️ No email verification required (future enhancement)
- ⚠️ No provider credential verification
- ⚠️ No state medical license validation

---

## 3. Workflow 2: Pharmacy Admin Onboarding

### Purpose & Trigger
**Purpose:** Enable pharmacy administrators to manage medication catalogs and view incoming prescriptions for their assigned pharmacy.

**Trigger:** Super Admin assigns pharmacy admin role to existing user OR user requests pharmacy admin access.

### Actors
- **Primary:** Pharmacy Administrator (existing user)
- **Secondary:** Super Admin (role assignment)
- **System:** Role detection logic

### Preconditions
- User has existing account in the system
- Super Admin has identified user for pharmacy admin role
- Pharmacy exists in pharmacies table

### Step-by-Step Flow

#### Step 1: Pharmacy Admin Request (Manual Process)
```
Current Implementation: Manual assignment by Super Admin
Future Enhancement: Self-service request form

User Action: Contact Super Admin
Super Admin Action: Manually insert into pharmacy_admins table
```

#### Step 2: Database Role Assignment
```
System Action (by Super Admin):
INSERT INTO pharmacy_admins (
  user_id,
  pharmacy_id,
  created_at
) VALUES (
  'user-uuid',
  'pharmacy-uuid',
  NOW()
);

Example:
Pharmacy: Greenwich (Store ID: 190190)
User: grin_admin@grinethch.com
Password: Grin2025!
```

#### Step 3: Role Detection on Login
```
System Action: Check pharmacy_admins table

Query:
SELECT pharmacy_id
FROM pharmacy_admins
WHERE user_id = $1;

If row exists:
  - isPharmacyAdmin = true
  - Redirect to /admin/medications
  - Show pharmacy admin navigation

If row does not exist:
  - Check providers table
  - Check user.role = 'admin'
```

#### Step 4: Navigation Menu Update
```
System Action: AdminHeader component conditionally renders navigation

Pharmacy Admin Navigation:
- Manage Medications (/admin/medications)
- Medication Catalog (/admin/medication-catalog)
- Incoming Prescriptions (/admin/prescriptions)

Super Admin Navigation:
- Dashboard
- Incoming Queue
- API & Logs
- Integration Settings
- Doctors Management
- Medication Catalog
```

#### Step 5: Access Control Enforcement
```
System Action: Middleware validates user permissions

Protected Routes:
/admin/medications → Requires pharmacy_admins entry
/admin/medication-catalog → Requires pharmacy_admins entry
/admin/prescriptions → Requires pharmacy_admins entry

RLS Policy:
- Pharmacy admins can only view/edit medications for their assigned pharmacy
- Can view prescriptions where pharmacy_id matches their assignment
```

### Success Criteria
✅ Entry exists in pharmacy_admins table
✅ User can login successfully
✅ Navigation shows pharmacy admin menu items
✅ User can access medication management pages
✅ User cannot access super admin features

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Pharmacy admin assignment fails | "Database error during role assignment" | Super Admin retries |
| User logs in but role not detected | Shows default user navigation | Check pharmacy_admins table entry |
| Access denied to admin pages | "Unauthorized access" redirect | Verify pharmacy_admins entry exists |

### Integration Points
- **Supabase Database:** pharmacy_admins table
- **Authentication:** Session-based role detection
- **Navigation:** Dynamic menu rendering

### Assumptions & Constraints
- ⚠️ No self-service pharmacy admin request form
- ⚠️ Manual assignment by Super Admin required
- ⚠️ User must already have an account
- ⚠️ One pharmacy per admin (no multi-pharmacy support in V1)
- ✅ Real-time role detection on each page load

---

## 4. Workflow 3: Patient Management

### Purpose & Trigger
**Purpose:** Allow providers to create, view, update, and search patient records.

**Trigger:**
- Provider navigates to `/patients` page
- Provider clicks "Add New Patient" during prescription workflow

### Actors
- **Primary:** Healthcare Provider
- **System:** Database, validation logic

### Preconditions
- Provider is authenticated
- Provider has valid session

### Step-by-Step Flow

#### Workflow 3A: View All Patients

##### Step 1: Page Load
```
User Action: Navigate to /patients
System Action:
1. Verify authentication
2. Fetch provider ID from session
3. Query patients table

Database Query:
SELECT
  id, first_name, last_name, email, phone,
  date_of_birth, gender, address, created_at
FROM patients
WHERE prescriber_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;

Pagination: 20 patients per page
```

##### Step 2: Display Patient List
```
UI Elements:
- Search bar (filter by name, email, phone)
- "Add New Patient" button (right-aligned)
- Patient table with columns:
  * Name
  * Date of Birth
  * Contact Info
  * Last Visit (derived from prescriptions)
  * Actions (View, Edit)

Search Implementation:
- Client-side filtering
- Case-insensitive
- Searches: first_name, last_name, email, phone
```

##### Step 3: Search Patients
```
User Action: Type in search bar
System Action: Filter displayed patients in real-time

Algorithm:
patients.filter(p =>
  p.firstName.toLowerCase().includes(query.toLowerCase()) ||
  p.lastName.toLowerCase().includes(query.toLowerCase()) ||
  p.email.toLowerCase().includes(query.toLowerCase()) ||
  p.phone.includes(query)
)

No API call - client-side filtering
```

#### Workflow 3B: Create New Patient

##### Step 1: Open Patient Form
```
User Action: Click "Add New Patient" button
System Action: Display patient creation modal/page

Route: /patients/new
```

##### Step 2: Fill Patient Form
```
Form Fields (Required):
- First Name
- Last Name
- Date of Birth (date picker, format: YYYY-MM-DD)
- Gender (radio: Male, Female, Other)
- Email
- Phone

Form Fields (Optional):
- Address Line 1
- Address Line 2
- City
- State (dropdown - US states)
- ZIP Code
- Emergency Contact
- Preferred Language
- Allergies
- Medical History Notes

Validation (Zod Schema):
- Email: valid email format
- Phone: US phone format (auto-formatted)
- Date of Birth: valid date, patient must be born before today
- ZIP: 5 digits
- All required fields populated
```

##### Step 3: Submit Patient Data
```
User Action: Click "Create Patient"
System Action:
1. Validate form client-side (React Hook Form + Zod)
2. POST to /api/patients/create (or direct Supabase insert)

Database Query:
INSERT INTO patients (
  prescriber_id,
  first_name,
  last_name,
  email,
  phone,
  date_of_birth,
  gender,
  address,
  created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
RETURNING *;

Response:
{
  success: true,
  patient: { id, first_name, last_name, ... }
}
```

##### Step 4: Success Confirmation
```
System Action:
1. Show success toast: "Patient created successfully"
2. Redirect to /patients (or return to prescription wizard)
3. Patient appears in patient list
```

#### Workflow 3C: Edit Existing Patient

##### Step 1: Select Patient
```
User Action: Click "Edit" button on patient row
System Action:
1. Load patient data
2. Pre-populate form fields
3. Display edit form

Route: /patients/[id]/edit
```

##### Step 2: Update Patient Information
```
User Action: Modify form fields
System Action: Validate changes in real-time

Same validation rules as create flow
```

##### Step 3: Save Changes
```
User Action: Click "Save Changes"
System Action:
1. Validate form
2. UPDATE database

Database Query:
UPDATE patients
SET
  first_name = $2,
  last_name = $3,
  email = $4,
  phone = $5,
  date_of_birth = $6,
  gender = $7,
  address = $8,
  updated_at = NOW()
WHERE id = $1 AND prescriber_id = $9;

RLS ensures provider can only update their own patients
```

##### Step 4: Confirmation
```
System Action:
1. Show success toast: "Patient updated successfully"
2. Redirect to /patients
3. Updated data visible in patient list
```

#### Workflow 3D: Patient Selection in Prescription Wizard

##### Step 1: Prescription Wizard - Step 1
```
User Action: Navigate to /prescriptions/new
System Action:
1. Display patient search/selection interface
2. Show "Add New Patient" button

Integration Point: Prescription creation workflow (Workflow 4)
```

##### Step 2: Search Existing Patients
```
User Action: Type in search bar
System Action: Filter patients in real-time

Same search logic as patient list page
```

##### Step 3: Select Patient or Create New
```
Option A: Select Existing Patient
  - User clicks patient row
  - Patient ID stored in wizard state (sessionStorage)
  - Navigate to Step 2 (medication selection)

Option B: Create New Patient
  - User clicks "Add New Patient"
  - Modal opens with patient form
  - After creation, patient auto-selected
  - Navigate to Step 2
```

### Success Criteria
✅ Provider can view all their patients
✅ Provider can search patients by name, email, phone
✅ Provider can create new patient with all required fields
✅ Provider can edit existing patient information
✅ Patient data validates correctly
✅ Patient selection works in prescription wizard
✅ Pagination works for large patient lists

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Email already exists | "Patient with this email already exists" | User modifies email or searches for existing patient |
| Invalid date of birth | "Invalid date format" | User selects valid date from picker |
| Missing required fields | "Please fill all required fields" | User completes form |
| Database constraint violation | "Unable to save patient" | User retries or contacts support |
| Network error during save | "Connection error. Changes not saved." | User retries save |

### Integration Points
- **Supabase Database:** patients table CRUD operations
- **Prescription Wizard:** Patient selection for new prescriptions
- **Real-time Subscriptions:** Patient list updates when new patient added
- **Stripe (Future):** Card on file for patient payments

### Assumptions & Constraints
- ✅ Providers can only see their own patients (RLS enforced)
- ⚠️ No patient portal (patients cannot login)
- ⚠️ No patient merge functionality
- ⚠️ No duplicate detection (same name, DOB)
- ⚠️ No patient consent management
- ⚠️ Phone format assumes US numbers
- ✅ Address stored as JSONB for flexibility

---

## 5. Workflow 4: E-Prescription Creation & Submission

### Purpose & Trigger
**Purpose:** Enable providers to create and submit electronic prescriptions to pharmacy backend (DigitalRX) for fulfillment.

**Trigger:** Provider clicks "New Prescription" button from dashboard or /prescriptions page.

### Actors
- **Primary:** Healthcare Provider
- **Secondary:** Patient (selected for prescription)
- **System:** DigitalRX API, Database

### Preconditions
- Provider is authenticated
- At least one patient exists in the system
- Medications exist in pharmacy catalog
- DigitalRX API credentials configured

### Step-by-Step Flow

#### Step 1: Patient Selection (Wizard Step 1)

##### Route: `/prescriptions/new` or `/prescriptions/new/step1`

```
System Action:
1. Load all patients for current provider
2. Display patient search/selection interface

Query:
SELECT id, first_name, last_name, date_of_birth, email, phone
FROM patients
WHERE prescriber_id = $1
ORDER BY last_name ASC;

UI Elements:
- Search bar (full width)
- Patient table/cards with:
  * Name
  * Date of Birth
  * Contact Info
  * "Select" button
- "Add New Patient" button (right-aligned)
```

```
User Action: Search and select patient

Option A: Select Existing Patient
  - User types in search bar
  - System filters patients in real-time
  - User clicks patient row
  - System stores patient_id in session storage
  - Navigate to Step 2

Option B: Create New Patient
  - User clicks "Add New Patient"
  - System shows patient creation form (modal or inline)
  - After creation, patient auto-selected
  - Navigate to Step 2
```

```
Session Storage:
{
  "prescriptionWizard": {
    "step": 1,
    "patient_id": "uuid",
    "patient_name": "John Doe",
    "patient_dob": "1985-09-25"
  }
}
```

#### Step 2: Medication Selection (Wizard Step 2)

##### Route: `/prescriptions/new/step2`

```
System Action:
1. Load medications from pharmacy catalog
2. Group by category
3. Display medication selection interface

Query:
SELECT
  id, name, category, description,
  price_cents, is_prescription_required
FROM medications
WHERE is_active = true
  AND pharmacy_id = $1
ORDER BY category, name;

Pharmacy Selection:
- Default: Greenwich (Store ID: 190190)
- Future: Allow provider to select pharmacy
```

```
UI Elements:
- Category dropdown (filter medications)
- Medication grid/list:
  * Medication name
  * Category badge
  * Description
  * Price (if applicable)
  * "Select" button with Plus icon
- Search bar (filter by medication name)
```

```
User Action: Select medication

1. Optional: Filter by category
2. Optional: Search by name
3. Click medication card
4. System stores medication details
5. Navigate to Step 3
```

```
Session Storage Update:
{
  "prescriptionWizard": {
    "step": 2,
    "patient_id": "uuid",
    "patient_name": "John Doe",
    "patient_dob": "1985-09-25",
    "medication_id": "uuid",
    "medication_name": "Lisinopril",
    "medication_price": "1500" // cents
  }
}
```

#### Step 3: Prescription Details (Wizard Step 3)

##### Route: `/prescriptions/new/step3`

```
System Action:
1. Display prescription detail form
2. Pre-populate patient and medication info (read-only)
3. Show dosage, quantity, refills inputs

Form Fields (Required):
- Dosage Amount (number input)
  Example: 10
- Dosage Unit (dropdown)
  Options: mg, mcg, g, mL, units, tablets
- Form (dropdown)
  Options: Tablet, Capsule, Liquid, Injection, Cream, Patch
- Quantity (number input)
  Example: 30
- Refills (number input, default: 0)
  Range: 0-12
- Sig (Signature/Directions) (textarea)
  Example: "Take one tablet by mouth once daily"

Form Fields (Optional):
- Vial Size (text input)
  Example: "10mL"
- Dispense as Written (checkbox)
  Default: false
- Pharmacy Notes (textarea)
  Example: "Patient prefers brand name"
- Patient Price Override (text input)
  Format: $XX.XX
```

```
Validation (Zod Schema):
- dosage_amount: positive number
- dosage_unit: valid option from dropdown
- form: valid option from dropdown
- quantity: positive integer, max 999
- refills: integer 0-12
- sig: min 10 characters, max 500 characters
- patient_price: valid currency format if provided
```

```
User Action: Fill prescription details
System Action:
1. Real-time validation as user types
2. Show error messages for invalid fields
3. Enable "Submit Prescription" button when valid
```

```
Session Storage Update:
{
  "prescriptionWizard": {
    "step": 3,
    "patient_id": "uuid",
    "patient_name": "John Doe",
    "patient_dob": "1985-09-25",
    "medication_id": "uuid",
    "medication_name": "Lisinopril",
    "medication_price": "1500",
    "dosage_amount": "10",
    "dosage_unit": "mg",
    "form": "Tablet",
    "quantity": 30,
    "refills": 3,
    "sig": "Take one tablet by mouth once daily",
    "vial_size": null,
    "dispense_as_written": false,
    "pharmacy_notes": "",
    "patient_price": "15.00"
  }
}
```

#### Step 4: Review & Submit

##### Same Route: `/prescriptions/new/step3` (bottom section)

```
UI Element: Prescription Summary Card
- Patient: John Doe (DOB: 09/25/1985)
- Medication: Lisinopril 10mg Tablet
- Quantity: 30 tablets
- Refills: 3
- Directions: Take one tablet by mouth once daily
- Patient Price: $15.00
- Dispense as Written: No
```

```
User Action: Click "Submit Prescription"

System Action:
1. Final validation of all data
2. Construct API payload
3. POST to /api/prescriptions/submit
```

#### Step 5: API Submission to DigitalRX

```
API Endpoint: /api/prescriptions/submit
Method: POST
Headers:
  Content-Type: application/json

Request Body:
{
  "prescriber_id": "uuid",
  "patient_id": "uuid",
  "medication": "Lisinopril",
  "dosage": "10mg", // combined dosage_amount + dosage_unit
  "dosage_amount": "10",
  "dosage_unit": "mg",
  "form": "Tablet",
  "vial_size": null,
  "quantity": 30,
  "refills": 3,
  "sig": "Take one tablet by mouth once daily",
  "dispense_as_written": false,
  "pharmacy_notes": "",
  "patient_price": "15.00",
  "patient": {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1985-09-25",
    "phone": "555-0123",
    "email": "john.doe@example.com"
  },
  "prescriber": {
    "first_name": "Jane",
    "last_name": "Smith",
    "npi": "1234567890",
    "dea": "AS1234563"
  }
}
```

```
Backend Processing (API Route):
1. Validate required fields
2. Generate unique RxNumber: RX{timestamp}
3. Get current date: YYYY-MM-DD
4. Transform payload to DigitalRX format
```

```
DigitalRX API Call:
Endpoint: https://www.dbswebserver.com/DBSRestApi/API/RxWebRequest
Method: POST
Headers:
  Authorization: 12345678901234567890
  Content-Type: application/json

Body:
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
```

```
DigitalRX Response (Success):
HTTP 200 OK
{
  "QueueID": "12345",
  "Message": "Request submitted successfully"
}
```

```
DigitalRX Response (Error):
HTTP 400 Bad Request
{
  "error": "Invalid StoreID"
}

HTTP 401 Unauthorized
{
  "error": "Invalid API key"
}

HTTP 500 Internal Server Error
{
  "error": "Pharmacy system unavailable"
}
```

#### Step 6: Database Storage

```
System Action: Save prescription to Supabase

INSERT INTO prescriptions (
  prescriber_id,
  patient_id,
  medication,
  dosage,
  dosage_amount,
  dosage_unit,
  vial_size,
  form,
  quantity,
  refills,
  sig,
  dispense_as_written,
  pharmacy_notes,
  patient_price,
  queue_id,
  status,
  submitted_at,
  updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
  $11, $12, $13, $14, $15, 'submitted', NOW(), NOW()
) RETURNING *;

queue_id: "12345" (from DigitalRX)
status: "submitted"
```

#### Step 7: System Logging

```
System Action: Log to system_logs table

INSERT INTO system_logs (
  user_id,
  user_email,
  user_name,
  action,
  details,
  queue_id,
  status,
  created_at
) VALUES (
  $1,
  $2,
  'Dr. Jane Smith',
  'PRESCRIPTION_SUBMITTED',
  'DigitalRx: Lisinopril 10mg for John Doe',
  '12345',
  'success',
  NOW()
);
```

#### Step 8: Success Response

```
API Response to Frontend:
HTTP 201 Created
{
  "success": true,
  "message": "Prescription submitted to DigitalRx successfully",
  "queue_id": "12345",
  "prescription_id": "uuid",
  "digitalrx_response": {
    "QueueID": "12345",
    "Message": "Request submitted successfully"
  }
}
```

#### Step 9: User Feedback & Redirect

```
System Action:
1. Clear session storage (wizard state)
2. Show success toast:
   "✅ Prescription submitted successfully!"
3. Redirect to /prescriptions?refresh=true
4. Display prescription in provider's prescription list
```

### Success Criteria
✅ Patient selected successfully
✅ Medication selected from catalog
✅ All prescription details validated
✅ Prescription submitted to DigitalRX API
✅ QueueID received from DigitalRX
✅ Prescription saved to database with status "submitted"
✅ System log entry created
✅ User redirected to prescriptions page
✅ New prescription visible in list

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| No patients exist | "No patients found. Create a patient first." | Redirect to /patients/new |
| Medication not selected | "Please select a medication" | User returns to Step 2 |
| Invalid dosage | "Please enter valid dosage amount" | User corrects dosage field |
| Invalid quantity | "Quantity must be between 1 and 999" | User corrects quantity |
| Empty sig field | "Directions are required (min 10 characters)" | User enters directions |
| DigitalRX API returns 401 | "API authentication failed. Contact support." | Admin checks API key configuration |
| DigitalRX API returns 400 | "Invalid prescription data. Please review." | User reviews form, support checks payload |
| DigitalRX API timeout | "Pharmacy system unavailable. Try again." | User retries submission |
| Database save fails | "Unable to save prescription. Contact support." | Manual intervention required |
| Network error | "Connection lost. Prescription not submitted." | User retries from Step 3 |

### Integration Points
- **DigitalRX API:** Prescription submission (`/RxWebRequest`)
- **Supabase Database:** Save prescription, system logs
- **Session Storage:** Multi-step wizard state persistence
- **Real-time Subscriptions:** Prescription list updates automatically
- **Patient Management:** Select existing or create new patient
- **Medication Catalog:** Select medication from pharmacy inventory

### Assumptions & Constraints
- ✅ Patient gender defaults to "M" in DigitalRX submission
- ⚠️ No prescription signing/attestation
- ⚠️ No controlled substance scheduling validation
- ⚠️ No drug interaction checking
- ⚠️ No allergy warnings
- ⚠️ No insurance verification
- ⚠️ No prescription cancellation after submission
- ⚠️ RxNumber auto-generated (not human-readable)
- ✅ All prescriptions go to Greenwich pharmacy (Store ID: 190190)
- ⚠️ No multi-pharmacy selection in V1
- ⚠️ No prescription templates or favorites
- ⚠️ No e-signature capture

---

## 6. Workflow 5: Prescription Status Tracking

### Purpose & Trigger
**Purpose:** Enable providers to monitor real-time status of submitted prescriptions through the pharmacy fulfillment lifecycle.

**Trigger:**
- Provider navigates to `/prescriptions` page
- Automatic refresh every 30 seconds
- Manual refresh (future enhancement)

### Actors
- **Primary:** Healthcare Provider
- **Secondary:** DigitalRX API (status updates)
- **System:** Background polling, database updates

### Preconditions
- Provider is authenticated
- At least one prescription has been submitted
- Prescriptions have valid QueueID from DigitalRX

### Step-by-Step Flow

#### Step 1: Load Prescriptions Page

```
User Action: Navigate to /prescriptions
System Action:
1. Verify authentication
2. Load prescriptions from database
3. Trigger status update fetch

Route: /prescriptions
```

```
Database Query:
SELECT
  p.id,
  p.queue_id,
  p.submitted_at,
  p.medication,
  p.dosage,
  p.dosage_amount,
  p.dosage_unit,
  p.vial_size,
  p.form,
  p.quantity,
  p.refills,
  p.sig,
  p.dispense_as_written,
  p.pharmacy_notes,
  p.patient_price,
  p.status,
  p.tracking_number,
  pt.first_name AS patient_first_name,
  pt.last_name AS patient_last_name,
  pt.date_of_birth AS patient_dob
FROM prescriptions p
LEFT JOIN patients pt ON p.patient_id = pt.id
WHERE p.prescriber_id = $1
ORDER BY p.submitted_at DESC;
```

```
UI Display:
- Tabs:
  * "In Progress" (status != "delivered")
  * "Completed" (status = "delivered")
- Table columns:
  * Queue ID
  * Date/Time Submitted
  * Patient Name
  * Medication
  * Status Badge
  * Actions (View Details)
```

#### Step 2: Initial Status Check (On Page Load)

```
System Action: Fetch status updates for all prescriptions

Frontend Call:
POST /api/prescriptions/status-batch
{
  "user_id": "provider-uuid"
}
```

```
Backend Processing (API Route):
1. Query all prescriptions for user
2. For each prescription with queue_id:
   - Call DigitalRX status API
3. Update database with latest status
4. Return aggregated results
```

```
For Each Prescription:
  DigitalRX API Call:
  POST https://www.dbswebserver.com/DBSRestApi/API/RxRequestStatus
  Authorization: 12345678901234567890
  Content-Type: application/json

  Body:
  {
    "StoreID": "190190",
    "QueueID": "12345"
  }
```

```
DigitalRX Response (Success):
{
  "BillingStatus": "Billed",
  "PatPay": "15.00",
  "PackDateTime": "2025-12-17T10:30:00Z",
  "ApprovedDate": "2025-12-17T11:00:00Z",
  "TrackingNumber": "1Z999AA10123456784",
  "RxNumber": "12343",
  "PickupDate": "2025-12-17T14:00:00Z",
  "DeliveredDate": null
}
```

```
DigitalRX Response (No Status):
{
  "error": "No status found for QueueID"
}
```

#### Step 3: Status Mapping Logic

```
System Action: Map DigitalRX status to display status

Status Determination Algorithm:
1. If DeliveredDate exists → status = "Delivered"
2. Else if PickupDate exists → status = "Shipped"
3. Else if ApprovedDate exists → status = "Approved"
4. Else if PackDateTime exists → status = "Processing"
5. Else if BillingStatus exists → status = "Billing"
6. Else → status = "Submitted"

Tracking Number:
- Extract from TrackingNumber field
- Store in database
- Display in UI when status = "Shipped" or "Delivered"
```

```
Status Lifecycle:
Submitted → Billing → Processing → Approved → Shipped → Delivered

Status Descriptions:
- Submitted: Prescription received by pharmacy
- Billing: Insurance processing or cash payment being handled
- Processing: Pharmacist filling prescription
- Approved: Pharmacist approved for shipment
- Shipped: Package picked up by carrier
- Delivered: Patient received prescription
```

#### Step 4: Database Update

```
System Action: Update prescription record with latest status

For Each Prescription:
UPDATE prescriptions
SET
  status = $2,
  tracking_number = $3,
  updated_at = NOW()
WHERE id = $1;

Example:
id: "prescription-uuid"
status: "Shipped"
tracking_number: "1Z999AA10123456784"
```

#### Step 5: UI Update (Real-time)

```
System Action:
1. Receive batch status results from API
2. Update local state with new statuses
3. Re-render prescription list
4. Update status badges with new colors
5. Show tracking number if available
```

```
Status Badge Styling:
All statuses: Navy background (#1E3A8A), white text

Status Badge Display:
- "Submitted" → 📝 Submitted
- "Billing" → 💳 Billing
- "Processing" → ⚙️ Processing
- "Approved" → ✅ Approved
- "Shipped" → 🚚 Shipped (+ tracking number)
- "Delivered" → 📦 Delivered (+ tracking number)
```

```
Tracking Number Display:
When status = "Shipped" or "Delivered":
  Show tracking number with copy button
  Click tracking number → opens carrier tracking page

  Example:
  🚚 Shipped
  Tracking: 1Z999AA10123456784 [Copy]
```

#### Step 6: Automatic Refresh (Every 30 Seconds)

```
System Action: Set up interval for automatic status checks

useEffect(() => {
  const interval = setInterval(() => {
    fetchStatusUpdates();
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, []);
```

```
Background Process:
1. Every 30 seconds, call /api/prescriptions/status-batch
2. Update database with new statuses
3. Update UI without page reload
4. Silent updates (no toast notifications)
```

#### Step 7: Real-time Database Subscription

```
System Action: Subscribe to prescription changes

Supabase Realtime:
supabase
  .channel('prescriptions-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'prescriptions',
    filter: 'prescriber_id=eq.{user_id}'
  }, (payload) => {
    // Reload prescription list
    loadPrescriptions();
  })
  .subscribe();

Triggers UI update when:
- New prescription inserted
- Existing prescription updated
- Prescription deleted (future)
```

#### Step 8: View Prescription Details

```
User Action: Click "View Details" on prescription row
System Action:
1. Fetch latest prescription data from database
2. Display modal with full prescription information
```

```
Modal Contents:
- Patient Information:
  * Name
  * Date of Birth
  * Contact Info

- Prescription Details:
  * Medication Name
  * Dosage (e.g., 10mg)
  * Form (e.g., Tablet)
  * Quantity (e.g., 30)
  * Refills (e.g., 3)
  * Vial Size (if applicable)
  * Directions (Sig)
  * Dispense as Written
  * Pharmacy Notes

- Status Information:
  * Current Status Badge
  * Queue ID
  * Tracking Number (if shipped/delivered)
  * Date Submitted
  * Last Updated

- Actions:
  * Print Prescription (future)
  * Copy Queue ID
  * Close Modal
```

#### Step 9: Filter by Status Tab

```
User Action: Click "In Progress" or "Completed" tab

System Action:
1. Filter prescriptions based on status
2. Update displayed list
3. Update badge counts

"In Progress" Filter:
prescriptions.filter(p => p.status !== "Delivered")

"Completed" Filter:
prescriptions.filter(p => p.status === "Delivered")
```

#### Step 10: Search Prescriptions

```
User Action: Type in search bar

System Action:
1. Filter prescriptions in real-time
2. Search across:
   - Patient name
   - Medication name
   - Queue ID

Search Algorithm:
prescriptions.filter(p =>
  p.patientName.toLowerCase().includes(query.toLowerCase()) ||
  p.medication.toLowerCase().includes(query.toLowerCase()) ||
  p.queueId.toLowerCase().includes(query.toLowerCase())
)
```

### Success Criteria
✅ Prescriptions load on page access
✅ Status updates fetch automatically
✅ DigitalRX API returns status data
✅ Status mapped correctly to display format
✅ Database updated with latest status
✅ UI updates in real-time
✅ Status badges display correctly
✅ Tracking numbers shown when available
✅ Automatic refresh works every 30 seconds
✅ Tabs filter prescriptions correctly
✅ Search functionality works

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| No prescriptions found | Display "No prescriptions in progress" | User can create new prescription |
| DigitalRX API timeout | Log warning, keep old status | Retry on next refresh cycle |
| Invalid QueueID | Log error, skip status update | Status remains "submitted" |
| DigitalRX returns 404 | "No status found" | Prescription may not be in DigitalRX system yet |
| Network error during status check | Silent failure, keep old status | Retry on next automatic refresh |
| Database update fails | Log error, display old status | Manual intervention may be required |
| Realtime subscription fails | Prescriptions still load | Page refresh works as fallback |

### Integration Points
- **DigitalRX API:** Status check endpoint (`/RxRequestStatus`)
- **Supabase Database:** Prescription status updates, tracking numbers
- **Supabase Realtime:** Live database subscriptions
- **Background Polling:** Automatic refresh every 30 seconds

### Assumptions & Constraints
- ✅ DigitalRX provides accurate, up-to-date status
- ✅ QueueID remains valid throughout prescription lifecycle
- ⚠️ 30-second polling interval (not push-based)
- ⚠️ No webhook support from DigitalRX in V1
- ⚠️ Status updates are eventually consistent (may lag by 30 seconds)
- ⚠️ No manual refresh button (automatic only)
- ⚠️ No status change notifications (email, SMS)
- ⚠️ No historical status tracking (only current status stored)
- ✅ Tracking numbers displayed for shipped/delivered prescriptions
- ⚠️ Tracking links not validated (assumes carrier format)

---

## 7. Workflow 6: Provider Dashboard View

### Purpose & Trigger
**Purpose:** Provide healthcare providers with an overview of their prescriptions, patients, and recent activity.

**Trigger:** Provider logs in and navigates to `/dashboard` or `/prescriptions` (main provider pages).

### Actors
- **Primary:** Healthcare Provider
- **System:** Database, aggregation logic

### Preconditions
- Provider is authenticated
- Provider has valid session

### Step-by-Step Flow

#### Step 1: Dashboard Page Load

```
User Action: Login or navigate to /dashboard
System Action:
1. Verify authentication
2. Redirect based on user role:
   - Providers → /dashboard or /prescriptions
   - Pharmacy Admins → /admin/medications
   - Super Admins → /admin/dashboard
```

#### Step 2: Fetch Dashboard Data

```
System Action: Load aggregated statistics

Queries:
1. Total Prescriptions:
   SELECT COUNT(*) FROM prescriptions
   WHERE prescriber_id = $1;

2. Recent Prescriptions (Last 7 days):
   SELECT COUNT(*) FROM prescriptions
   WHERE prescriber_id = $1
     AND submitted_at >= NOW() - INTERVAL '7 days';

3. Active Patients (with prescriptions):
   SELECT COUNT(DISTINCT patient_id) FROM prescriptions
   WHERE prescriber_id = $1;

4. In-Progress Prescriptions:
   SELECT COUNT(*) FROM prescriptions
   WHERE prescriber_id = $1
     AND status != 'Delivered';
```

#### Step 3: Display Dashboard Widgets

```
UI Layout:
┌────────────────────────────────────────────────────┐
│ Welcome, Dr. Jane Smith                            │
├────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐     │
│ │ Total Rx   │ │ In Progress│ │ Active Pts │     │
│ │    42      │ │     12     │ │    28      │     │
│ └────────────┘ └────────────┘ └────────────┘     │
├────────────────────────────────────────────────────┤
│ Recent Prescriptions                               │
│ ┌────────────────────────────────────────────┐   │
│ │ [Table of last 10 prescriptions]           │   │
│ └────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│ Quick Actions                                      │
│ [New Prescription] [Manage Patients]               │
└────────────────────────────────────────────────────┘
```

#### Step 4: Recent Prescriptions Table

```
System Action: Load last 10 prescriptions

Query:
SELECT
  p.id, p.queue_id, p.submitted_at,
  p.medication, p.status,
  pt.first_name, pt.last_name
FROM prescriptions p
LEFT JOIN patients pt ON p.patient_id = pt.id
WHERE p.prescriber_id = $1
ORDER BY p.submitted_at DESC
LIMIT 10;
```

```
Table Display:
Columns:
- Date/Time
- Patient Name
- Medication
- Status Badge
- Actions (View)

Click row → View prescription details modal
```

#### Step 5: Quick Actions

```
UI Elements:
- "New Prescription" button → /prescriptions/new
- "Manage Patients" button → /patients
- "View All Prescriptions" link → /prescriptions
```

### Success Criteria
✅ Dashboard loads successfully
✅ Statistics display correct counts
✅ Recent prescriptions show latest 10
✅ Status badges display correctly
✅ Quick action buttons navigate correctly
✅ Page renders within 2 seconds

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| No prescriptions | Show "No prescriptions yet. Create your first one!" | Display create button |
| Database query fails | Show generic error message | Retry on page refresh |
| Network error | "Unable to load dashboard" | User refreshes page |

### Integration Points
- **Supabase Database:** Prescription and patient aggregations
- **Navigation:** Links to patient and prescription management

### Assumptions & Constraints
- ✅ Dashboard shows only provider's own data (RLS enforced)
- ⚠️ No filtering by date range
- ⚠️ No charts or graphs in V1
- ⚠️ Statistics not cached (calculated on each load)

---

## 8. Workflow 7: Admin Incoming Queue Management

### Purpose & Trigger
**Purpose:** Enable pharmacy administrators to view and manage incoming prescriptions submitted to their pharmacy.

**Trigger:** Pharmacy Admin navigates to `/admin/prescriptions` page.

### Actors
- **Primary:** Pharmacy Administrator
- **System:** Database, DigitalRX status

### Preconditions
- User is authenticated as pharmacy admin
- Entry exists in `pharmacy_admins` table
- Prescriptions have been submitted to pharmacy

### Step-by-Step Flow

#### Step 1: Navigation

```
User Action: Login as pharmacy admin
System Action:
1. Detect pharmacy admin role
2. Redirect to /admin/medications (default landing page)
3. Show pharmacy admin navigation menu:
   - Manage Medications
   - Medication Catalog
   - Incoming Prescriptions ← This workflow
```

#### Step 2: Load Incoming Prescriptions Page

```
User Action: Click "Incoming Prescriptions" in navigation
Route: /admin/prescriptions

System Action:
1. Verify pharmacy admin role
2. Get pharmacy_id for current user
3. Load prescriptions for pharmacy
```

```
Role Detection Query:
SELECT pharmacy_id
FROM pharmacy_admins
WHERE user_id = $1;

If no row found:
  → Access Denied, redirect to /
```

#### Step 3: Fetch Prescriptions for Pharmacy

```
Database Query:
SELECT
  p.id,
  p.queue_id,
  p.submitted_at,
  p.medication,
  p.dosage,
  p.quantity,
  p.status,
  p.tracking_number,
  pt.first_name AS patient_first_name,
  pt.last_name AS patient_last_name,
  pr.first_name AS prescriber_first_name,
  pr.last_name AS prescriber_last_name
FROM prescriptions p
LEFT JOIN patients pt ON p.patient_id = pt.id
LEFT JOIN providers pr ON p.prescriber_id = pr.user_id
WHERE p.pharmacy_id = $1 -- Future enhancement
ORDER BY p.submitted_at DESC;

Current V1 Implementation:
- All prescriptions go to Greenwich (Store ID: 190190)
- pharmacy_id filtering not yet implemented
- Shows all prescriptions in system
```

#### Step 4: Display Prescription Queue

```
UI Layout:
┌────────────────────────────────────────────────────┐
│ Incoming Prescriptions - Greenwich                 │
├────────────────────────────────────────────────────┤
│ [Search Bar]                        [Filters ▼]    │
├────────────────────────────────────────────────────┤
│ Status Tabs:                                       │
│ [All] [New] [Billing] [Processing] [Shipped]      │
├────────────────────────────────────────────────────┤
│ Queue ID | Submitted | Patient | Provider | Rx | Status │
│ 12345   | 12/17 10am| J. Doe  | Dr. Smith| ...| Billing│
│ 12346   | 12/17 11am| M. Jones| Dr. Brown| ...| New    │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

```
Table Columns:
- Queue ID (from DigitalRX)
- Date/Time Submitted
- Patient Name
- Prescriber Name
- Medication
- Quantity
- Status Badge
- Actions (View Details, Update Status)
```

#### Step 5: Filter by Status

```
User Action: Click status tab

System Action:
1. Filter displayed prescriptions
2. Update count badges

Status Tabs:
- All: Show all prescriptions
- New: status = "Submitted"
- Billing: status = "Billing"
- Processing: status = "Processing"
- Shipped: status = "Shipped"
- Delivered: status = "Delivered" (archive)
```

#### Step 6: Search Prescriptions

```
User Action: Type in search bar

System Action:
Filter prescriptions by:
- Queue ID
- Patient name
- Provider name
- Medication name

Real-time client-side filtering
```

#### Step 7: View Prescription Details

```
User Action: Click prescription row

System Action:
1. Fetch full prescription data
2. Display detailed modal

Modal Contents:
- Patient Information (name, DOB, contact)
- Prescriber Information (name, NPI, DEA)
- Prescription Details (medication, dosage, quantity, refills, sig)
- Pharmacy Notes
- Patient Price
- Status Timeline (future)
- Actions:
  * Print Label
  * Mark as Filled
  * Add Internal Notes
```

#### Step 8: Manual Status Update (Future Enhancement)

```
Not Implemented in V1:
- Pharmacy admin cannot manually update status
- Status updates come only from DigitalRX API
- Future: Allow pharmacy to mark prescriptions as:
  * Received
  * In Progress
  * Filled
  * Ready for Pickup/Shipment
```

### Success Criteria
✅ Pharmacy admin can access incoming prescriptions page
✅ Prescriptions load for correct pharmacy
✅ Table displays all required information
✅ Status filters work correctly
✅ Search functionality filters results
✅ Prescription details modal shows full information
✅ Only pharmacy admins can access this page

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Not pharmacy admin | "Access Denied" redirect to / | User logs in with correct account |
| No prescriptions found | "No prescriptions found" | Display empty state with instructions |
| Database query fails | "Unable to load prescriptions" | User refreshes page |
| Prescription details load fails | "Unable to load details" | User retries clicking row |

### Integration Points
- **Supabase Database:** Prescription queries with joins
- **Role Detection:** pharmacy_admins table
- **DigitalRX Status:** Status updates from status check workflow

### Assumptions & Constraints
- ✅ Pharmacy admins assigned to single pharmacy
- ⚠️ All prescriptions currently show (no pharmacy filtering in V1)
- ⚠️ No manual status updates by pharmacy admin
- ⚠️ No internal notes or comments system
- ⚠️ No prescription assignment to staff
- ⚠️ No print/export functionality
- ⚠️ No batch operations (approve multiple, etc.)

---

## 9. Workflow 8: Pharmacy Medication Catalog Management

### Purpose & Trigger
**Purpose:** Allow pharmacy administrators and super admins to view the complete medication catalog with filtering and search capabilities.

**Trigger:** User navigates to `/admin/medication-catalog`.

### Actors
- **Primary:** Pharmacy Administrator
- **Secondary:** Super Administrator
- **System:** Database

### Preconditions
- User is authenticated as pharmacy admin or super admin
- Medications exist in database

### Step-by-Step Flow

#### Step 1: Access Medication Catalog

```
User Action: Click "Medication Catalog" in navigation
Route: /admin/medication-catalog

System Action:
1. Verify user has admin or pharmacy admin role
2. Load medications from database
```

```
Access Control:
- Pharmacy Admins: Can view catalog
- Super Admins: Can view catalog
- Providers: No access
- Patients: No access
```

#### Step 2: Load Medications

```
Database Query:
SELECT
  m.id,
  m.name,
  m.category,
  m.description,
  m.price_cents,
  m.stock_quantity,
  m.is_prescription_required,
  m.is_active,
  p.name AS pharmacy_name
FROM medications m
LEFT JOIN pharmacies p ON m.pharmacy_id = p.id
WHERE m.is_active = true
ORDER BY m.name ASC;

For Pharmacy Admins:
  WHERE m.pharmacy_id = (
    SELECT pharmacy_id FROM pharmacy_admins WHERE user_id = $1
  )

For Super Admins:
  No pharmacy filter (see all)
```

#### Step 3: Display Medication Catalog

```
UI Layout:
┌────────────────────────────────────────────────────┐
│ Medication Catalog                                 │
├────────────────────────────────────────────────────┤
│ [Search Bar]              [Category Filter ▼]      │
├────────────────────────────────────────────────────┤
│ Medication | Pharmacy | Category | Stock | Status | Actions │
│ Lisinopril | Greenwich| Blood Pr.| 500   | Active | [Delete]│
│ Metformin  | Greenwich| Diabetes | 300   | Active | [Delete]│
│ ...                                                │
├────────────────────────────────────────────────────┤
│ [Pagination: 1 2 3 ... 10]                         │
└────────────────────────────────────────────────────┘
```

```
Table Columns:
- Medication (30% width)
  * Name
  * Description (truncated)
- Pharmacy (15% width)
  * Pharmacy name
- Category (20% width)
  * Category badge
- Stock Status (12% width)
  * In Stock / Low Stock / Out of Stock
- Status (12% width)
  * Active / Inactive
- Actions (11% width)
  * Delete button (trash icon)
```

#### Step 4: Search Medications

```
User Action: Type in search bar

System Action:
Filter medications by name
Real-time client-side filtering

Search Algorithm:
medications.filter(m =>
  m.name.toLowerCase().includes(query.toLowerCase())
)
```

#### Step 5: Filter by Category

```
User Action: Select category from dropdown

System Action:
Filter medications by selected category

Categories (from database):
- Blood Pressure
- Diabetes
- Pain Relief
- Antibiotics
- Mental Health
- Cardiovascular
- Respiratory
- Gastrointestinal
- All (show all)
```

#### Step 6: View Stock Status

```
System Action: Calculate stock status

Stock Status Logic:
- In Stock: quantity >= 100
- Low Stock: quantity < 100 && quantity > 0
- Out of Stock: quantity = 0

Badge Colors:
- In Stock: Green background
- Low Stock: Yellow background
- Out of Stock: Red background
```

#### Step 7: Delete Medication (Future Enhancement)

```
User Action: Click delete button (trash icon)

System Action:
1. Show confirmation dialog:
   "Are you sure you want to delete [Medication Name]?"
2. If confirmed:
   - Soft delete (set is_active = false)
   - Remove from catalog view

Database Query:
UPDATE medications
SET is_active = false, updated_at = NOW()
WHERE id = $1;

Not Implemented in V1:
- Delete functionality exists but may not be fully tested
- No cascade delete handling for prescriptions
```

#### Step 8: Pagination

```
System Action: Display medications in pages

Settings:
- Items per page: 20
- Show page numbers at bottom
- Previous/Next buttons
- Jump to page

Implementation:
- Client-side pagination (all medications loaded)
- Server-side pagination (future optimization)
```

### Success Criteria
✅ Authorized users can access catalog
✅ Medications load and display correctly
✅ Search filters results in real-time
✅ Category filter works
✅ Stock status calculates correctly
✅ Pagination displays correct page
✅ Table formatting matches design
✅ Pharmacy admin sees only their pharmacy's medications
✅ Super admin sees all medications

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Unauthorized access | "Access Denied" redirect | User logs in with correct role |
| No medications found | "No medications found" | Display empty state |
| Database query fails | "Unable to load medications" | User refreshes page |
| Delete fails | "Unable to delete medication" | User retries or contacts support |

### Integration Points
- **Supabase Database:** medications and pharmacies tables
- **Role-Based Access:** pharmacy_admins table for filtering
- **Prescription Creation:** Medications selected from this catalog

### Assumptions & Constraints
- ✅ Pharmacy admins see only their pharmacy's medications
- ✅ Super admins see all medications
- ⚠️ No create/edit medication functionality in catalog view
- ⚠️ No bulk operations (import/export)
- ⚠️ No medication images
- ⚠️ No NDC (National Drug Code) tracking
- ⚠️ Stock quantity not integrated with DigitalRX
- ⚠️ No pricing management in V1
- ✅ Pagination stays at bottom regardless of content height

---

## 10. Workflow 9: Medication Creation by Pharmacy Admin

### Purpose & Trigger
**Purpose:** Enable pharmacy administrators to add new medications to their pharmacy's catalog.

**Trigger:** Pharmacy admin navigates to `/admin/medications` and clicks "Add New Medication".

### Actors
- **Primary:** Pharmacy Administrator
- **System:** Database

### Preconditions
- User is authenticated as pharmacy admin
- User has pharmacy_id assigned
- Pharmacy exists in database

### Step-by-Step Flow

#### Step 1: Access Medication Management

```
User Action: Login as pharmacy admin
System Action:
1. Detect pharmacy admin role
2. Redirect to /admin/medications (default page)

Navigation Menu:
- Manage Medications ← This workflow
- Medication Catalog
- Incoming Prescriptions
```

#### Step 2: View Existing Medications

```
Route: /admin/medications

System Action:
1. Load medications for current pharmacy

Database Query:
SELECT
  m.id, m.name, m.category, m.description,
  m.price_cents, m.stock_quantity,
  m.is_prescription_required, m.is_active
FROM medications m
WHERE m.pharmacy_id = (
  SELECT pharmacy_id FROM pharmacy_admins WHERE user_id = $1
)
ORDER BY m.name ASC;
```

```
UI Layout:
┌────────────────────────────────────────────────────┐
│ Manage Medications - Greenwich                     │
├────────────────────────────────────────────────────┤
│ [Add New Medication]                  [Search Bar] │
├────────────────────────────────────────────────────┤
│ Name        | Category     | Stock | Price | Actions│
│ Lisinopril  | Blood Press. | 500   | $15   | Edit Del│
│ ...                                                │
└────────────────────────────────────────────────────┘
```

#### Step 3: Open Medication Creation Form

```
User Action: Click "Add New Medication" button

System Action:
1. Display medication creation form/modal
2. Pre-populate pharmacy_id from current user
```

#### Step 4: Fill Medication Form

```
Form Fields (Required):
- Medication Name (text input)
  Example: "Lisinopril"
  Validation: min 2 characters, max 200 characters

- Category (dropdown)
  Options:
    * Blood Pressure
    * Diabetes
    * Pain Relief
    * Antibiotics
    * Mental Health
    * Cardiovascular
    * Respiratory
    * Gastrointestinal
    * Dermatology
    * Other

- Description (textarea)
  Example: "Used to treat high blood pressure and heart failure"
  Validation: max 1000 characters

- Price (currency input)
  Example: $15.00
  Format: $XX.XX
  Stored as: price_cents (1500)

- Stock Quantity (number input)
  Example: 500
  Validation: non-negative integer

Form Fields (Optional):
- Prescription Required (checkbox)
  Default: true

- Active (checkbox)
  Default: true
```

```
Validation (Zod Schema):
{
  name: z.string().min(2).max(200),
  category: z.enum([...categories]),
  description: z.string().max(1000).optional(),
  price_cents: z.number().int().min(0),
  stock_quantity: z.number().int().min(0),
  is_prescription_required: z.boolean().default(true),
  is_active: z.boolean().default(true)
}
```

```
Example Form Data:
{
  name: "Lisinopril",
  category: "Blood Pressure",
  description: "ACE inhibitor used to treat high blood pressure",
  price_cents: 1500, // $15.00
  stock_quantity: 500,
  is_prescription_required: true,
  is_active: true
}
```

#### Step 5: Submit Medication

```
User Action: Click "Create Medication"

System Action:
1. Validate form client-side (React Hook Form + Zod)
2. POST to API or direct Supabase insert
```

```
Database Query:
INSERT INTO medications (
  pharmacy_id,
  name,
  category,
  description,
  price_cents,
  stock_quantity,
  is_prescription_required,
  is_active,
  created_at,
  updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
) RETURNING *;

pharmacy_id: Get from pharmacy_admins table for current user
```

```
Response (Success):
{
  success: true,
  medication: {
    id: "uuid",
    name: "Lisinopril",
    category: "Blood Pressure",
    ...
  }
}
```

#### Step 6: Success Feedback

```
System Action:
1. Close form/modal
2. Show success toast: "Medication added successfully"
3. Refresh medication list
4. New medication appears in table
```

#### Step 7: Edit Existing Medication (Same Form Flow)

```
User Action: Click "Edit" button on medication row

System Action:
1. Load medication data
2. Pre-populate form fields
3. Display edit form (same as create)

User Action: Modify fields

System Action:
1. Validate changes
2. UPDATE database

Database Query:
UPDATE medications
SET
  name = $2,
  category = $3,
  description = $4,
  price_cents = $5,
  stock_quantity = $6,
  is_prescription_required = $7,
  is_active = $8,
  updated_at = NOW()
WHERE id = $1 AND pharmacy_id = $9;

RLS ensures pharmacy admin can only edit their pharmacy's medications
```

#### Step 8: Delete Medication (Soft Delete)

```
User Action: Click "Delete" button

System Action:
1. Show confirmation dialog:
   "Are you sure you want to delete [Medication Name]?"
2. If confirmed, soft delete

Database Query:
UPDATE medications
SET is_active = false, updated_at = NOW()
WHERE id = $1 AND pharmacy_id = $2;

Soft delete preserves data for existing prescriptions
```

### Success Criteria
✅ Pharmacy admin can access medication management
✅ Form displays with all required fields
✅ Validation works correctly
✅ Medication saves to database
✅ Medication appears in catalog
✅ Only assigned pharmacy's medications shown
✅ Edit and delete functions work
✅ Stock quantity updates correctly

### Failure Paths

| Failure Point | Error Message | Recovery Action |
|--------------|---------------|-----------------|
| Duplicate medication name | "Medication already exists" | User modifies name or edits existing |
| Invalid price format | "Please enter valid price" | User corrects price field |
| Negative stock quantity | "Stock quantity cannot be negative" | User enters positive number |
| Missing required fields | "Please fill all required fields" | User completes form |
| Database constraint violation | "Unable to save medication" | User retries or contacts support |
| Unauthorized edit attempt | "Access Denied" | Verify pharmacy admin role |

### Integration Points
- **Supabase Database:** medications table
- **Pharmacy Assignment:** pharmacy_admins table
- **Prescription Creation:** Medications available in wizard Step 2
- **Medication Catalog:** Visible in catalog view

### Assumptions & Constraints
- ✅ Pharmacy admins can only manage their own pharmacy's medications
- ⚠️ No NDC code tracking
- ⚠️ No manufacturer information
- ⚠️ No expiration date tracking
- ⚠️ No barcode/SKU system
- ⚠️ No integration with wholesale suppliers
- ⚠️ Stock quantity manually managed (no automatic decrements)
- ⚠️ No medication images
- ⚠️ No bulk import/export
- ✅ Soft delete preserves prescription history

---

## 11. Cross-Workflow Integration Points

### Integration Map

```
┌─────────────────────────────────────────────────────────┐
│                    User Authentication                   │
│              (Supabase Auth + RLS Policies)              │
└─────────────────┬───────────────────────────────────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
┌──────▼────────┐    ┌──────▼────────┐
│   Provider    │    │ Pharmacy Admin│
│   Workflows   │    │   Workflows   │
└──────┬────────┘    └──────┬────────┘
       │                     │
       │ Patient Mgmt        │ Medication Mgmt
       │      ↓              │      ↓
       │ ┌─────────────┐    │ ┌─────────────┐
       │ │  Patients   │    │ │ Medications │
       │ │   Table     │    │ │   Table     │
       │ └─────┬───────┘    │ └─────┬───────┘
       │       │             │       │
       │       └─────────────┼───────┘
       │                     │
       │              ┌──────▼────────┐
       └──────────────►  Prescription │
                      │   Creation    │
                      └──────┬────────┘
                             │
                      ┌──────▼────────┐
                      │  DigitalRX    │
                      │  Submission   │
                      └──────┬────────┘
                             │
                      ┌──────▼────────┐
                      │ Prescriptions │
                      │    Table      │
                      └──────┬────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
┌──────▼────────┐    ┌──────▼────────┐    ┌──────▼────────┐
│ Provider View │    │ Admin Queue   │    │ Status Polling│
│ /prescriptions│    │/admin/prescr. │    │ (Background)  │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Key Integration Points

#### 1. Authentication → All Workflows
- Session validation on every request
- Role detection for navigation and access control
- User context available via `useUser()` hook

#### 2. Patient Management → Prescription Creation
- Patient selection in wizard Step 1
- Create new patient inline during prescription flow
- Patient data pre-populated in prescription submission

#### 3. Medication Catalog → Prescription Creation
- Medication selection in wizard Step 2
- Search and filter available medications
- Medication details auto-filled in prescription

#### 4. Prescription Submission → DigitalRX API
- Transform internal data to DigitalRX format
- Submit via `/RxWebRequest` endpoint
- Store QueueID for future status checks

#### 5. Prescription Storage → Database
- Save to prescriptions table
- Log to system_logs table
- Trigger real-time subscription updates

#### 6. Status Polling → DigitalRX API
- Automatic polling every 30 seconds
- Batch status checks via `/RxRequestStatus`
- Update prescriptions table with latest status

#### 7. Real-time Updates → UI Refresh
- Supabase Realtime subscriptions
- Automatic prescription list updates
- No manual page refresh required

#### 8. Role-Based Views → Database Filtering
- Providers: WHERE prescriber_id = current_user
- Pharmacy Admins: WHERE pharmacy_id = user's_pharmacy
- Super Admins: No filtering (see all)

---

## 12. Error Handling Patterns

### Global Error Handling Strategy

#### API Error Response Format

```typescript
// Success Response
{
  success: true,
  data: { ... },
  message: "Operation completed successfully"
}

// Error Response
{
  success: false,
  error: "User-friendly error message",
  error_details: "Technical details (dev only)",
  status: 400 | 401 | 403 | 404 | 500
}
```

#### Frontend Error Display

```typescript
// Toast Notification
toast.error("Unable to submit prescription", {
  description: "Please check your internet connection and try again",
  icon: <AlertCircle className="h-5 w-5" />,
  duration: 5000
});

// Inline Form Error
<FormMessage>
  Please enter a valid email address
</FormMessage>

// Modal Error Dialog
<AlertDialog>
  <AlertDialogTitle>Submission Failed</AlertDialogTitle>
  <AlertDialogDescription>
    The pharmacy system is temporarily unavailable.
    Your prescription has not been submitted. Please try again later.
  </AlertDialogDescription>
</AlertDialog>
```

### Common Error Scenarios

#### 1. Network Errors

**Symptom:** `fetch failed`, `ECONNREFUSED`, timeout

**Handling:**
```typescript
try {
  const response = await fetch(url);
} catch (error) {
  if (error instanceof TypeError && error.message === 'fetch failed') {
    toast.error("Connection Error", {
      description: "Unable to reach server. Check your internet connection."
    });
  }
}
```

**User Action:** Retry operation

#### 2. Authentication Errors

**Symptom:** `401 Unauthorized`, `403 Forbidden`

**Handling:**
```typescript
if (response.status === 401) {
  // Session expired
  await supabase.auth.signOut();
  router.push('/auth/login?session_expired=true');
}

if (response.status === 403) {
  // Insufficient permissions
  toast.error("Access Denied", {
    description: "You don't have permission to access this resource"
  });
  router.push('/dashboard');
}
```

**User Action:** Re-login or contact administrator

#### 3. Validation Errors

**Symptom:** `400 Bad Request`, Zod validation failure

**Handling:**
```typescript
// Client-side (React Hook Form + Zod)
const form = useForm({
  resolver: zodResolver(prescriptionSchema)
});

// Display errors inline
{errors.dosage && (
  <FormMessage>{errors.dosage.message}</FormMessage>
)}

// Server-side
if (!body.prescriber_id || !body.patient_id) {
  return NextResponse.json(
    { success: false, error: "Missing required fields" },
    { status: 400 }
  );
}
```

**User Action:** Correct invalid fields

#### 4. DigitalRX API Errors

**Symptom:** `400`, `404`, `500` from DigitalRX

**Handling:**
```typescript
if (!digitalRxResponse.ok) {
  const errorText = await digitalRxResponse.text();
  console.error("DigitalRX API error:", errorText);

  return NextResponse.json({
    success: false,
    error: `Pharmacy system error: ${digitalRxResponse.status}`,
    details: errorText
  }, { status: digitalRxResponse.status });
}
```

**User Action:** Retry or contact support

#### 5. Database Errors

**Symptom:** Supabase RLS violation, constraint violation

**Handling:**
```typescript
const { data, error } = await supabase
  .from('prescriptions')
  .insert(prescriptionData);

if (error) {
  console.error("Database error:", error);

  if (error.code === '23505') {
    // Unique constraint violation
    toast.error("Duplicate Entry", {
      description: "This prescription already exists"
    });
  } else {
    // Generic database error
    toast.error("Database Error", {
      description: "Unable to save data. Please try again."
    });
  }
}
```

**User Action:** Check data and retry

### Retry Strategies

#### Automatic Retry (Background Tasks)

```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry server errors (5xx)
      if (i < maxRetries - 1) {
        await delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
}
```

#### Manual Retry (User-Initiated)

```typescript
toast.error("Submission Failed", {
  description: "Unable to submit prescription",
  action: {
    label: "Retry",
    onClick: () => handleSubmit()
  }
});
```

### Logging Strategy

#### Console Logging (Development)

```typescript
console.log("📤 Submitting to DigitalRx:", payload);
console.log("📥 DigitalRx Response:", data);
console.error("❌ API Error:", error);
console.warn("⚠️ Status check failed:", queueId);
```

#### Database Logging (Production)

```typescript
await supabase.from('system_logs').insert({
  user_id,
  action: 'PRESCRIPTION_SUBMITTED',
  details: `${medication} for ${patient_name}`,
  queue_id,
  status: 'success',
  created_at: new Date()
});
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-17 | System | Initial MVP baseline documentation |

---

**Document Classification:** Internal Use Only
**Next Review Date:** Q1 2026
**Document Owner:** AIM E-Prescribing Portal Team
