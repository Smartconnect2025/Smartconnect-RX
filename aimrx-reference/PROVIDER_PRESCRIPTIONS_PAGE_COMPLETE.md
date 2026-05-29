# PROVIDER PRESCRIPTIONS PAGE — COMPLETE IN-DEPTH DOCUMENTATION

## Every detail: table structure, colors, columns, group coding, View button, modal sections, action buttons, edit modal, bill modal, progress tracker, print receipt, templates, pharmacy relationship.

---

## TABLE OF CONTENTS

1. [Page Overview — What the Provider Sees](#overview)
2. [File Structure — 4 Files That Build This Page](#files)
3. [Data Loading — Where Prescriptions Come From](#data-loading)
4. [Interface — Every Field on a Prescription](#interface)
5. [Page Layout — Top to Bottom](#layout)
6. [Search Bar](#search)
7. [Tabs — "In Progress" vs "Completed"](#tabs)
8. [Table Header — All 8 Columns](#table-header)
9. [Table Body — Row Rendering](#table-body)
10. [Group Color-Coding — How Rows Get Colored](#color-coding)
11. [Group Badge — "2 items" / "3 items"](#group-badge)
12. [Status Column — Colors and Labels](#status-column)
13. [Pharmacy Column — Color From Database](#pharmacy-column)
14. [Actions Column — The "View" Button](#actions-button)
15. [What Happens When You Click "View"](#view-click)
16. [The Receipt Modal — Complete Structure](#receipt-modal)
17. [Modal Section 1: AIM Logo + Letterhead](#modal-logo)
18. [Modal Section 2: Reference Information](#modal-reference)
19. [Modal Section 3: Order Progress Tracker](#modal-progress)
20. [Progress Tracker — 7 Steps Explained](#progress-steps)
21. [Progress Tracker — Payment Badge](#payment-badge)
22. [Progress Tracker — Payment Warning](#payment-warning)
23. [Progress Tracker — Tracking Info](#tracking-info)
24. [Modal Section 4: Prescription Details](#modal-details)
25. [Modal Section 5: Pricing Breakdown](#modal-pricing)
26. [Modal Section 6: Shipping Address](#modal-shipping)
27. [Modal Section 7: Pharmacy Notes](#modal-notes)
28. [Modal Section 8: Fulfilling Pharmacy](#modal-pharmacy)
29. [Action Buttons — What Shows When](#action-buttons)
30. [Action Button: Edit Prescription](#action-edit)
31. [Action Button: Bill Patient](#action-bill)
32. [Action Button: Payment Received (disabled)](#action-payment-received)
33. [Action Button: Submit to Pharmacy](#action-submit)
34. [Action Button: View Prescription PDF](#action-pdf)
35. [Action Button: Print Receipt](#action-print)
36. [The Edit Prescription Modal — Every Field](#edit-modal)
37. [The Bill Patient Modal — Payment Link + Direct Charge](#bill-modal)
38. [Real-Time Updates — How Data Stays Fresh](#realtime)
39. [Templates / Pharmacy Relationship](#templates)
40. [Visual Diagrams](#diagrams)

---

<a name="overview"></a>
## 1. PAGE OVERVIEW

**Path:** `app/(features)/prescriptions/page.tsx` (1,139 lines)

This is the page the PROVIDER sees when they click "Prescriptions" in the top nav. It shows ALL prescriptions this provider has written, with group color-coding, status badges, and a "View" button that opens a detailed receipt modal.

**What you see (matching your screenshot):**
- Top: Search bar + blue "+ New Prescription" button
- Below search: Two tabs — "In Progress (22)" and "Completed"
- Main area: Table with 8 columns
- Grouped prescriptions have blue/purple/amber/green/rose backgrounds
- First item in each group has a colored badge like "2 items" or "3 items"
- Each row has a "View" button on the right

---

<a name="files"></a>
## 2. FILE STRUCTURE — 4 FILES

```
app/(features)/prescriptions/
├── page.tsx                          (1,139 lines) — Main page: table, tabs, search, data loading
├── _components/
│   ├── PrescriptionModals.tsx        (1,061 lines) — Receipt modal + address editing
│   ├── PrescriptionProgressTracker.tsx (445 lines) — 7-step progress bar
│   └── EditPrescriptionModal.tsx      (499 lines) — Edit form modal
```

**Plus one shared component:**
```
components/billing/BillPatientModal.tsx (1,279 lines) — Bill patient: payment link or direct charge
```

**Total: ~4,423 lines across 5 files.**

---

<a name="data-loading"></a>
## 3. DATA LOADING

### Primary query (Supabase direct, not API route):

```typescript
const { data } = await supabase
  .from("prescriptions")
  .select(`
    id, queue_id, submitted_at, medication, dosage, dosage_amount,
    dosage_unit, vial_size, form, quantity, refills, sig,
    dispense_as_written, pharmacy_notes, patient_price, profit_cents,
    consultation_reason, refill_frequency_days, shipping_fee_cents,
    total_paid_cents, status, payment_status, tracking_number,
    fedex_status, estimated_delivery, pharmacy_id, pdf_storage_path,
    patient_id, has_custom_address, custom_address,
    patient:patients(first_name, last_name, date_of_birth, email, physical_address),
    pharmacy:pharmacies(name, primary_color),
    payment_transactions(id)
  `)
  .eq("prescriber_id", user.id)           // Only THIS provider's prescriptions
  .eq("prescription_type", "prescription") // Not refills
  .neq("status", "cancelled")             // Hide cancelled
  .order("submitted_at", { ascending: false }); // Newest first
```

### Group ID fetch (separate API call):

```typescript
const groupRes = await fetch("/api/prescriptions/submission-groups");
const { groups } = await groupRes.json();
// groups = { "rx-id-1": "group-uuid-abc", "rx-id-2": "group-uuid-abc", ... }
// Maps each prescription ID to its order_group_id
```

### Doctor name (separate query):

```typescript
const { data: providerData } = await supabase
  .from("providers")
  .select("first_name, last_name")
  .eq("user_id", user.id)
  .single();
// Result: "Dr. Joseph Sughayer" (used for ALL prescriptions since provider is viewing their own)
```

---

<a name="interface"></a>
## 4. INTERFACE — EVERY FIELD

```typescript
interface Prescription {
  id: string;                              // UUID, last 4 chars shown as "Ref" in table
  queueId: string;                         // DigitalRx Queue ID (e.g. "1094216") or "N/A"
  dateTime: string;                        // submitted_at timestamp
  patientName: string;                     // "First Last" from patients table
  patientEmail?: string;                   // from patients table
  patientDOB?: string;                     // date_of_birth from patients
  doctorName?: string;                     // "Dr. First Last" from providers
  medication: string;                      // e.g. "BPC-157/TB500 capsules"
  strength: string;                        // dosage field, e.g. "1mg"
  quantity: number;                        // e.g. 1, 2, 5
  refills: number;                         // 0-12
  status: string;                          // "submitted", "pending_payment", "payment_received", etc.
  sig: string;                             // Patient directions
  form: string;                            // "Capsule", "Injection", etc.
  dispenseAsWritten: boolean;              // DAW flag
  pharmacyNotes?: string;                  // Notes to pharmacy
  trackingNumber?: string;                 // FedEx/UPS tracking
  patientPrice?: string;                   // Dollar amount as string (e.g. "5.00")
  vialSize?: string;                       // e.g. "1EA", "5mL"
  dosageAmount?: string;                   // e.g. "1"
  dosageUnit?: string;                     // e.g. "mg", "mL"
  pharmacyName?: string;                   // e.g. "Greenwich" — from pharmacies table
  pharmacyColor?: string;                  // e.g. "#10B981" — primary_color from pharmacies
  profitCents?: number;                    // Oversight/consultation fee in cents
  shippingFeeCents?: number;               // Shipping fee in cents
  totalPaidCents?: number;                 // What patient actually paid in cents
  paymentStatus?: string;                  // "pending", "paid", "link_sent"
  pdfStoragePath?: string;                 // Supabase storage path to PDF
  consultationReason?: string;             // "dose_titration", "side_effect_monitoring", etc.
  carrierStatus?: string;                  // FedEx status like "In Transit", "Delivered"
  trackingCarrier?: string;                // "fedex", "ups", "usps"
  estimatedDelivery?: string;              // Date string
  refillFrequencyDays?: number | null;     // 30, 60, 90 days
  patientId?: string;                      // UUID of patient
  hasCustomAddress?: boolean;              // Custom shipping address override
  customAddress?: AddressData | null;      // The custom address
  patientAddress?: AddressData | null;     // Default patient address
  submissionGroupId?: string | null;       // order_group_id — THE GROUP KEY
  paymentTransactionId?: string | null;    // Links to payment_transactions
}
```

---

<a name="layout"></a>
## 5. PAGE LAYOUT — TOP TO BOTTOM

```
┌─────────────────────────────────────────────────────────────────┐
│  AIM Rx Logo    TEST PROVIDER    Dashboard | Catalog |          │
│                                  Prescriptions | Refills |      │
│                                  Prescribe | Patients   🔔 👤    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────┐        ┌───────────────────┐  │
│  │ Search by patient, medication│        │ + New Prescription│  │
│  │ or ref...                    │        │   (blue button)   │  │
│  └──────────────────────────────┘        └───────────────────┘  │
│                                                                 │
│  ┌──────────────────┬───────────┐                               │
│  │ In Progress  22  │ Completed │    ← tabs with count badges  │
│  └──────────────────┴───────────┘                               │
│  ─────────────────────────────── (border-b)                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ref │ Date&Time │ Patient │ Medication │ Qty │ Pharm │ Stat ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ rows with View buttons...                                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

<a name="search"></a>
## 6. SEARCH BAR

```typescript
<Input
  placeholder="Search by patient, medication or ref..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="max-w-md border-gray-300 rounded-lg"
/>
```

**Search filters by:**
- `patientName` (case-insensitive includes)
- `medication` (case-insensitive includes)
- `id.slice(-4)` (last 4 chars of UUID — the "Ref" column)

```typescript
const searchMatch =
  rx.patientName.toLowerCase().includes(query) ||
  rx.medication.toLowerCase().includes(query) ||
  rx.id.slice(-4).toLowerCase().includes(query);
```

---

<a name="tabs"></a>
## 7. TABS — "IN PROGRESS" vs "COMPLETED"

Two tabs with count badges:

### "In Progress" tab:
- **Filter:** `status !== "delivered"`
- **Badge:** Blue circle with count → `bg-blue-100 text-blue-700`
- **Active style:** `border-[#1E3A8A] text-[#1E3A8A]` (navy blue underline)

### "Completed" tab:
- **Filter:** `status === "delivered"`
- **Badge:** Green circle with count → `bg-green-100 text-green-700`
- **Active style:** Same navy blue underline

### Inactive tab:
- `border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300`

---

<a name="table-header"></a>
## 8. TABLE HEADER — ALL 8 COLUMNS

```
┌──────┬────────────┬─────────────┬──────────────────────────┬──────────────┬──────────┬─────────────┬─────────┐
│ Ref  │ Date &     │ Patient     │ Medication + Strength/   │ Quantity /   │ Pharmacy │ Status      │ Actions │
│      │ Time       │ Name        │ Dosage                   │ Refills      │          │             │ (right) │
└──────┴────────────┴─────────────┴──────────────────────────┴──────────────┴──────────┴─────────────┴─────────┘
```

Header row has `bg-gray-50` background. All headers have `font-semibold` class.

---

<a name="table-body"></a>
## 9. TABLE BODY — ROW RENDERING

Each row renders 8 cells:

### Cell 1: Ref
```typescript
<TableCell className="font-mono text-xs text-muted-foreground">
  {prescription.id.slice(-4).toUpperCase()}   // Last 4 of UUID, e.g. "2B61"
</TableCell>
```
- `font-mono` → monospace font
- `text-xs` → small
- `text-muted-foreground` → gray color

### Cell 2: Date & Time
```typescript
<TableCell className="whitespace-nowrap">
  {formatDateTime(prescription.dateTime)}     // "Apr 13, 2026, 6:31 PM"
</TableCell>
```
Format: `month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true`

### Cell 3: Patient Name + Group Badge
```typescript
<TableCell className="font-medium">
  <div className="flex items-center gap-2">
    {prescription.patientName}                // "Test Test 1"
    {isFirstInBatch && (                      // ONLY on first item of group
      <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
            style={{ backgroundColor: groupBorders[colorIdx] }}>
        {batchSize} items                     // "2 items", "3 items"
      </span>
    )}
  </div>
</TableCell>
```

### Cell 4: Medication + Strength/Dosage
```typescript
<TableCell>
  <div className="flex flex-col">
    <span className="font-medium">{prescription.medication}</span>  // "BPC-157/TB500 capsules"
    <span className="text-sm text-muted-foreground">
      {prescription.strength}                                       // "1mg"
    </span>
  </div>
</TableCell>
```
Two lines stacked: medication name (bold) and strength (gray, smaller).

### Cell 5: Quantity / Refills
```typescript
<TableCell>
  <div className="flex flex-col">
    <span>Qty: {prescription.quantity}</span>      // "Qty: 1"
    <span className="text-sm text-muted-foreground">
      Refills: {prescription.refills}              // "Refills: 0"
    </span>
  </div>
</TableCell>
```
Two lines stacked.

### Cell 6: Pharmacy
```typescript
<TableCell>
  {prescription.pharmacyName ? (
    <span className="font-medium"
          style={{ color: prescription.pharmacyColor || "#1E3A8A" }}>
      {prescription.pharmacyName}              // "Greenwich" in pharmacy's brand color
    </span>
  ) : (
    <span className="text-muted-foreground text-sm">Not specified</span>
  )}
</TableCell>
```
**KEY:** The pharmacy name is displayed in the **pharmacy's own brand color** from `pharmacies.primary_color` in the database. For example, Greenwich might show in green.

### Cell 7: Status
```typescript
<TableCell>
  <div className="flex flex-col">
    <Badge variant="outline" className={`${getStatusColor(prescription.status)} text-xs px-2 py-1`}>
      {formatStatusLabel(prescription.status)}    // "Submitted", "Pending Payment"
    </Badge>
    {prescription.queueId && prescription.queueId !== "N/A" && (
      <span className="text-xs text-muted-foreground">
        Queue: {prescription.queueId}             // "Queue: 1094216"
      </span>
    )}
  </div>
</TableCell>
```

### Cell 8: Actions (right-aligned)
```typescript
<TableCell className="text-right">
  <Button variant="outline" size="sm"
          onClick={() => handleViewDetails(prescription)}
          className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white">
    View
  </Button>
</TableCell>
```
- Navy blue outline button
- On hover: fills navy blue with white text

---

<a name="color-coding"></a>
## 10. GROUP COLOR-CODING — HOW ROWS GET COLORED

**Same algorithm as admin page.** Applied inside an IIFE in the `<TableBody>`:

### Step 1: Build batch keys
```typescript
for (let i = 0; i < filteredPrescriptions.length; i++) {
  const curr = filteredPrescriptions[i];
  const sgId = curr.submissionGroupId;     // PRIMARY: order_group_id
  const txId = curr.paymentTransactionId;  // FALLBACK: shared transaction

  if (sgId) {
    if (!groupIdMap[sgId]) { groupCounter++; groupIdMap[sgId] = `g${groupCounter}`; }
    batchKeys.push(groupIdMap[sgId]);
  } else if (txId) {
    if (!txIdMap[txId]) { groupCounter++; txIdMap[txId] = `t${groupCounter}`; }
    batchKeys.push(txIdMap[txId]);
  } else {
    groupCounter++;
    batchKeys.push(`g${groupCounter}`);   // Solo item
  }
}
```

### Step 2: Validate groups (break invalid ones)
If a group has MORE than 1 item with `shippingFeeCents > 0`, it's invalid (data error) → break into solo items.

### Step 3: Assign colors
```typescript
const groupBgs = ["#EFF6FF", "#F5F3FF", "#FFFBEB", "#ECFDF5", "#FFF1F2"];
//                 Blue       Purple     Amber      Green      Rose
const groupBorders = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E"];
```

Only groups with `count > 1` get assigned colors. Colors rotate through the 5 options.

### Step 4: Apply to rows
```typescript
<TableRow
  style={isMultiBatch ? {
    backgroundColor: groupBgs[colorIdx],           // Tinted background
    borderLeft: `3px solid ${groupBorders[colorIdx]}` // Colored left stripe
  } : undefined}                                    // Solo = no special style
>
```

**Solo rows:** No special style (default white, hover:bg-gray-50)
**Grouped rows:** Colored background + 3px left border stripe

---

<a name="group-badge"></a>
## 11. GROUP BADGE — "2 items" / "3 items"

Only the **first row** of each group shows the badge:

```typescript
{isFirstInBatch && (
  <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
        style={{ backgroundColor: groupBorders[colorIdx] }}>
    {batchSize} items
  </span>
)}
```

- **Shape:** `rounded-full` (pill shape)
- **Size:** `text-xs`, `px-1.5 py-0.5`
- **Color:** White text on the group's border color (e.g. blue badge for blue group)
- **Text:** "{N} items" where N = total items in group

### Visual example from your screenshot:
```
│ 2B61  Apr 13, 6:31 PM  Test Test 1 [2 items]  Dihexa/Teofensi...  │ ← blue bg, badge
│ 7A26  Apr 13, 6:31 PM  Test Test 1             BPC-157 capsules    │ ← blue bg, no badge
│ T512  Apr 11, 7:47 AM  Test Test 1 [2 items]  BPC-157 capsules    │ ← different group
│ 0818  Apr 11, 7:47 AM  Test Test 1             BPC-157 capsules    │ ← same group
```

---

<a name="status-column"></a>
## 12. STATUS COLUMN — COLORS AND LABELS

### Status badge colors (Badge component with variant="outline"):

```typescript
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":   return "bg-blue-100 text-blue-800 border-blue-200";
    case "billing":     return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "approved":    return "bg-green-100 text-green-800 border-green-200";
    case "processing":  return "bg-purple-100 text-purple-800 border-purple-200";
    case "shipped":     return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":   return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:            return "bg-gray-100 text-gray-800 border-gray-200";
  }
};
```

### Status label formatting:
- Replaces `_` and `-` with spaces
- Capitalizes each word
- Examples: `"pending_payment"` → `"Pending Payment"`, `"submitted"` → `"Submitted"`

### Queue ID shown below badge:
If the prescription has a DigitalRx queue ID, it shows below the status badge as "Queue: 1094216" in small gray text.

---

<a name="pharmacy-column"></a>
## 13. PHARMACY COLUMN — COLOR FROM DATABASE

The pharmacy name is shown in the pharmacy's brand color:

```typescript
style={{ color: prescription.pharmacyColor || "#1E3A8A" }}
```

- `pharmacyColor` comes from `pharmacies.primary_color` in the database
- If no color set, defaults to navy blue `#1E3A8A`
- Each pharmacy has its own color (e.g., Greenwich in green, another pharmacy in purple)

---

<a name="actions-button"></a>
## 14. ACTIONS COLUMN — THE "VIEW" BUTTON

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => handleViewDetails(prescription)}
  className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white"
>
  View
</Button>
```

**Style:**
- Border: Navy blue `#1E3A8A`
- Text: Navy blue `#1E3A8A`
- On hover: Navy blue fill, white text
- Size: `sm` (small button)
- Right-aligned in its cell

---

<a name="view-click"></a>
## 15. WHAT HAPPENS WHEN YOU CLICK "VIEW"

```typescript
const handleViewDetails = async (prescription: Prescription) => {
  // 1. Fresh-fetch this prescription from DB (not stale cached data)
  const { data: freshData } = await supabase
    .from("prescriptions")
    .select(`id, queue_id, submitted_at, medication, dosage, ...all fields...
             patient:patients(first_name, last_name, date_of_birth)`)
    .eq("id", prescription.id)
    .single();

  // 2. Merge fresh data with existing data (keeps pharmacy, email, etc.)
  const freshPrescription = {
    ...prescription,
    queueId: freshData.queue_id || "N/A",
    medication: freshData.medication,
    // ... all other fields updated from DB ...
  };

  // 3. Set as selected and open modal
  setSelectedPrescription(freshPrescription);
  setIsDialogOpen(true);
};
```

**Key:** Every time you click View, it re-fetches the latest data from the database. This ensures the modal always shows the most current status, tracking number, payment status, etc.

---

<a name="receipt-modal"></a>
## 16. THE RECEIPT MODAL — COMPLETE STRUCTURE

**Component:** `PrescriptionModals` from `_components/PrescriptionModals.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│                        (X close button)                      │
│                                                              │
│                     [AIM Rx Logo]                            │
│              AIM Medical Technologies                        │
│       106 E 6th St, Suite 900 · Austin, TX 78701            │
│            (769) 304-1830 · Mon-Fri 9AM-6PM CST             │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│                    ✓ (blue circle)                           │
│             Order Successfully Submitted                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Reference #                              [📋 Copy]   │   │
│  │ 1094216                                              │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Patient              │ Date                          │   │
│  │ Test Test 1           │ Apr 13, 2026, 6:31 PM        │   │
│  │ DOB: 6/23/1985        │                              │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Prescribed by                                        │   │
│  │ Dr. Joseph Sughayer                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Order Progress    [$ Paid · $5.00] [Greenwich]       │   │
│  │                                                      │   │
│  │ ⚠ Order will NOT be sent to pharmacy until payment   │   │
│  │   is received. (only if payment pending)             │   │
│  │                                                      │   │
│  │  ✓──✓──●──○──○──○──○                                 │   │
│  │  Order Payment Sent Processing Approved Shipped Deliv│   │
│  │  Created        to                                   │   │
│  │                 Pharm                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Prescription Details (blue text)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Medication                    │ Vial Size             │   │
│  │ BPC - 157 capsules            │ 1EA                   │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Dosage Amount │ Unit │ Form                          │   │
│  │ 1             │ mg   │ Injection                     │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Quantity │ Refills │ DAW                             │   │
│  │ 1        │ 0       │ No                              │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ How to Use This Medication (Patient Directions)      │   │
│  │ Take 1 capsule by mouth every morning with           │   │
│  │ WATER ONLY.                                          │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Pricing                                              │   │
│  │ Medication Price:                          $5.00     │   │
│  │ Shipping Fee:                             $25.00     │   │
│  │ Consultation Fee (Dose Titration):         $1.00     │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ Total:                                   $31.00      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  🚚 Shipping Address (blue text)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📍 123 Main St, Miami, FL 33101                      │   │
│  │    [Custom address for this order] (if custom)       │   │
│  │ ──────────────────────────────────────────────────── │   │
│  │ [✏️ Edit Shipping Address]                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📋 Important Notes from AIM Pharmacy:                │   │
│  │ • Keep refrigerated at 36-46°F until use             │   │
│  │ • This medication requires proper injection...       │   │
│  │ • Report any unusual side effects...                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📍 Fulfilling Pharmacy                               │   │
│  │ Greenwich                                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [✏️ Edit Prescription]  (only if pending_payment)     │   │
│  │ [💲 Bill Patient]       (or "Payment Received" gray) │   │
│  │ [💊 Submit to Pharmacy] (only if paid, not submitted)│   │
│  │ [📄 View Prescription PDF] (only if PDF exists)      │   │
│  │ [🖨️ Print Receipt]                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

<a name="modal-progress"></a>
## 19. MODAL SECTION 3: ORDER PROGRESS TRACKER

**Component:** `PrescriptionProgressTracker` (445 lines)

### 7 Steps with Icons:

| Step | Key | Label | Icon | Description |
|------|-----|-------|------|-------------|
| 0 | `created` | Order Created | ClipboardList | "Saved in system" |
| 1 | `payment` | Payment | CreditCard | "Awaiting payment" |
| 2 | `sent_to_pharmacy` | Sent to Pharmacy | Send | "Submitted after payment" |
| 3 | `processing` | Processing | Package | "Rx being filled" |
| 4 | `approved` | Approved | ShieldCheck | "Pharmacist OK" |
| 5 | `shipped` | Shipped | Truck | "With carrier" |
| 6 | `delivered` | Delivered | PackageCheck | "Received" |

### Step Status Mapping:

```typescript
function getStepIndex(status: string, billingStatus?: string): number {
  if (status === "delivered" || status === "completed") return 6;
  if (status === "shipped" || status === "pickedup") return 5;
  if (status === "approved") return 4;
  if (status === "packed" || status === "processing" || status === "compounding") return 3;
  if (status === "submitted" && billingStatus !== "pending") return 2;
  if (status === "paymentreceived" || billingStatus === "paid") return 2;
  if (status === "billing" || status === "pendingpayment" || billingStatus === "pending") return 1;
  return 0;
}
```

### Step Circle Colors:

| State | Circle Style |
|-------|-------------|
| **Completed** (past step) | Green gradient (`from-emerald-500 to-emerald-600`), white checkmark, green shadow |
| **Current** (active step) | Navy blue gradient (`from-[#1E3A8A] to-[#2563EB]`), white icon, blue ring, ping animation |
| **Current + Payment Pending** | Amber gradient (`from-amber-400 to-amber-500`), white icon, amber ring, ping animation |
| **Future** (not reached) | Gray background (`bg-gray-100`), gray icon, gray border |

### Progress Bar:
- Gray line connecting all steps
- Green gradient fill (`from-emerald-500 to-emerald-600`) up to current step
- Animated on mount with 1000ms transition

### Step Label Colors:
- Completed: `text-emerald-600` (green)
- Current: `text-[#1E3A8A]` (navy)
- Current + payment pending: `text-amber-600` (amber)
- Future: `text-gray-400`

---

<a name="payment-badge"></a>
## 21. PROGRESS TRACKER — PAYMENT BADGE

Top-right of progress tracker, two badges:

### Payment badge:
```
[$ Paid · $5.00]  — green bg, green text (emerald-50/emerald-700)
[$ Due · $5.00]   — amber bg, amber text (amber-50/amber-700)
```

### Pharmacy badge:
```
[Greenwich]  — gray bg (gray-100), gray text, rounded pill
```

---

<a name="payment-warning"></a>
## 22. PROGRESS TRACKER — PAYMENT WARNING

Only shows when payment is pending (step index < 2):

```
┌──────────────────────────────────────────────────────────┐
│ ⚠ Order will NOT be sent to the pharmacy until payment   │
│   is received.                                           │
└──────────────────────────────────────────────────────────┘
```

- `bg-amber-50 border-amber-200` background
- `text-amber-800` text
- AlertTriangle icon in `text-amber-600`

---

<a name="modal-pricing"></a>
## 25. MODAL SECTION 5: PRICING BREAKDOWN

```
Pricing
─────────────────────────────────────────────
Medication Price:                    $5.00
Shipping Fee:                       $25.00
Consultation Fee (Dose Titration     $1.00
& Adjustment):
─────────────────────────────────────────────
Total:                              $31.00
```

### Consultation reason labels:
```typescript
const CONSULTATION_REASON_LABELS = {
  dose_titration: "Dose Titration & Adjustment",
  side_effect_monitoring: "Side Effect & Safety Monitoring",
  therapeutic_response: "Therapeutic Response Review",
  adherence_tracking: "Medication Adherence Tracking",
  contraindication_screening: "Contraindication Screening",
};
```

### Total calculation:
```typescript
const total = medicationPrice + (profitCents / 100) + (shippingFeeCents / 100);
```

---

<a name="action-buttons"></a>
## 29. ACTION BUTTONS — WHAT SHOWS WHEN

All buttons are `w-full text-lg py-6` (full width, large) with navy blue outline styling.

### Rules:

| Condition | Buttons Shown |
|-----------|--------------|
| `status === "pending_payment"` | Edit Prescription, Bill Patient |
| `paymentStatus === "paid"` | Payment Received (disabled), Submit to Pharmacy (if `status === "payment_received"`), View PDF, Print |
| `paymentStatus !== "paid"` | Bill Patient, View PDF, Print |
| `pdfStoragePath` exists | View Prescription PDF |
| Always | Print Receipt |

### Button details:

**Edit Prescription** (only when `pending_payment`, hidden if `hideEdit` prop):
```typescript
<Button onClick={() => setIsEditModalOpen(true)}
        variant="outline"
        className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5">
  <Pencil /> Edit Prescription
</Button>
```

**Bill Patient** (opens BillPatientModal):
```typescript
<Button onClick={() => setIsBillModalOpen(true)}
        variant="outline"
        className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5">
  <DollarSign /> Bill Patient
</Button>
```

**Payment Received** (disabled, shown when paid):
```typescript
<Button disabled variant="outline"
        className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 cursor-not-allowed">
  <CheckCircle2 /> Payment Received
</Button>
```

**Submit to Pharmacy** (only when `paymentStatus === "paid"` AND `status === "payment_received"`):
```typescript
<Button onClick={() => handleSubmitToPharmacy(selectedPrescription.id)}
        disabled={isSubmittingToPharmacy}>
  {isSubmittingToPharmacy ? "⏳ Submitting..." : "💊 Submit to Pharmacy"}
</Button>
```

**View Prescription PDF** (only if `pdfStoragePath` exists):
```typescript
<Button onClick={async () => {
  const response = await fetch(`/api/prescriptions/${id}/pdf`);
  const data = await response.json();
  if (data.success && data.url) window.open(data.url, "_blank");
}}>
  <FileText /> View Prescription PDF
</Button>
```

**Print Receipt** (always shown):
```typescript
<Button onClick={() => printReceipt()}>
  <Printer /> Print Receipt
</Button>
```

---

<a name="edit-modal"></a>
## 36. THE EDIT PRESCRIPTION MODAL — EVERY FIELD

**Component:** `EditPrescriptionModal` (499 lines)

Opens when provider clicks "Edit Prescription" (only available when `status === "pending_payment"`).

### Fields in the edit form:

| Field | Type | Details |
|-------|------|---------|
| Medication | Read-only text | Cannot change medication name |
| Vial Size | Text input | e.g. "5mL", "1EA" |
| Dosage Amount * | Number input | Required, min 0 |
| Unit | Select dropdown | Options: mg, mL, mcg, g, units, % |
| Form | Select dropdown | Options: Tablet, Capsule, Liquid, Cream, Ointment, Gel, Patch, Injection, Inhaler, Drops, Spray, Suppository |
| Quantity * | Number input | Required, min 1 |
| Refills | Number input | 0-12 |
| Refill Frequency (days) * | Number input | Only shows when refills > 0. Required when refills > 0. |
| SIG (Directions) * | Textarea | Patient directions, 3 rows |
| Dispense as Written | Checkbox | DAW flag |
| Notes to Pharmacy | Textarea | 2 rows |
| **Pricing section** | | |
| Medication Price ($) | Number input | Step 0.01 |
| Shipping & Handling ($) | Number input | Step 0.01, converted to cents on save |
| Consultation Fee ($) | Number input | Step 0.01, converted to cents on save |
| Consultation Reason | Select dropdown | 5 options (see consultation reasons above) |

### Save action:
- Calls `PATCH /api/prescriptions/{id}/update`
- Converts dollar amounts to cents for `shippingFeeCents` and `profitCents`
- On success: toast, calls `onSaved` callback, closes modal, updates in-memory data

### Buttons:
- Cancel (outline) | Save Changes (navy blue `bg-[#1E3A8A]`)

---

<a name="bill-modal"></a>
## 37. THE BILL PATIENT MODAL

**Component:** `BillPatientModal` from `components/billing/BillPatientModal.tsx` (1,279 lines)

This is the modal that appears when the provider clicks "Bill Patient". It has **two tabs**:

### Tab 1: "Send Payment Link" (via email)
- Generates a payment link using `/api/payments/generate-link`
- Sends email to patient with payment URL
- Shows: patient email, consultation fee, medication cost, shipping fee, total
- "Generate & Send Payment Link" button

### Tab 2: "Direct Charge" (enter card details)
- Processes payment directly via Authorize.Net
- Card fields: number, expiry, CVV
- Same cost breakdown

### What it receives from the parent:
```typescript
<BillPatientModal
  prescriptionId={selectedPrescription.id}
  patientName={selectedPrescription.patientName}
  patientEmail={selectedPrescription.patientEmail}
  medication={selectedPrescription.medication}
  medicationCostCents={Math.round(parseFloat(patientPrice) * 100)}
  profitCents={selectedPrescription.profitCents}
  shippingFeeCents={selectedPrescription.shippingFeeCents}
  paymentStatus={selectedPrescription.paymentStatus}
/>
```

---

<a name="realtime"></a>
## 38. REAL-TIME UPDATES — HOW DATA STAYS FRESH

### 3 mechanisms:

**1. Supabase real-time subscription:**
```typescript
const channel = supabase
  .channel("prescriptions-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "prescriptions",
    filter: `prescriber_id=eq.${user?.id}`,
  }, () => {
    loadPrescriptions();   // Reload ALL prescriptions on any change
  })
  .subscribe();
```

**2. DigitalRx status polling (every 30 seconds):**
```typescript
const fetchStatusUpdates = async () => {
  const response = await fetch("/api/prescriptions/status-batch", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id }),
  });
  // Updates statuses from pharmacy system (processing, approved, shipped, etc.)
};

setInterval(fetchStatusUpdates, 30000);
```

**3. Tracking sync (on modal open):**
```typescript
// When modal opens and prescription has tracking number:
fetch("/api/prescriptions/sync-tracking", {
  method: "POST",
  body: JSON.stringify({ prescriptionId: selectedPrescription.id }),
});
// Syncs carrier status (FedEx/UPS) and estimated delivery
```

**4. Modal stays in sync:**
```typescript
useEffect(() => {
  setSelectedPrescription((prev) => {
    if (!prev) return null;
    const updated = prescriptions.find((p) => p.id === prev.id);
    return updated || null;
  });
}, [prescriptions]);
```

---

<a name="templates"></a>
## 39. TEMPLATES / PHARMACY RELATIONSHIP

### How prescriptions relate to pharmacies:

Each prescription stores:
- `pharmacy_id` → UUID referencing `pharmacies` table
- The `pharmacies` table has: `name`, `primary_color`, and links to `pharmacy_backends` for API credentials

### What comes from the pharmacy:
- **Name:** Displayed in table and modal (e.g. "Greenwich")
- **Color:** `primary_color` used for the pharmacy name text in the table
- **Backend:** API credentials for DigitalRx submission (stored in `pharmacy_backends`)

### Medication catalog is pharmacy-specific:
In `step2/page.tsx`, when the provider selects medications, they choose from a pharmacy's catalog. Each pharmacy has its own set of medications with pharmacy-specific pricing. The selected `pharmacy_id` and `medication_id` are stored with the prescription.

---

<a name="diagrams"></a>
## 40. VISUAL DIAGRAMS

### Table with groups (matching your screenshot):

```
┌──────┬──────────────────┬──────────────────┬────────────────────────────────┬──────────┬───────────┬──────────────────┬────────┐
│ Ref  │ Date & Time      │ Patient Name     │ Medication + Strength/Dosage   │ Qty/Ref  │ Pharmacy  │ Status           │ Actions│
├──────┼──────────────────┼──────────────────┼────────────────────────────────┼──────────┼───────────┼──────────────────┼────────┤
│▌2B61 │ Apr 13, 6:31 PM  │ Test Test 1      │ Dihexa/Teofensine capsules    │ Qty: 1   │ Greenwich │ ┌─Submitted──┐   │ [View] │
│      │                  │ [2 items]        │ 5mg/500mcg                    │ Ref: 0   │ (green)   │ │Queue:10942 │   │        │
│      │                  │                  │                                │          │           │ └────────────┘   │        │
│▌7A26 │ Apr 13, 6:31 PM  │ Test Test 1      │ BPC-157 capsules              │ Qty: 1   │ Greenwich │ ┌─Submitted──┐   │ [View] │
│      │                  │                  │ 1mg                           │ Ref: 0   │ (green)   │ │Queue:10942 │   │        │
├──────┼──────────────────┼──────────────────┼────────────────────────────────┼──────────┼───────────┼──────────────────┼────────┤
│▌T512 │ Apr 11, 7:47 AM  │ Test Test 1      │ BPC-157 capsules              │ Qty: 2   │ Greenwich │ ┌─Pending────┐   │ [View] │
│      │                  │ [2 items]        │ 1mg                           │ Ref: 0   │ (green)   │ │ Payment    │   │        │
│▌0818 │ Apr 11, 7:47 AM  │ Test Test 1      │ BPC-157 capsules              │ Qty: 1   │ Greenwich │ ┌─Pending────┐   │ [View] │
│      │                  │                  │ 1mg                           │ Ref: 0   │ (green)   │ │ Payment    │   │        │
├──────┼──────────────────┼──────────────────┼────────────────────────────────┼──────────┼───────────┼──────────────────┼────────┤
│ 5F73 │ Apr 11, 7:44 AM  │ Test Test 1      │ BPC-157/TB500 capsules        │ Qty: 1   │ Greenwich │ ┌─Pending────┐   │ [View] │
│      │                  │ [2 items]        │ 1mg                           │ Ref: 0   │ (green)   │ │ Payment    │   │        │
│ 0F40 │ Apr 11, 7:44 AM  │ Test Test 1      │ BPC-157 capsules              │ Qty: 1   │ Greenwich │ ┌─Pending────┐   │ [View] │
│      │                  │                  │ 1mg                           │ Ref: 0   │ (green)   │ │ Payment    │   │        │
├──────┼──────────────────┼──────────────────┼────────────────────────────────┼──────────┼───────────┼──────────────────┼────────┤
│ E762 │ Apr 10, 9:11 PM  │ Test Test 1      │ Dihexa/Teofensine capsules    │ Qty: 1   │ Greenwich │ ┌─Submitted──┐   │ [View] │
│      │                  │ [3 items]        │ 5mg/500mcg                    │ Ref: 0   │ (green)   │ │Queue:19777 │   │        │
│      │                  │                  │ 1mg                           │          │           │ └────────────┘   │        │
│      │ Apr 10, 9:11 PM  │ Test Test 1      │ NAD+ 100mg/mL                 │ Qty: 1   │ Greenwich │ ┌─Submitted──┐   │ [View] │
│      │                  │                  │ 10mg                          │ Ref: 0   │ (green)   │ │Queue:19777 │   │        │
│      │ Apr 10, 9:11 PM  │ Test Test 1      │ Epithalon 2mg/mL              │ Qty: 2   │ Greenwich │ ┌─Submitted──┐   │ [View] │
│      │                  │                  │ 1mg                           │ Ref: 1   │ (green)   │ │Queue:19777 │   │        │
└──────┴──────────────────┴──────────────────┴────────────────────────────────┴──────────┴───────────┴──────────────────┴────────┘
```

**Blue rows** (`#EFF6FF` bg, `#3B82F6` left border) = grouped prescriptions
**White/gray rows** = solo prescriptions (alternating with `#FAFAFA`)
**Badge** = appears only on FIRST row of each group

### Modal structure (matching your second screenshot):

```
┌──────────────────────────────────────────┐
│ 1094216                        [📋 Copy] │
│ ─────────────────────────────────────── │
│ Patient           │ Date                │
│ Test Test 1        │ Apr 13, 6:31 PM    │
│ DOB: 6/23/1985     │                    │
│ ─────────────────────────────────────── │
│ Prescribed by                           │
│ Dr. Joseph Sughayer                     │
├─────────────────────────────────────────┤
│ Order Progress    [$ Paid·$5.00] [Grn]  │
│                                         │
│  ✓────✓────●────○────○────○────○        │
│  Order  Pay  Sent  Proc  Appr  Ship Del │
│  Creat       to Ph                      │
│         ↑ current step                  │
├─────────────────────────────────────────┤
│ Prescription Details                    │
│ ┌────────────────────────────────────┐  │
│ │ Medication          │ Vial Size    │  │
│ │ BPC - 157 capsules  │ 1EA          │  │
│ │ ──────────────────────────────── │  │
│ │ Dosage │ Unit │ Form              │  │
│ │ 1      │ mg   │ Injection         │  │
│ │ ──────────────────────────────── │  │
│ │ Quantity │ Refills │ DAW          │  │
│ │ 1        │ 0       │ No           │  │
│ │ ──────────────────────────────── │  │
│ │ Directions:                      │  │
│ │ Take 1 capsule by mouth every    │  │
│ │ morning with WATER ONLY.         │  │
│ │ ──────────────────────────────── │  │
│ │ Pricing                          │  │
│ │ Medication Price:      $5.00     │  │
│ │ Shipping Fee:         $25.00     │  │
│ │ Consultation Fee:      $1.00     │  │
│ │ ──────────────────────────────── │  │
│ │ Total:                $31.00     │  │
│ └────────────────────────────────────┘  │
├─────────────────────────────────────────┤
│ 🚚 Shipping Address                    │
│ [📍 address here]                      │
│ [✏️ Edit Shipping Address]              │
├─────────────────────────────────────────┤
│ 📋 Important Notes from AIM Pharmacy:  │
│ • Keep refrigerated at 36-46°F...      │
├─────────────────────────────────────────┤
│ 📍 Fulfilling Pharmacy                 │
│ Greenwich                              │
├─────────────────────────────────────────┤
│ [✏️ Edit Prescription]                  │
│ [💲 Bill Patient]                       │
│ [📄 View Prescription PDF]              │
│ [🖨️ Print Receipt]                      │
└─────────────────────────────────────────┘
```

---

## KEY COLORS REFERENCE

| Element | Color | Hex |
|---------|-------|-----|
| Primary brand (buttons, borders, text) | Navy Blue | `#1E3A8A` |
| Section headings in modal | AIM Cyan | `#00AEEF` |
| Group row bg 1 | Light Blue | `#EFF6FF` |
| Group row bg 2 | Light Purple | `#F5F3FF` |
| Group row bg 3 | Light Amber | `#FFFBEB` |
| Group row bg 4 | Light Green | `#ECFDF5` |
| Group row bg 5 | Light Rose | `#FFF1F2` |
| Group left border 1 | Blue | `#3B82F6` |
| Group left border 2 | Purple | `#8B5CF6` |
| Group left border 3 | Amber | `#F59E0B` |
| Group left border 4 | Green | `#10B981` |
| Group left border 5 | Rose | `#F43F5E` |
| Status: Submitted | Blue | `bg-blue-100 text-blue-800` |
| Status: Billing | Yellow | `bg-yellow-100 text-yellow-800` |
| Status: Approved | Green | `bg-green-100 text-green-800` |
| Status: Processing | Purple | `bg-purple-100 text-purple-800` |
| Status: Shipped | Indigo | `bg-indigo-100 text-indigo-800` |
| Status: Delivered | Emerald | `bg-emerald-100 text-emerald-800` |
| Progress completed step | Emerald gradient | `from-emerald-500 to-emerald-600` |
| Progress current step | Navy gradient | `from-[#1E3A8A] to-[#2563EB]` |
| Progress payment pending | Amber gradient | `from-amber-400 to-amber-500` |
| Progress future step | Gray | `bg-gray-100 text-gray-400` |
| Payment badge (paid) | Green | `bg-emerald-50 text-emerald-700` |
| Payment badge (due) | Amber | `bg-amber-50 text-amber-700` |
| Payment warning | Amber | `bg-amber-50 border-amber-200 text-amber-800` |
| Table header | Light gray | `bg-gray-50` |
| Solo row alternating | Off-white | `#FAFAFA` |
| Pharmacy name | Dynamic | `pharmacies.primary_color` from DB |

---

## EMPTY STATE

When no prescriptions exist for the active tab:

```
┌─────────────────────────────────────────┐
│              💊 (large pill icon)        │
│                                         │
│    No prescriptions in progress         │
│    All prescriptions have been          │
│    delivered                            │
│                                         │
│    [+ Create Prescription]              │
└─────────────────────────────────────────┘
```

---

## PROFILE CHECK BEFORE NEW PRESCRIPTION

When provider clicks "+ New Prescription":

1. Checks `/api/provider/profile-check` → are NPI, medical license, signature complete?
2. If missing → shows `CompleteProfileModal` instead of navigating
3. Then checks `/api/provider/check-active` → is account active?
4. If inactive → toast error: "Your account is inactive. Please contact administrator."
5. If all good → navigates to `/prescriptions/new/step1`

---

## ADDRESS EDITING IN MODAL

Two save options:
1. **"Save to Patient Record & Prescription"** — updates both the prescription's custom_address AND the patient's physical_address
2. **"This Prescription Only"** — only updates the prescription's custom_address

After saving, if the order has already been submitted to pharmacy, the pharmacy is notified via email about the address change, and a green banner appears:
```
✓ Pharmacy notified via email
Sent to: pharmacy@example.com
```

---

## PRINT RECEIPT

Uses an iframe-based print approach:
1. Clones the receipt modal content
2. Removes `.print-hide` elements (buttons, interactive tracker)
3. Replaces interactive progress tracker with a simplified print version (table-based, no animations)
4. Creates hidden iframe, writes HTML with inline styles
5. Calls `iframe.contentWindow.print()`
6. Removes iframe after printing

The print version has condensed spacing, smaller fonts, and fits on a single page.
