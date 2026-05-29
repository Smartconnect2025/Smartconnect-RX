---
name: SmartConnect live DB access & the AIMRX_PROD_DB_URL trap
description: How to reach (and how NOT to reach) the live SmartConnect database; which secret is which.
---

# Reaching the SmartConnect live database

**The live SmartConnect database is the Supabase project referenced by `NEXT_PUBLIC_SUPABASE_URL` (`<ref>.supabase.co`).** The running app — in BOTH the Replit dev environment and production — reads/writes it via Supabase REST using `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. REST cannot run DDL (ALTER TABLE / CREATE TABLE).

**`DATABASE_URL` (host ends in `helium`) is an empty Replit-managed dev Postgres**, NOT the live DB. Drizzle (`drizzle.config.ts`, `db:migrate`) targets it. Running migrations there does NOT affect the live app. Do not rely on it to verify data-dependent features — the app does not read it.

**TRAP: `AIMRX_PROD_DB_URL` is NOT the SmartConnect DB.** It is a direct Postgres pooler URL (`aws-0-us-west-2.pooler.supabase.com`) to a **different** Supabase project ref than `NEXT_PUBLIC_SUPABASE_URL`. It is the *upstream AimRx* production database.
**Why:** the project was forked from AimRx and kept the secret name. Verified the project refs differ.
**How to apply:** NEVER run SmartConnect DDL/migrations against `AIMRX_PROD_DB_URL` — that would modify a different company's production DB and violates the "don't mix systems" rule.

## Consequence for schema changes
To add columns to the LIVE SmartConnect DB you need EITHER:
- the user to provide `SMARTCONNECT_DB_URL` (Supabase project Settings → Database → Connection string → URI), or
- the user to paste the SQL into the Supabase SQL editor themselves.

There is no other path: service-role REST can't do DDL, and no direct SmartConnect Postgres connection string is present in the project. The team's established convention is standalone SQL scripts in `aimrx-new/scripts/*.sql` applied manually (e.g. `add-tier-level-column.sql`, `create-tiers-table.sql`).

## Feature dependency
Pay-on-Terms reporting and delegation ("assistant files under provider's NPI") attribution both require these additive columns on live before their code can be pushed (pushing column-dependent SELECT/INSERT before the columns exist breaks the live app, since dev also reads live Supabase):
- `providers.prefix text NOT NULL DEFAULT 'Dr.'`
- `providers.pay_on_terms boolean NOT NULL DEFAULT false`
- `prescriptions.submitted_by_delegation_id uuid REFERENCES delegations(id) ON DELETE SET NULL`
- `prescriptions.pay_on_terms_settled_at timestamptz`
Ready-to-run script: `aimrx-new/scripts/add-payon-terms-and-delegation-columns.sql`.
