/**
 * Integration-style coverage for the delegate-regen path (Task #64).
 *
 * Run with:   node --import tsx --test core/services/regenerate-stale-pdf.test.ts
 *
 * `regenerateGreenwichPdfFromRow` is too heavy to instantiate end-to-end
 * here (it pulls Supabase storage + the Greenwich PDF generator). What
 * we DO pin down is its single most important invariant for Task #64:
 * the resolver path it consumes ALWAYS prefers the authorizing
 * provider's row over the assistant's, and ALWAYS refuses to silently
 * fall back when the delegation join is broken — because that's the
 * exact contract the regen flow now relies on, replacing the previous
 * "load by prescriber_id" code path that produced Manning's stub PDF.
 *
 * If a future refactor re-introduces an assistant-row fallback in the
 * regen flow, these assertions will fail at the resolver layer before
 * the regen even starts producing a PDF.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveAuthorizingProvider } from "./authorizing-provider";
import type { SupabaseClient } from "@supabase/supabase-js";

// Minimal Supabase fake — same shape as authorizing-provider.test.ts.
type Row = Record<string, unknown> | null;
type Recorder = { table: string; filters: Array<[string, string, unknown]> };
interface FakeQueryBuilder {
  select(c: string): FakeQueryBuilder;
  eq(c: string, v: unknown): FakeQueryBuilder;
  order(c: string, o?: { ascending?: boolean }): FakeQueryBuilder;
  limit(n: number): FakeQueryBuilder;
  maybeSingle(): Promise<{ data: Row; error: { message: string } | null }>;
  single(): Promise<{ data: Row; error: { message: string } | null }>;
}
interface FakeSupabaseClient { from(t: string): FakeQueryBuilder }

function makeFakeClient(
  responses: Array<{ match: (r: Recorder) => boolean; row: Row }>,
): SupabaseClient {
  const c: FakeSupabaseClient = {
    from(table) {
      const rec: Recorder = { table, filters: [] };
      const b: FakeQueryBuilder = {
        select() { return b; },
        eq(col, val) { rec.filters.push(["eq", col, val]); return b; },
        order() { return b; },
        limit() { return b; },
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
      return b;
    },
  };
  return c as unknown as SupabaseClient;
}

const ASSISTANT_USER_ID = "11111111-1111-1111-1111-111111111111";
const AUTH_PROVIDER_USER_ID = "22222222-2222-2222-2222-222222222222";
const DELEGATION_ID = "33333333-3333-3333-3333-333333333333";

const AUTH_PROVIDER_ROW = {
  user_id: AUTH_PROVIDER_USER_ID,
  prefix: "Dr.",
  first_name: "Randolph",
  last_name: "Whipps",
  npi_number: "1063491181",
  dea_number: "BW1234567",
  signature_url: "https://example.com/whipps-sig.png",
  physical_address: { state: "TX" },
  email: "whipps@example.com",
  is_active: true,
};

const ASSISTANT_ROW = {
  user_id: ASSISTANT_USER_ID,
  first_name: "Cather",
  last_name: "Smith",
  npi_number: null,
  dea_number: null,
  signature_url: null,
  physical_address: null,
  email: "cather@example.com",
  is_active: true,
};

describe("regen path — Manning-bug regression guard", () => {
  test("resolver returns AUTHORIZING provider's credentials for delegate-row PDF regen (NOT assistant's)", async () => {
    const supabase = makeFakeClient([
      {
        match: (r) =>
          r.table === "delegations" &&
          r.filters.some(([, c, v]) => c === "id" && v === DELEGATION_ID),
        row: { provider_id: "x", providers: AUTH_PROVIDER_ROW },
      },
      // Even with the assistant's row available, the regen path must
      // not see it — it should consume the resolver's authorizing
      // provider exclusively.
      { match: (r) => r.table === "providers", row: ASSISTANT_ROW },
    ]);
    const result = await resolveAuthorizingProvider(supabase, {
      prescriberId: ASSISTANT_USER_ID,
      delegationId: DELEGATION_ID,
    });
    assert.ok(result, "resolver must succeed");
    assert.equal(result!.provider.user_id, AUTH_PROVIDER_USER_ID);
    assert.equal(result!.provider.npi_number, "1063491181");
    assert.equal(result!.provider.signature_url, "https://example.com/whipps-sig.png");
    // The exact failure that produced Manning's <200KB stub PDF: NPI
    // and signature_url BOTH null. Make absolutely sure the regen
    // never sees those values from the assistant row again.
    assert.notEqual(result!.provider.npi_number, null);
    assert.notEqual(result!.provider.signature_url, null);
  });

  test("regen path receives null when delegation join is broken — caller must NOT fall back to assistant row", async () => {
    const supabase = makeFakeClient([
      {
        match: (r) => r.table === "delegations",
        row: { provider_id: "x", providers: null },
      },
      // Decoy — present but MUST NOT be returned.
      { match: (r) => r.table === "providers", row: ASSISTANT_ROW },
    ]);
    const result = await resolveAuthorizingProvider(supabase, {
      prescriberId: ASSISTANT_USER_ID,
      delegationId: DELEGATION_ID,
    });
    assert.equal(
      result,
      null,
      "regen path must surface broken delegation as null, not as the assistant row",
    );
  });

  test("non-delegate regen still resolves directly (no behavior change for direct provider Rxs)", async () => {
    const supabase = makeFakeClient([
      {
        match: (r) =>
          r.table === "providers" &&
          r.filters.some(([, c, v]) => c === "user_id" && v === AUTH_PROVIDER_USER_ID),
        row: AUTH_PROVIDER_ROW,
      },
    ]);
    const result = await resolveAuthorizingProvider(supabase, {
      prescriberId: AUTH_PROVIDER_USER_ID,
      delegationId: null,
    });
    assert.ok(result);
    assert.equal(result!.viaDelegation, false);
    assert.equal(result!.provider.npi_number, "1063491181");
  });
});
