# Row Level Security (RLS) Documentation

This document describes the Row Level Security implementation for the healthcare application.

## Overview

All 41 tables have RLS policies defined via Drizzle ORM schemas. Policies are enforced at the database level by Supabase/PostgreSQL.

**Key Principle:** No anonymous access. All tables require authentication (`authenticatedRole`).

## Role Model

| Role | Description |
|------|-------------|
| `user` | Patient - can access own records |
| `provider` | Healthcare provider - can access assigned patients |
| `admin` | Full access to all records |
| `pharmacy_admin` | Can view prescriptions/payments for their pharmacy |

## Helper Functions

Located in `core/database/core-migrations/`:

### 03_user_roles_rls.sql
- `is_admin(check_user_id uuid)` - Check if user is admin

### 04_rls_helper_functions.sql
- `is_provider()` - Check if current user is a provider
- `provider_has_patient_access(p_patient_id uuid)` - Check if provider is assigned to patient
- `is_pharmacy_admin(p_pharmacy_id uuid)` - Check if user is pharmacy admin for specific pharmacy
- `is_own_patient_record(p_patient_id uuid)` - Check if patient record belongs to current user
- `is_own_provider_record(p_provider_id uuid)` - Check if provider record belongs to current user

## Tables by Access Pattern

### Category A: User-Owned (`user_id = auth.uid()`)
Tables where records belong to the authenticated user directly.

| Table | Schema File |
|-------|-------------|
| user_addresses | `user_addresses.ts` |
| orders | `orders.ts` |
| notifications | `notifications.ts` |
| goals | `goals.ts` |

### Category B: Cascade from Parent
Tables that inherit access from a parent table via foreign key.

| Table | Parent | Schema File |
|-------|--------|-------------|
| order_line_items | orders | `orders.ts` |
| order_activities | orders | `orders.ts` |
| notification_actions | notifications | `notifications.ts` |
| goal_progress | goals | `goals.ts` |

### Category C: Patient Medical Records
Tables accessible by: patient (self), assigned providers, and admins.

| Table | Schema File | Notes |
|-------|-------------|-------|
| patients | `patients.ts` | Core patient table |
| encounters | `encounters.ts` | |
| appointments | `appointments.ts` | |
| medications | `medications.ts` | |
| conditions | `conditions.ts` | |
| allergies | `allergies.ts` | |
| vitals | `vitals.ts` | |
| emr_orders | `emr_orders.ts` | |
| addendums | `addendums.ts` | Via encounter |
| patient_documents | `patient_documents.ts` | |
| prescriptions | `prescriptions.ts` | + pharmacy_admin |
| payment_transactions | `payment_transactions.ts` | + pharmacy_admin |

### Category D: Provider Data

| Table | Schema File | Access |
|-------|-------------|--------|
| providers | `providers.ts` | Self + public read (active) |
| provider_settings | `settings.ts` | Self only |
| provider_availability | `provider_availability.ts` | All authenticated (for booking UI) |
| provider_availability_exceptions | `provider_availability_exceptions.ts` | Self only |
| provider_pharmacy_links | `provider_pharmacy_links.ts` | Self + pharmacy_admin |
| provider_patient_mappings | `provider_patient_mappings.ts` | Both provider and patient |

### Category E: Billing
Provider access via encounter chain, admin full access.

| Table | Schema File |
|-------|-------------|
| billing_groups | `billing.ts` |
| billing_diagnoses | `billing.ts` |
| billing_procedures | `billing.ts` |

### Category F: Authenticated Read / Admin Write
Reference data readable by all authenticated users.

| Table | Schema File |
|-------|-------------|
| products | `products.ts` |
| categories | `products.ts` |
| symptoms | `symptoms.ts` |
| resources | `resources.ts` |
| tags | `tags.ts` |
| tiers | `tiers.ts` |
| pharmacies | `pharmacies.ts` |
| medication_catalog | `medication_catalog.ts` |

### Category G: Pharmacy Admin Scoped

| Table | Schema File |
|-------|-------------|
| pharmacy_medications | `pharmacy_medications.ts` |
| pharmacy_backends | `pharmacy_backends.ts` |
| pharmacy_admins | `pharmacy_admins.ts` |

### Category H: Admin Only

| Table | Schema File |
|-------|-------------|
| app_settings | `settings.ts` |
| system_logs | `system_logs.ts` |
| mfa_codes | `mfa_codes.ts` |
| access_requests | `access_requests.ts` |

## Policy Patterns

### User-Owned Pattern
```typescript
pgPolicy("table_select", {
  for: "select",
  to: authenticatedRole,
  using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
}),
pgPolicy("table_insert", {
  for: "insert",
  to: authenticatedRole,
  withCheck: sql`${table.user_id} = auth.uid()`,
}),
pgPolicy("table_update", {
  for: "update",
  to: authenticatedRole,
  using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
  withCheck: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
}),
pgPolicy("table_delete", {
  for: "delete",
  to: authenticatedRole,
  using: sql`${table.user_id} = auth.uid() OR public.is_admin(auth.uid())`,
}),
```

### Patient Medical Records Pattern
```typescript
pgPolicy("table_select", {
  for: "select",
  to: authenticatedRole,
  using: sql`
    public.is_admin(auth.uid())
    OR public.is_own_patient_record(${table.patient_id})
    OR public.provider_has_patient_access(${table.patient_id})
  `,
}),
// INSERT/UPDATE: Provider + Admin only
// DELETE: Admin only
```

### Authenticated Read / Admin Write Pattern
```typescript
pgPolicy("table_select", {
  for: "select",
  to: authenticatedRole,
  using: sql`true`,
}),
pgPolicy("table_insert", {
  for: "insert",
  to: authenticatedRole,
  withCheck: sql`public.is_admin(auth.uid())`,
}),
// UPDATE/DELETE: Admin only
```

## Important Notes

1. **UPDATE policies must have both `using` AND `withCheck`** - `using` controls which rows can be seen for update, `withCheck` controls what values can be written.

2. **Helper functions use `SECURITY DEFINER`** - They bypass RLS to prevent infinite recursion when checking access.

3. **provider_pharmacy_links.provider_id** references `auth.users.id` directly (not `providers.id`). This is intentional - it stores the user_id for direct comparison with `auth.uid()`.

4. **All helper functions are `STABLE`** - They don't modify data and can be optimized by PostgreSQL.

## Verification

Check RLS status:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

Check policies:
```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public';
```
