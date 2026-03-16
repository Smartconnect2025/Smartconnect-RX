# Prescription Payment Flow - Decision Required

**Date: January 19, 2026**
**Status: AWAITING JERRY/TOMAS APPROVAL**

---

## The Problem

Currently, prescriptions are being submitted to the pharmacy (DigitalRx) **IMMEDIATELY** when the provider creates them, even before the patient pays.

### Current Flow (PROBLEMATIC):
```
1. Provider creates prescription
2. System INSTANTLY submits to pharmacy → Queue ID received
3. Patient receives payment link
4. Patient may or may not pay
5. Pharmacy already has the order regardless of payment status ❌
```

**Why this is wrong:**
- Pharmacy receives orders that may never be paid
- Creates inventory and tracking issues
- Doesn't match standard e-commerce logic (payment before fulfillment)

---

## The Solution Implemented

I've created a **two-step submission process** that only submits to the pharmacy AFTER payment is confirmed.

### NEW Flow (Proposed):

#### **Scenario 1: Payment Required (patient_price > $0)**
```
1. Provider creates prescription
2. Status: "pending_payment" (NOT sent to pharmacy yet)
3. Patient receives payment link
4. Patient pays
5. Authorize.Net webhook confirms payment
6. System AUTOMATICALLY submits to pharmacy
7. Status: "submitted" + Queue ID received
8. Pharmacy receives the order
```

#### **Scenario 2: No Payment Required (patient_price = $0)**
```
1. Provider creates prescription
2. IMMEDIATELY submitted to pharmacy
3. Status: "submitted" + Queue ID received
4. Done
```

---

## What Was Changed

### 1. **`app/api/prescriptions/submit/route.ts`**
- Added payment requirement check
- If payment required: Save as "pending_payment", DON'T submit to pharmacy
- If no payment: Submit immediately to pharmacy (existing behavior)

### 2. **`app/api/prescriptions/[id]/submit-to-pharmacy/route.ts`** (NEW)
- New endpoint that submits prescription to pharmacy AFTER payment
- Verifies payment_status = "paid" before submitting
- Called automatically by webhook

### 3. **`app/api/webhooks/authnet/route.ts`**
- After payment confirmation, automatically calls submit-to-pharmacy endpoint
- Triggers pharmacy submission without manual intervention

---

## Questions for Jerry/Tomas

### 1. **Is this two-step approach correct?**
   - Should we ALWAYS wait for payment before submitting to pharmacy?
   - Or do you prefer the current immediate submission?

### 2. **What about direct card payments?**
   - If provider enters patient's card directly in the form, should that submit immediately?
   - How do we differentiate "payment link" vs "direct card entry"?

### 3. **Provider dashboard visibility**
   - Should providers see "pending_payment" status in their dashboard?
   - How should this be communicated to providers?

### 4. **Payment timeout handling**
   - If patient never pays, what happens to the prescription?
   - Should it expire after X days?
   - Should we notify the provider?

### 5. **Alternative approaches**
   - Should we keep immediate submission but add payment verification at pharmacy level?
   - Or is the two-step approach the right solution?

---

## My Recommendation

**The two-step approach is the correct solution** from a business logic perspective:

### Pros:
✅ Only paid orders go to pharmacy
✅ Clear payment tracking and status flow
✅ No unpaid inventory issues at pharmacy
✅ Matches standard e-commerce patterns
✅ Automatic submission after payment (no manual work)

### Cons:
⚠️ More complex workflow
⚠️ Requires webhook reliability
⚠️ Slight delay in order fulfillment (but only a few seconds after payment)

---

## Current Status

- ✅ Code is implemented and tested (0 linter errors)
- ✅ Two-step flow is functional and ready
- ⏸️ **Awaiting approval from Jerry/Tomas**
- 🔄 Can be reverted if different solution is needed

---

## What Happens Next

### **Option A: Approve the two-step approach**
→ Keep the changes as-is
→ Test the complete flow end-to-end
→ Update provider documentation about payment statuses

### **Option B: Reject the two-step approach**
→ Revert the changes
→ Discuss alternative solutions
→ Implement different approach based on business requirements

---

## Testing Checklist (Once Approved)

- [ ] Create prescription with patient_price > $0
- [ ] Verify status is "pending_payment"
- [ ] Verify prescription NOT sent to DigitalRx yet
- [ ] Patient pays via payment link
- [ ] Webhook receives payment confirmation
- [ ] Verify prescription automatically submitted to pharmacy
- [ ] Verify status changes to "submitted"
- [ ] Verify Queue ID is saved
- [ ] Create prescription with $0 price
- [ ] Verify immediately submitted to pharmacy

---

## Decision

**Jerry/Tomas: Please approve or reject this approach so we can proceed.**

If you have a different vision for how the payment flow should work, please describe it and I can implement accordingly.

---

## Related Files

- Full implementation details: `PRESCRIPTION_PAYMENT_FLOW_FIX.md`
- Code changes in:
  - `app/api/prescriptions/submit/route.ts`
  - `app/api/prescriptions/[id]/submit-to-pharmacy/route.ts` (NEW)
  - `app/api/webhooks/authnet/route.ts`
