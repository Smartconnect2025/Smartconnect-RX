# 🧪 COMPLETE SYSTEM TESTING CHECKLIST - RX PORTAL PRO

**Last Updated:** January 9, 2026
**Pre-Production Testing - ALL FEATURES**

---

## 🎯 TESTING INSTRUCTIONS

For each test:
- ✅ = PASS (Works as expected)
- ❌ = FAIL (Does not work, needs fix)
- ⚠️ = PARTIAL (Works but has issues)
- EXPECTED OUTCOME is listed for each test

---

# 1️⃣ AUTHENTICATION & USER MANAGEMENT

## 1.1 Login/Logout
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 1.1.1 | Login with valid credentials | Redirects to dashboard, no errors | [ ] |
| 1.1.2 | Login with invalid credentials | Shows error message "Invalid credentials" | [ ] |
| 1.1.3 | Logout from any page | Returns to login page, clears session | [ ] |
| 1.1.4 | Try to access protected pages when logged out | Redirects to login page | [ ] |

## 1.2 MFA (Multi-Factor Authentication)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 1.2.1 | Enable MFA from settings | QR code displayed, can scan with authenticator app | [ ] |
| 1.2.2 | Login with MFA enabled | Prompts for 6-digit code after password | [ ] |
| 1.2.3 | Enter correct MFA code | Successfully logs in | [ ] |
| 1.2.4 | Enter incorrect MFA code | Shows "Invalid code" error | [ ] |
| 1.2.5 | Disable MFA | MFA removed, next login doesn't require code | [ ] |

**APIs Used:**
- POST `/api/auth/mfa/send-code`
- POST `/api/auth/mfa/verify-code`

---

# 2️⃣ PRESCRIPTION MANAGEMENT (PROVIDER)

## 2.1 New Prescription - Step 1: Select Patient
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 2.1.1 | Navigate to "New Prescription" | Shows patient search/select screen | [ ] |
| 2.1.2 | Search for existing patient by name | Patient appears in search results | [ ] |
| 2.1.3 | Select patient | Moves to Step 2 with patient info saved | [ ] |
| 2.1.4 | Click "Create New Patient" | Opens new patient form | [ ] |
| 2.1.5 | Create patient and continue | Patient created, moves to Step 2 | [ ] |

**Files:** `app/(features)/prescriptions/new/step1/page.tsx`

## 2.2 New Prescription - Step 2: Prescription Details
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 2.2.1 | Select medication from dropdown | Medication name, form, strength auto-populate | [ ] |
| 2.2.2 | Enter strength/dosage | Accepts numeric + unit (e.g., "10mg") | [ ] |
| 2.2.3 | Enter quantity | Accepts numbers only | [ ] |
| 2.2.4 | Enter refills | Accepts numbers only | [ ] |
| 2.2.5 | Toggle "Dispense as Written" | Checkbox toggles on/off | [ ] |
| 2.2.6 | Select pharmacy | Shows Greenwich Pharmacy or other pharmacies | [ ] |
| 2.2.7 | Enter SIG (directions) | Accepts text instructions | [ ] |
| 2.2.8 | View medication price | Shows "Price of Medication: $XX.XX" | [ ] |
| 2.2.9 | Add pharmacy notes | Accepts text notes | [ ] |

**Files:** `app/(features)/prescriptions/new/step2/page.tsx`

## 2.3 New Prescription - Step 2: Multiple Oversight Fees ⭐ NEW
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 2.3.1 | Click "+ Add Fee" button | New fee entry row appears | [ ] |
| 2.3.2 | Enter fee amount (e.g., $50) | Accepts dollar amount | [ ] |
| 2.3.3 | Select fee reason from dropdown | Shows 5 options: Dose Titration, Side Effect Monitoring, Therapeutic Response, Adherence Tracking, Contraindication Screening | [ ] |
| 2.3.4 | Add second fee | Second fee row appears below first | [ ] |
| 2.3.5 | Remove a fee | Fee row disappears | [ ] |
| 2.3.6 | Try to proceed without entering fee amount | Shows validation error | [ ] |
| 2.3.7 | Try to proceed without selecting reason | Shows validation error | [ ] |
| 2.3.8 | Add 5+ fees | All fees display correctly | [ ] |

**Expected Dropdown Options:**
- Dose Titration & Adjustment
- Side Effect & Safety Monitoring
- Therapeutic Response Review
- Medication Adherence Tracking
- Contraindication Screening

## 2.4 New Prescription - Step 3: Review & Submit ⭐ UPDATED
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 2.4.1 | Arrive at review page | Shows all entered data | [ ] |
| 2.4.2 | Verify Patient Information section | Shows: Name, DOB, Email, Phone | [ ] |
| 2.4.3 | Verify Medication Information section | Shows: Medication name, Strength, Form, Vial Size, Quantity, Refills, DAW, Pharmacy (in color) | [ ] |
| 2.4.4 | Verify Directions (SIG) section | Shows entered directions | [ ] |
| 2.4.5 | Verify "Price of Medication" section | Shows medication price in green box: $XX.XX | [ ] |
| 2.4.6 | Verify "Medication Oversight & Monitoring Fees" section | Shows ALL entered fees with reasons in blue boxes | [ ] |
| 2.4.7 | Verify "Total Oversight Fees" | Shows sum of all oversight fees in blue | [ ] |
| 2.4.8 | Verify "Total Patient Cost" | Shows medication price + all oversight fees in green/blue gradient box | [ ] |
| 2.4.9 | Click "Back to Edit" | Returns to Step 2 with all data preserved | [ ] |
| 2.4.10 | Click "Prescribe" button | Shows loading overlay "Submitting prescription..." | [ ] |
| 2.4.11 | Successful submission | Shows success toast with Queue ID, redirects to prescriptions list | [ ] |
| 2.4.12 | Failed submission | Shows error toast with specific error message | [ ] |

**Files:** `app/(features)/prescriptions/new/step3/page.tsx`

**Expected Display Example:**
```
Price of Medication: $25.00

Medication Oversight & Monitoring Fees:
[Blue Box 1] Side Effect Monitoring - $50.00
[Blue Box 2] Dose Titration - $30.00

Total Oversight Fees: $80.00
Total Patient Cost: $105.00
```

## 2.5 Prescriptions List
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 2.5.1 | Navigate to "Prescriptions" | Shows list of all prescriptions | [ ] |
| 2.5.2 | View prescription details | Shows medication, patient, status, date | [ ] |
| 2.5.3 | Filter by status | Shows only prescriptions with selected status | [ ] |
| 2.5.4 | Search by patient name | Filters prescriptions by patient | [ ] |
| 2.5.5 | Click on prescription | Opens prescription detail view | [ ] |

**Files:** `app/(features)/prescriptions/page.tsx`

**APIs Used:**
- POST `/api/prescriptions/submit`
- GET `/api/prescriptions/status`
- GET `/api/prescriptions/[id]/check-status`

---

# 3️⃣ MEDICATION CATALOG (PHARMACY ADMIN)

## 3.1 Medication Catalog View
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 3.1.1 | Navigate to "Medication Catalog" | Shows table of all medications | [ ] |
| 3.1.2 | View medication count | Shows "Showing X of Y medications" at top | [ ] |
| 3.1.3 | Search by medication name | Filters list in real-time | [ ] |
| 3.1.4 | Search by strength | Filters list in real-time | [ ] |
| 3.1.5 | Search by form | Filters list in real-time | [ ] |
| 3.1.6 | Filter by category dropdown | Shows only medications in selected category | [ ] |
| 3.1.7 | Select "All" category | Shows all medications | [ ] |
| 3.1.8 | Click expand (▼) button | Shows detailed medication info below row | [ ] |
| 3.1.9 | View expanded details | Shows: Basic info, Pricing to AIMRx, AIMRx Site Pricing, Dosage Instructions, Detailed Description, Stock & Availability, Preparation Time | [ ] |

**Files:** `app/(features)/admin/medication-catalog/page.tsx`

## 3.2 Bulk Medication Upload ⭐ UPDATED
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 3.2.1 | Click "Bulk Upload CSV" | Opens upload page | [ ] |
| 3.2.2 | View CSV format guide | Shows required columns with dual pricing fields | [ ] |
| 3.2.3 | Download sample CSV | Downloads template with correct headers | [ ] |
| 3.2.4 | Upload valid CSV with dual pricing | Shows success message, processes all rows | [ ] |
| 3.2.5 | Upload CSV missing required fields | Shows validation errors | [ ] |
| 3.2.6 | Upload CSV with invalid pricing | Shows error for specific rows | [ ] |
| 3.2.7 | View processing results | Shows count of successful/failed uploads | [ ] |
| 3.2.8 | Navigate back to catalog | New medications appear in list | [ ] |

**Required CSV Columns:**
1. name (required)
2. strength
3. form
4. vial_size
5. ndc
6. category
7. retail_price_cents (required) - Pricing to AIMRx
8. aimrx_site_pricing_cents (required) - AIMRx Site Pricing ⭐ NEW
9. dosage_instructions
10. detailed_description
11. in_stock (true/false)
12. preparation_time_days

**Files:** `app/(features)/admin/medications/bulk-upload/page.tsx`

**APIs Used:**
- POST `/api/admin/medications/bulk-upload`

## 3.3 Edit Medication ⭐ NEW FEATURE
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 3.3.1 | Click blue pencil (✏️) icon | Opens edit modal with all current data | [ ] |
| 3.3.2 | Verify all fields populated | Shows: Name, Strength, Form, Vial Size, NDC, Category, Pricing to AIMRx, AIMRx Site Pricing, In Stock, Active Status, Prep Time, Dosage Instructions, Detailed Description | [ ] |
| 3.3.3 | Edit medication name | Changes reflected in form | [ ] |
| 3.3.4 | Edit Pricing to AIMRx field | Accepts decimal numbers (e.g., 25.99) | [ ] |
| 3.3.5 | Edit AIMRx Site Pricing field | Accepts decimal numbers (e.g., 30.00) | [ ] |
| 3.3.6 | Change "In Stock" dropdown | Toggle between In Stock / Out of Stock | [ ] |
| 3.3.7 | Change "Active Status" dropdown | Toggle between Active / Inactive | [ ] |
| 3.3.8 | Edit preparation time | Accepts numbers (days) | [ ] |
| 3.3.9 | Edit dosage instructions | Accepts multi-line text | [ ] |
| 3.3.10 | Edit detailed description | Accepts multi-line text | [ ] |
| 3.3.11 | Click "Cancel" | Closes modal, no changes saved | [ ] |
| 3.3.12 | Click "Save Changes" as pharmacy admin | Shows "Medication updated successfully!", modal closes, table refreshes with updated data | [ ] |
| 3.3.13 | Click "Save Changes" as platform admin | Successfully updates ANY medication regardless of pharmacy | [ ] |
| 3.3.14 | Edit fails (no permission) | Shows error message | [ ] |

**Files:** `app/(features)/admin/medication-catalog/page.tsx`

**APIs Used:**
- PATCH `/api/admin/medications/[id]`

## 3.4 Delete Medication
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 3.4.1 | Click red trash (🗑️) icon | Shows confirmation dialog | [ ] |
| 3.4.2 | Click "Cancel" on confirmation | Dialog closes, medication not deleted | [ ] |
| 3.4.3 | Click "OK" on confirmation | Medication deleted, removed from list | [ ] |
| 3.4.4 | Delete multiple with checkboxes | Checkbox appears next to each medication | [ ] |
| 3.4.5 | Select 5 medications | Checkboxes checked, counter updates | [ ] |
| 3.4.6 | Click "Delete Selected (5)" | Confirmation dialog shows | [ ] |
| 3.4.7 | Confirm bulk delete | All selected medications deleted | [ ] |

**APIs Used:**
- DELETE `/api/admin/medications/[id]`

## 3.5 Create Single Medication
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 3.5.1 | Click "Create Medication" | Opens medication form | [ ] |
| 3.5.2 | Fill all required fields | Form accepts data | [ ] |
| 3.5.3 | Enter both pricing fields | Accepts Pricing to AIMRx and AIMRx Site Pricing | [ ] |
| 3.5.4 | Submit form | Shows success message, redirects to catalog | [ ] |
| 3.5.5 | View new medication | Appears in catalog list | [ ] |

**Files:** `app/(features)/admin/medications/page.tsx`

**APIs Used:**
- POST `/api/admin/medications`
- GET `/api/admin/medications`

---

# 4️⃣ PATIENT MANAGEMENT (EMR)

## 4.1 Patient List
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.1.1 | Navigate to "Patients" or "Basic EMR" | Shows patient list | [ ] |
| 4.1.2 | Search by patient name | Filters patients in real-time | [ ] |
| 4.1.3 | Filter by provider | Shows only patients for selected provider | [ ] |
| 4.1.4 | Sort by name/date | List re-orders | [ ] |
| 4.1.5 | Click on patient row | Opens patient detail page | [ ] |

**Files:** `app/(features)/basic-emr/page.tsx`

## 4.2 Create New Patient
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.2.1 | Click "Add New Patient" | Opens patient form | [ ] |
| 4.2.2 | Fill required fields (First Name, Last Name, DOB) | Form accepts data | [ ] |
| 4.2.3 | Fill optional fields (Email, Phone, Address) | Form accepts data | [ ] |
| 4.2.4 | Try to submit without required fields | Shows validation errors | [ ] |
| 4.2.5 | Submit valid form | Patient created, redirects to patient detail | [ ] |

**Files:** `app/(features)/basic-emr/patients/new/page.tsx`

**APIs Used:**
- POST `/api/basic-emr/patients`

## 4.3 View Patient Details
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.3.1 | Open patient profile | Shows patient info, tabs for Encounters, Allergies, Conditions, Medications, Vitals | [ ] |
| 4.3.2 | View Demographics section | Shows: Name, DOB, Email, Phone, Address | [ ] |
| 4.3.3 | Click "Edit Patient" | Opens edit form | [ ] |
| 4.3.4 | Update patient info | Changes saved successfully | [ ] |

**Files:** `app/(features)/basic-emr/patients/[id]/page.tsx`

## 4.4 Patient Encounters
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.4.1 | Click "Encounters" tab | Shows list of patient encounters | [ ] |
| 4.4.2 | Click "New Encounter" | Opens encounter form | [ ] |
| 4.4.3 | Enter chief complaint | Text field accepts input | [ ] |
| 4.4.4 | Enter HPI, ROS, physical exam | All fields accept text | [ ] |
| 4.4.5 | Add diagnosis/assessment | Accepts text or ICD codes | [ ] |
| 4.4.6 | Add plan | Accepts text | [ ] |
| 4.4.7 | Save encounter | Encounter created, appears in list | [ ] |
| 4.4.8 | View encounter details | All entered data displays correctly | [ ] |

**Files:** `app/(features)/basic-emr/patients/[id]/encounters/[encounterId]/page.tsx`

**APIs Used:**
- POST `/api/basic-emr/encounters`
- GET `/api/basic-emr/patients/[id]/encounters`
- PATCH `/api/basic-emr/encounters/[id]`

## 4.5 Patient Allergies
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.5.1 | Click "Allergies" tab | Shows allergy list | [ ] |
| 4.5.2 | Click "Add Allergy" | Opens allergy form | [ ] |
| 4.5.3 | Enter allergen name | Field accepts text | [ ] |
| 4.5.4 | Select reaction type | Dropdown shows options | [ ] |
| 4.5.5 | Select severity | Dropdown shows: Mild, Moderate, Severe | [ ] |
| 4.5.6 | Save allergy | Allergy added to list | [ ] |
| 4.5.7 | Delete allergy | Confirmation shown, allergy removed | [ ] |

**APIs Used:**
- POST `/api/basic-emr/allergies`
- DELETE `/api/basic-emr/allergies/[id]`

## 4.6 Patient Conditions
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.6.1 | Click "Conditions" tab | Shows condition list | [ ] |
| 4.6.2 | Add new condition | Form opens with ICD-10 code field | [ ] |
| 4.6.3 | Enter condition name | Accepts text | [ ] |
| 4.6.4 | Enter ICD-10 code | Accepts alphanumeric | [ ] |
| 4.6.5 | Select status (Active/Resolved) | Dropdown works | [ ] |
| 4.6.6 | Save condition | Condition appears in list | [ ] |

**APIs Used:**
- POST `/api/basic-emr/conditions`
- PATCH `/api/basic-emr/conditions/[id]`

## 4.7 Patient Medications (Current)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.7.1 | Click "Medications" tab | Shows current medications | [ ] |
| 4.7.2 | View medication details | Shows name, dosage, frequency, start date | [ ] |
| 4.7.3 | Mark medication as discontinued | Status changes to "Discontinued" | [ ] |

**APIs Used:**
- GET `/api/basic-emr/medications`
- PATCH `/api/basic-emr/medications/[id]`

## 4.8 Patient Vitals
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 4.8.1 | Click "Vitals" tab | Shows vitals history | [ ] |
| 4.8.2 | Add new vitals | Form opens with fields: Height, Weight, BP, Pulse, Temp, O2 Sat | [ ] |
| 4.8.3 | Enter all vital signs | All fields accept numeric values | [ ] |
| 4.8.4 | Save vitals | Vitals saved with timestamp | [ ] |
| 4.8.5 | View vitals chart | Graph displays vitals over time | [ ] |

**APIs Used:**
- POST `/api/basic-emr/vitals`
- GET `/api/basic-emr/vitals`
- PATCH `/api/basic-emr/vitals/[id]`

---

# 5️⃣ PROVIDER PROFILE

## 5.1 Provider Profile - Personal Info
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 5.1.1 | Navigate to "Provider Profile" or "Profile Settings" | Shows profile form | [ ] |
| 5.1.2 | View Personal Information section | Shows: First Name, Last Name, DOB, Gender, Email, Phone | [ ] |
| 5.1.3 | Edit personal info | All fields editable | [ ] |
| 5.1.4 | Save changes | Success message, changes persist | [ ] |

**Files:** `app/(features)/provider/profile/page.tsx`

## 5.2 Provider Profile - Professional Info
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 5.2.1 | Navigate to "Professional Information" tab | Shows professional fields | [ ] |
| 5.2.2 | View fields | Shows: Specialties, Medical Licenses, Board Certifications, Education, Languages, Years of Experience, Bio | [ ] |
| 5.2.3 | Add specialty | New specialty added to list | [ ] |
| 5.2.4 | Add medical license | License with state and number added | [ ] |
| 5.2.5 | Add board certification | Certification added | [ ] |
| 5.2.6 | Edit bio | Text area accepts multi-line input | [ ] |
| 5.2.7 | Save all changes | Success message, data persists | [ ] |

**Files:** `app/(features)/provider/professional-info/page.tsx`

## 5.3 Provider Profile - Address & Tax Info ⭐ UPDATED
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 5.3.1 | Navigate to "Address & Billing" section | Shows Physical Address, Billing Address, Tax Information | [ ] |
| 5.3.2 | Verify Physical Address fields | Shows: Street, City, State, Zip, Country | [ ] |
| 5.3.3 | Verify Billing Address fields | Shows: Street, City, State, Zip, Country | [ ] |
| 5.3.4 | Verify Tax Information section | Shows ONLY: Tax ID / EIN field | [ ] |
| 5.3.5 | Verify Payment & Banking section REMOVED | SHOULD NOT SEE: Bank Account, Routing Number, Payment Method, Payment Schedule, SWIFT Code | [ ] |
| 5.3.6 | Enter Tax ID (format: XX-XXXXXXX) | Field accepts hyphenated format | [ ] |
| 5.3.7 | Save changes | Tax ID saves successfully | [ ] |

**Files:** `features/provider-profile/components/profile/AddressSection.tsx`

**IMPORTANT:** Payment & Banking Information section was REMOVED. Only Tax ID/EIN remains.

## 5.4 Provider Availability
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 5.4.1 | Navigate to "Availability" | Shows weekly schedule grid | [ ] |
| 5.4.2 | Toggle day availability | Can enable/disable each day | [ ] |
| 5.4.3 | Set start time for a day | Time picker opens, can select time | [ ] |
| 5.4.4 | Set end time for a day | Time picker opens, can select time | [ ] |
| 5.4.5 | Add multiple time slots for one day | Multiple time ranges appear | [ ] |
| 5.4.6 | Remove time slot | Slot removed from schedule | [ ] |
| 5.4.7 | Save availability | Success message, schedule persists | [ ] |

**Files:** `app/(features)/provider/availability/page.tsx`

## 5.5 Practice Details
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 5.5.1 | Navigate to "Practice Details" | Shows practice info form | [ ] |
| 5.5.2 | View fields | Shows: Practice Type, Practice Address, Services Offered, Insurance Plans Accepted, Hospital Affiliations | [ ] |
| 5.5.3 | Select practice type | Dropdown shows: Solo, Group, Hospital, Clinic, Telehealth | [ ] |
| 5.5.4 | Add service offered | Service added to list | [ ] |
| 5.5.5 | Add insurance plan | Insurance plan added to list | [ ] |
| 5.5.6 | Save changes | Success message, data persists | [ ] |

**Files:** `app/(features)/provider/practice-details/page.tsx`

---

# 6️⃣ PHARMACY MANAGEMENT (ADMIN)

## 6.1 Pharmacy List
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 6.1.1 | Navigate to "Pharmacy Management" | Shows list of all pharmacies | [ ] |
| 6.1.2 | View pharmacy details | Shows: Name, Slug, Store ID, API Key (masked), Status | [ ] |
| 6.1.3 | Click "Edit" on pharmacy | Opens edit form | [ ] |

**Files:** `app/(features)/admin/pharmacy-management/page.tsx`

## 6.2 Create/Edit Pharmacy
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 6.2.1 | Click "Add Pharmacy" | Opens create form | [ ] |
| 6.2.2 | Enter pharmacy name | Field accepts text | [ ] |
| 6.2.3 | Enter slug | Field accepts lowercase, hyphens | [ ] |
| 6.2.4 | Enter Store ID | Field accepts alphanumeric | [ ] |
| 6.2.5 | Set brand color | Color picker opens | [ ] |
| 6.2.6 | Generate API key | API key auto-generated | [ ] |
| 6.2.7 | Save pharmacy | Pharmacy created, appears in list | [ ] |
| 6.2.8 | Edit existing pharmacy | Changes save successfully | [ ] |
| 6.2.9 | Refresh API key | New API key generated, old one invalidated | [ ] |

**APIs Used:**
- POST `/api/admin/pharmacies`
- PATCH `/api/admin/pharmacies/[id]`
- POST `/api/admin/pharmacies/[id]/refresh-api-key`

## 6.3 Pharmacy Orders
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 6.3.1 | Navigate to "Pharmacy Orders" | Shows all orders from all pharmacies | [ ] |
| 6.3.2 | Filter by pharmacy | Shows only orders for selected pharmacy | [ ] |
| 6.3.3 | Filter by status | Shows only orders with selected status | [ ] |
| 6.3.4 | View order details | Shows: Patient, Medication, Prescriber, Status, Dates | [ ] |
| 6.3.5 | Update order status | Status dropdown changes, saves on selection | [ ] |

**Files:** `app/(features)/admin/pharmacy-orders/page.tsx`

**APIs Used:**
- GET `/api/admin/pharmacy-orders`

---

# 7️⃣ PROVIDER MANAGEMENT (ADMIN)

## 7.1 Providers List
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 7.1.1 | Navigate to "Providers" (admin) | Shows all providers | [ ] |
| 7.1.2 | View provider details | Shows: Name, Email, Specialty, Status, Tier Level | [ ] |
| 7.1.3 | Search by provider name | Filters list in real-time | [ ] |
| 7.1.4 | Filter by status (Active/Inactive) | Shows only matching providers | [ ] |
| 7.1.5 | Filter by tier level | Shows only providers in selected tier | [ ] |

**Files:** `app/(features)/admin/providers/page.tsx`

## 7.2 Activate/Deactivate Provider
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 7.2.1 | Toggle "Active" switch on provider | Provider status changes | [ ] |
| 7.2.2 | Deactivate provider | Provider cannot log in or submit prescriptions | [ ] |
| 7.2.3 | Reactivate provider | Provider can log in and function normally | [ ] |

**APIs Used:**
- PATCH `/api/admin/providers/[id]`

## 7.3 Assign Provider Tier
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 7.3.1 | Click "Assign Tier" on provider | Opens tier selection dialog | [ ] |
| 7.3.2 | Select tier (Tier 1, 2, 3, or 4) | Tier dropdown shows all options | [ ] |
| 7.3.3 | Save tier assignment | Provider tier updated, discount rates apply | [ ] |
| 7.3.4 | Verify tier in provider list | Tier level displays correctly | [ ] |

**APIs Used:**
- POST `/api/admin/providers/[id]/tier`

## 7.4 Reset Provider Password
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 7.4.1 | Click "Reset Password" on provider | Confirmation dialog appears | [ ] |
| 7.4.2 | Confirm reset | Email sent to provider with password reset link | [ ] |
| 7.4.3 | Provider receives email | Email contains valid reset link | [ ] |
| 7.4.4 | Provider clicks link | Opens password reset page | [ ] |
| 7.4.5 | Provider sets new password | Password updated, can log in | [ ] |

**APIs Used:**
- POST `/api/admin/reset-provider-password`

## 7.5 Invite New Provider
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 7.5.1 | Click "Invite Provider" | Opens invite form | [ ] |
| 7.5.2 | Enter provider email | Field accepts email format | [ ] |
| 7.5.3 | Enter first and last name | Fields accept text | [ ] |
| 7.5.4 | Select role | Dropdown shows: Provider, Admin | [ ] |
| 7.5.5 | Send invitation | Email sent to provider with signup link | [ ] |
| 7.5.6 | Provider receives email | Email contains signup instructions | [ ] |
| 7.5.7 | Provider completes signup | Account created, appears in provider list | [ ] |

**APIs Used:**
- POST `/api/admin/invite-doctor`

---

# 8️⃣ PATIENT MANAGEMENT (ADMIN)

## 8.1 Patients List (Admin View)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 8.1.1 | Navigate to "Patients" (admin) | Shows all patients from all providers | [ ] |
| 8.1.2 | Search by patient name | Filters patients in real-time | [ ] |
| 8.1.3 | Filter by provider | Shows only patients for selected provider | [ ] |
| 8.1.4 | Sort by date added | List re-orders | [ ] |
| 8.1.5 | Click on patient | Opens patient detail page | [ ] |

**Files:** `app/(features)/admin/patients/page.tsx`

## 8.2 Edit Patient (Admin)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 8.2.1 | Click "Edit" on patient | Opens edit form | [ ] |
| 8.2.2 | Modify patient info | All fields editable | [ ] |
| 8.2.3 | Change assigned provider | Provider dropdown works | [ ] |
| 8.2.4 | Save changes | Patient updated successfully | [ ] |

**APIs Used:**
- PATCH `/api/admin/patients/[id]`

## 8.3 Delete Patient (Admin)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 8.3.1 | Click "Delete" on patient | Confirmation dialog appears | [ ] |
| 8.3.2 | Confirm deletion | Patient and all related data deleted | [ ] |
| 8.3.3 | Verify deletion | Patient no longer appears in list | [ ] |

**APIs Used:**
- DELETE `/api/admin/patients/[id]`

---

# 9️⃣ TIER MANAGEMENT (ADMIN)

## 9.1 View Tiers
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 9.1.1 | Navigate to "Tiers" | Shows list of all discount tiers | [ ] |
| 9.1.2 | View tier details | Shows: Tier Name, Discount Percentage, Description | [ ] |

**Files:** `app/(features)/admin/tiers/page.tsx`

## 9.2 Create/Edit Tier
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 9.2.1 | Click "Add Tier" | Opens tier form | [ ] |
| 9.2.2 | Enter tier name (e.g., "Tier 1") | Field accepts text | [ ] |
| 9.2.3 | Enter discount percentage | Field accepts 0-100 | [ ] |
| 9.2.4 | Enter description | Text area accepts input | [ ] |
| 9.2.5 | Save tier | Tier created, appears in list | [ ] |
| 9.2.6 | Edit existing tier | Changes save successfully | [ ] |

**APIs Used:**
- POST `/api/admin/tiers`
- PATCH `/api/admin/tiers/[id]`

## 9.3 Delete Tier
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 9.3.1 | Click "Delete" on tier | Confirmation dialog appears | [ ] |
| 9.3.2 | Try to delete tier with assigned providers | Shows error: "Cannot delete tier with active providers" | [ ] |
| 9.3.3 | Delete unused tier | Tier deleted successfully | [ ] |

**APIs Used:**
- DELETE `/api/admin/tiers/[id]`

---

# 🔟 TAGS/CATEGORIES (ADMIN)

## 10.1 View Tags
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 10.1.1 | Navigate to "Tags" | Shows list of all tags/categories | [ ] |
| 10.1.2 | View tag details | Shows: Tag Name, Color, Usage Count | [ ] |

**Files:** `app/(features)/admin/tags/page.tsx`

## 10.2 Create/Edit Tag
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 10.2.1 | Click "Add Tag" | Opens tag form | [ ] |
| 10.2.2 | Enter tag name | Field accepts text | [ ] |
| 10.2.3 | Select tag color | Color picker opens | [ ] |
| 10.2.4 | Save tag | Tag created, appears in list | [ ] |
| 10.2.5 | Edit existing tag | Changes save successfully | [ ] |

**APIs Used:**
- POST `/api/admin/tags`
- PATCH `/api/admin/tags/[id]`

---

# 1️⃣1️⃣ SYSTEM LOGS & MONITORING (ADMIN)

## 11.1 API Logs
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 11.1.1 | Navigate to "API Logs" | Shows recent API calls | [ ] |
| 11.1.2 | View log details | Shows: Timestamp, User, Action, Endpoint, Status Code, Response Time | [ ] |
| 11.1.3 | Filter by status code | Shows only logs with selected status | [ ] |
| 11.1.4 | Filter by date range | Shows logs within selected range | [ ] |
| 11.1.5 | Search by user email | Filters logs by user | [ ] |
| 11.1.6 | View error details | Click on error log shows full stack trace | [ ] |

**Files:** `app/(features)/admin/api-logs/page.tsx`

**APIs Used:**
- GET `/api/admin/system-logs`

## 11.2 System Health
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 11.2.1 | Navigate to "System Health" | Shows health dashboard | [ ] |
| 11.2.2 | View API health status | Shows: API response time, error rate, uptime | [ ] |
| 11.2.3 | View database health | Shows: Connection status, query performance | [ ] |
| 11.2.4 | View DigitalRx API status | Shows: Connection status, last successful call | [ ] |

**APIs Used:**
- GET `/api/admin/api-health`

---

# 1️⃣2️⃣ SECURITY & SETTINGS

## 12.1 Security Settings
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 12.1.1 | Navigate to "Settings > Security" | Shows security options | [ ] |
| 12.1.2 | Change password | Password change form opens | [ ] |
| 12.1.3 | Enter current password | Field accepts input | [ ] |
| 12.1.4 | Enter new password (meets requirements) | Field validates strength | [ ] |
| 12.1.5 | Enter new password (too weak) | Shows validation error | [ ] |
| 12.1.6 | Confirm new password (matches) | Form submits successfully | [ ] |
| 12.1.7 | Confirm new password (doesn't match) | Shows "Passwords don't match" error | [ ] |
| 12.1.8 | Enable MFA | See section 1.2 | [ ] |

**Files:** `app/(features)/settings/security/page.tsx`

---

# 1️⃣3️⃣ ORDERS & REVIEW (PROVIDER)

## 13.1 Review Orders
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 13.1.1 | Navigate to "Review Orders" | Shows orders requiring provider review | [ ] |
| 13.1.2 | Filter by order type | Shows only selected order types | [ ] |
| 13.1.3 | Filter by status | Shows only orders with selected status | [ ] |
| 13.1.4 | Click on order | Opens order detail view | [ ] |
| 13.1.5 | View order details | Shows: Patient, Tests/Items ordered, Ordering provider, Date, Notes | [ ] |
| 13.1.6 | Approve order | Order status changes to "Approved" | [ ] |
| 13.1.7 | Reject order | Rejection reason dialog appears | [ ] |
| 13.1.8 | Enter rejection reason | Text field accepts input | [ ] |
| 13.1.9 | Submit rejection | Order status changes to "Rejected", reason saved | [ ] |

**Files:** `app/(features)/basic-emr/provider/review-orders/page.tsx`

**APIs Used:**
- GET `/api/basic-emr/orders/review-list`
- PATCH `/api/basic-emr/orders/[id]`

---

# 1️⃣4️⃣ SUPER ADMIN FUNCTIONS

## 14.1 Super Admin Dashboard
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 14.1.1 | Login as super admin | Access to all admin features | [ ] |
| 14.1.2 | Navigate to "Super Admin" | Shows super admin dashboard | [ ] |
| 14.1.3 | View system statistics | Shows: Total users, providers, patients, prescriptions | [ ] |

**Files:** `app/(features)/super-admin/page.tsx`

## 14.2 Database Management
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 14.2.1 | Navigate to "Database Check" | Shows database health | [ ] |
| 14.2.2 | View table statistics | Shows row counts for all tables | [ ] |
| 14.2.3 | Run schema check | Verifies all tables and columns exist | [ ] |
| 14.2.4 | Force schema reload | Supabase PostgREST schema cache refreshed | [ ] |

**Files:** `app/(features)/admin/database-check/page.tsx`

**APIs Used:**
- GET `/api/admin/check-schema`
- POST `/api/admin/reload-schema`

---

# 1️⃣5️⃣ CRITICAL INTEGRATION TESTS

## 15.1 DigitalRx API Integration
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 15.1.1 | Submit prescription to DigitalRx | Receives Queue ID in response | [ ] |
| 15.1.2 | Check prescription status | Returns current status from DigitalRx | [ ] |
| 15.1.3 | Handle DigitalRx API errors | Shows user-friendly error message | [ ] |
| 15.1.4 | Test with invalid credentials | Returns authentication error | [ ] |

**APIs Used:**
- POST `/api/prescriptions/submit` (calls DigitalRx API)
- GET `/api/prescriptions/status`
- GET `/api/prescriptions/[id]/check-status`

## 15.2 Email Notifications
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 15.2.1 | Create new prescription | Provider receives confirmation email | [ ] |
| 15.2.2 | Check email content | Shows: Patient name, Medication, Dosage, All oversight fees, Total cost | [ ] |
| 15.2.3 | Patient receives prescription receipt | Email sent to patient with details | [ ] |
| 15.2.4 | Provider password reset | Email sent with reset link | [ ] |
| 15.2.5 | Provider invitation | Email sent with signup link | [ ] |
| 15.2.6 | MFA code email | Email sent with 6-digit code | [ ] |

---

# 1️⃣6️⃣ EDGE CASES & ERROR HANDLING

## 16.1 Session Management
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 16.1.1 | Let session expire (idle 30 min) | Redirected to login page | [ ] |
| 16.1.2 | Try to use expired session | Shows "Session expired" error | [ ] |
| 16.1.3 | Login from multiple devices | Both sessions work independently | [ ] |
| 16.1.4 | Logout from one device | Other device session unaffected | [ ] |

## 16.2 Network Errors
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 16.2.1 | Disconnect internet during form submission | Shows "Network error" message | [ ] |
| 16.2.2 | Reconnect and retry | Form submits successfully | [ ] |
| 16.2.3 | API timeout (>30 seconds) | Shows timeout error | [ ] |

## 16.3 Validation & Data Integrity
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 16.3.1 | Enter invalid email format | Shows validation error | [ ] |
| 16.3.2 | Enter negative pricing | Shows "Must be positive" error | [ ] |
| 16.3.3 | Enter text in numeric fields | Field rejects non-numeric input | [ ] |
| 16.3.4 | Submit form with missing required fields | Shows all validation errors | [ ] |
| 16.3.5 | Enter SQL injection attempt | Input sanitized, no database error | [ ] |
| 16.3.6 | Enter XSS script in text fields | Script escaped, not executed | [ ] |

---

# 1️⃣7️⃣ PERFORMANCE TESTS

## 17.1 Load Times
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 17.1.1 | Load medication catalog (100+ items) | Page loads in <3 seconds | [ ] |
| 17.1.2 | Load patient list (50+ patients) | Page loads in <2 seconds | [ ] |
| 17.1.3 | Load prescription list (100+ prescriptions) | Page loads in <3 seconds | [ ] |
| 17.1.4 | Search medications (real-time) | Results appear in <500ms | [ ] |

## 17.2 Bulk Operations
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 17.2.1 | Upload CSV with 500 medications | Processes within 30 seconds | [ ] |
| 17.2.2 | Delete 50 medications at once | Completes within 10 seconds | [ ] |
| 17.2.3 | Load API logs (1000+ entries) | Pagination works, loads smoothly | [ ] |

---

# 📧 EMAIL TESTING CHECKLIST

## 18.1 Prescription Emails (Updated with Oversight Fees)
| Test # | Email Type | Expected Content | Status |
|--------|-----------|------------------|--------|
| 18.1.1 | Prescription Confirmation (Provider) | Subject: "Prescription Submitted", Contains: Patient name, Medication, Dosage, **All oversight fees listed**, **Total oversight fees**, **Total patient cost**, Queue ID | [ ] |
| 18.1.2 | Prescription Receipt (Patient) | Subject: "Your Prescription", Contains: Medication name, Dosage, **Price of medication**, **All oversight fees with reasons**, **Total cost**, Directions (SIG), Pharmacy info | [ ] |
| 18.1.3 | Prescription Status Update | Subject: "Prescription Status Update", Contains: Current status, Queue ID, Next steps | [ ] |

## 18.2 Authentication Emails
| Test # | Email Type | Expected Content | Status |
|--------|-----------|------------------|--------|
| 18.2.1 | Provider Invitation | Subject: "You're invited to join RxPortal", Contains: Signup link, Expires in 7 days | [ ] |
| 18.2.2 | Password Reset | Subject: "Reset your password", Contains: Reset link (valid 1 hour), Security warning | [ ] |
| 18.2.3 | MFA Code | Subject: "Your verification code", Contains: 6-digit code, Expires in 10 minutes | [ ] |
| 18.2.4 | Welcome Email (New Provider) | Subject: "Welcome to RxPortal", Contains: Getting started guide, Support contact | [ ] |

## 18.3 System Notifications
| Test # | Email Type | Expected Content | Status |
|--------|-----------|------------------|--------|
| 18.3.1 | New Order Notification (Provider) | Subject: "New order requires review", Contains: Patient name, Order type, Review link | [ ] |
| 18.3.2 | Order Approved (Patient) | Subject: "Your order has been approved", Contains: Order details, Next steps | [ ] |
| 18.3.3 | Order Rejected (Patient) | Subject: "Order status update", Contains: Rejection reason, Contact info | [ ] |

---

# 🎯 DEPLOYMENT VERIFICATION (PRODUCTION)

## 19.1 Post-Deployment Checks
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 19.1.1 | Verify all environment variables set | All required .env values present | [ ] |
| 19.1.2 | Check database migrations ran | All 3 new migrations applied | [ ] |
| 19.1.3 | Test DigitalRx API connection | Receives valid response | [ ] |
| 19.1.4 | Verify Supabase connection | Database queries work | [ ] |
| 19.1.5 | Check SMTP email settings | Test email sends successfully | [ ] |
| 19.1.6 | Verify all static assets loaded | No 404 errors on images/CSS/JS | [ ] |
| 19.1.7 | Test SSL certificate | HTTPS works, no warnings | [ ] |
| 19.1.8 | Check error logging | Errors logged to system | [ ] |

## 19.2 Critical Path Test (End-to-End)
| Test # | Action | Expected Outcome | Status |
|--------|--------|------------------|--------|
| 19.2.1 | Provider logs in | Successful login | [ ] |
| 19.2.2 | Provider creates patient | Patient created | [ ] |
| 19.2.3 | Provider creates prescription with 2 oversight fees | Prescription created | [ ] |
| 19.2.4 | Review page shows all data correctly | All info displayed: medication price, 2 fees, total cost | [ ] |
| 19.2.5 | Submit prescription | Success message, Queue ID received | [ ] |
| 19.2.6 | Check prescription list | New prescription appears | [ ] |
| 19.2.7 | Provider receives confirmation email | Email delivered with all oversight fees | [ ] |
| 19.2.8 | Patient receives receipt email | Email delivered with total cost breakdown | [ ] |
| 19.2.9 | Admin views pharmacy orders | Order appears in admin panel | [ ] |
| 19.2.10 | Admin edits medication | Medication updated successfully | [ ] |

---

# 📊 TESTING SUMMARY TEMPLATE

```
TESTING COMPLETED: [Date]
TESTED BY: [Name]

TOTAL TESTS: [X]
PASSED: [X] ✅
FAILED: [X] ❌
PARTIAL: [X] ⚠️

CRITICAL ISSUES FOUND:
1. [Description]
2. [Description]

MINOR ISSUES FOUND:
1. [Description]
2. [Description]

READY FOR PRODUCTION: YES / NO

BLOCKER ISSUES (Must fix before production):
- [Issue 1]
- [Issue 2]

NOTES:
[Additional observations]
```

---

# 🚨 KNOWN ISSUES TO VERIFY FIXED

Based on recent changes, verify these are working:

1. ✅ **Provider lookup uses `user_id` not `provider.id`** (Fixed in commit 641d454)
2. ✅ **Provider profile check is optional** (Fixed in commit f2fe2c7)
3. ✅ **Platform admins can edit ANY medication** (Fixed in commit b657217)
4. ✅ **Dual pricing displays correctly** (Pricing to AIMRx vs AIMRx Site Pricing)
5. ✅ **Multiple oversight fees can be added** (Not just one)
6. ✅ **Review page shows ALL oversight fees with total** (Not missing any)
7. ✅ **Payment/Banking section removed from provider profile** (Only Tax ID remains)
8. ✅ **Medication edit modal saves changes** (Not just opening and closing)

---

# 📝 NOTES FOR TESTERS

**IMPORTANT CHANGES TO VERIFY:**

1. **Prescription Step 3 Review Page:**
   - Must show "Price of Medication" section
   - Must show ALL oversight fees individually
   - Must show "Total Oversight Fees" (sum)
   - Must show "Total Patient Cost" (medication + all fees)

2. **Medication Edit:**
   - Blue pencil icon appears next to each medication
   - Dialog opens with ALL fields populated
   - Both pricing fields editable (Pricing to AIMRx, AIMRx Site Pricing)
   - "Save Changes" actually saves to database
   - Table refreshes automatically after save

3. **Provider Profile:**
   - Payment & Banking section REMOVED
   - Only Tax ID / EIN field remains
   - No bank account, routing number, payment method fields

4. **Platform Admin Permissions:**
   - Can edit medications from ANY pharmacy
   - Can view all pharmacy orders
   - Can manage all providers

5. **CSV Bulk Upload:**
   - Must accept both `retail_price_cents` AND `aimrx_site_pricing_cents`
   - Both columns required in CSV
   - Upload processes both pricing fields

---

**END OF TESTING CHECKLIST**

This checklist covers ALL major features and functions in the RxPortal Pro application. Use this for comprehensive pre-production testing.
