/**
 * Unit tests for Greenwich-compliant DigitalRx formatting helpers.
 *
 * Run with:   node --import tsx --test core/utils/digitalrx-format.test.ts
 *
 * Uses Node's built-in test runner (node:test) — no external dependencies.
 * Each test exercises one documented behavior of the helper. When a function
 * has a "fail-loud" contract (throws GreenwichValidationError), the negative
 * cases are tested explicitly with assert.throws and field-name verification.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  GreenwichValidationError,
  formatDrugNameWithPrefix,
  formatDateMMDDYYYY,
  formatPatientDOB,
  vialMlFromVialSize,
  quantityInMl,
  daysSupplyFromVialCount,
  formatBillToNote,
  truncateZip,
  formatPhoneForDigitalRx,
  formatDobForDigitalRx,
} from "./digitalrx-format";

// ─────────────────────────────────────────────────────────────────────────────
// 1. GreenwichValidationError
// ─────────────────────────────────────────────────────────────────────────────

describe("GreenwichValidationError", () => {
  test("stores the field name", () => {
    const err = new GreenwichValidationError("drugName", "is empty");
    assert.equal(err.field, "drugName");
  });

  test("formats super message as [field] message", () => {
    const err = new GreenwichValidationError("zip", "too short");
    assert.equal(err.message, "[zip] too short");
  });

  test("sets name to GreenwichValidationError", () => {
    const err = new GreenwichValidationError("date", "bad");
    assert.equal(err.name, "GreenwichValidationError");
  });

  test("is an instance of Error", () => {
    const err = new GreenwichValidationError("x", "y");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof GreenwichValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. formatDrugNameWithPrefix
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDrugNameWithPrefix", () => {
  test("prepends AIM + 2 spaces to a clean name", () => {
    assert.equal(
      formatDrugNameWithPrefix("BPC-157 3mg/3mL"),
      "AIM  BPC-157 3mg/3mL",
    );
  });

  test("uses exactly two ASCII spaces between prefix and name", () => {
    const out = formatDrugNameWithPrefix("Foo");
    assert.equal(out, "AIM  Foo");
    // Verify the gap is two ASCII 0x20 characters, not a tab/non-breaking
    assert.equal(out.charCodeAt(3), 0x20);
    assert.equal(out.charCodeAt(4), 0x20);
    assert.equal(out.charCodeAt(5), 0x46); // 'F'
  });

  test("strips an existing AIM prefix (idempotent)", () => {
    assert.equal(
      formatDrugNameWithPrefix("AIM TB-500 3mg/5mL"),
      "AIM  TB-500 3mg/5mL",
    );
  });

  test("strips existing AIM prefix case-insensitively", () => {
    assert.equal(formatDrugNameWithPrefix("aim BPC-157"), "AIM  BPC-157");
  });

  test("normalizes when called twice in a row", () => {
    const once = formatDrugNameWithPrefix("Cake");
    const twice = formatDrugNameWithPrefix(once);
    assert.equal(twice, "AIM  Cake");
  });

  test("trims surrounding whitespace before formatting", () => {
    assert.equal(formatDrugNameWithPrefix("  BPC-157  "), "AIM  BPC-157");
  });

  test("supports a custom clinic prefix", () => {
    assert.equal(formatDrugNameWithPrefix("BPC-157", "ABC"), "ABC  BPC-157");
  });

  test("throws GreenwichValidationError on empty string", () => {
    assert.throws(
      () => formatDrugNameWithPrefix(""),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "drugName",
    );
  });

  test("throws on whitespace-only input", () => {
    assert.throws(
      () => formatDrugNameWithPrefix("   "),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "drugName",
    );
  });

  test("throws on non-string input", () => {
    assert.throws(
      () => formatDrugNameWithPrefix(123 as unknown as string),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });

  test("throws on empty clinic prefix", () => {
    assert.throws(
      () => formatDrugNameWithPrefix("BPC-157", ""),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. formatDateMMDDYYYY
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDateMMDDYYYY", () => {
  test("formats a UTC Date as MM/DD/YYYY", () => {
    const d = new Date(Date.UTC(1991, 11, 31)); // Dec 31, 1991 UTC
    assert.equal(formatDateMMDDYYYY(d), "12/31/1991");
  });

  test("formats YYYY-MM-DD timezone-safely", () => {
    assert.equal(formatDateMMDDYYYY("1991-12-31"), "12/31/1991");
  });

  test("is idempotent on already-formatted MM/DD/YYYY", () => {
    assert.equal(formatDateMMDDYYYY("12/31/1991"), "12/31/1991");
  });

  test("zero-pads single-digit month and day", () => {
    assert.equal(formatDateMMDDYYYY("1/5/1991"), "01/05/1991");
  });

  test("accepts ISO timestamp with time portion", () => {
    assert.equal(formatDateMMDDYYYY("2024-03-15T08:30:00.000Z"), "03/15/2024");
  });

  test("throws on null", () => {
    assert.throws(
      () => formatDateMMDDYYYY(null),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });

  test("throws on undefined", () => {
    assert.throws(
      () => formatDateMMDDYYYY(undefined),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });

  test("throws on Invalid Date object", () => {
    assert.throws(
      () => formatDateMMDDYYYY(new Date("not-a-date")),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });

  test("throws on garbage string", () => {
    assert.throws(
      () => formatDateMMDDYYYY("yesterday"),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });

  test("throws GreenwichValidationError(date) on out-of-range month", () => {
    assert.throws(
      () => formatDateMMDDYYYY("13/01/2024"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "date",
    );
  });

  test("throws on impossible calendar date Feb 31", () => {
    assert.throws(
      () => formatDateMMDDYYYY("02/31/2024"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "date",
    );
  });

  test("throws on impossible calendar date April 31", () => {
    assert.throws(
      () => formatDateMMDDYYYY("04/31/2024"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "date",
    );
  });

  test("throws on Feb 29 in a non-leap year", () => {
    assert.throws(
      () => formatDateMMDDYYYY("02/29/2023"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "date",
    );
  });

  test("accepts Feb 29 in a leap year", () => {
    assert.equal(formatDateMMDDYYYY("02/29/2024"), "02/29/2024");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. formatPatientDOB
// ─────────────────────────────────────────────────────────────────────────────

describe("formatPatientDOB", () => {
  test("delegates to formatDateMMDDYYYY", () => {
    assert.equal(formatPatientDOB("1991-12-31"), "12/31/1991");
  });

  test("re-tags error field to patientDob", () => {
    assert.throws(
      () => formatPatientDOB("garbage"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "patientDob",
    );
  });

  test("re-tags null-input error to patientDob", () => {
    assert.throws(
      () => formatPatientDOB(null),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "patientDob",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. vialMlFromVialSize
// ─────────────────────────────────────────────────────────────────────────────

describe("vialMlFromVialSize", () => {
  test("parses 5ML as 5", () => {
    assert.equal(vialMlFromVialSize("5ML"), 5);
  });

  test("parses 10ML as 10", () => {
    assert.equal(vialMlFromVialSize("10ML"), 10);
  });

  test("parses 1ML as 1", () => {
    assert.equal(vialMlFromVialSize("1ML"), 1);
  });

  test("parses lowercase ml", () => {
    assert.equal(vialMlFromVialSize("3ml"), 3);
  });

  test("parses decimal vial size", () => {
    assert.equal(vialMlFromVialSize("2.5ml"), 2.5);
  });

  test("tolerates whitespace between number and ml", () => {
    assert.equal(vialMlFromVialSize("5 ML"), 5);
  });

  test("returns null for capsule form 1EA", () => {
    assert.equal(vialMlFromVialSize("1EA"), null);
  });

  test("returns null for capsule form 30ea", () => {
    assert.equal(vialMlFromVialSize("30ea"), null);
  });

  test("throws GreenwichValidationError(vialSize) on null", () => {
    assert.throws(
      () => vialMlFromVialSize(null),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "vialSize",
    );
  });

  test("throws GreenwichValidationError(vialSize) on empty string", () => {
    assert.throws(
      () => vialMlFromVialSize(""),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "vialSize",
    );
  });

  test("throws GreenwichValidationError(vialSize) on unrecognized format", () => {
    assert.throws(
      () => vialMlFromVialSize("five ml"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "vialSize",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. quantityInMl
// ─────────────────────────────────────────────────────────────────────────────

describe("quantityInMl", () => {
  test("1 vial × 5ML = 5", () => {
    assert.equal(quantityInMl(1, "5ML"), 5);
  });

  test("2 vials × 5ML = 10", () => {
    assert.equal(quantityInMl(2, "5ML"), 10);
  });

  test("3 vials × 10ML = 30", () => {
    assert.equal(quantityInMl(3, "10ML"), 30);
  });

  test("throws GreenwichValidationError(quantity) on zero vial count", () => {
    assert.throws(
      () => quantityInMl(0, "5ML"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "quantity",
    );
  });

  test("throws GreenwichValidationError(quantity) on negative vial count", () => {
    assert.throws(
      () => quantityInMl(-1, "5ML"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "quantity",
    );
  });

  test("throws GreenwichValidationError(quantity) on non-integer vial count", () => {
    assert.throws(
      () => quantityInMl(1.5, "5ML"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "quantity",
    );
  });

  test("throws GreenwichValidationError(quantity) on capsule vial size", () => {
    assert.throws(
      () => quantityInMl(1, "1EA"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "quantity",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. daysSupplyFromVialCount
// ─────────────────────────────────────────────────────────────────────────────

describe("daysSupplyFromVialCount", () => {
  test("1 vial = 28 days", () => {
    assert.equal(daysSupplyFromVialCount(1), 28);
  });

  test("2 vials = 56 days", () => {
    assert.equal(daysSupplyFromVialCount(2), 56);
  });

  test("3 vials = 84 days", () => {
    assert.equal(daysSupplyFromVialCount(3), 84);
  });

  test("throws GreenwichValidationError(daysSupply) on 0 vials", () => {
    assert.throws(
      () => daysSupplyFromVialCount(0),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "daysSupply",
    );
  });

  test("throws GreenwichValidationError(daysSupply) on 4 vials", () => {
    assert.throws(
      () => daysSupplyFromVialCount(4),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "daysSupply",
    );
  });

  test("throws GreenwichValidationError(daysSupply) on non-integer", () => {
    assert.throws(
      () => daysSupplyFromVialCount(1.5),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "daysSupply",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. formatBillToNote
// ─────────────────────────────────────────────────────────────────────────────

describe("formatBillToNote", () => {
  test("prefixes the clinic name with 'Bill to '", () => {
    assert.equal(formatBillToNote("AIM Rx"), "Bill to AIM Rx");
  });

  test("trims surrounding whitespace", () => {
    assert.equal(formatBillToNote("  ABCD Med Spa, LLC  "), "Bill to ABCD Med Spa, LLC");
  });

  test("throws GreenwichValidationError(notes) on empty string", () => {
    assert.throws(
      () => formatBillToNote(""),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "notes",
    );
  });

  test("throws GreenwichValidationError(notes) on null", () => {
    assert.throws(
      () => formatBillToNote(null),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "notes",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. truncateZip
// ─────────────────────────────────────────────────────────────────────────────

describe("truncateZip", () => {
  test("returns 5-digit zip unchanged", () => {
    assert.equal(truncateZip("12345"), "12345");
  });

  test("truncates ZIP+4 with hyphen", () => {
    assert.equal(truncateZip("12345-6789"), "12345");
  });

  test("truncates 9-digit zip with no separator", () => {
    assert.equal(truncateZip("123456789"), "12345");
  });

  test("strips non-digit characters before truncating", () => {
    assert.equal(truncateZip("12345 6789"), "12345");
  });

  test("throws on fewer than 5 digits", () => {
    assert.throws(
      () => truncateZip("123"),
      (e: unknown) =>
        e instanceof GreenwichValidationError && e.field === "zip",
    );
  });

  test("throws on null input", () => {
    assert.throws(
      () => truncateZip(null),
      (e: unknown) => e instanceof GreenwichValidationError,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. formatPhoneForDigitalRx (deprecated path)
// ─────────────────────────────────────────────────────────────────────────────

describe("formatPhoneForDigitalRx", () => {
  test("returns 10-digit phone unchanged", () => {
    assert.equal(formatPhoneForDigitalRx("5551234567"), "5551234567");
  });

  test("strips leading 1 from 11-digit US phone", () => {
    assert.equal(formatPhoneForDigitalRx("15551234567"), "5551234567");
  });

  test("strips formatting punctuation before validating", () => {
    assert.equal(formatPhoneForDigitalRx("(555) 123-4567"), "5551234567");
  });

  test("returns empty string for null/empty input", () => {
    assert.equal(formatPhoneForDigitalRx(null), "");
    assert.equal(formatPhoneForDigitalRx(""), "");
  });

  test("returns empty string for unexpected digit count", () => {
    assert.equal(formatPhoneForDigitalRx("123"), "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. formatDobForDigitalRx (deprecated path — kept for backward-compat)
// ─────────────────────────────────────────────────────────────────────────────

describe("formatDobForDigitalRx", () => {
  test("returns YYYY-MM-DD when given valid YYYY-MM-DD", () => {
    assert.equal(formatDobForDigitalRx("1991-12-31"), "1991-12-31");
  });

  test("returns empty string for unrecognized format", () => {
    assert.equal(formatDobForDigitalRx("12/31/1991"), "");
  });

  test("returns empty string for null/empty input", () => {
    assert.equal(formatDobForDigitalRx(null), "");
    assert.equal(formatDobForDigitalRx(""), "");
  });
});
