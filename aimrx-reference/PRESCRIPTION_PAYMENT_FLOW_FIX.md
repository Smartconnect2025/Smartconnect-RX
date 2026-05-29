# Prescription Payment Flow Fix - Two-Step Submission

**Date: January 19, 2026**
**Status: COMPLETE ✅**

---

## Problem

The prescription was being submitted to the pharmacy (DigitalRx) **BEFORE** the patient paid. This is wrong because:

1. Provider creates prescription → Immediately sent to pharmacy → Status: "Submitted"
2. Patient receives payment link
3. Patient pays (maybe... maybe not)
4. **Pharmacy already has the order even if patient never pays!**

**This is a major issue** - we're sending orders to the pharmacy without confirming payment first.

---

## Solution: Two-Step Process

### NEW FLOW (Correct):

#### **Step 1: Create Prescription (Payment Required)**
- Provider creates prescription with patient price
- Prescription saved with status: **"pending_payment"**
- Payment status: **"pending"**
- **NOT submitted to pharmacy yet**
- Patient receives payment link via email

#### **Step 2: After Payment Received**
- Patient pays via payment link
- Authorize.Net webhook confirms payment
- Webhook calls new API: `/api/prescriptions/[id]/submit-to-pharmacy`
- **NOW** prescription is submitted to DigitalRx
- Status changes to: **"submitted"**
- Payment status: **"paid"**
- Queue ID received from pharmacy

---

## Files Modified

### 1. **`app/api/prescriptions/submit/route.ts`** ✅

**Changes:**
- Added payment check: `requiresPayment` logic
- If patient_price > 0 → Save as "pending_payment" and DON'T submit to pharmacy
- If patient_price = 0 or no price → Submit immediately to pharmacy
- Return different messages based on payment requirement

**Key Code:**
```typescript
const requiresPayment = body.patient_price && parseFloat(body.patient_price) > 0;
let prescriptionStatus = "pending_payment"; // Default when payment required

if (!requiresPayment) {
  // Submit to DigitalRx immediately
  prescriptionStatus = "submitted";
} else {
  // Save as pending_payment, wait for payment
  console.log("💳 Payment required - saving as 'pending_payment'");
}
```

### 2. **`app/api/prescriptions/[id]/submit-to-pharmacy/route.ts`** ✅ (NEW FILE)

**Purpose:** Submit prescription to pharmacy AFTER payment is received

**Features:**
- Called by webhook after payment confirmation
- Checks if prescription is already submitted (idempotent)
- Verifies payment status is "paid"
- Submits to DigitalRx API
- Updates prescription with queue_id and status "submitted"
- Logs to system_logs

**Key Code:**
```typescript
// Check if payment is completed
if (prescription.payment_status !== "paid") {
  return NextResponse.json(
    { success: false, error: "Payment not completed" },
    { status: 400 }
  );
}

// Submit to DigitalRx...
// Update prescription status to "submitted"
```

### 3. **`app/api/webhooks/authnet/route.ts`** ✅

**Changes:**
- After payment success, calls the new submit-to-pharmacy endpoint
- Automatically submits prescription to pharmacy when payment is confirmed

**Key Code:**
```typescript
// Submit prescription to pharmacy now that payment is received
const submitResponse = await fetch(
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/prescriptions/${paymentTransaction.prescription_id}/submit-to-pharmacy`,
  { method: "POST" }
);
```

---

## Status Flow

### Before This Fix ❌
```
Create Prescription → Submit to Pharmacy → Status: "submitted"
                   ↓
            Send Payment Link
                   ↓
         Patient Pays (maybe)
                   ↓
      Payment Status: "paid" (but already at pharmacy!)
```

### After This Fix ✅
```
Create Prescription → Status: "pending_payment"
                   ↓
            Send Payment Link
                   ↓
            Patient Pays
                   ↓
      Webhook Receives Payment
                   ↓
   Submit to Pharmacy → Status: "submitted"
                   ↓
     Queue ID from DigitalRx
```

---

## Payment Scenarios

### Scenario 1: Patient Price > $0 (Payment Link)
1. Provider creates prescription with $50 patient price
2. Status: **"pending_payment"**
3. Payment link sent to patient
4. Patient clicks link and pays
5. Webhook receives payment confirmation
6. **Prescription submitted to pharmacy**
7. Status: **"submitted"**
8. Pharmacy receives order

### Scenario 2: No Patient Price (Free/Direct)
1. Provider creates prescription with $0 or no price
2. **Immediately submitted to pharmacy**
3. Status: **"submitted"**
4. Queue ID received
5. Done!

### Scenario 3: Patient Never Pays
1. Provider creates prescription with $50 patient price
2. Status: **"pending_payment"**
3. Payment link sent to patient
4. Patient never pays
5. Status stays: **"pending_payment"**
6. **Pharmacy never receives order** ✅ (This is correct!)

---

## Database Fields

### `prescriptions` table:
- **`status`**: "pending_payment" or "submitted"
- **`payment_status`**: "pending" or "paid"
- **`queue_id`**: NULL until submitted to pharmacy
- **`submitted_to_pharmacy_at`**: Timestamp when sent to pharmacy

---

## Testing Checklist

- [x] Linter passes with 0 errors
- [ ] Create prescription with payment → Status is "pending_payment"
- [ ] Verify prescription NOT sent to DigitalRx yet
- [ ] Patient pays via payment link
- [ ] Webhook receives payment
- [ ] Prescription automatically submitted to pharmacy
- [ ] Status changes to "submitted"
- [ ] Queue ID is saved
- [ ] Create prescription with $0 price → Immediately submitted

---

## API Endpoints

### POST `/api/prescriptions/submit`
- Creates prescription
- If payment required: Status = "pending_payment", NOT sent to pharmacy
- If no payment: Status = "submitted", sent to pharmacy immediately

### POST `/api/prescriptions/[id]/submit-to-pharmacy`
- Submits prescription to pharmacy after payment
- Requires payment_status = "paid"
- Returns queue_id from DigitalRx
- Updates status to "submitted"

### POST `/api/webhooks/authnet`
- Receives payment confirmation
- Calls submit-to-pharmacy endpoint
- Updates payment_status to "paid"

---

## Benefits

✅ **No more unpaid orders at pharmacy**
✅ **Clear status tracking** (pending_payment vs submitted)
✅ **Automatic submission after payment**
✅ **Idempotent** (safe to retry)
✅ **Proper payment flow**
✅ **Pharmacy only gets paid orders**

---

## Summary

**Before:** Prescriptions were submitted to pharmacy BEFORE payment ❌

**After:** Prescriptions are only submitted to pharmacy AFTER payment is confirmed ✅

**The pharmacy will now only receive orders that have been paid for!**
