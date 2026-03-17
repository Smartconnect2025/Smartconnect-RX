Subject: SmartConnect RX — Pioneer RX Integration Documentation

Hi Jerry,

I wanted to share a complete technical overview of the Pioneer RX pharmacy integration we built into SmartConnect RX. This serves as internal documentation for our records.

---

# SmartConnect RX — Pioneer RX Integration

## Overview

SmartConnect RX now supports two pharmacy backend systems:
1. **DigitalRx** (existing) — our original pharmacy fulfillment system
2. **Pioneer RX** (new) — added as a second supported pharmacy management system

The system automatically routes prescriptions to the correct backend based on how each pharmacy is configured in the admin panel. Both systems run side-by-side without interfering with each other.

---

## Architecture

### Multi-Pharmacy Dispatcher

The core of the integration is a **pharmacy dispatcher** (`pharmacy-dispatcher.ts`) that sits between our prescription routes and the pharmacy backends. When a prescription is submitted or a status check is requested, the dispatcher:

1. Looks up the pharmacy's configured backend in the `pharmacy_backends` database table
2. Determines whether it's a DigitalRx or Pioneer RX pharmacy
3. Routes the request to the correct handler

There is **no cross-pharmacy fallback** — each pharmacy is strictly isolated. If Pharmacy A is configured for Pioneer RX, it will never accidentally use Pharmacy B's DigitalRx credentials.

### Key Files

| File | Purpose |
|------|---------|
| `app/api/prescriptions/_shared/pharmacy-dispatcher.ts` | Routes requests to the correct pharmacy system |
| `app/api/prescriptions/_shared/pioneerrx-helpers.ts` | Pioneer RX API client (auth, submit, status, test) |
| `app/api/prescriptions/_shared/digitalrx-helpers.ts` | DigitalRx API client (unchanged) |
| `app/api/prescriptions/[id]/submit-to-pharmacy/route.ts` | Submits a prescription to the pharmacy |
| `app/api/prescriptions/[id]/check-status/route.ts` | Checks prescription status from the pharmacy |
| `app/api/prescriptions/status-batch/route.ts` | Batch status checking for multiple prescriptions |
| `app/api/webhook/pioneerrx/route.ts` | Receives status updates from Pioneer RX |
| `app/api/webhook/digitalrx/route.ts` | Receives status updates from DigitalRx |
| `app/api/admin/pioneer-test/route.ts` | Admin endpoint to test Pioneer RX connectivity |
| `core/database/schema/pharmacy_backends.ts` | Database schema for pharmacy backend configs |

---

## Pioneer RX Authentication

Pioneer RX uses a signature-based authentication system. Here's how it works:

1. **Credentials are stored** as `apiKey|sharedSecret` (pipe-separated) in the `api_key_encrypted` field of the `pharmacy_backends` table
2. **For each API request**, we generate:
   - A timestamp (ISO 8601 format)
   - A signature: SHA-512 hash of the UTF-16-LE encoded string `(timestamp + sharedSecret)`, output as Base64
3. **Three headers** are sent with every request:
   - `prx-api-key`: The API key portion
   - `prx-timestamp`: The current timestamp
   - `prx-signature`: The computed signature

**Important**: This is a plain SHA-512 hash (`crypto.createHash`), NOT an HMAC. The Pioneer RX documentation specifies plain hashing.

---

## What We Built

### 1. Prescription Submission (EScript)

When a provider submits a prescription for a Pioneer RX pharmacy, the system:
- Sends to: `POST /api/v1/Prescription/Process/NewEScript`
- Builds a structured payload with an `rx` array containing prescription details (rxID as GUID, directionsLiteral, prescribedQuantity, daysSupply, startDate, NDC)
- Includes patient demographics, prescriber info (NPI, DEA), and optionally a PDF attachment
- Includes `storeID` and `locationID` when configured (targets specific store/location)
- Parses the response for `TransactionID` (GUID) and `RxNumber` (internal pharmacy reference)
- Stores the `TransactionID` as the prescription's `queue_id`

### 2. Status Checking

Both single and batch status checks:
- Query: `GET /api/v1/Claim/RxTransaction?rxTransactionID={id}`
- Secondary check available: `GET /api/v1/Prescription/RxPostEdit/Active?rxTransactionID={id}` (for pending edits/blocks)
- Map Pioneer RX's `RxStatusTypeID` values to our internal status system:
  - `1 (Active/Received)` → `submitted`
  - `2 (Filled)` → `packed`
  - `3 (Voided)` → `cancelled`
  - `4 (Discontinue)` → `cancelled`
  - `5 (Verified/Approved)` → `approved`
  - `6 (Shipped)` → `picked_up`
  - `7 (Delivered)` → `delivered`
- Also supports text-based status matching as fallback (e.g., "in process", "ready for pickup", etc.)

### 3. Webhook (Inbound Status Updates)

Pioneer RX can push status updates to us via webhook at `/api/webhook/pioneerrx`. The webhook:
- Validates the request using a shared secret (`PIONEERRX_WEBHOOK_SECRET` env var)
- Maps the incoming status to our internal system
- Updates the prescription in our database
- Triggers notifications to the prescriber
- Registers tracking numbers with our shipping tracker if provided

### 4. Connection Test

Admin users can test Pioneer RX connectivity from the admin panel via `/api/admin/pioneer-test`. This verifies:
- The API key and shared secret are valid
- The Pioneer RX server is reachable
- Authentication succeeds

---

## Security Measures

1. **Webhook Authentication**: Both Pioneer RX and DigitalRx webhooks **reject all requests** when their respective secrets are not configured. No fallback to unauthenticated mode.

2. **Authorization**: 
   - Prescription submission requires provider, admin, or pharmacy_admin role
   - Providers can only submit prescriptions under their own account (cannot impersonate other prescribers)
   - Submit-to-pharmacy checks that the user is either the prescriber on the prescription or an admin

3. **No Cross-Pharmacy Credential Leakage**: Backend resolution is strictly scoped by `pharmacy_id`. One pharmacy's credentials are never used for another pharmacy's prescriptions.

4. **Explicit System Dispatch**: All routes use explicit `if PioneerRx / else if DigitalRx / else reject` logic. Unknown system types return a 400 error instead of being silently routed to the wrong system.

5. **Credential Validation**: If Pioneer RX credentials are stored in the wrong format (missing pipe separator, empty values), the system logs clear error messages instead of silently failing.

---

## Environment Variables Required

| Variable | Purpose | Required |
|----------|---------|----------|
| `PIONEERRX_WEBHOOK_SECRET` | Shared secret for authenticating Pioneer RX webhook calls | Yes (for Pioneer RX webhooks) |
| `DIGITALRX_WEBHOOK_SECRET` | Shared secret for authenticating DigitalRx webhook calls | Yes (for DigitalRx webhooks) |
| `INTERNAL_API_SECRET` | Secret for internal service-to-service calls (e.g., auto-submit after payment) | Yes (for internal calls) |

---

## How to Set Up a Pharmacy for Pioneer RX

1. Go to **Admin → Pharmacy Management**
2. Select the pharmacy you want to configure
3. Set **System Type** to `PioneerRx`
4. In the **API Key** field, enter credentials in the format: `apiKey|sharedSecret`
   - Example: `ABC123|MySecretKey456`
   - The first part before the pipe is the API key
   - The second part after the pipe is the shared secret
5. Enter the **Base URL** for the Pioneer RX server (e.g., `https://pioneerserver:42957`)
6. Optionally set **Store ID** and **Location ID** if the pharmacy has multiple locations
7. Save and use the **Test Connection** button to verify

---

## How to Test the Integration

### Test 1: Connection Test
1. Log in as admin (`joseph+200@smartconnects.com`)
2. Go to Admin → Pharmacy Management
3. Select a pharmacy configured for Pioneer RX
4. Click "Test Connection"
5. Expected: Success message confirming connectivity

### Test 2: Prescription Submission
1. Log in as a provider
2. Create a new prescription for a patient assigned to a Pioneer RX pharmacy
3. Complete payment
4. The system should auto-submit to Pioneer RX
5. Check the prescription detail page — it should show a queue ID and "submitted" status

### Test 3: Status Check
1. Find a submitted Pioneer RX prescription in the admin panel
2. Click "Check Status"
3. The system should query Pioneer RX and update the status accordingly

### Test 4: Webhook
1. Set the `PIONEERRX_WEBHOOK_SECRET` environment variable
2. Configure your Pioneer RX server to send status updates to: `https://your-domain.com/api/webhook/pioneerrx?token=YOUR_SECRET`
3. When Pioneer RX updates an order, the webhook should receive the update and reflect it in SmartConnect RX

### Test 5: Security Verification
1. Try accessing the webhook endpoint without the correct token — should return 401
2. Try submitting a prescription as a patient role — should return 403
3. Try submitting as a provider using another provider's ID — should return 403

---

## Database Schema

The `pharmacy_backends` table stores the configuration:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `pharmacy_id` | UUID | Links to the pharmacy |
| `system_type` | VARCHAR | `DigitalRx` or `PioneerRx` |
| `api_key_encrypted` | TEXT | Encrypted API credentials |
| `api_url` | TEXT | Base URL for the pharmacy API |
| `store_id` | VARCHAR | Store identifier |
| `location_id` | VARCHAR | Location identifier (Pioneer RX) |
| `is_active` | BOOLEAN | Whether this backend is active |

---

## Pioneer RX API Endpoints Reference

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Health Check (unauthenticated) | GET | `/api/v1/Test/IsAvailable` |
| Health Check (authenticated) | GET | `/api/v1/Test/IsAvailableWithAuth` |
| New EScript (submit prescription) | POST | `/api/v1/Prescription/Process/NewEScript` |
| Check Status (claim/transaction) | GET | `/api/v1/Claim/RxTransaction?rxTransactionID={id}` |
| Check Pending Edits | GET | `/api/v1/Prescription/RxPostEdit/Active?rxTransactionID={id}` |
| Price Check | GET/POST | `/api/v1/Item/Pricing/PriceCheck` |
| Edit Prescription | POST | `/api/v1/Prescription/Edit/RxTransaction` |

**Important Notes from Manual:**
- The API uses **polling** (GET status checks) rather than push notifications by default
- Timestamps must be within a ~5-minute window or the signature will be rejected (replay attack protection)
- The `RxNumber` returned is Pioneer RX's internal pharmacy reference number
- Setting `readjudicate: true` on prescription edits triggers a new insurance claim
- Some edits can trigger a "block" requiring an explicit API call to unblock

---

## Code Quality

The integration passed a comprehensive 12-point architect review:
1. Signature generation (SHA512 plain hash, UTF-16-LE) — PASS
2. API key parsing (pipe-separated, edge cases) — PASS
3. No cross-system/cross-pharmacy fallback — PASS
4. EScript payload completeness — PASS
5. Status dispatch (explicit system type matching) — PASS
6. Webhook security (reject when secret missing) — PASS
7. Import paths — PASS
8. DigitalRx preserved, no regressions — PASS
9. Error handling (no silent swallowing) — PASS
10. Admin test endpoint (pharmacy-scoped) — PASS
11. Type safety (null guards) — PASS
12. Security (authorization, no bypass) — PASS

---

Please let me know if you have any questions or need any changes to the integration.

Best regards,
SmartConnect RX Development Team
