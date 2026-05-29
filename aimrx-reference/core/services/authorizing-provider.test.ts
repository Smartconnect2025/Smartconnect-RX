/**
 * Unit tests for the authorizing-provider resolver.
 *
 * Run with:   node --import tsx --test core/services/authorizing-provider.test.ts
 *
 * Uses Node's built-in test runner (no external deps), matching the
 * existing pattern in core/utils/digitalrx-format.test.ts.
 *
 * The resolver is tested with a fake SupabaseClient — `from(table)`
 * returns a chainable query builder whose terminal `.maybeSingle()` /
 * `.single()` resolves to a recorded row. This isolates the branching
 * logic (delegationId vs. prescriberId, broken-join vs. happy-path)
 * from the actual Supabase JS client.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAuthorizingProvider,
  resolveActiveAuthorizingProviderForDelegate,
} from "./authorizing-provider";

// ── Fake Supabase ──────────────────────────────────────────────────────
// Minimal SupabaseClient subset that the resolver actually uses. Typed
// explicitly so the tests don't reach for `any` (HIPAA / strict-types
// hygiene). The resolver's signature accepts `SupabaseClient` but only
// invokes from().select().eq().order().limit().maybeSingle()/single().
type Row = Record<string, unknown> | null;
type Recorder = {
  table: string;
  filters: Array<[string, string, unknown]>;
  selectClause: string;
};
type FakeSupabaseResponse<T> = { data: T; error: { message: string } | null };
interface FakeQueryBuilder {
  select(clause: string): FakeQueryBuilder;
  eq(col: string, val: unknown): FakeQueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): FakeQueryBuilder;
  limit(n: number): FakeQueryBuilder;
  maybeSingle(): Promise<FakeSupabaseResponse<Row>>;
  single(): Promise<FakeSupabaseResponse<Row>>;
}
interface FakeSupabaseClient {
  from(table: string): FakeQueryBuilder;
}

function makeFakeClient(
  responses: Array<{ match: (r: Recorder) => boolean; row: Row }>,
): FakeSupabaseClient {
  return {
    from(table: string): FakeQueryBuilder {
      const rec: Recorder = { table, filters: [], selectClause: "" };
      const builder: FakeQueryBuilder = {
        select(clause: string) {
          rec.selectClause = clause;
          return builder;
        },
        eq(col: string, val: unknown) {
          rec.filters.push(["eq", col, val]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          const hit = responses.find((r) => r.match(rec));
          return Promise.resolve({ data: hit?.row ?? null, error: null });
        },
        single() {
          const hit = responses.find((r) => r.match(rec));
          return Promise.resolve({
            data: hit?.row ?? null,
            error: hit?.row ? null : { message: "not found" },
          });
        },
      };
      return builder;
    },
  };
}

// Resolver only uses the `from(...).select(...).eq(...)…` surface above,
// so a structural cast through `unknown` to the concrete SupabaseClient
// param type is safe and `any`-free.
import type { SupabaseClient } from "@supabase/supabase-js";
const asClient = (c: FakeSupabaseClient): SupabaseClient =>
  c as unknown as SupabaseClient;

const ASSISTANT_USER_ID = "11111111-1111-1111-1111-111111111111";
const AUTH_PROVIDER_USER_ID = "22222222-2222-2222-2222-222222222222";
const DELEGATION_ID = "33333333-3333-3333-3333-333333333333";

const AUTH_PROVIDER_ROW = {
  user_id: AUTH_PROVIDER_USER_ID,
  prefix: "Dr.",
  first_name: "Randolph",
  last_name: "Whipps",
  npi_number: "1063491181",
  dea_number: null,
  company_name: "Whipps Clinic",
  phone_number: "555-0100",
  signature_url: "https://example.com/whipps.png",
  physical_address: { street: "1 Main", city: "Houston", state: "TX" },
  email: "whipps@example.com",
  is_active: true,
};

const ASSISTANT_PROVIDER_ROW = {
  user_id: ASSISTANT_USER_ID,
  prefix: null,
  first_name: "Cather",
  last_name: "Smith",
  npi_number: null,
  dea_number: null,
  company_name: null,
  phone_number: null,
  signature_url: null,
  physical_address: null,
  email: "cather@example.com",
  is_active: true,
};

// ─────────────────────────────────────────────────────────────────────
describe("resolveAuthorizingProvider — delegate path", () => {
  test("returns AUTHORIZING provider's row when delegationId is set", async () => {
    const client = makeFakeClient([
      {
        match: (r) =>
          r.table === "delegations" &&
          r.filters.some(([, c, v]) => c === "id" && v === DELEGATION_ID),
        row: { provider_id: "x", providers: AUTH_PROVIDER_ROW },
      },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      {
        prescriberId: ASSISTANT_USER_ID,
        delegationId: DELEGATION_ID,
      },
    );
    assert.ok(result, "expected a resolved provider");
    assert.equal(result!.viaDelegation, true);
    assert.equal(result!.delegationId, DELEGATION_ID);
    assert.equal(result!.provider.user_id, AUTH_PROVIDER_USER_ID);
    assert.equal(result!.provider.npi_number, "1063491181");
  });

  test("returns null when delegation join is broken — does NOT silently fall back to assistant row (Manning bug)", async () => {
    // Delegations row exists but the providers join is missing — this
    // is the EXACT failure mode that caused Manning's PDF to be
    // generated against Cather's empty row. The resolver must refuse
    // and let the caller decide.
    const client = makeFakeClient([
      {
        match: (r) => r.table === "delegations",
        row: { provider_id: "x", providers: null },
      },
      // Even if a fallback lookup were attempted, the assistant's row
      // is available — the resolver MUST NOT reach for it.
      {
        match: (r) => r.table === "providers",
        row: ASSISTANT_PROVIDER_ROW,
      },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      {
        prescriberId: ASSISTANT_USER_ID,
        delegationId: DELEGATION_ID,
      },
    );
    assert.equal(result, null, "must NOT fall back to assistant row");
  });

  test("returns null when delegation row itself is missing", async () => {
    const client = makeFakeClient([
      { match: (r) => r.table === "delegations", row: null },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      { prescriberId: ASSISTANT_USER_ID, delegationId: DELEGATION_ID },
    );
    assert.equal(result, null);
  });
});

describe("resolveAuthorizingProvider — direct provider path", () => {
  test("returns provider row when delegationId is null", async () => {
    const client = makeFakeClient([
      {
        match: (r) =>
          r.table === "providers" &&
          r.filters.some(
            ([, c, v]) => c === "user_id" && v === AUTH_PROVIDER_USER_ID,
          ),
        row: AUTH_PROVIDER_ROW,
      },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      { prescriberId: AUTH_PROVIDER_USER_ID, delegationId: null },
    );
    assert.ok(result);
    assert.equal(result!.viaDelegation, false);
    assert.equal(result!.delegationId, null);
    assert.equal(result!.provider.user_id, AUTH_PROVIDER_USER_ID);
  });

  test("returns null when prescriber_id has no providers row", async () => {
    const client = makeFakeClient([
      { match: (r) => r.table === "providers", row: null },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      { prescriberId: "no-such-user", delegationId: null },
    );
    assert.equal(result, null);
  });

  test("treats undefined delegationId the same as null", async () => {
    const client = makeFakeClient([
      { match: (r) => r.table === "providers", row: AUTH_PROVIDER_ROW },
    ]);
    const result = await resolveAuthorizingProvider(
      
      asClient(client),
      { prescriberId: AUTH_PROVIDER_USER_ID, delegationId: undefined },
    );
    assert.ok(result);
    assert.equal(result!.viaDelegation, false);
  });
});

describe("resolveActiveAuthorizingProviderForDelegate", () => {
  test("returns active delegation's authorizing provider row", async () => {
    const client = makeFakeClient([
      {
        match: (r) =>
          r.table === "delegations" &&
          r.filters.some(
            ([, c, v]) => c === "delegate_user_id" && v === ASSISTANT_USER_ID,
          ),
        row: {
          id: DELEGATION_ID,
          provider_id: "x",
          providers: AUTH_PROVIDER_ROW,
        },
      },
    ]);
    const result = await resolveActiveAuthorizingProviderForDelegate(
      
      asClient(client),
      ASSISTANT_USER_ID,
    );
    assert.ok(result);
    assert.equal(result!.delegationId, DELEGATION_ID);
    assert.equal(result!.provider.user_id, AUTH_PROVIDER_USER_ID);
  });

  test("returns null when delegate has no active delegation", async () => {
    const client = makeFakeClient([
      { match: (r) => r.table === "delegations", row: null },
    ]);
    const result = await resolveActiveAuthorizingProviderForDelegate(
      
      asClient(client),
      ASSISTANT_USER_ID,
    );
    assert.equal(result, null);
  });
});
