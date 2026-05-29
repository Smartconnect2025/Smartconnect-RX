# GROUP ORDERS — COMPLETE SYSTEM DOCUMENTATION

## Everything in one place: how it works, how it displays, all the code, all the logic.

---

## TABLE OF CONTENTS

1. [How Group Orders Work — Overview](#overview)
2. [Database Schema](#database)
3. [File 1: prescriptionSessionUtils.ts — Cart Utilities](#file-1)
4. [File 2: step3/page.tsx — Review & Submit (Provider Side)](#file-2)
5. [File 3: admin/prescriptions/route.ts — Admin API](#file-3)
6. [File 4: admin/prescriptions/page.tsx — Admin Panel UI](#file-4)
7. [File 5: generate-link/route.ts — Payment Link Generation](#file-5)
8. [File 6: mark-paid/route.ts — Mark as Paid + Submit to Pharmacy](#file-6)
9. [File 7: submit-to-pharmacy/route.ts — DigitalRx Pharmacy Submission](#file-7)
10. [Admin Table — Group Color-Coding Algorithm](#color-coding)
11. [Admin Modal — Group Pricing Display](#modal-pricing)
12. [Send Payment Link — Complete Flow for Groups](#send-payment-link)
13. [Mark as Paid — Complete Flow for Groups](#mark-as-paid-flow)
14. [Confirmation Email — What Patient Receives](#email)
15. [Critical Rules Summary](#rules)

---

<a name="overview"></a>
## 1. HOW GROUP ORDERS WORK — OVERVIEW

### End-to-end flow:

```
Provider adds 3 medications to cart
  ↓
Provider clicks "Create 3 Prescriptions" on step3
  ↓
One submissionGroupId (UUID) generated, shared by all 3
  ↓
3 sequential API calls to /api/prescriptions/submit
  → Item 1: profit_cents = total oversight, shipping_fee_cents = shipping total
  → Item 2: profit_cents = 0, shipping_fee_cents = 0
  → Item 3: profit_cents = 0, shipping_fee_cents = 0
  ↓
3 rows in DB, all with same order_group_id
  ↓
Admin sees 3 rows color-coded together, first row shows "3 items" badge
  ↓
Admin clicks any row → modal shows ALL 3 medications with itemized pricing
  ↓
Admin clicks "Send Payment Link (3 items)"
  → Collects all 3 IDs, sums all costs
  → Creates ONE payment_transaction for the total
  → Generates ONE payment URL
  → Sends ONE email listing all 3 medications
  ↓
Patient pays ONE time
  ↓
Payment webhook OR "Mark All 3 Items as Paid"
  → Marks ALL 3 as paid
  → Submits ALL 3 to pharmacy individually (loop)
  → Sends confirmation email listing ALL 3 medications
```

### Fee allocation rule:
- **Shipping fee** (`shipping_fee_cents`) → ONLY on the FIRST cart item
- **Oversight/monitoring fee** (`profit_cents`) → ONLY on the FIRST cart item
- **All other items** → `profit_cents = 0`, `shipping_fee_cents = 0`
- The code that does this: `const isFirstItem = i === 0;`

### Session storage keys:
- `prescriptionCart` → JSON array of CartItem objects
- `cartShippingFee` → string dollar amount (e.g. "15.00")
- `cartOversightFees` → JSON array of `{ fee: string, reason: string }`

---

<a name="database"></a>
## 2. DATABASE SCHEMA

### prescriptions table — columns for group orders:

```sql
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS order_group_id UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS profit_cents INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS consultation_reason TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS shipping_fee_cents INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS total_paid_cents INTEGER DEFAULT 0;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_price NUMERIC;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS payment_transaction_id UUID REFERENCES payment_transactions(id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS has_custom_address BOOLEAN DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS custom_address JSONB;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS refill_frequency_days INTEGER;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS next_refill_date DATE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'ship';
```

### payment_transactions table:

```sql
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id),
  total_amount_cents INTEGER NOT NULL,
  consultation_fee_cents INTEGER DEFAULT 0,
  medication_cost_cents INTEGER DEFAULT 0,
  shipping_fee_cents INTEGER DEFAULT 0,
  patient_id UUID,
  patient_email TEXT,
  patient_phone TEXT,
  patient_name TEXT,
  provider_id UUID,
  provider_name TEXT,
  pharmacy_id UUID,
  pharmacy_name TEXT,
  payment_token TEXT UNIQUE NOT NULL,
  authnet_ref_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  order_progress TEXT DEFAULT 'payment_pending',
  description TEXT,
  payment_link_url TEXT,
  payment_link_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  card_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

<a name="file-1"></a>
## 3. FILE 1: `prescriptionSessionUtils.ts`

**Path:** `app/(features)/prescriptions/new/prescriptionSessionUtils.ts`

```typescript
const PRESCRIPTION_SESSION_KEYS = [
  "prescriptionFormData",
  "selectedPatientId",
  "encounterId",
  "appointmentId",
  "prescriptionPdfData",
  "prescriptionPdfName",
  "prescriptionCart",
  "cartShippingFee",
  "cartOversightFees",
] as const;

const LEGACY_KEYS = ["prescriptionData", "prescriptionDraft"] as const;

export interface CartItem {
  id: string;
  medication: string;
  strength: string;
  dosageAmount?: string;
  dosageUnit?: string;
  vialSize?: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes: string;
  patientPrice: string;
  selectedPharmacyId: string;
  selectedPharmacyName: string;
  selectedPharmacyColor: string;
  selectedMedicationId: string;
  refillFrequencyDays?: string;
}

export function getCart(): CartItem[] {
  try {
    const data = sessionStorage.getItem("prescriptionCart");
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  cart.push(item);
  sessionStorage.setItem("prescriptionCart", JSON.stringify(cart));
  return cart;
}

export function removeFromCart(itemId: string): CartItem[] {
  const cart = getCart().filter((item) => item.id !== itemId);
  sessionStorage.setItem("prescriptionCart", JSON.stringify(cart));
  return cart;
}

export function clearCart(): void {
  sessionStorage.removeItem("prescriptionCart");
  sessionStorage.removeItem("cartShippingFee");
  sessionStorage.removeItem("cartOversightFees");
}

export function getCartShippingFee(): string {
  return sessionStorage.getItem("cartShippingFee") || "0";
}

export function setCartShippingFee(fee: string): void {
  sessionStorage.setItem("cartShippingFee", fee);
}

export function getCartOversightFees(): Array<{ fee: string; reason: string }> {
  try {
    const data = sessionStorage.getItem("cartOversightFees");
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCartOversightFees(
  fees: Array<{ fee: string; reason: string }>,
): void {
  sessionStorage.setItem("cartOversightFees", JSON.stringify(fees));
}

export function clearPrescriptionSession(options?: {
  preserveEncounterContext?: boolean;
  preserveCatalogSelection?: boolean;
}) {
  for (const key of PRESCRIPTION_SESSION_KEYS) {
    if (
      options?.preserveEncounterContext &&
      (key === "encounterId" || key === "appointmentId")
    ) {
      continue;
    }
    if (
      options?.preserveCatalogSelection &&
      key === "prescriptionFormData"
    ) {
      continue;
    }
    sessionStorage.removeItem(key);
  }
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
  }
}
```

---

<a name="file-2"></a>
## 4. FILE 2: `step3/page.tsx` — The Submit Handler

**Path:** `app/(features)/prescriptions/new/step3/page.tsx` (845 lines)

### THE CRITICAL SUBMIT HANDLER (the part that creates the group):

```typescript
const handleSubmit = async () => {
  // ... validation ...

  const prescriptionIds: string[] = [];
  const submissionGroupId = crypto.randomUUID();   // ← ONE UUID for ALL items

  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    const isFirstItem = i === 0;                   // ← ONLY first item gets fees

    const submissionPayload = {
      prescriber_id: user.id,
      patient_id: patientId,
      medication: item.medication,
      dosage: item.strength,
      quantity: parseInt(item.quantity) || 1,
      refills: parseInt(item.refills),
      sig: item.sig,
      patient_price: item.patientPrice
        ? (parseFloat(item.patientPrice) * (parseInt(item.quantity) || 1)).toFixed(2)
        : null,
      pharmacy_id: item.selectedPharmacyId || null,
      medication_id: item.selectedMedicationId || null,
      profit_cents: isFirstItem ? totalOversightFeesCents : 0,        // ← FIRST ONLY
      consultation_reason: isFirstItem ? consultationReason : null,    // ← FIRST ONLY
      shipping_fee_cents: isFirstItem ? Math.round(shippingTotal * 100) : 0, // ← FIRST ONLY
      submission_group_id: submissionGroupId,                          // ← SAME FOR ALL
      delivery_method: deliveryMethod,
      has_custom_address: deliveryMethod === "ship" ? useCustomAddress : false,
      custom_address: deliveryMethod === "ship" && useCustomAddress ? customAddress : null,
      // ... patient and prescriber data ...
    };

    const response = await fetch("/api/prescriptions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissionPayload),
    });

    const result = await response.json();
    prescriptionIds.push(result.prescription_id);

    // PDF generation and upload happens here for each item...
  }

  // After all submitted, redirect to step4
  router.push(`/prescriptions/new/step4?prescriptionIds=${prescriptionIds.join(",")}`);
};
```

### The submit API (`/api/prescriptions/submit`) maps `submission_group_id` → `order_group_id` in the database:

```typescript
// In the submit route, the insert looks like:
const { data: newRx } = await supabase.from("prescriptions").insert({
  // ... all fields ...
  order_group_id: body.submission_group_id,  // ← stored as order_group_id
  profit_cents: body.profit_cents,
  shipping_fee_cents: body.shipping_fee_cents,
  // ...
});
```

---

<a name="file-3"></a>
## 5. FILE 3: `admin/prescriptions/route.ts`

**Path:** `app/api/admin/prescriptions/route.ts` (189 lines)

```typescript
import { NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

export async function GET() {
  try {
    const { user } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    const userRole = roleRow?.role || null;

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Check if admin is pharmacy-scoped
    let pharmacyId: string | null = null;
    const { data: adminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminLink?.pharmacy_id) {
      pharmacyId = adminLink.pharmacy_id;
    }

    // Main prescriptions query
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

    const { data: prescriptionsData, error: prescriptionsError } = await query;

    // Separate query to get order_group_id for grouping
    let groupIdLookup: Record<string, string> = {};
    try {
      const { data: groupRows } = await supabase
        .from("prescriptions")
        .select("id, order_group_id")
        .not("order_group_id", "is", null);
      if (groupRows) {
        for (const row of groupRows as { id: string; order_group_id: string }[]) {
          groupIdLookup[row.id] = row.order_group_id;
        }
      }
    } catch (e) {
      console.error("order_group_id lookup error:", e);
    }

    if (prescriptionsError) {
      console.error("Error loading prescriptions:", prescriptionsError);
      return NextResponse.json({ error: prescriptionsError.message }, { status: 500 });
    }

    // Provider names lookup
    const prescriberIds = [
      ...new Set((prescriptionsData || []).map((rx) => rx.prescriber_id)),
    ].filter(Boolean);

    let providerMap = new Map<string, { first_name: string; last_name: string }>();

    if (prescriberIds.length > 0) {
      const { data: providersData } = await supabase
        .from("providers")
        .select("user_id, first_name, last_name")
        .in("user_id", prescriberIds);

      providerMap = new Map(
        providersData?.map((p) => [p.user_id, p]) || []
      );
    }

    // Filter out test patients
    const HIDDEN_TEST_LASTNAMES = ["harton"];

    const formatted = (prescriptionsData || [])
      .filter((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        if (patient) {
          const p = patient as { first_name: string; last_name: string };
          if (HIDDEN_TEST_LASTNAMES.includes(p.last_name?.toLowerCase())) return false;
        }
        return true;
      })
      .map((rx) => {
      const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
      const provider = providerMap.get(rx.prescriber_id);
      const pharmacy = Array.isArray(rx.pharmacy) ? rx.pharmacy[0] : rx.pharmacy;

      return {
        id: rx.id,
        queueId: rx.queue_id || "N/A",
        submittedAt: rx.submitted_at,
        providerName: provider
          ? `Dr. ${provider.first_name} ${provider.last_name}`
          : "Unknown Provider",
        patientName: patient
          ? `${(patient as any).first_name} ${(patient as any).last_name}`
          : "Unknown Patient",
        patientEmail: (patient as any)?.email || null,
        medication: rx.medication,
        strength: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        sig: rx.sig,
        status: rx.status || "submitted",
        paymentStatus: rx.payment_status,
        patientPrice: rx.patient_price,
        shippingFeeCents: rx.shipping_fee_cents,
        profitCents: rx.profit_cents || 0,
        submissionGroupId: groupIdLookup[rx.id] || null,   // ← THE GROUP KEY
        trackingNumber: rx.tracking_number,
        pharmacyName: (pharmacy as any)?.name,
        pharmacyColor: (pharmacy as any)?.primary_color,
        carrierStatus: rx.fedex_status,
        estimatedDelivery: rx.estimated_delivery,
        patientId: rx.patient_id,
        hasCustomAddress: rx.has_custom_address || false,
        customAddress: rx.custom_address,
        patientAddress: (() => {
          const p = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
          return (p as any)?.physical_address || null;
        })(),
        paymentToken: (() => {
          const txs = (rx as any).payment_transactions;
          if (Array.isArray(txs) && txs.length > 0) return txs[0].payment_token;
          return null;
        })(),
        paymentTransactionId: (() => {
          const txs = (rx as any).payment_transactions;
          if (Array.isArray(txs) && txs.length > 0) return txs[0].id;
          return null;
        })(),
      };
    });

    return NextResponse.json({ prescriptions: formatted });
  } catch (error) {
    console.error("Error in admin prescriptions API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

<a name="file-4"></a>
## 6. FILE 4: `admin/prescriptions/page.tsx` — Admin Panel UI

**Path:** `app/(features)/admin/prescriptions/page.tsx` (1274 lines)

### Interface:

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
  profitCents?: number | null;         // cents (e.g. 2500 = $25.00) — oversight fee
  submissionGroupId?: string | null;   // UUID grouping key (from order_group_id)
  trackingNumber?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  patientId?: string;
  hasCustomAddress?: boolean;
  customAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  patientAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  paymentToken?: string | null;
  paymentTransactionId?: string | null;
}
```

### Status logic:

```typescript
const getEffectiveStatus = (rx: AdminPrescription): string => {
  if (rx.status === "submitted" && (!rx.queueId || rx.queueId === "N/A")) {
    return rx.paymentStatus === "paid" ? "payment_received" : "pending_payment";
  }
  return rx.status;
};
```

### handleSendPaymentLink — finds ALL group members, sends ONE link:

```typescript
const handleSendPaymentLink = async (rx: AdminPrescription) => {
  if (sendingRef.current) return;
  if (!rx.patientEmail) { /* error */ return; }
  if (rx.patientPrice == null) { /* error */ return; }

  sendingRef.current = true;

  // Find all unpaid items in this group
  const allGroupMembers = rx.submissionGroupId
    ? prescriptions.filter(
        (p) => p.submissionGroupId === rx.submissionGroupId && p.paymentStatus !== "paid"
      )
    : [rx];

  // All must have a price
  const missingPrice = allGroupMembers.filter((p) => p.patientPrice == null);
  if (missingPrice.length > 0) { /* error listing which meds have no price */ return; }

  // Sum totals from ALL group members
  const prescriptionIds = allGroupMembers.map((p) => p.id);
  let totalMedicationCostCents = 0;
  let totalShippingFeeCents = 0;
  let totalOversightFeeCents = 0;

  for (const grx of allGroupMembers) {
    totalMedicationCostCents += Math.round((grx.patientPrice ?? 0) * 100);
    totalShippingFeeCents += grx.shippingFeeCents ?? 0;
    totalOversightFeeCents += grx.profitCents ?? 0;
  }

  // ONE API call with ALL IDs
  const response = await fetch("/api/payments/generate-link", {
    method: "POST",
    body: JSON.stringify({
      prescriptionIds,                               // Array of ALL group member IDs
      consultationFeeCents: totalOversightFeeCents,
      medicationCostCents: totalMedicationCostCents,
      shippingFeeCents: totalShippingFeeCents,
      description: `Payment for ${allGroupMembers.length} medications: ${medNames.join(", ")}`,
      patientEmail: rx.patientEmail,
      sendEmail: true,
    }),
  });
};
```

### handleMarkAsPaid — sends ONE prescription ID, server finds ALL group members:

```typescript
const handleMarkAsPaid = async (prescriptionId: string) => {
  const response = await fetch(`/api/prescriptions/${prescriptionId}/mark-paid`, {
    method: "POST",
    credentials: "include",
  });
  // Server handles finding all group members, marking all paid, submitting all to pharmacy
};
```

### Auto-refresh every 15 seconds:

```typescript
useEffect(() => {
  loadPrescriptions();
  const interval = setInterval(loadPrescriptions, 15000);
  return () => clearInterval(interval);
}, [loadPrescriptions]);
```

### loadPrescriptions keeps modal in sync:

```typescript
const loadPrescriptions = useCallback(async () => {
  const freshList = data.prescriptions || [];
  setPrescriptions(freshList);
  setSelectedPrescription((prev) => {
    if (!prev) return null;
    const updated = freshList.find((p) => p.id === prev.id);
    return updated || null;
  });
}, []);
```

---

<a name="color-coding"></a>
## 10. ADMIN TABLE — GROUP COLOR-CODING ALGORITHM

### Step 1: Assign batch keys

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
    // PRIMARY: group by submissionGroupId
    if (!groupIdMap[sgId]) { groupCounter++; groupIdMap[sgId] = `g${groupCounter}`; }
    batchKeys.push(groupIdMap[sgId]);
  } else if (txId) {
    // FALLBACK: group by shared paymentTransactionId
    if (!txIdMap[txId]) { groupCounter++; txIdMap[txId] = `t${groupCounter}`; }
    batchKeys.push(txIdMap[txId]);
  } else {
    // SOLO: no group
    groupCounter++;
    batchKeys.push(`g${groupCounter}`);
  }
}
```

### Step 2: Break invalid groups (multiple shipping fees = data error)

```typescript
const shippingPerGroup: Record<string, number> = {};
for (let i = 0; i < filteredPrescriptions.length; i++) {
  const fee = filteredPrescriptions[i].shippingFeeCents ?? 0;
  if (fee > 0) shippingPerGroup[batchKeys[i]] = (shippingPerGroup[batchKeys[i]] || 0) + 1;
}
const invalidGroups = new Set(
  Object.entries(shippingPerGroup).filter(([, count]) => count > 1).map(([key]) => key)
);
for (let i = 0; i < batchKeys.length; i++) {
  if (invalidGroups.has(batchKeys[i])) { groupCounter++; batchKeys[i] = `solo${groupCounter}`; }
}
```

### Step 3: Count items per batch and assign colors

```typescript
const keyCounts: Record<string, number> = {};
batchKeys.forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1; });

const groupBgs = ["#EFF6FF", "#F5F3FF", "#FFFBEB", "#ECFDF5", "#FFF1F2"];     // Blue, Purple, Amber, Green, Rose
const groupBorders = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E"]; // matching borders

let colorCounter = 0;
const keyColorMap: Record<string, number> = {};
Object.entries(keyCounts).forEach(([key, count]) => {
  if (count > 1 && !(key in keyColorMap)) {
    keyColorMap[key] = colorCounter % groupBgs.length;  // wraps after 5 colors
    colorCounter++;
  }
});
```

### Step 4: Render rows

```typescript
const seenKeys = new Set<string>();

filteredPrescriptions.map((prescription, idx) => {
  const key = batchKeys[idx];
  const isMultiBatch = keyCounts[key] > 1;
  const isFirstInBatch = isMultiBatch && !seenKeys.has(key);
  seenKeys.add(key);
  const batchSize = keyCounts[key];
  const colorIdx = keyColorMap[key] ?? 0;

  return (
    <TableRow
      style={isMultiBatch ? {
        backgroundColor: groupBgs[colorIdx],              // Colored background
        borderLeft: `4px solid ${groupBorders[colorIdx]}`, // Left color stripe
      } : {
        backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA", // Normal zebra
      }}
    >
      {/* Patient cell with group badge */}
      <TableCell>
        {prescription.patientName}
        {isFirstInBatch && isMultiBatch && (
          <span style={{ backgroundColor: groupBorders[colorIdx] }}
                className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white">
            {batchSize} items
          </span>
        )}
      </TableCell>

      {/* Price cell — only first item shows shipping */}
      <TableCell>
        <span className="font-semibold text-green-700">
          ${prescription.patientPrice.toFixed(2)}
        </span>
        {(prescription.shippingFeeCents ?? 0) > 0 && (
          <span className="text-[10px]">
            +${((prescription.shippingFeeCents ?? 0) / 100).toFixed(2)} ship
          </span>
        )}
      </TableCell>
    </TableRow>
  );
});
```

### Visual result:

```
┌──────────────────────────────────────────────────────┐
│ (white)  Apr 10  Dr. Smith  Jane Doe  Metformin  $50 │  ← solo
├──────────────────────────────────────────────────────┤
│▌(blue)   Apr 11  Dr. Jones  Bob Lee [3 items] Lipitor $80  │  ← group
│▌(blue)   Apr 11  Dr. Jones  Bob Lee  Amlodipi  $45  │
│▌(blue)   Apr 11  Dr. Jones  Bob Lee  Losartan  $35  │
├──────────────────────────────────────────────────────┤
│ (#FAFAFA) Apr 12  Dr. Smith  Amy Wu  Omeprazol  $25 │  ← solo
└──────────────────────────────────────────────────────┘
```

---

<a name="modal-pricing"></a>
## 11. ADMIN MODAL — GROUP PRICING DISPLAY

When you click a grouped row, the modal shows ALL items:

```typescript
const groupMembers = selectedPrescription.submissionGroupId
  ? prescriptions.filter(p => p.submissionGroupId === selectedPrescription.submissionGroupId)
  : [selectedPrescription];
const isGrouped = groupMembers.length > 1;

const groupTotalMed = groupMembers.reduce((sum, p) => sum + (p.patientPrice ?? 0), 0);
const groupTotalShipping = groupMembers.reduce((sum, p) => sum + (p.shippingFeeCents ?? 0), 0);
const groupTotalOversight = groupMembers.reduce((sum, p) => sum + (p.profitCents ?? 0), 0);
const groupTotal = groupTotalMed + groupTotalShipping / 100 + groupTotalOversight / 100;
```

### If grouped — itemized list:

```
┌──────────────────────────────────────────────────────┐
│ 💲 Pricing                     [3 items in group]    │
│                                                      │
│ ┌─ (highlighted = currently selected item) ────────┐ │
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

### Payment action buttons (when status = pending_payment):

```typescript
// Button text changes for groups:
payIsGrouped
  ? `Send Payment Link (${payGroupMembers.length} items)`
  : "Send Payment Link to Patient"

payIsGrouped
  ? `Mark All ${payGroupMembers.length} Items as Paid`
  : "Mark as Paid"

// Badge above buttons:
payIsGrouped && <Badge>Applies to all {payGroupMembers.length} items</Badge>
```

---

<a name="send-payment-link"></a>
## 12. SEND PAYMENT LINK — COMPLETE FLOW

### What generate-link API does:

1. Normalizes `prescriptionIds` array
2. Fetches primary prescription with patient/pharmacy join
3. Rejects if already paid
4. Multi-Rx validation: all same patient, same prescriber, none paid
5. **3-tier idempotency check** for existing valid payment link:
   - By `prescription_id` on `payment_transactions`
   - By `payment_transaction_id` on prescriptions
   - By `order_group_id` via group members
6. If existing link found and NOT expired → resend email, return existing
7. If expired → delete it, create fresh
8. **Optimistic lock**: set all to `payment_status = "link_generating"` (prevents double-submit)
9. **Server-authoritative pricing**: recalculates from DB, warns if client total differs
10. Creates ONE `payment_transaction` with total of ALL items
11. Generates payment URL: `{siteUrl}/payment/{paymentToken}`
12. Links ALL prescriptions to this ONE transaction
13. Sends ONE email with ALL medications listed
14. Returns `{ success, paymentUrl, paymentToken, transactionId, emailSent }`

### On ANY failure → reverts `link_generating` status back to `pending`

---

<a name="mark-as-paid-flow"></a>
## 13. MARK AS PAID — COMPLETE FLOW

**File: `app/api/prescriptions/[id]/mark-paid/route.ts`** (386 lines)

### What happens:

1. Admin sends `POST /api/prescriptions/{id}/mark-paid` with just ONE prescription ID
2. API fetches that prescription including `order_group_id`
3. If `order_group_id` exists → fetches ALL items in that group to calculate total
4. Sums `patient_price + shipping_fee_cents + profit_cents` across ALL group members
5. Creates or updates ONE `payment_transaction` with the group total
6. Finds ALL related prescription IDs via:
   - Same `payment_transaction_id`
   - Same `order_group_id`
   - Deduplicates
7. Updates ALL to `payment_status: "paid"`, `status: "payment_received"`
8. **Sends confirmation email** (async, non-blocking) listing ALL medications
9. **Submits ALL to pharmacy** in a loop, each calling `/api/prescriptions/{id}/submit-to-pharmacy`
10. Tracks successes and failures, logs errors to `system_logs`
11. Returns result with warning if some pharmacy submissions failed

---

<a name="file-7"></a>
## 14. FILE 7: `submit-to-pharmacy/route.ts`

**Path:** `app/api/prescriptions/[id]/submit-to-pharmacy/route.ts` (552 lines)

Called for EACH prescription individually (loop from mark-paid or webhook).

### Key flow:

1. **Auth**: internal secret header (`x-internal-secret`) OR authenticated provider/admin
2. **Fetch**: prescription + patient + provider + pharmacy medication from DB
3. **Already submitted?** If has `queue_id` → return existing (idempotent)
4. **Optimistic lock**: set status to `"submitting_to_pharmacy"` (prevents double-submit)
5. **Pharmacy backend**: fetch API key, URL, store ID from `pharmacy_backends` table
6. **Decrypt API key** if encrypted
7. **Resolve address**: custom_address if overridden, else patient physical_address
8. **Build DigitalRx payload**:
   - StoreID, VendorName
   - Patient: name, DOB, sex, address, phone, email
   - Doctor: name, NPI, DEA, address, phone
   - RxClaim: DrugName (prefixed with `"AIM-"`), Qty, DateWritten, Refills, NDC, Instructions, Notes, DAW
   - DocSignature: provider signature URL
   - PDFFile: base64 PDF from storage
9. **Validate** critical fields (StoreID, patient name, drug name)
10. **POST** to DigitalRx API: `{baseUrl}/RxWebRequest`
11. Extract QueueID from response
12. **Update prescription**: `queue_id`, `status: "submitted"`, `submitted_to_pharmacy_at`
13. Calculate `next_refill_date` if applicable
14. Log to `system_logs`

### On failure → revert status to `"payment_received"` so admin can retry

---

<a name="email"></a>
## 15. CONFIRMATION EMAIL — WHAT PATIENT RECEIVES

For group orders, the email payload includes ALL medications:

```typescript
{
  patientEmail: "patient@email.com",
  patientName: "Jane Doe",
  medication: "Semaglutide, Tirzepatide, B12 Injection",    // ALL names joined
  medications: [                                              // Per-item breakdown
    { name: "Semaglutide", price: "150.00", shippingFee: "15.00" },
    { name: "Tirzepatide", price: "200.00" },
    { name: "B12 Injection", price: "35.00" },
  ],
  oversightFee: "25.00",                                     // Total oversight
  providerName: "Dr. John Smith",
  totalAmount: "425.00",                                     // Grand total
  paymentMethod: "Manual Payment",                           // or card type from webhook
  transactionId: "MANUAL-ABC12345",
}
```

---

<a name="rules"></a>
## 16. CRITICAL RULES SUMMARY

1. **ONE `submissionGroupId`** (UUID) shared across ALL cart items in step3 submit
2. **`profit_cents` and `shipping_fee_cents`** ONLY on first item (`isFirstItem = i === 0`)
3. **Admin finds group members** by `submissionGroupId` (= `order_group_id` in DB)
4. **"Send Payment Link"** collects ALL unpaid group members, sums ALL costs, sends ONE API call
5. **ONE `payment_transaction`** created covering entire group total
6. **ONE payment link** and **ONE email** sent listing ALL medications
7. **"Mark as Paid"** finds ALL group members via `order_group_id` AND `payment_transaction_id`
8. **Submit to pharmacy** happens individually per prescription in a loop
9. **Confirmation email** lists ALL medications with per-item prices + grand total
10. **Table color-coding** uses 5 rotating color pairs; first item shows "{N} items" badge
11. **Server-authoritative pricing** — generate-link recalculates from DB, warns on mismatch
12. **Optimistic locks** — `link_generating` and `submitting_to_pharmacy` prevent double-processing
13. **Test patient filter** — patients with last_name "harton" hidden from admin table
14. **Auto-refresh** — admin table refreshes every 15 seconds
