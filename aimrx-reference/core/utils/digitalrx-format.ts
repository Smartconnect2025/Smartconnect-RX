/**
 * Greenwich-compliant formatting helpers for DigitalRx submission.
 *
 * All functions are pure and side-effect free, suitable for sharing
 * between the submit-to-pharmacy route and the prescription PDF renderer.
 *
 * Validation policy: fail-loud. Functions throw GreenwichValidationError
 * on invalid input so the route can return a 422 with field-level detail
 * rather than shipping a malformed script that Greenwich will silently reject.
 */

export class GreenwichValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(`[${field}] ${message}`);
    this.name = "GreenwichValidationError";
    this.field = field;
  }
}

const TWO_SPACES = "  ";
const DEFAULT_CLINIC_PREFIX = "AIM";

/**
 * Shared Greenwich identity constants. Imported by:
 *   - app/api/prescriptions/[id]/submit-to-pharmacy/route.ts (server submission)
 *   - app/(features)/prescriptions/new/step3/page.tsx (wizard PDF generation)
 *   - core/cron/jobs/refill-check.ts (cron PDF generation)
 *
 * Keeping these in one place ensures the visible PDF and the outbound API
 * payload always describe the same Greenwich pharmacy / clinic.
 */
export const GREENWICH_PHARMACY_ID = "59623278-013e-407f-96af-b164144bdbc7";
export const GREENWICH_STORE_ID = "190190";
export const GREENWICH_CLINIC_NAME = "AIM Rx";

/**
 * Returns true when the given pharmacy_id is the Greenwich pharmacy.
 *
 * The submit route additionally verifies the backend store_id; PDF callers
 * (which run before submission) only have pharmacy_id, so this lighter check
 * is sufficient for choosing the visual format.
 */
export function isGreenwichPharmacy(pharmacyId: string | null | undefined): boolean {
  return pharmacyId === GREENWICH_PHARMACY_ID;
}

/**
 * Prepends the clinic prefix and exactly two ASCII spaces to a clean drug name.
 *
 * Greenwich rule: "Drug Name with Clinic Prefix should have 2 spaces between.
 * NO special characters IE -. Example: AIM TB-500 3mg/5mL".
 *
 * Idempotent: if cleanName already begins with the prefix (with one or more
 * spaces or nothing after it), the existing prefix is stripped before
 * re-applying the canonical "PREFIX  " form.
 */
export function formatDrugNameWithPrefix(
  cleanName: string,
  clinicPrefix: string = DEFAULT_CLINIC_PREFIX,
): string {
  if (typeof cleanName !== "string") {
    throw new GreenwichValidationError(
      "drugName",
      `Expected string, got ${typeof cleanName}`,
    );
  }
  const trimmed = cleanName.trim();
  if (!trimmed) {
    throw new GreenwichValidationError("drugName", "Drug name is empty");
  }
  if (!clinicPrefix || !clinicPrefix.trim()) {
    throw new GreenwichValidationError("drugName", "Clinic prefix is empty");
  }

  const prefix = clinicPrefix.trim();
  const prefixRegex = new RegExp(`^${escapeRegExp(prefix)}\\s+`, "i");
  const stripped = trimmed.replace(prefixRegex, "").trim();

  return `${prefix}${TWO_SPACES}${stripped}`;
}

/**
 * Returns a date as MM/DD/YYYY (zero-padded), Greenwich's required format
 * for both Date Written and Patient DOB. Throws on invalid input.
 *
 * Accepts:
 *   - Date object
 *   - ISO date string ("YYYY-MM-DD" or full ISO with time)
 *   - Already-formatted "MM/DD/YYYY" or "M/D/YYYY" (idempotent)
 *
 * Timezone-safe for date-only strings: "1991-12-31" always returns
 * "12/31/1991" regardless of server timezone.
 */
export function formatDateMMDDYYYY(input: Date | string | null | undefined): string {
  const { y, m, d } = parseToYMD(input);
  validateYMD(y, m, d);
  return `${pad2(m)}/${pad2(d)}/${y}`;
}

/**
 * Greenwich requires Patient DOB in MM/DD/YYYY (no dashes). Thin wrapper
 * around formatDateMMDDYYYY for call-site clarity.
 */
export function formatPatientDOB(dob: Date | string | null | undefined): string {
  try {
    return formatDateMMDDYYYY(dob);
  } catch (err) {
    if (err instanceof GreenwichValidationError) {
      // Re-tag the field for clearer route-level error messages.
      throw new GreenwichValidationError("patientDob", err.message.replace(/^\[date\]\s*/, ""));
    }
    throw err;
  }
}

/**
 * Parses a vial size string like "5ML", "10ML", "1ML", "2ML" and returns
 * the numeric mL volume. Returns null for capsule forms ("1EA", "30ea")
 * because their quantity is computed differently and is not a Greenwich
 * "vial mL" concept.
 *
 * Throws on truly malformed input (e.g. "five ml", empty string).
 */
export function vialMlFromVialSize(vialSize: string | null | undefined): number | null {
  if (vialSize == null) {
    throw new GreenwichValidationError("vialSize", "Vial size is null/undefined");
  }
  if (typeof vialSize !== "string") {
    throw new GreenwichValidationError(
      "vialSize",
      `Expected string, got ${typeof vialSize}`,
    );
  }
  const trimmed = vialSize.trim();
  if (!trimmed) {
    throw new GreenwichValidationError("vialSize", "Vial size is empty");
  }

  // Capsule / per-unit forms are not vial-mL.
  if (/^\d+\s*ea$/i.test(trimmed)) {
    return null;
  }

  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (!m) {
    throw new GreenwichValidationError(
      "vialSize",
      `Unrecognized vial size format: "${vialSize}"`,
    );
  }

  const ml = parseFloat(m[1]);
  if (!Number.isFinite(ml) || ml <= 0) {
    throw new GreenwichValidationError(
      "vialSize",
      `Vial size must be a positive number: "${vialSize}"`,
    );
  }
  return ml;
}

/**
 * Greenwich Qty rule: "Quantity should reflect mL — not # of vials ordered".
 * For an injectable, Qty = vialCount * vialMl.
 *
 * Throws if the vial size is not an injectable mL form (capsule rows must
 * use a different quantity convention and should not call this helper).
 */
export function quantityInMl(vialCount: number, vialSize: string): number {
  if (!Number.isInteger(vialCount) || vialCount < 1) {
    throw new GreenwichValidationError(
      "quantity",
      `Vial count must be a positive integer, got ${vialCount}`,
    );
  }
  const ml = vialMlFromVialSize(vialSize);
  if (ml == null) {
    throw new GreenwichValidationError(
      "quantity",
      `quantityInMl called for non-injectable vial size "${vialSize}". Capsule quantities must be computed by the caller.`,
    );
  }
  return vialCount * ml;
}

/**
 * Greenwich Days Supply rule: "28 days (1 month script), 56 days (2 months
 * script), 84 days (3 months script)". Mapping is purely vial-count-based.
 */
export function daysSupplyFromVialCount(vialCount: number): 28 | 56 | 84 {
  if (!Number.isInteger(vialCount)) {
    throw new GreenwichValidationError(
      "daysSupply",
      `Vial count must be an integer, got ${vialCount}`,
    );
  }
  switch (vialCount) {
    case 1:
      return 28;
    case 2:
      return 56;
    case 3:
      return 84;
    default:
      throw new GreenwichValidationError(
        "daysSupply",
        `Vial count must be 1, 2, or 3 (Greenwich supports 28/56/84-day scripts only), got ${vialCount}`,
      );
  }
}

/**
 * Classifies a catalog row's `form` field into the Greenwich routing bucket.
 * Throws on unknown / empty forms so the route returns a clean 422 instead
 * of silently dropping a script.
 *
 * Recognized buckets:
 *   - "injection" — form contains "inject" (existing mL-vial path)
 *   - "capsule"   — form contains "caps" (oral per-unit path)
 *   - "tablet"    — form contains "tab" (oral pre-packaged path)
 */
export function classifyDosageForm(
  form: string | null | undefined,
): "injection" | "capsule" | "tablet" {
  if (typeof form !== "string") {
    throw new GreenwichValidationError(
      "form",
      `Expected string form, got ${typeof form}`,
    );
  }
  const lower = form.trim().toLowerCase();
  if (!lower) {
    throw new GreenwichValidationError("form", "Catalog form is empty");
  }
  if (lower.includes("inject")) return "injection";
  if (lower.includes("caps")) return "capsule";
  if (lower.includes("tab")) return "tablet";
  throw new GreenwichValidationError(
    "form",
    `Unrecognized dosage form: "${form}" (expected Injection / Capsule / Tablet)`,
  );
}

/**
 * Greenwich oral (capsule/tablet) Quantity rule — INTERIM best-guess pending
 * Laci's confirmation. Returns the total unit count (e.g. number of capsules
 * or tablets) the patient receives.
 *
 * Vial-size conventions used here:
 *   - "1EA"   → per-unit SKU (capsule rows). prescriptionQty is treated as a
 *               month count, expanded to 30 units per month (1/2/3 → 30/60/90)
 *               to mirror the injectable 1/2/3-vial cadence.
 *   - "<N>EA" → pre-packaged SKU (e.g. Ondansetron 30EA). Returns
 *               prescriptionQty * N units.
 *
 * If Greenwich confirms a different rule, change ONLY this function.
 */
export function quantityForOral(
  prescriptionQty: number,
  vialSize: string,
): number {
  if (!Number.isInteger(prescriptionQty) || prescriptionQty < 1) {
    throw new GreenwichValidationError(
      "quantity",
      `Prescription quantity must be a positive integer, got ${prescriptionQty}`,
    );
  }
  if (typeof vialSize !== "string") {
    throw new GreenwichValidationError(
      "vialSize",
      `Expected string vial_size, got ${typeof vialSize}`,
    );
  }
  const trimmed = vialSize.trim();
  if (!trimmed) {
    throw new GreenwichValidationError("vialSize", "Vial size is empty");
  }
  const m = trimmed.match(/^(\d+)\s*ea$/i);
  if (!m) {
    throw new GreenwichValidationError(
      "vialSize",
      `Unrecognized oral vial_size format: "${vialSize}" (expected e.g. "1EA" or "30EA")`,
    );
  }
  const unitsPerPackage = parseInt(m[1], 10);
  if (!Number.isFinite(unitsPerPackage) || unitsPerPackage < 1) {
    throw new GreenwichValidationError(
      "vialSize",
      `Oral vial_size must contain a positive unit count: "${vialSize}"`,
    );
  }
  // Per-unit catalog row → expand by 30 units/month convention.
  if (unitsPerPackage === 1) {
    return prescriptionQty * 30;
  }
  // Pre-packaged row → straight multiplier.
  return prescriptionQty * unitsPerPackage;
}

/**
 * Greenwich oral DaysSupply rule — INTERIM best-guess pending Laci's
 * confirmation. Mirrors the injectable 28/56/84 cadence in 30/60/90-day
 * buckets (oral SIGs are once-daily or PRN; 30/60/90 is the standard
 * mail-order pharmacy convention).
 */
export function daysSupplyForOral(
  prescriptionQty: number,
): 30 | 60 | 90 {
  if (!Number.isInteger(prescriptionQty)) {
    throw new GreenwichValidationError(
      "daysSupply",
      `Prescription quantity must be an integer, got ${prescriptionQty}`,
    );
  }
  switch (prescriptionQty) {
    case 1:
      return 30;
    case 2:
      return 60;
    case 3:
      return 90;
    default:
      throw new GreenwichValidationError(
        "daysSupply",
        `Oral prescription quantity must be 1, 2, or 3 (Greenwich supports 30/60/90-day scripts only), got ${prescriptionQty}`,
      );
  }
}

/**
 * Greenwich Notes rule: 'This should say Bill to (clinic name).
 * Example: Bill to ABCD Med Spa, LLC'.
 */
export function formatBillToNote(clinicName: string | null | undefined): string {
  if (typeof clinicName !== "string") {
    throw new GreenwichValidationError(
      "notes",
      `Expected clinic name string, got ${typeof clinicName}`,
    );
  }
  const trimmed = clinicName.trim();
  if (!trimmed) {
    throw new GreenwichValidationError("notes", "Clinic name is empty");
  }
  return `Bill to ${trimmed}`;
}

/**
 * Greenwich Patient ZIP rule: "ONLY first 5 digits". Strips non-numeric
 * characters then takes the first five digits.
 */
export function truncateZip(zip: string | null | undefined): string {
  if (typeof zip !== "string") {
    throw new GreenwichValidationError(
      "zip",
      `Expected string, got ${typeof zip}`,
    );
  }
  const digits = zip.replace(/\D/g, "");
  if (digits.length < 5) {
    throw new GreenwichValidationError(
      "zip",
      `ZIP must contain at least 5 digits, got ${digits.length} from "${zip}"`,
    );
  }
  return digits.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing helpers — kept for backward compatibility with non-Greenwich code
// paths. Prefer the new fail-loud helpers above for any new Greenwich work.
// ─────────────────────────────────────────────────────────────────────────────

export function formatPhoneForDigitalRx(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  console.warn(`⚠️ [digitalrx-format] Phone number has unexpected digit count (${digits.length}): masked`);
  return "";
}

/**
 * @deprecated Outputs YYYY-MM-DD which does NOT meet Greenwich's MM/DD/YYYY
 * requirement. Use {@link formatPatientDOB} instead. Kept temporarily for any
 * non-Greenwich call sites until migration completes in Batch B.
 */
export function formatDobForDigitalRx(dob: string | null | undefined): string {
  if (!dob) return "";
  const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const year = parseInt(match[1], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      console.warn(`⚠️ [digitalrx-format] DOB has invalid date values: ${dob}`);
      return "";
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  console.warn(`⚠️ [digitalrx-format] DOB not in expected YYYY-MM-DD format: ${dob}`);
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function parseToYMD(input: Date | string | null | undefined): {
  y: number;
  m: number;
  d: number;
} {
  if (input == null) {
    throw new GreenwichValidationError("date", "Date is null/undefined");
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new GreenwichValidationError("date", "Invalid Date object");
    }
    // DB date columns serialize at UTC midnight; using UTC components avoids
    // timezone drift on the server.
    return {
      y: input.getUTCFullYear(),
      m: input.getUTCMonth() + 1,
      d: input.getUTCDate(),
    };
  }

  if (typeof input !== "string") {
    throw new GreenwichValidationError(
      "date",
      `Expected Date or string, got ${typeof input}`,
    );
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new GreenwichValidationError("date", "Date is empty");
  }

  // Already-formatted MM/DD/YYYY or M/D/YYYY (idempotent)
  let m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return {
      y: parseInt(m[3], 10),
      m: parseInt(m[1], 10),
      d: parseInt(m[2], 10),
    };
  }

  // YYYY-MM-DD optionally followed by time portion
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) {
    return {
      y: parseInt(m[1], 10),
      m: parseInt(m[2], 10),
      d: parseInt(m[3], 10),
    };
  }

  throw new GreenwichValidationError(
    "date",
    `Unrecognized date format: "${trimmed}" (expected MM/DD/YYYY or YYYY-MM-DD)`,
  );
}

function validateYMD(y: number, m: number, d: number): void {
  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    throw new GreenwichValidationError("date", `Year out of range: ${y}`);
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new GreenwichValidationError("date", `Month out of range: ${m}`);
  }
  if (!Number.isInteger(d) || d < 1 || d > 31) {
    throw new GreenwichValidationError("date", `Day out of range: ${d}`);
  }
  // Calendar-date round-trip: rejects impossible dates that pass the loose
  // 1–31 range check above, e.g. Feb 31, Apr 31, Feb 29 in non-leap years.
  // JS Date normalizes overflow days (Feb 31 → Mar 3), so any normalization
  // means the input was not a real calendar date.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    throw new GreenwichValidationError(
      "date",
      `Invalid calendar date: ${pad2(m)}/${pad2(d)}/${y}`,
    );
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
