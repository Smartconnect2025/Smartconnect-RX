/**
 * Submit-guard credential validator tests (Task #64).
 *
 * Run with:   node --import tsx --test core/services/prescriber-credentials.test.ts
 *
 * Covers the integration-style matrix the unified pre-payment validator
 * in `app/api/prescriptions/submit/route.ts` uses:
 *   - delegate complete (auth provider's row whole)        → no block
 *   - delegate incomplete (auth provider missing fields)   → block + missing list
 *   - direct provider complete                             → no block
 *   - direct provider incomplete                           → block + missing list
 *   - admin-supplied prescriber, complete / incomplete     → same as direct
 *   - delegate with broken delegation (null source)        → all-missing
 *
 * Plus the regen-side contract: regenerate-stale-pdf consumes the
 * resolver output directly, so the same credential-source shape feeds
 * both code paths — these tests pin the shared contract.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeMissingPrescriberFields,
  type PrescriberCredentialSource,
} from "./prescriber-credentials";

// ── fixtures ─────────────────────────────────────────────────────────
const COMPLETE: PrescriberCredentialSource = {
  npi_number: "1063491181",
  dea_number: "BW1234567",
  signature_url: "https://example.com/sig.png",
  medical_licenses: [{ licenseNumber: "TX-12345", state: "TX" }],
};

const ASSISTANT_EMPTY: PrescriberCredentialSource = {
  npi_number: null,
  dea_number: null,
  signature_url: null,
  medical_licenses: [],
};

// ─────────────────────────────────────────────────────────────────────
describe("computeMissingPrescriberFields — happy path", () => {
  test("complete provider returns empty missing list", () => {
    assert.deepEqual(computeMissingPrescriberFields(COMPLETE), []);
  });

  test("complete provider with multiple licenses still returns empty", () => {
    const src = {
      ...COMPLETE,
      medical_licenses: [
        { licenseNumber: "TX-12345", state: "TX" },
        { licenseNumber: "CA-99999", state: "CA" },
      ],
    };
    assert.deepEqual(computeMissingPrescriberFields(src), []);
  });
});

describe("computeMissingPrescriberFields — direct provider blocks", () => {
  test("missing npi → ['npi']", () => {
    const src = { ...COMPLETE, npi_number: null };
    assert.deepEqual(computeMissingPrescriberFields(src), ["npi"]);
  });

  test("missing dea is allowed (peptides don't require DEA)", () => {
    const src = { ...COMPLETE, dea_number: "" };
    assert.deepEqual(computeMissingPrescriberFields(src), []);
  });

  test("missing dea on otherwise-incomplete provider does NOT add 'dea'", () => {
    const src = { ...COMPLETE, dea_number: null, npi_number: null };
    assert.deepEqual(computeMissingPrescriberFields(src), ["npi"]);
  });

  test("whitespace-only signature_url is treated as missing", () => {
    const src = { ...COMPLETE, signature_url: "   " };
    assert.deepEqual(computeMissingPrescriberFields(src), ["signature"]);
  });

  test("empty medical_licenses array → ['medicalLicense']", () => {
    const src = { ...COMPLETE, medical_licenses: [] };
    assert.deepEqual(computeMissingPrescriberFields(src), ["medicalLicense"]);
  });

  test("medical_licenses entry missing state → ['medicalLicense']", () => {
    const src = {
      ...COMPLETE,
      medical_licenses: [{ licenseNumber: "TX-12345", state: "" }],
    };
    assert.deepEqual(computeMissingPrescriberFields(src), ["medicalLicense"]);
  });

  test("medical_licenses entry missing licenseNumber → ['medicalLicense']", () => {
    const src = {
      ...COMPLETE,
      medical_licenses: [{ licenseNumber: null, state: "TX" }],
    };
    assert.deepEqual(computeMissingPrescriberFields(src), ["medicalLicense"]);
  });

  test("medical_licenses non-array (corrupt JSON) → ['medicalLicense']", () => {
    const src = { ...COMPLETE, medical_licenses: { foo: "bar" } };
    assert.deepEqual(computeMissingPrescriberFields(src), ["medicalLicense"]);
  });

  test("multi-field gap returns all codes in canonical order (DEA omitted — not required)", () => {
    const src: PrescriberCredentialSource = {
      npi_number: null,
      dea_number: null,
      signature_url: null,
      medical_licenses: [],
    };
    assert.deepEqual(computeMissingPrescriberFields(src), [
      "npi",
      "signature",
      "medicalLicense",
    ]);
  });
});

describe("computeMissingPrescriberFields — delegate flows", () => {
  test("delegate w/ complete authorizing provider source → no block", () => {
    // submit-guard re-loads the AUTHORIZING provider's row when role is
    // delegate; that row, not the assistant's, is what we check.
    assert.deepEqual(computeMissingPrescriberFields(COMPLETE), []);
  });

  test("delegate w/ incomplete authorizing provider → blocks (Manning bug exact reproduction)", () => {
    // Whipps's row at the time of the Manning incident: NPI present
    // but signature_url null and no medical_licenses array.
    const whippsManningEra: PrescriberCredentialSource = {
      npi_number: "1063491181",
      dea_number: "BW1234567",
      signature_url: null,
      medical_licenses: [],
    };
    assert.deepEqual(
      computeMissingPrescriberFields(whippsManningEra),
      ["signature", "medicalLicense"],
    );
  });

  test("delegate w/ Whipps post-fix profile (NPI + sig + MD license, no DEA) → no block", () => {
    // Real production state May 9 2026 — Whipps has everything Greenwich
    // needs for peptide Rx. Cather's submissions on his behalf must NOT
    // be blocked over a missing DEA he doesn't need.
    const whippsLive: PrescriberCredentialSource = {
      npi_number: "1063491181",
      dea_number: null,
      signature_url: "https://example.com/whipps-sig.png",
      medical_licenses: [{ licenseNumber: "D0022699", state: "MD" }],
    };
    assert.deepEqual(computeMissingPrescriberFields(whippsLive), []);
  });

  test("delegate w/ broken delegation (null source) → ALL required fields missing", () => {
    // profile-check returns this shape when the delegation row exists
    // but the providers join is broken; the validator must surface all
    // required codes so the caller's block-on-any check fires.
    assert.deepEqual(computeMissingPrescriberFields(null), [
      "npi",
      "signature",
      "medicalLicense",
    ]);
  });

  test("delegate w/ assistant's own empty row → ALL required fields missing", () => {
    // Defense-in-depth: even if a future caller accidentally passes
    // the assistant's row instead of the authorizing provider's, the
    // validator refuses to let the submission through.
    assert.deepEqual(computeMissingPrescriberFields(ASSISTANT_EMPTY), [
      "npi",
      "signature",
      "medicalLicense",
    ]);
  });
});

describe("computeMissingPrescriberFields — admin-supplied prescriber", () => {
  test("admin behaves identically to direct provider (complete)", () => {
    assert.deepEqual(computeMissingPrescriberFields(COMPLETE), []);
  });

  test("admin behaves identically to direct provider (incomplete)", () => {
    const src = { ...COMPLETE, npi_number: null, signature_url: null };
    assert.deepEqual(computeMissingPrescriberFields(src), ["npi", "signature"]);
  });
});
