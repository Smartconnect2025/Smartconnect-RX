/**
 * Money parsing helpers.
 *
 * Postgres `numeric` columns (like `patient_price`) are serialized by
 * supabase-js as STRINGS to preserve precision — but downstream code
 * frequently does arithmetic on them, which silently does string
 * concatenation instead of addition. This caused the Group Total
 * display bug ($25.50 instead of $569.50) on the admin Medication
 * Details modal during the May 1 2026 Greenwich/Rahmany incident.
 *
 * Always coerce money fields through these helpers before any
 * arithmetic. Always do sums in integer cents to avoid floating-point
 * drift. Convert back to dollars only at the display layer.
 */

/**
 * Coerce a money-shaped value (number, numeric-string, or nullish)
 * into a number-of-DOLLARS. Returns 0 for null/undefined/NaN inputs.
 */
export function toMoneyNumber(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Coerce a money-shaped value (number-of-DOLLARS, numeric-string, or
 * nullish) into integer CENTS for safe summation. Returns 0 for
 * null/undefined/NaN inputs.
 *
 * Use this for `patient_price` / `patientPrice` style fields stored
 * as dollar amounts (numeric column).
 */
export function dollarsToCents(value: unknown): number {
  return Math.round(toMoneyNumber(value) * 100);
}

/**
 * Coerce a value already expressed in CENTS (number, integer-string,
 * or nullish) into integer CENTS. Returns 0 for null/undefined/NaN.
 *
 * Use this for `shipping_fee_cents` / `profit_cents` style fields
 * already stored as integer cents.
 */
export function centsToCents(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Render integer cents as a `$X.XX` display string.
 */
export function formatCents(cents: number | null | undefined): string {
  return `$${(centsToCents(cents) / 100).toFixed(2)}`;
}

/**
 * Render dollars (number or numeric-string) as a `$X.XX` display string.
 */
export function formatDollars(dollars: unknown): string {
  return `$${toMoneyNumber(dollars).toFixed(2)}`;
}
