# Prescription Status Testing Guide

## Overview

This guide explains how to test prescription status progression in the Pharmacy Admin "Incoming Prescriptions" page.

## Status Progression Flow

Prescriptions progress through the following statuses:

1. **Submitted** → Prescription sent to DigitalRX
2. **Billing** → Insurance/payment processing
3. **Approved** → Prescription approved by pharmacy
4. **Processing** → Medication being prepared/packed
5. **Shipped** → Package shipped to patient (tracking number added)
6. **Delivered** → Package delivered to patient

## Testing Modes

The Incoming Prescriptions page supports **two modes**:

### 1. Production Mode (Default)

**Purpose**: Check real prescription status from DigitalRX API

**How to use**:
1. Navigate to `/admin/prescriptions`
2. Click the "Check Status" button
3. System calls DigitalRX `/RxRequestStatus` endpoint for all prescriptions
4. Database updates with latest status from DigitalRX
5. UI refreshes automatically via real-time subscription

**API Flow**:
```
Admin UI → /api/prescriptions/status-batch
         → DigitalRX API (for each prescription)
         → Database Update
         → Real-time UI Update
```

**Status Mapping from DigitalRX Response**:
- `DeliveredDate` present → **delivered**
- `PickupDate` present → **shipped**
- `ApprovedDate` present → **approved**
- `PackDateTime` present → **processing**
- `BillingStatus` present → **billing**
- Default → **submitted**

---

### 2. Testing Mode

**Purpose**: Manually advance prescription status for testing/demo purposes

**How to activate**:
1. Navigate to `/admin/prescriptions`
2. Click the "Testing Mode" button (flask icon)
3. Yellow alert banner appears

**Testing Mode Features**:

#### A. Advance Individual Prescription
- Each prescription row shows an arrow button (→)
- Click arrow to advance that prescription to next status
- Toast notification shows status change: `submitted → billing`
- Status immediately updates in UI

#### B. Advance Random Prescriptions
- Click "Advance Random" button (replaces "Check Status")
- Randomly selects 2 prescriptions that aren't "delivered"
- Advances each one to next status
- Toast shows: `Advanced 2 prescriptions`

**Status Progression in Testing Mode**:
```
submitted → billing → approved → processing → shipped → delivered
```

**Tracking Numbers**:
- Automatically generated when status changes to "shipped"
- Format: `1Z + 16 random alphanumeric characters`
- Example: `1ZA3K9L2M4N5P6Q7R8S9`
- Displayed under status badge in table

---

## API Endpoints

### Production Status Check

**Endpoint**: `POST /api/prescriptions/status-batch`

**Request Body**:
```json
{
  "prescription_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response**:
```json
{
  "success": true,
  "statuses": [
    {
      "prescription_id": "uuid1",
      "queue_id": "RX1234567890",
      "success": true,
      "status": {
        "BillingStatus": "Approved",
        "ApprovedDate": "2024-01-15T10:30:00Z",
        "TrackingNumber": "1ZA3K9L2M4N5P6Q7R8S9"
      },
      "updated_status": "approved"
    }
  ]
}
```

---

### Testing Mode - Advance Single

**Endpoint**: `POST /api/admin/test-prescription-status`

**Request Body**:
```json
{
  "prescription_id": "uuid",
  "action": "advance"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "prescription_id": "uuid",
    "old_status": "submitted",
    "new_status": "billing",
    "tracking_number": null
  }
}
```

---

### Testing Mode - Advance Batch

**Endpoint**: `PATCH /api/admin/test-prescription-status`

**Request Body**:
```json
{
  "count": 2  // Number of prescriptions to advance
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated_count": 2,
    "updates": [
      {
        "prescription_id": "uuid1",
        "old_status": "submitted",
        "new_status": "billing"
      },
      {
        "prescription_id": "uuid2",
        "old_status": "billing",
        "new_status": "approved"
      }
    ]
  }
}
```

---

## Testing Scenarios

### Scenario 1: New Prescription Submission

1. **Provider** submits prescription via `/prescriptions/new` wizard
2. **System** calls DigitalRX API and stores Queue ID
3. **Pharmacy Admin** navigates to `/admin/prescriptions`
4. **Expected**: Prescription appears with status **"Submitted"** and Queue ID

### Scenario 2: Manual Status Progression (Testing Mode)

1. Enable **Testing Mode**
2. Find a prescription with status "submitted"
3. Click arrow button next to it
4. **Expected**: Status changes to "billing" immediately
5. Click arrow again
6. **Expected**: Status changes to "approved"
7. Continue until "shipped"
8. **Expected**: Tracking number appears when shipped

### Scenario 3: Batch Status Update (Testing Mode)

1. Enable **Testing Mode**
2. Click "Advance Random" button
3. **Expected**:
   - Toast shows "Advanced 2 prescriptions"
   - 2 random prescriptions move to next status
   - UI updates immediately

### Scenario 4: Real DigitalRX Status Check

1. Ensure **Testing Mode is OFF** (production mode)
2. Click "Check Status" button
3. **Expected**:
   - Loading spinner appears
   - API calls DigitalRX for each prescription
   - Toast shows: "Status updated for X prescriptions"
   - Any status changes reflect in UI

### Scenario 5: Real-Time Updates

1. Open two browser windows
2. Window 1: Pharmacy Admin on `/admin/prescriptions`
3. Window 2: Pharmacy Admin on `/admin/prescriptions` (Testing Mode enabled)
4. In Window 2, advance a prescription
5. **Expected**: Window 1 automatically updates (no refresh needed)

---

## Filtering & Search

### Status Filter Dropdown
- Filter by: All, Submitted, Billing, Approved, Processing, Shipped, Delivered
- Shows count for each status: `Approved (5)`

### Status Badge Filters
- Click any colored status badge to filter by that status
- Example: Click "Billing: 3" badge → shows only billing prescriptions

### Search Box
Search by:
- Patient name
- Provider name
- Medication name
- Queue ID

---

## Database Schema

### Prescriptions Table

**Relevant Columns**:
```sql
id                UUID PRIMARY KEY
queue_id          TEXT              -- DigitalRX Queue ID
status            TEXT              -- submitted|billing|approved|processing|shipped|delivered
tracking_number   TEXT              -- Added when status = shipped
submitted_at      TIMESTAMP
updated_at        TIMESTAMP
```

**Status Update Query**:
```sql
UPDATE prescriptions
SET status = 'billing',
    tracking_number = '1ZA3K9L2M4N5P6Q7R8S9',
    updated_at = NOW()
WHERE id = 'uuid';
```

---

## Real-Time Subscription

The page uses Supabase real-time subscriptions to automatically refresh when prescriptions change:

```typescript
const channel = supabase
  .channel("admin-prescriptions-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "prescriptions",
  }, () => {
    loadPrescriptions(); // Refresh data
  })
  .subscribe();
```

**Events Monitored**:
- INSERT: New prescription submitted
- UPDATE: Status changed
- DELETE: Prescription removed

---

## Troubleshooting

### Issue: Status not updating from DigitalRX

**Possible Causes**:
1. Invalid Queue ID in database
2. DigitalRX API key incorrect
3. Network timeout

**Debug Steps**:
1. Open browser console (F12)
2. Click "Check Status"
3. Look for API errors in console
4. Check Network tab for failed requests
5. Verify Queue ID format: `RX` + 13 digits

---

### Issue: Testing Mode arrow button not working

**Possible Causes**:
1. Prescription already at "delivered" status
2. Network error
3. Database update failed

**Debug Steps**:
1. Check if prescription status is "delivered" (arrow hidden for delivered)
2. Open console, look for error messages
3. Check Network tab for `/api/admin/test-prescription-status` response

---

### Issue: Real-time updates not working

**Possible Causes**:
1. Supabase connection lost
2. Browser tab suspended
3. Network issues

**Debug Steps**:
1. Refresh page
2. Check console for subscription errors
3. Manually click "Check Status" to force refresh

---

## Environment Variables

Required for production mode:

```bash
# DigitalRX API Configuration
DIGITALRX_API_KEY=12345678901234567890
DIGITALRX_API_URL=https://www.dbswebserver.com/DBSRestApi/API/
```

**Location**: `.env` file in project root

---

## Summary

| Mode | Purpose | Button Label | API Called |
|------|---------|--------------|------------|
| **Production** | Real DigitalRX status | "Check Status" | `/api/prescriptions/status-batch` → DigitalRX |
| **Testing** | Manual simulation | "Advance Random" | `/api/admin/test-prescription-status` |

**Recommendation**: Use Testing Mode for demos and development, Production Mode for real pharmacy operations.
