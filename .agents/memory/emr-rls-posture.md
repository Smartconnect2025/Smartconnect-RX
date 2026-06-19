---
name: EMR (allergies/medications) RLS & auth posture
description: How basic-emr services authorize, and the unconfirmed RLS posture on the allergies table.
---

# EMR auth & RLS posture

The `basic-emr` services (`allergyService`, and by the same pattern
`medicationService`) are instantiated once with the **public Supabase anon
client** (`createClient()` → `createBrowserClient`). They take a client-passed
`userId` and run an app-level `verifyPatientOwnership` check
(providers → any active patient; non-providers → only their own). The real DB
enforcement is therefore whatever **Supabase RLS does with `auth.uid()`** from
the authenticated session JWT — NOT the passed `userId` (that only drives the
app-level pre-check and can be spoofed by a crafted client).

**Key consequence:** the attack surface for read/write/delete on these tables is
set entirely by RLS + table grants reachable via the *public* anon key. Adding a
UI button (e.g. an allergies delete) does NOT widen it — anyone with the public
anon key can already hit the REST endpoint directly.

## Unconfirmed: RLS on `allergies`
- Could not confirm RLS is enabled on `allergies`. Direct Postgres (`:5432`) is
  IPv6-only and times out; REST probes were inconclusive because the table was
  empty (service role saw 0 rows) so anon-vs-service SELECT couldn't differ.
- An anon DELETE to a non-existent id returned **HTTP 204 (not 401/403)**, which
  means the `anon` role has a table-level DELETE grant — so RLS is the *only*
  thing protecting the table. If RLS is off, the table is wide open via the
  public anon key.
- There is an `scripts/enable-patients-rls.sql` (patients RLS enabled with
  `auth.uid()` policies) but **no equivalent script for `allergies`** — a yellow
  flag that allergies RLS may never have been enabled.

**Why:** matters for any destructive EMR operation on the live medical platform.
**How to apply:** before relying on client-side EMR service calls for security,
either confirm an RLS DELETE/UPDATE policy exists on the table (test that a
non-provider session cannot mutate another patient's row) or move authorization
fully server-side (API route using server-side `getUser()` + a session-bound or
service-role client — note the existing PATCH route calls the anon-client service
server-side, which has no session, so that route's security also rests on RLS).
