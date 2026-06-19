---
name: SmartConnect DB topology
description: Which database actually backs the SmartConnect RX app, and how to apply schema changes to it.
---

# SmartConnect RX database topology

The app's real production data lives in the **Supabase project** referenced by
`NEXT_PUBLIC_SUPABASE_URL` (+ `SUPABASE_SERVICE_ROLE_KEY`). Server code reaches it
via the Supabase JS client (`createAdminClient` in `core/database/client.ts`),
i.e. PostgREST — which **cannot run DDL**.

**Why this matters:** other connection-string secrets do NOT point at this DB:
- `DATABASE_URL` → a separate, essentially empty Postgres (0 pharmacies).
- `AIMRX_PROD_DB_URL` → a different Supabase project entirely.
- The Supabase project's **direct** host (`db.<ref>.supabase.co:5432`) is
  **IPv6-only** and unreachable from the Replit container (CONNECT_TIMEOUT).

Project ref = `pxehuvreezdpiusgwbct`. Live `pharmacies` fingerprint (sanity check
for the real DB): **5 rows**.

**Gotcha — no usable Postgres DSN is provisioned in the container.** Both
`SUPABASE_DATABASE_URL` and `SMARTCONNECT_DB_URL` are set to the **REST URL**
(`https://<ref>.supabase.co`), NOT a `postgres://` DSN — `psql "$SUPABASE_DATABASE_URL"`
just treats the URL as a dbname and connects to the local default host (fails).
`SMARTCONNECT_DB_PASSWORD` is in missing-secrets (not provisioned), so the pooler
DSN below cannot be built without the user adding it.

**How to apply schema changes (DDL) to the real DB:**
1. Easiest / most reliable: have the user paste the SQL into the Supabase
   **SQL Editor** and click Run. No credentials needed from us. PostgREST/service
   role CANNOT run DDL, so this (or option 2) is required for any ALTER/CREATE.
2. Programmatically (only if user adds the password): **Session/Transaction pooler**
   string `postgresql://postgres.<ref>:<pwd>@aws-<n>-<region>.pooler.supabase.com:6543/postgres`,
   which is IPv4-friendly. The pooler region must be discovered (probe regions in
   parallel) since it isn't derivable from the project ref.

Always verify the target DB before any DDL: compare the app's PostgREST
fingerprint (row count + a deterministic sample row of `pharmacies`) against the
direct connection's same query. Refuse to run DDL unless they match.
