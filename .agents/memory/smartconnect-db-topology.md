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

**How to apply schema changes (DDL) to the real DB:**
1. Easiest / most reliable for a non-technical user: have them paste the SQL into
   the Supabase **SQL Editor** and click Run. No credentials needed from us.
2. Programmatically: use the **Session/Transaction pooler** connection string
   (`postgresql://postgres.<ref>:<pwd>@aws-<n>-<region>.pooler.supabase.com:6543/postgres`),
   which is IPv4-friendly. The pooler region must be discovered (probe regions in
   parallel) since it isn't derivable from the project ref.

Always verify the target DB before any DDL: compare the app's PostgREST
fingerprint (row count + a deterministic sample row of `pharmacies`) against the
direct connection's same query. Refuse to run DDL unless they match.
