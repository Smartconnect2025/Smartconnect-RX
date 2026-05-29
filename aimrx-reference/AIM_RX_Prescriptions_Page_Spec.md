# AIM Rx — Prescriptions Page Complete Specification

This document describes **every detail** of the Prescriptions page: layout, table, View modal (receipt), Edit Prescription modal, Bill Patient modal, View PDF, and Print Receipt — including exact sizes, colors, fonts, icons, spacing, logic, flow, and data model.

---

## TABLE OF CONTENTS

1. [Page Layout & Container](#1-page-layout--container)
2. [Search Bar & New Prescription Button](#2-search-bar--new-prescription-button)
3. [Tabs (In Progress / Completed)](#3-tabs-in-progress--completed)
4. [Prescriptions Table](#4-prescriptions-table)
5. [Empty State](#5-empty-state)
6. [View Modal (Receipt Modal)](#6-view-modal-receipt-modal)
7. [Progress Tracker (Screen Version)](#7-progress-tracker-screen-version)
8. [Progress Tracker (Print Version)](#8-progress-tracker-print-version)
9. [Edit Prescription Modal](#9-edit-prescription-modal)
10. [Bill Patient Modal](#10-bill-patient-modal)
11. [View Prescription PDF](#11-view-prescription-pdf)
12. [Print Receipt](#12-print-receipt)
13. [Data Model & Supabase Query](#13-data-model--supabase-query)
14. [Real-Time Updates & Status Polling](#14-real-time-updates--status-polling)
15. [Status Color Map](#15-status-color-map)
16. [Constants & Enums](#16-constants--enums)

---

## 1. PAGE LAYOUT & CONTAINER

- **Wrapper**: `DefaultLayout` (app shell with sidebar/nav)
- **Container**: `<div className="container max-w-7xl mx-auto py-8 px-4">`
  - `max-width: 80rem (1280px)`
  - `padding-top / padding-bottom: 2rem (32px)`
  - `padding-left / padding-right: 1rem (16px)`
  - Centered with `mx-auto`

---

## 2. SEARCH BAR & NEW PRESCRIPTION BUTTON

**Container**: `<div className="mb-6">` → `margin-bottom: 1.5rem (24px)`

**Row**: `<div className="flex justify-between items-center gap-4 mb-4">`

### Search Input
- `<Input>` component (shadcn)
- `placeholder="Search by patient, medication or ref..."`
- `className="max-w-md border-gray-300 rounded-lg"`
- `max-width: 28rem (448px)`
- Border: `gray-300` (#D1D5DB)
- Border-radius: `0.5rem (8px)`
- Searches against: `patientName`, `medication`, last 4 chars of `id`

### New Prescription Button
- `<Button size="sm">`
- `className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"`
- Background: Navy blue `#1E3A8A`, hover: 90% opacity
- Text: White
- Icon: `<Plus className="mr-2 h-4 w-4" />` (Lucide `Plus`, 16×16px, margin-right 8px)
- Text: "New Prescription"
- `disabled={checkingActive}` — disabled while checking provider account

### Create Prescription Flow (onClick):
1. Calls `GET /api/provider/profile-check` — checks NPI, medical license, signature
2. If any missing → opens `CompleteProfileModal` with `missingProfileFields`
3. If complete → calls `GET /api/provider/check-active`
4. If inactive → toast error "Your account is inactive..."
5. If active → `router.push("/prescriptions/new/step1")`

---

## 3. TABS (IN PROGRESS / COMPLETED)

**Container**: `<div className="border-b border-border">`
**Row**: `<div className="flex gap-4">`

### Tab Buttons
Each is a `<button>` element:

**Active state**:
```
border-b-2 border-[#1E3A8A] text-[#1E3A8A]
px-4 py-2 text-sm font-medium
```

**Inactive state**:
```
border-b-2 border-transparent text-muted-foreground
hover:text-foreground hover:border-gray-300
px-4 py-2 text-sm font-medium transition-colors
```

### Tab 1: "In Progress"
- Filters: `rx.status.toLowerCase() !== "delivered"`
- Badge (when count > 0):
  ```
  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
  ```
  - `margin-left: 0.5rem`, `padding: 0.125rem 0.5rem`
  - `font-size: 0.75rem`, `border-radius: 9999px`
  - Background: `blue-100` (#DBEAFE), text: `blue-700` (#1D4ED8)

### Tab 2: "Completed"
- Filters: `rx.status.toLowerCase() === "delivered"`
- Badge (when count > 0):
  ```
  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
  ```
  - Background: `green-100` (#DCFCE7), text: `green-700` (#15803D)

---

## 4. PRESCRIPTIONS TABLE

**Outer wrapper**: `<div className="bg-white border border-border rounded-lg overflow-hidden">`
- White background, 1px border, `border-radius: 0.5rem`, overflow hidden

**Scroll wrapper**: `<div className="overflow-x-auto">`

### Table Header
```
<TableRow className="bg-gray-50">
```
- Background: `gray-50` (#F9FAFB)
- Each `<TableHead className="font-semibold">` — `font-weight: 600`

### Columns (8 total):

| # | Header | Width | Content |
|---|--------|-------|---------|
| 1 | **Ref** | auto | Last 4 chars of `id`, uppercased. `className="font-mono text-xs text-muted-foreground"` — monospace, 12px, muted gray |
| 2 | **Date & Time** | auto | `formatDateTime()` → "Jan 15, 2025, 2:30 PM". `className="whitespace-nowrap"` |
| 3 | **Patient Name** | auto | `className="font-medium"` — font-weight 500 |
| 4 | **Medication + Strength/Dosage** | auto | Two lines: `<span className="font-medium">{medication}</span>` + `<span className="text-sm text-muted-foreground">{strength}</span>` (wrapped in `flex flex-col`) |
| 5 | **Quantity / Refills** | auto | Two lines: `Qty: {quantity}` + `Refills: {refills}` (text-sm text-muted-foreground) |
| 6 | **Pharmacy** | auto | If `pharmacyName` exists: `<span className="font-medium" style={{color: pharmacyColor \|\| "#1E3A8A"}}>`. Else: `<span className="text-muted-foreground text-sm">Not specified</span>` |
| 7 | **Status** | auto | `<Badge variant="outline" className="${getStatusColor(status)} text-xs px-2 py-1">` + optional `Queue: {queueId}` below in `text-xs text-muted-foreground` |
| 8 | **Actions** | auto, right-aligned | `<Button variant="outline" size="sm" className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white">View</Button>` |

### Table Row
```
<TableRow className="hover:bg-gray-50">
```

### formatDateTime function:
```typescript
const formatDateTime = (dateTime: string) => {
  const date = new Date(dateTime);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
```

---

## 5. EMPTY STATE

When `filteredPrescriptions.length === 0`:

```
<div className="bg-white border border-border rounded-lg p-12 text-center">
```
- `padding: 3rem (48px)`, centered

**Icon**: `<Pill className="mx-auto h-16 w-16 text-muted-foreground mb-4" />` — 64×64px, muted gray
**Heading**: `<h3 className="text-xl font-semibold mb-2">` — 20px, semibold
- In Progress: "No prescriptions in progress"
- Completed: "No completed prescriptions"

**Subtext**: `<p className="text-muted-foreground mb-6">`
- In Progress: "All prescriptions have been delivered"
- Completed: "No prescriptions have been completed yet"

**CTA** (In Progress tab only): `<Button onClick={handleCreatePrescription}>` with Plus icon

---

## 6. VIEW MODAL (RECEIPT MODAL)

This is the main modal that opens when you click "View" on any prescription row.

### Dialog Container
```
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-full">
```
- `max-width: 48rem (768px)`
- `max-height: 90vh`
- Scrollable vertically

### Inner wrapper
```
<div className="space-y-6 print-container" id="aim-receipt">
```
- `space-y-6` = 24px gap between children
- `id="aim-receipt"` — used by print function to find the content

### Section 1: AIM Logo
```html
<div className="text-center pt-4">
  <img src="https://app.aimrx.com/logo-header.png"
       alt="AIM Medical Technologies"
       className="h-[80px] mx-auto print-logo" />
</div>
```
- `height: 80px`, centered
- Print: shrinks to 37px

### Section 2: Letterhead
```html
<div className="text-center text-sm text-gray-600 border-b pb-4 print-letterhead">
  <p className="font-semibold text-gray-900">AIM Medical Technologies</p>
  <p>106 E 6th St, Suite 900 · Austin, TX 78701</p>
  <p>(769) 304-1830 · Mon–Fri 9AM–6PM CST</p>
</div>
```
- `font-size: 0.875rem (14px)`, `color: gray-600` (#4B5563)
- Company name: `font-semibold text-gray-900` (#111827)
- `border-bottom: 1px solid`, `padding-bottom: 1rem`

### Section 3: Success Checkmark & Headline
```html
<div className="text-center py-4 print-title">
  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 print-icon"
       style={{ backgroundColor: "#00AEEF20" }}>
    <CheckCircle2 className="w-10 h-10" style={{ color: "#00AEEF" }} />
  </div>
  <h2 className="text-2xl font-bold" style={{ color: "#00AEEF" }}>
    Order Successfully Submitted
  </h2>
</div>
```
- Circle: `64×64px`, `border-radius: 50%`, background: `#00AEEF` at 12.5% opacity (`#00AEEF20`)
- Icon: `CheckCircle2` (Lucide), `40×40px`, color: `#00AEEF` (AIM cyan)
- Title: `font-size: 1.5rem (24px)`, `font-weight: 700`, color: `#00AEEF`
- `padding: 1rem 0`

### Section 4: Reference Information
```html
<div className="bg-gray-50 rounded-lg p-4 space-y-3 print-section print-ref">
```
- Background: `gray-50` (#F9FAFB), `border-radius: 8px`, `padding: 16px`

**Row 1**: Reference # with Copy button
- Left side:
  - Label: `text-sm text-gray-600` — "Reference #"
  - Value: `font-bold text-lg` — shows `queueId`
- Right side: `<Button variant="outline" size="sm" className="print-hide">` with `<Copy>` icon + "Copy"
  - Hidden on print
  - onClick: copies queueId to clipboard via `document.execCommand("copy")`

**Row 2**: 2-column grid (`grid grid-cols-2 gap-4 pt-2 border-t`)
- **Patient**: name (font-medium) + DOB if available (`text-sm text-gray-600`)
- **Date**: formatted datetime (font-medium)

**Row 3**: Prescribed by (`pt-2 border-t`)
- Label: `text-sm text-gray-600` — "Prescribed by"
- Value: `font-medium` — `doctorName || "Unknown Provider"`

### Section 5: Progress Tracker (Screen Only)
```html
<div className="print-section print-production print-hide-tracker">
  <PrescriptionProgressTracker ... />
</div>
```
- Hidden on print (class `print-hide-tracker`)
- See [Section 7](#7-progress-tracker-screen-version) for full details

### Section 5b: Print Progress Tracker (Print Only)
```html
<div className="hidden print-show-tracker" data-print-only="true">
  <PrintProgressTracker ... />
</div>
```
- Hidden on screen (`className="hidden"`)
- Shown in print iframe via `[data-print-only="true"] { display: block !important; }`
- See [Section 8](#8-progress-tracker-print-version) for full details

### Section 6: Prescription Details
```html
<h3 className="font-semibold text-lg print-details-title" style={{ color: "#00AEEF" }}>
  Prescription Details
</h3>
```
- Title: `18px`, `font-weight: 600`, color: `#00AEEF`

**Inner card**: `bg-gray-50 rounded-lg p-4 space-y-3 print-section`

#### Row 1 — Medication & Vial Size (2-col grid)
- `grid grid-cols-2 gap-4`
- **Medication**: label `text-sm text-gray-600 font-medium`, value `text-base font-semibold text-gray-900`
- **Vial Size**: label same, value `text-base text-gray-900`. Fallback: "5mL"

#### Row 2 — Dosage Amount, Unit, Form (3-col grid)
- `grid grid-cols-3 gap-4 pt-3 border-t border-gray-200`
- **Dosage Amount**: value = `dosageAmount || strength`
- **Unit**: value = `dosageUnit || "mg"`
- **Form**: value = `form !== "N/A" ? form : "Injectable"`

#### Row 3 — Quantity, Refills, DAW (3-col grid)
- Same 3-col layout as above
- **Quantity**: number
- **Refills**: number
- **DAW**: "Yes" or "No" (`dispenseAsWritten ? "Yes" : "No"`)

#### Row 4 — SIG (Patient Directions)
- `pt-3 border-t border-gray-200`
- Label: "How to Use This Medication (Patient Directions)" (`text-sm text-gray-600 font-medium`)
- Value: `text-base text-gray-900 mt-1 leading-relaxed`
- Fallback: long default injection instructions

#### Row 5 — Pricing Breakdown
- `pt-3 border-t border-gray-200`
- Label: "Pricing" (`text-sm text-gray-600 font-medium mb-2`)
- Each line: `flex justify-between`
  - **Medication Price**: `$X.XX` (`text-sm font-semibold text-gray-900`)
  - **Shipping Fee**: `$X.XX`
  - **Consultation Fee**: `$X.XX` — includes reason label if set (e.g., "Consultation Fee (Dose Titration & Adjustment)")
- **Total line**: `flex justify-between pt-2 border-t border-gray-300`
  - "Total:" in `text-base font-semibold text-gray-900`
  - Value in `text-xl font-bold text-gray-900`
  - Calculation: `medicationPrice + providerFees + shippingFee`

### Section 7: Notes from Pharmacy
```html
<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 print-section print-notes">
```
- Background: `yellow-50` (#FEFCE8), border: `yellow-200` (#FDE68A)
- Title: `📋 Important Notes from AIM Pharmacy:` (`font-semibold text-sm text-gray-700 mb-2`)
- Content: splits `pharmacyNotes` by `\n` and renders each line
- Fallback notes (5 bullet points about refrigeration, injection technique, etc.)

### Section 8: Fulfilling Pharmacy Box
```html
<div className="border-2 rounded-lg p-4 space-y-3 print-section print-pickup"
     style={{ borderColor: "#00AEEF" }}>
```
- Border: `2px solid #00AEEF`
- `border-radius: 8px`, `padding: 16px`

**Content**:
- Icon: `<MapPin className="w-5 h-5 mt-0.5 print-hide" style={{ color: "#00AEEF" }} />`
- Title: `<h3 className="font-semibold text-lg mb-2" style={{ color: "#00AEEF" }}>Fulfilling Pharmacy</h3>`
- Pharmacy name: `<p className="font-semibold text-gray-900">{pharmacyName || "AIM Medical Technologies"}</p>`
- If no pharmacy assigned: shows AIM address link
  ```html
  <a href="https://maps.google.com/?q=106+E+6th+St+Suite+900+Austin+TX+78701"
     target="_blank" rel="noopener noreferrer"
     className="text-sm hover:underline inline-block mt-1"
     style={{ color: "#00AEEF" }}>
    106 E 6th St, Suite 900, Austin, TX 78701 →
  </a>
  ```

### Section 9: Action Buttons
```html
<div className="pt-4 space-y-3 print-hide">
```
- Hidden on print
- All buttons share: `w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5`
  - Full width, `font-size: 18px`, `padding-y: 24px`
  - Border: `#1E3A8A` at 60% opacity
  - Text: `#1E3A8A` at 80% opacity
  - Hover bg: `#1E3A8A` at 5% opacity

#### Button 1: Edit Prescription
- **Condition**: `status === "pending_payment"` AND `!hideEdit`
- Icon: `<Pencil className="h-5 w-5 mr-2" />`
- Text: "Edit Prescription"
- Opens: `EditPrescriptionModal`

#### Button 2: Bill Patient / Payment Received / Submit to Pharmacy
Three states:

**A) If `paymentStatus === "paid"`:**
- Disabled "Payment Received" button with `<CheckCircle2>` icon, `cursor-not-allowed`
- If status is exactly `"payment_received"` → also shows "Submit to Pharmacy" button
  - Icon: `<Pill>`, shows spinner when submitting
  - Calls `handleSubmitToPharmacy(prescriptionId)`

**B) If not paid:**
- "Bill Patient" button with `<DollarSign>` icon
- Opens `BillPatientModal` via `setIsBillModalOpen(true)`

#### Button 3: View Prescription PDF
- **Condition**: `pdfStoragePath` exists
- Icon: `<FileText className="h-5 w-5 mr-2" />`
- Text: "View Prescription PDF"
- onClick: `GET /api/prescriptions/${id}/pdf` → opens returned URL in new tab

#### Button 4: Print Receipt
- Always visible
- Icon: `<Printer className="h-5 w-5 mr-2" />`
- Text: "Print Receipt"
- onClick: calls `printReceipt()` function

---

## 7. PROGRESS TRACKER (SCREEN VERSION)

Component: `PrescriptionProgressTracker`

### Container
```
bg-gradient-to-br from-white to-slate-50
border border-gray-200
rounded-xl p-5 space-y-4
```
- Gradient background: white → slate-50
- Border: `gray-200` (#E5E7EB)
- `border-radius: 12px`, `padding: 20px`

### Header Row
`flex items-center justify-between`

- Left: `<h3 className="font-semibold text-sm text-gray-900 tracking-tight">Order Progress</h3>`
- Right: `flex items-center gap-2`
  - **Payment badge** (if exists):
    ```
    text-[10px] font-semibold px-2.5 py-0.5 rounded-full border
    ```
    - With `<DollarSign className="w-3 h-3" />` icon
    - Paid: `bg-emerald-50 text-emerald-700 border-emerald-200` — "Paid · $X.XX"
    - Pending: `bg-amber-50 text-amber-700 border-amber-200` — "Due · $X.XX"
  - **Pharmacy name pill** (if exists):
    ```
    text-xs text-muted-foreground bg-gray-100 px-2.5 py-0.5 rounded-full
    ```

### Payment Warning Banner
- Shows when payment is "pending"
```
flex items-center gap-2
bg-amber-50 border border-amber-200 rounded-lg px-3 py-2
```
- Icon: `<AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />`
- Text: `text-xs font-medium text-amber-800`
- Message: "Order will NOT be sent to the pharmacy until payment is received."

### 7 Steps (Horizontal Progress Bar)

**Steps**: Order Created → Payment → Sent to Pharmacy → Processing → Approved → Shipped → Delivered

**Icons per step** (Lucide):
1. `ClipboardList`
2. `CreditCard`
3. `Send`
4. `Package`
5. `ShieldCheck`
6. `Truck`
7. `PackageCheck`

**Progress Bar**:
- Background line: `h-[2px] bg-gray-200 rounded-full`, positioned `top: 20px`
- Fill: `linear-gradient(90deg, #10B981, #059669)`, animates to `progressPercent` width over `1000ms`

**Step Circles**:
- Size: `w-9 h-9 sm:w-10 sm:h-10` (36×36 / 40×40px)
- `rounded-full flex items-center justify-center`

**States**:
- **Completed**: `bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-200/60` — shows `<Check>` icon (strokeWidth 2.5)
- **Current (payment pending)**: `bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-300/50 ring-[3px] ring-amber-100`
- **Current (normal)**: `bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] text-white shadow-lg shadow-blue-300/50 ring-[3px] ring-blue-100`
- **Future**: `bg-gray-100 text-gray-400 border border-gray-200`

**Ping animation** (current step, not last step):
```
absolute inset-0 rounded-full animate-ping
animationDuration: 2s
```
- Payment pending: `rgba(245, 158, 11, 0.15)`
- Normal: `rgba(30, 58, 138, 0.15)`

**Entrance animation** (per step, staggered):
```
opacity: mounted ? 1 : 0
transform: mounted ? translateY(0) : translateY(6px)
transition: opacity 350ms ease ${index * 70}ms, transform 350ms ease ${index * 70}ms
```

**Step Labels**:
- Label: `mt-2 text-[10px] sm:text-[11px] font-semibold text-center leading-tight`
  - Completed: `text-emerald-600`
  - Payment pending: `text-amber-600`
  - Current: `text-[#1E3A8A]`
  - Future: `text-gray-400`
- Description: `text-[8px] sm:text-[9px] text-center leading-tight mt-0.5 hidden sm:block`
  - Future: `text-gray-300`
  - Other: `text-gray-500`

### Tracking Section (if trackingNumber exists)
```
bg-blue-50/80 border border-blue-100 rounded-lg px-4 py-2.5 space-y-2
```
- Carrier label: `text-[10px] font-medium text-blue-500 uppercase tracking-wider`
- Tracking #: `text-sm font-mono font-semibold text-[#1E3A8A]`
- Track button: `<a>` styled as `text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 px-3 py-1.5 rounded-md`
  - Links to carrier URL based on carrier type

**Tracking URL logic**:
- UPS → `https://www.ups.com/track?tracknum=...`
- USPS → `https://tools.usps.com/go/TrackConfirmAction?tLabels=...`
- DHL → `https://www.dhl.com/en/express/tracking.html?AWB=...`
- Default → `https://parcelsapp.com/en/tracking/...`

**Carrier status badge** (if exists):
- Delivered: `bg-emerald-50 text-emerald-700 border-emerald-200`
- In transit / Out for delivery: `bg-blue-50 text-blue-700 border-blue-200`
- Other: `bg-gray-50 text-gray-700 border-gray-200`

**ETA** (if exists): `text-gray-500` — "ETA: Jan 15, 2025"

### Status → Step Index Mapping
```
"delivered" / "completed"        → 6
"shipped" / "pickedup"           → 5
"approved" / "providerapproved"  → 4
"packed" / "processing" / "pharmacyprocessing" / "compounding" → 3
"submitted" (+ billingStatus !== "pending") → 2
"paymentreceived" / "billed" / billing=paid/billed/cash → 2
"billing" / "paymentpending" / "pendingpayment" / billing=pending → 1
default                           → 0
```

---

## 8. PROGRESS TRACKER (PRINT VERSION)

Component: `PrintProgressTracker` — uses inline styles (no Tailwind), table-based layout.

### Container
```
border: 1px solid #e5e7eb
border-radius: 8px
padding: 12px 16px
```

### Header
- Left: "Order Progress" — `fontWeight: 600, fontSize: 13px, color: #111827`
- Right: flex row with gap 8px:
  - Payment badge: `fontSize: 11px, fontWeight: 600, padding: 2px 8px, borderRadius: 9999px`
    - Paid: `border: #a7f3d0, bg: #f0fdf4, color: #047857`
    - Pending: `border: #fde68a, bg: #fffbeb, color: #b45309`
  - Pharmacy pill: `fontSize: 11px, color: #6b7280, bg: #f3f4f6, padding: 2px 8px, borderRadius: 9999px`

### Payment Warning (if step < 2)
```
display: flex, alignItems: center, gap: 6px
bg: #fffbeb, border: 1px solid #fde68a, borderRadius: 6px
padding: 6px 10px, marginBottom: 8px
fontSize: 11px, fontWeight: 500, color: #92400e
```
- Text: "⚠ Order will NOT be sent to the pharmacy until payment is received."

### Steps Table
- `<table width="100%" borderCollapse="collapse" fontSize="11px">`
- Each row: `<tr>` with two `<td>` cells
  - **Column 1** (indicator): `width: 18px, padding: 3px 6px 3px 0`
    - Done: `"✓"` in `color: #10B981, fontWeight: 700, fontSize: 13px`
    - Current: `"▸"` in `color: #1E3A8A`
    - Future: `"○"` in `color: #d1d5db`
  - **Column 2** (label): `padding: 3px 0`
    - Done: `fontWeight: 600, color: #10B981`
    - Current: `fontWeight: 600, color: #1E3A8A` + `"← Current"` suffix in `fontSize: 9px, marginLeft: 6px, color: #6b7280`
    - Future: `fontWeight: 400, color: #9CA3AF`

### 7 Steps (same as screen version):
1. Order Created — "Saved in system"
2. Payment — "Awaiting payment"
3. Sent to Pharmacy — "Submitted after payment"
4. Processing — "Rx being filled"
5. Approved — "Pharmacist OK"
6. Shipped — "With carrier"
7. Delivered — "Received"

### Tracking Box (if exists)
```
marginTop: 8px
bg: #eff6ff, border: 1px solid #bfdbfe, borderRadius: 6px
padding: 6px 10px, fontSize: 11px
```
- Carrier label: `color: #6b7280, textTransform: uppercase, fontSize: 9px, fontWeight: 600, letterSpacing: 0.5px`
- Number: `fontFamily: monospace, fontWeight: 600, color: #1E3A8A, fontSize: 12px`

---

## 9. EDIT PRESCRIPTION MODAL

### Dialog
```
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
```
- `max-width: 42rem (672px)`, `max-height: 90vh`, scrollable

### Header
- Title: "Edit Prescription"
- Description: "Update prescription details for {patientName}"

### Form Fields

All wrapped in `<div className="space-y-4 py-4">` (16px gap, padding-y 16px)

#### 1. Medication (read-only)
- `<Label className="text-sm font-medium text-gray-600">Medication</Label>`
- `<p className="text-base font-semibold text-gray-900 mt-1">{medication}</p>`
- Not editable

#### 2. Vial Size
- `<Input>` with `placeholder="e.g., 5mL"`

#### 3. Dosage Amount + Unit (2-col grid)
```
<div className="grid grid-cols-2 gap-4">
```
- **Dosage Amount**: `<Input type="number" min="0" step="any" />` — REQUIRED (asterisk *)
- **Unit**: `<Select>` dropdown with options: `["mg", "mL", "mcg", "g", "units", "%"]`

#### 4. Form
- `<Select>` dropdown with options:
  `["Tablet", "Capsule", "Liquid", "Cream", "Ointment", "Gel", "Patch", "Injection", "Inhaler", "Drops", "Spray", "Suppository"]`

#### 5. Quantity + Refills (2-col grid)
- **Quantity**: `<Input type="number" min="1" />` — REQUIRED
- **Refills**: `<Input type="number" min="0" max="12" />`
  - When refills change: if count > 0 and no frequency set, defaults to "30"; if count = 0, clears frequency

#### 6. Refill Frequency (conditional)
- Only shown when `parseInt(refills) > 0`
- `<Input type="number" min="1" placeholder="e.g., 30" />` — REQUIRED when refills > 0
- Label: "Refill Frequency (days) *"

#### 7. SIG (Directions)
- `<Textarea rows={3} />` — REQUIRED
- Label: "SIG (Directions for Patient) *"

#### 8. Dispense as Written
- `<Checkbox>` + `<Label className="cursor-pointer">`
- Text: "Dispense as Written (DAW)"

#### 9. Notes to Pharmacy
- `<Textarea rows={2} />`

#### 10. Pricing Section
Separated by `border-t pt-4 space-y-3`

**Medication Price** ($): `<Input type="number" min="0" step="0.01" />`
**Shipping & Handling** ($): `<Input type="number" min="0" step="0.01" />`

**Consultation Fee** (sub-section): `pt-3 border-t border-gray-200 space-y-3`
- Layout: `grid grid-cols-[1fr_2fr] gap-3`
- **Fee ($)**: `<Input type="number" min="0" step="0.01" placeholder="0.00" />`
- **Reason**: native `<select>` (not shadcn Select)
  - `className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"`
  - Options:
    - "Select reason..."
    - "Dose Titration & Adjustment" (`dose_titration`)
    - "Side Effect & Safety Monitoring" (`side_effect_monitoring`)
    - "Therapeutic Response Review" (`therapeutic_response`)
    - "Medication Adherence Tracking" (`adherence_tracking`)
    - "Contraindication Screening" (`contraindication_screening`)

### Action Buttons
```
<div className="flex gap-3 pt-4 border-t">
```
- **Cancel**: `<Button variant="outline" className="flex-1">`
- **Save Changes**: `<Button className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90" disabled={isSaving}>`
  - Shows "Saving..." when saving

### Save Logic
1. Validates: dosageAmount > 0, quantity > 0, sig not empty, refill frequency required if refills > 0
2. `PATCH /api/prescriptions/${id}/update` with JSON body
3. On success: toast "Prescription updated successfully", calls `onSaved()` with updated fields
4. `onSaved` callback immediately updates the in-memory `selectedPrescription` so the receipt modal reflects changes without re-fetch

---

## 10. BILL PATIENT MODAL

### Dialog
```
<DialogContent className="max-w-2xl">
```
- `max-width: 42rem (672px)`

### Header
- Title: "Bill Patient" (`text-2xl` = 24px)
- Description: "Generate a secure payment link for {patientName}"

### Three View States

#### State 1: Loading (`checkingStatus = true`)
- Centered spinner: `<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />`
- Text: "Checking payment status..."

#### State 2: Payment Link Result (`paymentUrl` exists)
Shows `PaymentLinkResultView` component:

**Success Header**:
- Circle: `w-16 h-16 rounded-full mb-4`
  - New link: `bg-green-100` + `<CheckCircle2 className="w-10 h-10 text-green-600" />`
  - Existing link: `bg-yellow-100` + `<AlertCircle className="w-10 h-10 text-yellow-600" />`
- Title: `text-xl font-bold text-gray-900 mb-2`
  - "Existing Payment Link" / "Payment Link Sent!" / "Payment Link Generated!"
- Subtitle: `text-gray-600` — contextual message

**Existing Link Warning** (if `isExistingLink`):
```
bg-yellow-50 border border-yellow-200 rounded-lg p-4
```
- `<AlertCircle>` icon + warning text

**Payment Details**:
```
bg-gray-50 rounded-lg p-4 space-y-3
```
- Total: `text-lg font-bold text-gray-900`
- Consultation Fee, Medication Cost, Shipping Fee: `text-sm text-gray-600` + `font-medium`

**Payment URL**:
- `<Input readOnly className="font-mono text-sm">` with Copy button
- Expiry: `<Clock>` icon + "Link expires on {date}" or "Link expires in 7 days"

**Next Steps** box:
```
bg-blue-50 border border-blue-200 rounded-lg p-4
```
- Ordered list (4 items)

**Action Buttons**:
- "Charge Directly" (if existing link): `bg-[#1E3A8A] hover:bg-[#1E3A8A]/90`
- "Resend Email to Patient" (if existing + email not sent): outline variant
- "Done" button
- "Delete Link" (if existing): `text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700`

#### State 3: Payment Form (no payment URL yet)

**Container**: `<div className="space-y-6 py-4 overflow-y-auto max-h-[500px]">`

**Patient Info Card**:
```
bg-gray-50 rounded-lg p-4 space-y-2
```
- Patient name + Medication in `flex justify-between` rows

**Two Tabs** (shadcn Tabs):
```
<Tabs value={paymentMethod} onValueChange={...}>
  <TabsList className="w-full">
```

### Tab A: "Send Payment Link"
- Icon: `<Mail className="h-4 w-4" />`
- Content: `PaymentFormFields` component + Generate button

**PaymentFormFields component**:

1. **Patient Email**: `<Input type="email" placeholder="patient@example.com" />`
   - Required (red asterisk)
   - Helper: "Payment link will be sent to this email automatically"

2. **Cost Breakdown**: `bg-gray-50 rounded-lg p-4 space-y-3`
   - Consultation Fee: `text-sm text-gray-600` + `font-medium`
   - Medication Cost: same
   - Shipping Fee: same (only if > $0)
   - Total: `text-lg font-semibold text-gray-900` + `text-xl font-bold text-blue-600` ($X.XX)

3. **Description**: `<Textarea rows={3} placeholder="Payment description..." />`
   - Optional
   - Helper: "This will appear on the payment form and receipt"

**Buttons** (`flex gap-3 pt-4`):
- Cancel: `variant="outline" className="flex-1"`
- Generate: `className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"`
  - Loading: spinner + "Generating..."
  - Normal: "Generate Payment Link"

### Tab B: "Charge Now"
- Icon: `<CreditCard className="h-4 w-4" />`

**Three sub-states**:

**B1: Charge Success** (`chargeSuccess` exists):
- Green checkmark: `w-16 h-16 rounded-full bg-green-100` + `<CheckCircle2 className="w-10 h-10 text-green-600" />`
- Title: "Payment Successful!" (`text-xl font-bold text-gray-900`)
- Amount: "$X.XX charged to card ending in XXXX" (`text-gray-600`)
- Transaction details: `bg-green-50 border border-green-200 rounded-lg p-4`
  - Transaction ID (font-mono), Card Type, Amount (`font-bold text-green-700`)
- Pharmacy warning or info box
- Done button: `bg-[#1E3A8A] hover:bg-[#1E3A8A]/90`

**B2: SDK Error** (`sdkError` exists):
- `bg-red-50 border border-red-200 rounded-lg p-4 text-center`
- `<AlertCircle className="w-8 h-8 text-red-500" />`
- Retry button

**B3: Card Form** (normal state):
- Same `PaymentFormFields` as Tab A
- **Card Information section**: `border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50/50`
  - Header: `<Lock className="h-4 w-4 text-[#1E3A8A]" />` + "Card Information" (`text-sm font-semibold text-gray-900`)
  - **Cardholder Name**: `<Input placeholder="Name on card" className="bg-white" />`
  - **Card Number**: `<Input placeholder="1234 5678 9012 3456" className="bg-white font-mono text-base tracking-wider" maxLength={19} inputMode="numeric" />`
    - Auto-formats with spaces every 4 digits
    - Required (red asterisk)
  - **Exp Month / Exp Year / CVV** (3-col grid: `grid grid-cols-3 gap-3`):
    - Month: `placeholder="MM" className="bg-white text-center" maxLength={2}`
    - Year: `placeholder="YYYY" className="bg-white text-center" maxLength={4}`
    - CVV: `placeholder="123" className="bg-white text-center" maxLength={4} type="password"`
    - All required (red asterisk)
  - **Billing ZIP**: `<Input placeholder="12345" className="bg-white w-1/3" maxLength={5} />`

- **Card Error** (if exists): `bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2`
  - `<AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />`
  - Error message in `text-sm text-red-800`

- **Security note**: `<ShieldCheck className="h-4 w-4 text-green-600" />` + "Secured by Authorize.Net..."

- **Buttons** (`flex gap-3 pt-2`):
  - Cancel: outline
  - Charge: `bg-[#1E3A8A] hover:bg-[#1E3A8A]/90`
    - Loading: spinner + "Processing..."
    - SDK loading: spinner + "Loading..."
    - Ready: `<Lock>` icon + "Charge $X.XX"

### Charge Now Flow:
1. Validates form (amounts, email)
2. Validates card (number ≥ 13 digits, exp month/year, CVV ≥ 3)
3. If no `paymentToken` → calls `POST /api/payments/generate-link` with `sendEmail: false`
4. Loads Authorize.Net Accept.js SDK (fetches config from `GET /api/payments/authnet-config`)
5. Calls `Accept.dispatchData()` to tokenize card → gets `opaqueData`
6. Calls `POST /api/payments/charge-nonce` with `{ paymentToken, opaqueData }`
7. Handles responses:
   - Success: shows charge success screen, triggers pharmacy auto-submit
   - Declined: "Card was declined..."
   - 409: "Already being processed..."
   - 422: "Could not be processed..."
   - 502: "Unable to reach payment gateway..."
   - Charged but recording failed: shows transaction ID for manual reconciliation

### Modal Close (Reset):
Resets all state: paymentUrl, paymentToken, paymentMethod→"send-link", all fee fields, card fields, errors, chargeSuccess

---

## 11. VIEW PRESCRIPTION PDF

**Button condition**: `pdfStoragePath` must exist on the prescription

**Flow**:
1. onClick: `GET /api/prescriptions/${id}/pdf`
2. Response: `{ success: true, url: "..." }`
3. Opens URL in new tab: `window.open(data.url, "_blank")`
4. Error: toast "Failed to load PDF"

---

## 12. PRINT RECEIPT

### Print Function: `printReceipt()`

1. Finds `document.getElementById("aim-receipt")`
2. Clones the element
3. Removes all `.print-hide` elements from clone
4. Creates hidden `<iframe>` (position: absolute, top: -10000px)
5. Writes full HTML document into iframe with inline styles
6. Waits for iframe load → 250ms delay → calls `iframe.contentWindow.print()`
7. After 1000ms → removes iframe

### Iframe HTML Structure:
```html
<!DOCTYPE html>
<html>
<head>
  <title>AIM Receipt</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 12px; color: #333; font-size: 0.86rem; }
    /* ... all inline class styles ... */
    .print-hide-tracker { display: none !important; }
    [data-print-only="true"] { display: block !important; }
    /* Print-specific overrides at @media print */
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>
```

### Print Styles (from page.tsx `printStyles` const):
Key overrides:
- `@page { size: auto; margin: 7mm; }`
- Logo: `height: 37px`
- Letterhead: `font-size: 0.69rem`, `line-height: 1.2`
- Title: `font-size: 0.98rem`
- Sections: `padding: 0.29rem`, `border-radius: 3px`
- Normal text: `font-size: 0.69rem`
- Small text: `font-size: 0.63rem`
- Grid gaps: `0.17rem–0.23rem`
- Container spacing between children: `margin-top: 0.17rem`

---

## 13. DATA MODEL & SUPABASE QUERY

### Supabase Select Query:
```sql
SELECT
  id, queue_id, submitted_at, medication, dosage,
  dosage_amount, dosage_unit, vial_size, form, quantity,
  refills, sig, dispense_as_written, pharmacy_notes,
  patient_price, profit_cents, consultation_reason,
  refill_frequency_days, shipping_fee_cents, total_paid_cents,
  status, payment_status, tracking_number, fedex_status,
  estimated_delivery, pharmacy_id, pdf_storage_path,
  patient:patients(first_name, last_name, date_of_birth, email),
  pharmacy:pharmacies(name, primary_color)
FROM prescriptions
WHERE prescriber_id = $userId
  AND prescription_type = 'prescription'
  AND status != 'cancelled'
ORDER BY submitted_at DESC
```

### Field Mapping (DB → Frontend):
| DB Column | Frontend Field |
|-----------|---------------|
| `id` | `id` |
| `queue_id` | `queueId` (fallback "N/A") |
| `submitted_at` | `dateTime` |
| `medication` | `medication` |
| `dosage` | `strength` |
| `dosage_amount` | `dosageAmount` |
| `dosage_unit` | `dosageUnit` |
| `vial_size` | `vialSize` |
| `form` | `form` |
| `quantity` | `quantity` |
| `refills` | `refills` |
| `sig` | `sig` |
| `dispense_as_written` | `dispenseAsWritten` (fallback false) |
| `pharmacy_notes` | `pharmacyNotes` |
| `patient_price` | `patientPrice` |
| `profit_cents` | `profitCents` |
| `consultation_reason` | `consultationReason` |
| `refill_frequency_days` | `refillFrequencyDays` (fallback null) |
| `shipping_fee_cents` | `shippingFeeCents` |
| `total_paid_cents` | `totalPaidCents` |
| `status` | `status` (fallback "submitted") |
| `payment_status` | `paymentStatus` |
| `tracking_number` | `trackingNumber` |
| `fedex_status` | `carrierStatus` |
| `estimated_delivery` | `estimatedDelivery` |
| `pdf_storage_path` | `pdfStoragePath` |
| `patients.first_name + last_name` | `patientName` |
| `patients.email` | `patientEmail` |
| `patients.date_of_birth` | `patientDOB` |
| `pharmacies.name` | `pharmacyName` |
| `pharmacies.primary_color` | `pharmacyColor` |
| (from providers table) | `doctorName` ("Dr. First Last") |

---

## 14. REAL-TIME UPDATES & STATUS POLLING

### Supabase Real-Time Subscription
```typescript
supabase.channel("prescriptions-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "prescriptions",
    filter: `prescriber_id=eq.${user.id}`,
  }, () => loadPrescriptions())
  .subscribe();
```
- Reloads full prescription list on any insert/update/delete

### Status Batch Polling
- Calls `POST /api/prescriptions/status-batch` with `{ user_id }`
- Runs on mount and every **30 seconds** (`setInterval`)
- Maps DigitalRx status fields to display statuses:
  - `DeliveredDate` → "Delivered"
  - `PickupDate` → "Shipped"
  - `ApprovedDate` → "Approved"
  - `PackDateTime` → "Processing"
  - `BillingStatus` → "Billing"
  - Default → "Submitted"

### Tracking Sync (per-prescription)
- When View modal opens with a `trackingNumber` and status ≠ "delivered"
- Calls `POST /api/prescriptions/sync-tracking` with `{ prescriptionId }`
- If `data.synced` is true → calls `onPrescriptionUpdated()` to refresh

### URL Refresh
- If URL has `?refresh=true` → reloads prescriptions and strips the param

---

## 15. STATUS COLOR MAP

| Status | Badge Classes |
|--------|--------------|
| `submitted` | `bg-blue-100 text-blue-800 border-blue-200` |
| `billing` | `bg-yellow-100 text-yellow-800 border-yellow-200` |
| `approved` | `bg-green-100 text-green-800 border-green-200` |
| `processing` | `bg-purple-100 text-purple-800 border-purple-200` |
| `shipped` | `bg-indigo-100 text-indigo-800 border-indigo-200` |
| `delivered` | `bg-emerald-100 text-emerald-800 border-emerald-200` |
| default | `bg-gray-100 text-gray-800 border-gray-200` |

### formatStatusLabel function:
- Replaces `_` and `-` with spaces
- Capitalizes first letter of each word
- Example: `"pending_payment"` → `"Pending Payment"`

---

## 16. CONSTANTS & ENUMS

### Consultation Reasons
| Value | Label |
|-------|-------|
| `dose_titration` | Dose Titration & Adjustment |
| `side_effect_monitoring` | Side Effect & Safety Monitoring |
| `therapeutic_response` | Therapeutic Response Review |
| `adherence_tracking` | Medication Adherence Tracking |
| `contraindication_screening` | Contraindication Screening |

### Medication Forms
`Tablet, Capsule, Liquid, Cream, Ointment, Gel, Patch, Injection, Inhaler, Drops, Spray, Suppository`

### Dosage Units
`mg, mL, mcg, g, units, %`

### Brand Colors
| Color | Hex | Usage |
|-------|-----|-------|
| AIM Navy Blue | `#1E3A8A` | Buttons, current step, primary actions |
| AIM Cyan | `#00AEEF` | Receipt headings, fulfillment box, checkmark circle |
| Emerald Green | `#10B981` / `#059669` | Completed steps, progress bar gradient |
| Amber | `#F59E0B` / `#B45309` | Payment pending states |

### API Endpoints Used
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/provider/profile-check` | Check NPI, license, signature |
| GET | `/api/provider/check-active` | Check account active status |
| GET | `/api/prescriptions/${id}/pdf` | Get signed PDF URL |
| PATCH | `/api/prescriptions/${id}/update` | Update prescription fields |
| POST | `/api/prescriptions/${id}/submit-to-pharmacy` | Submit to DigitalRx |
| POST | `/api/prescriptions/status-batch` | Batch status poll |
| POST | `/api/prescriptions/sync-tracking` | Sync EasyPost tracking |
| GET | `/api/payments/check-link/${id}` | Check existing payment link |
| DELETE | `/api/payments/check-link/${id}` | Delete payment link |
| POST | `/api/payments/generate-link` | Generate payment link |
| GET | `/api/payments/authnet-config` | Get Authorize.Net SDK config |
| POST | `/api/payments/charge-nonce` | Charge card with nonce |

### Component/Library Dependencies
- **UI**: shadcn/ui (`Dialog`, `DialogContent`, `Button`, `Input`, `Label`, `Textarea`, `Table`, `Badge`, `Select`, `Checkbox`, `Tabs`)
- **Icons**: Lucide React (`Plus`, `Pill`, `CheckCircle2`, `Copy`, `Printer`, `MapPin`, `DollarSign`, `FileText`, `Pencil`, `ClipboardList`, `Package`, `ShieldCheck`, `Truck`, `PackageCheck`, `ExternalLink`, `Check`, `CreditCard`, `Send`, `AlertTriangle`, `Loader2`, `AlertCircle`, `Clock`, `Mail`, `Trash2`, `Lock`)
- **Routing**: Next.js `useRouter`, `useSearchParams`
- **Notifications**: Sonner `toast`
- **Database**: Supabase client (`createClient()`, real-time subscriptions)
- **Auth**: `useUser()` hook
