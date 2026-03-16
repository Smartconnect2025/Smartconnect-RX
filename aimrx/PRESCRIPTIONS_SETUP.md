# Prescriptions Table Setup

## Database Schema

A new `prescriptions` table has been created to track electronic prescriptions submitted to DigitalRx pharmacy.

### Table Structure

```sql
CREATE TABLE "prescriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "prescriber_id" uuid NOT NULL,               -- References auth.users(id)
  "patient_id" uuid NOT NULL,                  -- References patients(id)
  "medication" text NOT NULL,
  "dosage" text NOT NULL,                      -- e.g. "10mg"
  "quantity" integer NOT NULL,
  "refills" integer DEFAULT 0 NOT NULL,
  "sig" text NOT NULL,                         -- Instructions: "Take 1 tablet daily..."
  "pdf_base64" text,                           -- Optional uploaded PDF (Base64)
  "signature_base64" text,                     -- Optional e-signature (Base64)
  "queue_id" text UNIQUE,                      -- ID from DigitalRx API
  "status" text DEFAULT 'submitted' NOT NULL,  -- Status tracking
  "tracking_number" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

### Status Flow

Prescriptions follow this status progression:
- `submitted` → Initial state when prescription is created
- `billing` → Billing information being processed
- `approved` → Prescription approved by provider
- `packed` → Pharmacy has packed the medication
- `shipped` → Package shipped to patient
- `delivered` → Package delivered

## Files Created

1. **Schema Definition**: `core/database/schema/prescriptions.ts`
   - Drizzle ORM schema definition
   - Type exports for TypeScript

2. **Migration**: `core/database/migrations/20251201133703_prescriptions.sql`
   - SQL migration to create the table
   - Foreign key constraints to auth.users and patients tables

3. **Database Check Page**: `app/(features)/admin/database-check/page.tsx`
   - Admin utility page to verify table creation
   - URL: `/admin/database-check`
   - Shows table status and column list
   - Will be removed after verification

## Next Steps

1. **Run Migration**: Execute the migration to create the table in Supabase
2. **Verify Setup**: Visit `/admin/database-check` to confirm table exists
3. **Add Features**: Build prescription submission forms and DigitalRx integration

## TypeScript Types

```typescript
import { Prescription, InsertPrescription, UpdatePrescription } from '@core/database/schema';

// Use these types when working with prescriptions
const newPrescription: InsertPrescription = {
  prescriber_id: '...',
  patient_id: '...',
  medication: 'Lisinopril',
  dosage: '10mg',
  quantity: 30,
  refills: 3,
  sig: 'Take 1 tablet daily with food',
  status: 'submitted'
};
```
