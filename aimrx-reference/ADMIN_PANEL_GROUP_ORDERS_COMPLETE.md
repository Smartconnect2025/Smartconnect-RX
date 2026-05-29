# ADMIN PANEL — GROUP ORDERS: COMPLETE DISPLAY & PAYMENT PROCESSING LOGIC

## Every single feature, every UI detail, every API call, every line of code.

---

## TABLE OF CONTENTS

1. [Admin Panel File Structure](#1-file-structure)
2. [Data Loading — How Admin Gets Prescriptions](#2-data-loading)
3. [AdminPrescription Interface (Every Field)](#3-interface)
4. [Status Logic — How Status Is Determined](#4-status-logic)
5. [GROUP COLOR-CODING — How Table Rows Are Grouped](#5-group-color-coding)
6. [Table Columns — What Shows in Each Column](#6-table-columns)
7. [Detail Modal — What Shows When You Click a Row](#7-detail-modal)
8. [GROUP PRICING DISPLAY — Itemized Breakdown](#8-group-pricing-display)
9. [SEND PAYMENT LINK — Complete Flow for Groups](#9-send-payment-link)
10. [MARK AS PAID — Complete Flow for Groups](#10-mark-as-paid)
11. [SUBMIT TO PHARMACY — What Happens After Payment](#11-submit-to-pharmacy)
12. [CONFIRMATION EMAIL — What Patient Receives](#12-confirmation-email)
13. [Manual Override, Address Edit, Other Actions](#13-other-actions)
14. [Auto-Refresh & Tracking Sync](#14-auto-refresh)
15. [Complete Code Files](#15-complete-code)

---

## 1. FILE STRUCTURE

```
app/
├── (features)/admin/prescriptions/
│   └── page.tsx                          ← Admin table + detail modal (1274 lines)
├── api/admin/prescriptions/
│   └── route.ts                          ← GET: fetch all prescriptions for admin (189 lines)
├── api/payments/generate-link/
│   └── route.ts                          ← POST: create payment link for 1 or N prescriptions (624 lines)
├── api/prescriptions/[id]/mark-paid/
│   └── route.ts                          ← POST: manually mark as paid + submit to pharmacy (386 lines)
└── api/prescriptions/[id]/submit-to-pharmacy/
    └── route.ts                          ← POST: submit single Rx to DigitalRx API (552 lines)
```

---

## 2. DATA LOADING

**File: `app/api/admin/prescriptions/route.ts`**

### Auth:
```typescript
const { user } = await getUser();
// Must be admin or super_admin
const { data: roleRow } = await supabase
  .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
if (!["admin", "super_admin"].includes(roleRow?.role)) → 403

// Check if admin is pharmacy-scoped
const { data: adminLink } = await supabase
  .from("pharmacy_admins").select("pharmacy_id").eq("user_id", user.id).maybeSingle();
// If linked → filter prescriptions by pharmacy_id
```

### Main Query:
```typescript
let query = supabase
  .from("prescriptions")
  .select(`
    id, queue_id, submitted_at, medication, dosage, quantity, refills, sig,
    status, payment_status, tracking_number, prescriber_id, pharmacy_id,
    fedex_status, estimated_delivery, patient_price, shipping_fee_cents,
    profit_cents, patient_id, has_custom_address, custom_address,
    patient:patients(first_name, last_name, email, physical_address),
    pharmacy:pharmacies(name, primary_color),
    payment_transactions(id, payment_token)
  `)
  .neq("status", "cancelled")
  .order("submitted_at", { ascending: false });

if (pharmacyId) {
  query = query.eq("pharmacy_id", pharmacyId);
}
```

### Group ID Lookup (separate query):
```typescript
let groupIdLookup: Record<string, string> = {};
const { data: groupRows } = await supabase
  .from("prescriptions")
  .select("id, order_group_id")
  .not("order_group_id", "is", null);

if (groupRows) {
  for (const row of groupRows) {
    groupIdLookup[row.id] = row.order_group_id;
  }
}
```

### Provider Names Lookup:
```typescript
const prescriberIds = [...new Set(prescriptionsData.map(rx => rx.prescriber_id))].filter(Boolean);
const { data: providersData } = await supabase
  .from("providers")
  .select("user_id, first_name, last_name")
  .in("user_id", prescriberIds);
const providerMap = new Map(providersData?.map(p => [p.user_id, p]) || []);
```

### Test Patient Filter:
```typescript
const HIDDEN_TEST_LASTNAMES = ["harton"];
// Patients with last_name "harton" are filtered out
```

### Response Format (for EACH prescription):
```typescript
{
  id: rx.id,
  queueId: rx.queue_id || "N/A",
  submittedAt: rx.submitted_at,
  providerName: "Dr. FirstName LastName",         // from providers table
  patientName: "FirstName LastName",               // from patients join
  patientEmail: patient?.email || null,             // from patients join
  medication: rx.medication,
  strength: rx.dosage,                             // dosage column → "strength" in UI
  quantity: rx.quantity,
  refills: rx.refills,
  sig: rx.sig,
  status: rx.status || "submitted",
  paymentStatus: rx.payment_status,
  patientPrice: rx.patient_price,                  // numeric, dollars
  shippingFeeCents: rx.shipping_fee_cents,         // integer, cents
  profitCents: rx.profit_cents || 0,               // integer, cents (oversight fee)
  submissionGroupId: groupIdLookup[rx.id] || null, // ← THE GROUP KEY
  trackingNumber: rx.tracking_number,
  pharmacyName: pharmacy?.name,
  pharmacyColor: pharmacy?.primary_color,          // hex color for pharmacy badge
  carrierStatus: rx.fedex_status,
  estimatedDelivery: rx.estimated_delivery,
  patientId: rx.patient_id,
  hasCustomAddress: rx.has_custom_address || false,
  customAddress: rx.custom_address,                // jsonb object
  patientAddress: patient?.physical_address,       // from patients join
  paymentToken: payment_transactions?.[0]?.payment_token,
  paymentTransactionId: payment_transactions?.[0]?.id,
}
```

---

## 3. INTERFACE

```typescript
interface AdminPrescription {
  id: string;
  queueId: string;
  submittedAt: string;
  providerName: string;
  patientName: string;
  patientEmail?: string | null;
  medication: string;
  strength: string;
  quantity: number;
  refills: number;
  sig: string;
  status: string;
  paymentStatus?: string;
  patientPrice?: number | null;        // dollars (e.g. 150.00)
  shippingFeeCents?: number | null;    // cents (e.g. 1500 = $15.00)
  profitCents?: number | null;         // cents (e.g. 2500 = $25.00)
  submissionGroupId?: string | null;   // UUID grouping key
  trackingNumber?: string;
  pharmacyName?: string;
  pharmacyColor?: string;              // hex color
  billingStatus?: string;
  patientCopay?: string;
  deliveryDate?: string;
  lotNumber?: string;
  orderProgress?: string;
  carrierStatus?: string;
  trackingCarrier?: string;
  estimatedDelivery?: string;
  patientId?: string;
  hasCustomAddress?: boolean;
  customAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  patientAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  paymentToken?: string | null;
  paymentTransactionId?: string | null;
}
```

---

## 4. STATUS LOGIC

```typescript
const getEffectiveStatus = (rx: AdminPrescription): string => {
  // If status is "submitted" but NO queue_id → it hasn't gone to pharmacy yet
  if (rx.status === "submitted" && (!rx.queueId || rx.queueId === "N/A")) {
    // Check payment: paid → "payment_received", not paid → "pending_payment"
    return rx.paymentStatus === "paid" ? "payment_received" : "pending_payment";
  }
  return rx.status;
};
```

**Status flow:**
```
pending_payment → payment_received → submitted (has queue_id) → packed → approved → picked_up/shipped → delivered
```

**Status Colors:**
```typescript
"submitted"        → bg-blue-100 text-blue-800
"pending_payment"  → bg-yellow-100 text-yellow-800
"payment_received" → bg-teal-100 text-teal-800
"packed"           → bg-purple-100 text-purple-800
"approved"         → bg-green-100 text-green-800
"picked_up/shipped"→ bg-indigo-100 text-indigo-800
"delivered"        → bg-emerald-100 text-emerald-800
default            → bg-gray-100 text-gray-800
```

**Status Filter Options:**
```typescript
["All", "submitted", "pending_payment", "payment_received", "packed", "approved", "picked_up", "shipped", "delivered"]
```

---

## 5. GROUP COLOR-CODING — THE COMPLETE ALGORITHM

This is the heart of how grouped items display in the table.

### Step 1: Assign batch keys

Every row gets a "batch key". Items that share a key are visually grouped together.

```typescript
const batchKeys: string[] = [];
const groupIdMap: Record<string, string> = {};
let groupCounter = 0;
const txIdMap: Record<string, string> = {};

for (let i = 0; i < filteredPrescriptions.length; i++) {
  const curr = filteredPrescriptions[i];
  const sgId = curr.submissionGroupId;    // from order_group_id in DB
  const txId = curr.paymentTransactionId; // from payment_transactions join

  if (sgId) {
    // PRIMARY GROUPING: by submissionGroupId (order_group_id)
    if (!groupIdMap[sgId]) {
      groupCounter++;
      groupIdMap[sgId] = `g${groupCounter}`;
    }
    batchKeys.push(groupIdMap[sgId]);
  } else if (txId) {
    // FALLBACK GROUPING: by shared paymentTransactionId
    if (!txIdMap[txId]) {
      groupCounter++;
      txIdMap[txId] = `t${groupCounter}`;
    }
    batchKeys.push(txIdMap[txId]);
  } else {
    // SOLO: no group, no shared transaction
    groupCounter++;
    batchKeys.push(`g${groupCounter}`);
  }
}
```

### Step 2: Break invalid groups (data integrity check)

If a group has MORE THAN ONE item with a shipping fee, that's a data error (shipping should only be on the first item). Break those into solo items:

```typescript
const shippingPerGroup: Record<string, number> = {};
for (let i = 0; i < filteredPrescriptions.length; i++) {
  const rx = filteredPrescriptions[i];
  const k = batchKeys[i];
  const fee = rx.shippingFeeCents ?? 0;
  if (fee > 0) {
    shippingPerGroup[k] = (shippingPerGroup[k] || 0) + 1;
  }
}

// Groups where multiple items have shipping → break apart
const invalidGroups = new Set(
  Object.entries(shippingPerGroup)
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
);

for (let i = 0; i < batchKeys.length; i++) {
  if (invalidGroups.has(batchKeys[i])) {
    groupCounter++;
    batchKeys[i] = `solo${groupCounter}`;  // Force solo
  }
}
```

### Step 3: Count items per batch

```typescript
const keyCounts: Record<string, number> = {};
batchKeys.forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1; });
```

### Step 4: Assign colors (only to multi-item batches)

```typescript
const groupBgs = [
  "#EFF6FF",   // Blue background
  "#F5F3FF",   // Purple background
  "#FFFBEB",   // Amber background
  "#ECFDF5",   // Green background
  "#FFF1F2",   // Rose background
];
const groupBorders = [
  "#3B82F6",   // Blue left border + badge
  "#8B5CF6",   // Purple
  "#F59E0B",   // Amber
  "#10B981",   // Green
  "#F43F5E",   // Rose
];

let colorCounter = 0;
const keyColorMap: Record<string, number> = {};
Object.entries(keyCounts).forEach(([key, count]) => {
  if (count > 1 && !(key in keyColorMap)) {
    keyColorMap[key] = colorCounter % groupBgs.length;
    colorCounter++;
  }
});
```

**Color cycling:** If more than 5 groups exist, colors wrap around (modulo 5).

### Step 5: Render rows with grouping

```typescript
const seenKeys = new Set<string>();

return filteredPrescriptions.map((prescription, idx) => {
  const key = batchKeys[idx];
  const isMultiBatch = keyCounts[key] > 1;          // Is this row part of a group?
  const isFirstInBatch = isMultiBatch && !seenKeys.has(key); // First row of this group?
  seenKeys.add(key);
  const batchSize = keyCounts[key];                  // How many items in this group?
  const colorIdx = keyColorMap[key] ?? 0;

  return (
    <TableRow
      style={isMultiBatch ? {
        backgroundColor: groupBgs[colorIdx],         // Colored background
        borderLeft: `4px solid ${groupBorders[colorIdx]}`, // Left color stripe
      } : {
        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA", // Normal zebra stripe
      }}
    >
      {/* ... all columns ... */}
    </TableRow>
  );
});
```

### Visual result:

```
┌─────────────────────────────────────────────────────────┐
│ (white)  Apr 10  Dr. Smith  Jane Doe  Metformin  $50   │  ← solo item
├─────────────────────────────────────────────────────────┤
│▌(blue)   Apr 11  Dr. Jones  Bob Lee [3 items]  Lipitor  $80   │  ← group item 1
│▌(blue)   Apr 11  Dr. Jones  Bob Lee   Amlodipi  $45   │  ← group item 2
│▌(blue)   Apr 11  Dr. Jones  Bob Lee   Losartan  $35   │  ← group item 3
├─────────────────────────────────────────────────────────┤
│ (white)  Apr 12  Dr. Smith  Amy Wu    Omeprazol $25   │  ← solo item
└─────────────────────────────────────────────────────────┘
```

- Group items: same background color + left colored stripe
- First item in group: shows `"3 items"` badge next to patient name
- Badge: rounded-full, white text, background = group border color

---

## 6. TABLE COLUMNS

```
| Date | Provider | Patient | Medication | Qty/Refills | Price | Pharmacy | SIG | Status |
```

### Date Column:
```typescript
formatDateTime(prescription.submittedAt)
// Format: "Apr 10, 2025, 3:45 PM"
```

### Provider Column:
```typescript
prescription.providerName  // "Dr. FirstName LastName"
```

### Patient Column:
```typescript
<div className="flex items-center gap-1.5">
  {prescription.patientName}
  {/* Group badge — ONLY on first row of a multi-item batch */}
  {isFirstInBatch && isMultiBatch && (
    <span
      className="ml-1 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
      style={{ backgroundColor: groupBorders[colorIdx] }}
    >
      {batchSize} items
    </span>
  )}
</div>
```

### Medication Column:
```typescript
<div className="flex flex-col">
  <span className="font-medium truncate" title={prescription.medication}>
    {prescription.medication}
  </span>
  <span className="text-sm text-muted-foreground truncate">
    {prescription.strength}    {/* This is the dosage/strength */}
  </span>
</div>
```

### Qty/Refills Column:
```typescript
<div className="flex flex-col">
  <span>Qty: {prescription.quantity}</span>
  <span className="text-muted-foreground">Ref: {prescription.refills}</span>
</div>
```

### Price Column:
```typescript
{prescription.patientPrice != null ? (
  <div className="flex flex-col">
    <span className="font-semibold text-green-700">
      ${prescription.patientPrice.toFixed(2)}
    </span>
    {/* Show shipping sub-text only if this item carries a shipping fee */}
    {(prescription.shippingFeeCents ?? 0) > 0 && (
      <span className="text-[10px] text-muted-foreground">
        +${((prescription.shippingFeeCents ?? 0) / 100).toFixed(2)} ship
      </span>
    )}
  </div>
) : (
  <span className="text-muted-foreground text-xs">--</span>
)}
```

**Important:** Only the FIRST item in a group shows shipping because `shipping_fee_cents` is only stored on the first item (the rest have 0).

### Pharmacy Column:
```typescript
<span className="font-medium text-sm" style={{ color: prescription.pharmacyColor || "#1E3A8A" }}>
  {prescription.pharmacyName}
</span>
```

### SIG Column:
```typescript
<p className="text-sm truncate cursor-help" title={prescription.sig}>
  {prescription.sig}
</p>
```

### Status Column:
```typescript
<Badge
  variant="outline"
  className={`${getStatusColor(getEffectiveStatus(prescription))} text-xs px-2 py-1 whitespace-nowrap`}
>
  {/* Capitalize and replace underscores: "pending_payment" → "Pending payment" */}
  {getEffectiveStatus(prescription).charAt(0).toUpperCase() +
   getEffectiveStatus(prescription).slice(1).replace(/_/g, " ")}
</Badge>
```

---

## 7. DETAIL MODAL

Opens when any row is clicked:

```typescript
<Dialog open={!!selectedPrescription} onOpenChange={(open) => {
  if (!open) { setSelectedPrescription(null); setSubmitResult(null); }
}}>
  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
```

### Modal Header:
```
┌──────────────────────────────────────────────────────┐
│  Prescription Details                [Status Badge]  │
└──────────────────────────────────────────────────────┘
```

### Info Grid (2×2):
```
┌─────────────────────┬─────────────────────┐
│ # Queue ID          │ 📅 Submitted        │
│ N/A                 │ Apr 10, 2025 3:45 PM│
├─────────────────────┼─────────────────────┤
│ 👤 Provider          │ 👤 Patient           │
│ Dr. John Smith      │ Jane Doe            │
└─────────────────────┴─────────────────────┘
```

### Progress Tracker:
```typescript
<PrescriptionProgressTracker
  status={getEffectiveStatus(selectedPrescription)}
  trackingNumber={selectedPrescription.trackingNumber}
  pharmacyName={selectedPrescription.pharmacyName}
  billingStatus={selectedPrescription.billingStatus}
  patientCopay={selectedPrescription.patientCopay}
  carrierStatus={selectedPrescription.carrierStatus}
  trackingCarrier={selectedPrescription.trackingCarrier}
  estimatedDelivery={selectedPrescription.estimatedDelivery}
/>
```

### Medication Details:
```
┌──────────────────────────────────────────────────────┐
│ 💊 Medication Details                                │
│                                                      │
│  Medication: Semaglutide    Strength: 2.5mg         │
│  Quantity: 4                Refills: 2              │
│  SIG Instructions: Inject 0.25mg weekly...          │
└──────────────────────────────────────────────────────┘
```

---

## 8. GROUP PRICING DISPLAY

This is the most important section for group orders.

### How group members are determined:
```typescript
const groupMembers = selectedPrescription.submissionGroupId
  ? prescriptions.filter(p => p.submissionGroupId === selectedPrescription.submissionGroupId)
  : [selectedPrescription];
const isGrouped = groupMembers.length > 1;
```

### Totals calculation:
```typescript
const groupTotalMed = groupMembers.reduce((sum, p) => sum + (p.patientPrice ?? 0), 0);
const groupTotalShipping = groupMembers.reduce((sum, p) => sum + (p.shippingFeeCents ?? 0), 0);
const groupTotalOversight = groupMembers.reduce((sum, p) => sum + (p.profitCents ?? 0), 0);
const groupTotal = groupTotalMed + groupTotalShipping / 100 + groupTotalOversight / 100;
```

### IF GROUPED — shows itemized list:
```
┌──────────────────────────────────────────────────────┐
│ 💲 Pricing                     [3 items in group]    │
│                                                      │
│ ┌─ (highlighted if this is the selected item) ─────┐ │
│ │  Semaglutide                           $150.00   │ │
│ │                              +$15.00 ship        │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │  Tirzepatide                           $200.00   │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │  B12 Injection                          $35.00   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ──────────────────────────────────────────────────── │
│  Shipping & Handling                      $15.00    │
│  Oversight & Monitoring                   $25.00    │
│ ──────────────────────────────────────────────────── │
│  Group Total                             $425.00    │
└──────────────────────────────────────────────────────┘
```

**Key visual detail:** The currently-selected medication is highlighted with `bg-green-100 font-semibold`. Others show `bg-white`.

### IF NOT GROUPED — shows single item:
```
┌──────────────────────────────────────────────────────┐
│ 💲 Pricing                                           │
│                                                      │
│  Medication Cost          Shipping                   │
│  $150.00                  $15.00                     │
│                                                      │
│  Oversight & Monitoring   Total                      │
│  $25.00                   $190.00                    │
└──────────────────────────────────────────────────────┘
```

---

## 9. SEND PAYMENT LINK — COMPLETE FLOW FOR GROUPS

### What happens when admin clicks "Send Payment Link":

#### Step 1: Pre-validation (admin page)

```typescript
const handleSendPaymentLink = async (rx: AdminPrescription) => {
  // Debounce: prevent double-clicks
  if (sendingRef.current) return;

  // Must have email
  if (!rx.patientEmail) {
    setPaymentLinkResult({ success: false, message: "No patient email on file" });
    return;
  }

  // Must have price
  if (rx.patientPrice == null) {
    setPaymentLinkResult({ success: false, message: "No price set for this prescription" });
    return;
  }
```

#### Step 2: Gather ALL group members (admin page)

```typescript
  // Find all unpaid items in this group
  const allGroupMembers = rx.submissionGroupId
    ? prescriptions.filter(
        (p) => p.submissionGroupId === rx.submissionGroupId && p.paymentStatus !== "paid"
      )
    : [rx];

  // ALL items must have a price
  const missingPrice = allGroupMembers.filter((p) => p.patientPrice == null);
  if (missingPrice.length > 0) {
    setPaymentLinkResult({
      success: false,
      message: `${missingPrice.length} item(s) in this group have no price set: ${missingPrice.map((p) => p.medication).join(", ")}`,
    });
    return;
  }
```

#### Step 3: Calculate totals from ALL group members (admin page)

```typescript
  const prescriptionIds = allGroupMembers.map((p) => p.id);
  let totalMedicationCostCents = 0;
  let totalShippingFeeCents = 0;
  let totalOversightFeeCents = 0;
  const medNames: string[] = [];

  for (const grx of allGroupMembers) {
    totalMedicationCostCents += Math.round((grx.patientPrice ?? 0) * 100);
    totalShippingFeeCents += grx.shippingFeeCents ?? 0;
    totalOversightFeeCents += grx.profitCents ?? 0;
    medNames.push(grx.medication);
  }

  const description = allGroupMembers.length > 1
    ? `Payment for ${allGroupMembers.length} medications: ${medNames.join(", ")}`
    : `Payment for ${rx.medication} prescription`;
```

#### Step 4: Call generate-link API with ALL IDs (admin page → API)

```typescript
  const response = await fetch("/api/payments/generate-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      prescriptionIds,                                // Array of ALL group member IDs
      consultationFeeCents: totalOversightFeeCents,   // Total oversight from all items
      medicationCostCents: totalMedicationCostCents,  // Total med cost from all items
      shippingFeeCents: totalShippingFeeCents,        // Total shipping from all items
      description,                                     // "Payment for 3 medications: ..."
      patientEmail: rx.patientEmail,
      sendEmail: true,
    }),
  });
```

#### Step 5: generate-link API validates (server)

1. Normalizes `prescriptionIds` array
2. Fetches primary prescription (first ID) with patient/pharmacy join
3. Rejects if already paid
4. If multiple IDs: verifies all same patient, same prescriber, none paid
5. Checks for existing valid payment link (3-tier idempotency):
   - By `prescription_id` on `payment_transactions`
   - By `payment_transaction_id` on prescriptions
   - By `order_group_id` via group members
6. If existing link found and NOT expired → resend email, return existing
7. If existing link found and IS expired → delete it, create fresh

#### Step 6: Optimistic lock (server)

```typescript
// Claim all prescriptions with status = "link_generating"
for (const rxId of prescriptionIds) {
  const { data: claimed } = await supabase
    .from("prescriptions")
    .update({ payment_status: "link_generating" })
    .eq("id", rxId)
    .eq("payment_status", "pending")    // Only if still pending
    .select("id");
}
// If not all claimed → revert all, return 409
```

#### Step 7: Server-authoritative pricing (server)

```typescript
// Recalculate from DB — IGNORE client values if server has data
const { data: dbRxPrices } = await supabase
  .from("prescriptions")
  .select("patient_price, shipping_fee_cents, profit_cents")
  .in("id", prescriptionIds);

for (const rx of dbRxPrices) {
  serverTotalMedCents += Math.round(parseFloat(rx.patient_price) * 100);
  serverTotalShipCents += rx.shipping_fee_cents || 0;
  serverTotalOversightCents += rx.profit_cents || 0;
}

totalAmountCents = serverTotalMedCents + serverTotalShipCents + serverTotalOversightCents;

// Warn if client total differs from server total
if (Math.abs(serverTotalCents - clientTotalCents) > 1) {
  console.warn(`Amount mismatch: client=${clientTotalCents} server=${serverTotalCents}`);
}
```

#### Step 8: Create ONE payment transaction (server)

```typescript
const paymentToken = crypto.randomBytes(32).toString("hex");    // 64-char hex
const authnetRefId = `PAY${...}`.substring(0, 20);              // 20-char max for Auth.Net

// Build medications array for email
let medicationsArray = allMeds.map(m => ({
  name: m.medication || "Medication",
  price: Number(m.patient_price).toFixed(2),
  shippingFee: m.shipping_fee_cents > 0 ? (m.shipping_fee_cents / 100).toFixed(2) : undefined,
}));

const { data: paymentTransaction } = await supabase
  .from("payment_transactions")
  .insert({
    prescription_id: primaryPrescriptionId,              // First Rx in group
    total_amount_cents: totalAmountCents,                 // Everything summed
    consultation_fee_cents: serverTotalOversightCents,    // All oversight
    medication_cost_cents: serverTotalMedCents,           // All med costs
    shipping_fee_cents: serverTotalShipCents,             // All shipping
    patient_id, patient_email, patient_phone, patient_name,
    provider_id, provider_name,
    pharmacy_id, pharmacy_name,
    payment_token: paymentToken,
    authnet_ref_id: authnetRefId,
    payment_status: "pending",
    order_progress: "payment_pending",
    description: `Payment for Med A, Med B, Med C - Jane Doe`,
    payment_link_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // 7 days
  })
  .select().single();
```

#### Step 9: Generate URL and link ALL prescriptions (server)

```typescript
const fullPaymentUrl = `${siteUrl}/payment/${paymentToken}`;

// Store URL on transaction
await supabase
  .from("payment_transactions")
  .update({ payment_link_url: fullPaymentUrl })
  .eq("id", paymentTransaction.id);

// Link EVERY prescription to this ONE transaction
for (const rxId of prescriptionIds) {
  await supabase
    .from("prescriptions")
    .update({
      payment_status: "pending",
      payment_transaction_id: paymentTransaction.id,
    })
    .eq("id", rxId);
}
```

#### Step 10: Send email (server)

```typescript
await fetch(`${siteUrl}/api/payments/send-payment-email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-internal-api-key": INTERNAL_API_KEY },
  body: JSON.stringify({
    patientEmail,
    patientPhone,
    patientName: "Jane Doe",
    providerName: "Dr. John Smith",
    medication: "Semaglutide, Tirzepatide, B12 Injection",    // comma-separated
    medications: [                                              // per-item breakdown
      { name: "Semaglutide", price: "150.00", shippingFee: "15.00" },
      { name: "Tirzepatide", price: "200.00" },
      { name: "B12 Injection", price: "35.00" },
    ],
    oversightFee: "25.00",                                     // total oversight (if > 0)
    totalAmount: "425.00",                                     // grand total
    paymentUrl: "https://aimrx.com/payment/abc123...",
    paymentToken: "abc123...",
  }),
});
```

#### Step 11: Return result to admin page

```typescript
return NextResponse.json({
  success: true,
  paymentUrl: fullPaymentUrl,
  paymentToken,
  transactionId: paymentTransaction.id,
  expiresAt: paymentTransaction.payment_link_expires_at,
  emailSent: true,
});
```

#### Step 12: Admin page shows result

```typescript
if (response.ok && data.success) {
  setPaymentLinkResult({
    success: true,
    message: data.existing
      ? `Existing payment link resent to ${rx.patientEmail}`
      : itemCount > 1
        ? `Payment link for ${itemCount} items created and sent to ${rx.patientEmail}`
        : `Payment link created and sent to ${rx.patientEmail}`,
  });
  loadPrescriptions();  // Refresh the table
}
```

### UI for the button:

```typescript
<Button onClick={() => handleSendPaymentLink(selectedPrescription)} ...>
  {payIsGrouped
    ? `Send Payment Link (${payGroupMembers.length} items)`
    : "Send Payment Link to Patient"}
</Button>
```

If grouped, badge above says:
```typescript
<Badge>Applies to all {payGroupMembers.length} items</Badge>
```

---

## 10. MARK AS PAID — COMPLETE FLOW FOR GROUPS

**File: `app/api/prescriptions/[id]/mark-paid/route.ts`** (386 lines)

### What happens when admin clicks "Mark as Paid":

#### Step 1: Admin page calls API

```typescript
const handleMarkAsPaid = async (prescriptionId: string) => {
  const response = await fetch(`/api/prescriptions/${prescriptionId}/mark-paid`, {
    method: "POST",
    credentials: "include",
  });
};
```

**Note:** Only the selected prescription's ID is sent. The server finds all group members.

#### Step 2: API validates

```typescript
// Fetch the prescription with group info
const { data: prescription } = await supabaseAdmin
  .from("prescriptions")
  .select("id, prescriber_id, status, payment_status, payment_transaction_id, patient_id, patient_price, profit_cents, shipping_fee_cents, total_paid_cents, medication, dosage, order_group_id")
  .eq("id", prescriptionId)
  .single();

// Must be admin or the prescriber
// Must be in "pending_payment" or "pending" status
// If already paid → return success (idempotent)
```

#### Step 3: Calculate group total from ALL members

```typescript
let groupMembersForTotal = [];

if (prescription.order_group_id) {
  // Fetch ALL items in the group
  const { data: groupMembers } = await supabaseAdmin
    .from("prescriptions")
    .select("patient_price, shipping_fee_cents, profit_cents")
    .eq("order_group_id", prescription.order_group_id);

  if (groupMembers && groupMembers.length > 0) {
    groupMembersForTotal = groupMembers;
  }
}

// Sum all values
let totalMedicationCostCents = 0;
let totalShippingFeeCents = 0;
let totalOversightFeeCents = 0;

if (groupMembersForTotal.length > 0) {
  for (const m of groupMembersForTotal) {
    totalMedicationCostCents += Math.round(parseFloat(m.patient_price) * 100);
    totalShippingFeeCents += m.shipping_fee_cents || 0;
    totalOversightFeeCents += m.profit_cents || 0;
  }
} else {
  // Single item
  totalMedicationCostCents = Math.round(parseFloat(prescription.patient_price) * 100);
  totalShippingFeeCents = prescription.shipping_fee_cents || 0;
  totalOversightFeeCents = prescription.profit_cents || 0;
}

const computedTotalCents = totalMedicationCostCents + totalShippingFeeCents + totalOversightFeeCents;
```

#### Step 4: Create or update payment transaction

```typescript
if (paymentTransactionId) {
  // UPDATE existing transaction
  await supabaseAdmin
    .from("payment_transactions")
    .update({
      payment_status: "completed",
      order_progress: "payment_received",
      paid_at: now,
      card_type: "manual-payment",
      total_amount_cents: totalAmountCents,
      medication_cost_cents: totalMedicationCostCents,
      consultation_fee_cents: totalOversightFeeCents,
      shipping_fee_cents: totalShippingFeeCents,
    })
    .eq("id", paymentTransactionId);
} else {
  // CREATE new transaction
  const { data: newTransaction } = await supabaseAdmin
    .from("payment_transactions")
    .insert({
      prescription_id: prescriptionId,
      payment_status: "completed",
      order_progress: "payment_received",
      paid_at: now,
      card_type: "manual-payment",
      total_amount_cents: totalAmountCents,
      medication_cost_cents: totalMedicationCostCents,
      consultation_fee_cents: totalOversightFeeCents,
      shipping_fee_cents: totalShippingFeeCents,
      payment_token: `manual-${crypto.randomUUID()}`,
      patient_id: prescription.patient_id,
    })
    .select("id").single();

  paymentTransactionId = newTransaction.id;
}
```

#### Step 5: Find ALL related prescriptions to update

```typescript
const allRxIdsToUpdate: string[] = [prescriptionId];

// Add items linked by same payment_transaction_id
const { data: linkedRxs } = await supabaseAdmin
  .from("prescriptions")
  .select("id")
  .eq("payment_transaction_id", paymentTransactionId)
  .neq("id", prescriptionId);
if (linkedRxs) {
  for (const rx of linkedRxs) allRxIdsToUpdate.push(rx.id);
}

// Add items linked by same order_group_id
if (prescription.order_group_id) {
  const { data: groupRxs } = await supabaseAdmin
    .from("prescriptions")
    .select("id")
    .eq("order_group_id", prescription.order_group_id)
    .neq("id", prescriptionId);
  if (groupRxs) {
    for (const rx of groupRxs) {
      if (!allRxIdsToUpdate.includes(rx.id)) {
        allRxIdsToUpdate.push(rx.id);
      }
    }
  }
}
```

#### Step 6: Update ALL prescriptions to "paid"

```typescript
for (const rxId of allRxIdsToUpdate) {
  await supabaseAdmin
    .from("prescriptions")
    .update({
      payment_status: "paid",
      status: "payment_received",
      payment_transaction_id: paymentTransactionId,
    })
    .eq("id", rxId);
}
```

#### Step 7: Send confirmation email (async, non-blocking)

```typescript
(async () => {
  // Fetch patient data
  const { data: patientData } = await supabaseAdmin
    .from("patients")
    .select("first_name, last_name, email, phone")
    .eq("id", prescription.patient_id).single();

  // Build medications list
  const allMedications = [];
  if (allRxIdsToUpdate.length > 1) {
    const { data: groupRxDetails } = await supabaseAdmin
      .from("prescriptions")
      .select("medication, patient_price, shipping_fee_cents, profit_cents")
      .in("id", allRxIdsToUpdate);

    for (const grx of groupRxDetails) {
      allMedications.push({
        name: grx.medication || "Medication",
        price: parseFloat(grx.patient_price).toFixed(2),
        shippingFee: grx.shipping_fee_cents > 0 ? (grx.shipping_fee_cents / 100).toFixed(2) : undefined,
      });
    }
  }

  // Send confirmation email
  await fetch(`${siteUrl}/api/payments/send-confirmation-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": internalApiKey },
    body: JSON.stringify({
      patientEmail: patientData.email,
      patientName,
      medication: allMedications.map(m => m.name).join(", "),
      medications: allMedications,                              // Per-item breakdown
      oversightFee: emailOversightCents > 0 ? (emailOversightCents / 100).toFixed(2) : undefined,
      providerName,
      totalAmount: (emailTotalCents / 100).toFixed(2),
      paymentMethod: "Manual Payment",
      transactionId: `MANUAL-${prescriptionId.slice(0, 8).toUpperCase()}`,
    }),
  });
})();
```

#### Step 8: Submit ALL to pharmacy

```typescript
for (const rxId of allRxIdsToUpdate) {
  const submitResponse = await fetch(
    `${siteUrl}/api/prescriptions/${rxId}/submit-to-pharmacy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,    // Server-to-server auth
      },
    }
  );
  // Track successes and failures
}
```

#### Step 9: Return result

```typescript
// If ALL pharmacy submissions failed:
{ success: true, warning: "Marked as paid but failed to submit to pharmacy. Please submit manually." }

// If all or some succeeded:
{
  success: true,
  message: `${allRxIdsToUpdate.length} prescription(s) marked as paid and submitted to pharmacy`,
  queue_ids: submittedQueueIds,
}
```

### Admin page handles the response:

```typescript
if (response.ok && data.success) {
  if (data.warning) {
    toast.warning(data.warning, { duration: 8000 });
  } else {
    toast.success("Prescription marked as paid and sent to pharmacy!");
  }
  loadPrescriptions();
  setSelectedPrescription(null);
}
```

### UI for mark-as-paid button:

```typescript
<Button onClick={() => handleMarkAsPaid(selectedPrescription.id)} ...>
  {payIsGrouped
    ? `Mark All ${payGroupMembers.length} Items as Paid`
    : "Mark as Paid"}
</Button>
```

---

## 11. SUBMIT TO PHARMACY

**File: `app/api/prescriptions/[id]/submit-to-pharmacy/route.ts`** (552 lines)

Called for EACH prescription individually (loop from mark-paid or after webhook payment).

### Key Flow:
1. Auth: internal secret header OR authenticated provider/admin
2. Fetch prescription + patient + provider + pharmacy medication from DB
3. Status check: if already submitted (has queue_id) → return existing
4. Optimistic lock: set status to `"submitting_to_pharmacy"` (prevents double-submit)
5. Fetch pharmacy backend config (API key, URL, store ID)
6. Decrypt API key if encrypted
7. Resolve shipping address (custom_address if overridden, else patient physical_address)
8. Build DigitalRx payload:
   - StoreID, VendorName
   - Patient: name, DOB, sex, address, phone, email
   - Doctor: name, NPI, DEA, address, phone
   - RxClaim: DrugName (prefixed with "AIM-"), Qty, DateWritten, Refills, NDC, Instructions, Notes, DAW
   - DocSignature: provider signature URL
   - PDFFile: base64 PDF from storage
9. Validate critical fields (StoreID, patient name, drug name)
10. POST to DigitalRx API: `{baseUrl}/RxWebRequest`
11. Extract QueueID from response
12. Update prescription: `queue_id`, `status: "submitted"`, `submitted_to_pharmacy_at`
13. Calculate `next_refill_date` if applicable
14. Log to system_logs

### On failure → revert status to `"payment_received"` so admin can retry.

---

## 12. CONFIRMATION EMAIL

The email sent to the patient includes ALL medications when it's a group order:

```typescript
{
  patientEmail: "patient@email.com",
  patientName: "Jane Doe",
  medication: "Semaglutide, Tirzepatide, B12 Injection",    // ALL medication names
  medications: [                                              // Per-item breakdown
    { name: "Semaglutide", price: "150.00", shippingFee: "15.00" },
    { name: "Tirzepatide", price: "200.00" },
    { name: "B12 Injection", price: "35.00" },
  ],
  oversightFee: "25.00",                                     // Total oversight
  providerName: "Dr. John Smith",
  totalAmount: "425.00",                                     // Grand total
  paymentMethod: "Manual Payment",                           // or card type
  transactionId: "MANUAL-ABC12345",
}
```

---

## 13. OTHER ACTIONS IN MODAL

### Submit to Pharmacy (manual):
Shows when `queueId` is "N/A" (not yet sent to pharmacy):
```typescript
<Button onClick={() => handleSubmitToPharmacy(selectedPrescription.id)}>
  Submit to Pharmacy
</Button>
```
Calls `POST /api/prescriptions/{id}/submit-to-pharmacy`.

### Manual Status/Tracking Override:
Opens override form with:
- Status dropdown: Submitted, Packed, Approved, Shipped/Picked Up, Delivered, Ready for Pickup, Cancelled
- Tracking number input
- Note input
- Calls `PATCH /api/prescriptions/{id}/admin-override`

### Shipping Address Edit:
- Shows current address (custom or patient's)
- Edit form with street, city, state, zip, country
- Two save options: "Save to Patient Record & Prescription" or "This Prescription Only"
- After save: if pharmacy is notified, shows green banner with recipient emails
- Calls `PATCH /api/prescriptions/{id}/update-address`

---

## 14. AUTO-REFRESH & TRACKING SYNC

### Auto-refresh every 15 seconds:
```typescript
useEffect(() => {
  loadPrescriptions();
  const interval = setInterval(loadPrescriptions, 15000);
  return () => clearInterval(interval);
}, [loadPrescriptions]);
```

### Tracking sync on modal open:
When a prescription with a tracking number is selected, triggers a sync:
```typescript
useEffect(() => {
  if (!selectedPrescription?.trackingNumber) return;
  if (selectedPrescription.status === "delivered") return;

  fetch("/api/prescriptions/sync-tracking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prescriptionId: selectedPrescription.id }),
  })
    .then(r => r.json())
    .then(data => { if (data.synced) loadPrescriptions(); });
}, [selectedPrescription?.id, selectedPrescription?.trackingNumber]);
```

### State reset on modal change:
When a different prescription is selected, all action states reset:
```typescript
useEffect(() => {
  setSubmitResult(null);
  setIsSubmittingToPharmacy(false);
  setPaymentLinkResult(null);
  setIsSendingPaymentLink(false);
  setIsMarkingPaid(false);
  setShowOverrideForm(false);
  setOverrideStatus("");
  setOverrideTracking("");
  setOverrideNote("");
  setOverrideResult(null);
  setShowAddressEdit(false);
  setSavingAddress(false);
  setAddressNotification(null);
}, [selectedPrescription?.id]);
```

### After data refresh, keep modal in sync:
```typescript
const loadPrescriptions = useCallback(async () => {
  const freshList = data.prescriptions || [];
  setPrescriptions(freshList);

  // Keep modal showing updated data
  setSelectedPrescription((prev) => {
    if (!prev) return null;
    const updated = freshList.find((p) => p.id === prev.id);
    return updated || null;
  });
}, []);
```

---

## 15. COMPLETE CODE FILES

All complete code is in the files listed in section 1. This document covers every function, every condition, every UI element in those files as they relate to group orders.

### Summary of what happens for a 3-item group order:

1. **Provider creates 3 medications in cart** → stored in sessionStorage
2. **Provider submits** → 3 sequential API calls, all sharing one `submissionGroupId` (UUID)
3. **DB has 3 rows** with same `order_group_id`, shipping/oversight only on first row
4. **Admin sees 3 rows** with same blue background + blue left stripe, first row shows "3 items" badge
5. **Admin clicks any row** → modal shows all 3 medications in pricing section with itemized costs
6. **Admin clicks "Send Payment Link (3 items)"** → collects all 3 IDs, sums all costs, calls generate-link
7. **generate-link creates ONE payment_transaction** covering $385 med + $15 ship + $25 oversight = $425 total
8. **ONE email sent** listing all 3 medications with prices
9. **Patient gets ONE link, pays ONE time for $425**
10. **Payment webhook fires** → marks all 3 as paid → submits all 3 to pharmacy individually
11. **OR admin clicks "Mark All 3 Items as Paid"** → same result: all 3 marked paid, all 3 sent to pharmacy, confirmation email with all 3 listed
