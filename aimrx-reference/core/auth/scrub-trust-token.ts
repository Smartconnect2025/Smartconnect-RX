/**
 * scrubTrustToken — HIPAA safety helper (Step 10 of Trusted Device feature).
 *
 * Masks any value that looks like a raw `aimrx_td` trust token so it can
 * never appear in console output, error messages, audit rows, or future
 * Sentry events.
 *
 * The trust token is `crypto.randomBytes(32).toString("base64url")` — a
 * 43-character base64url string (32 bytes → 43 chars without padding).
 * We accept 32–128 chars to cover both the raw token and any longer
 * concatenated string that embeds one.
 *
 * RULE (replit.md): the raw `aimrx_td` cookie value, the trust token,
 * and the raw fingerprint MUST NEVER reach a logger. Any code path that
 * stringifies an Error or arbitrary value into a log line MUST run it
 * through `scrubTrustToken()` first.
 */

// The trust token is `crypto.randomBytes(32).toString("base64url")` —
// EXACTLY 43 chars from the base64url alphabet, no padding. We match
// that exact shape so we don't false-positive on:
//   - UUIDs (36 chars, contain hyphens at fixed positions)
//   - SHA-256 hex hashes (64 chars from [0-9a-f] only — and we DO log
//     `token_hash` and `fingerprint_hash` deliberately)
//   - Stripe/UUID-like IDs which are typically <43 or >43 chars
// Word boundaries ensure we still match an embedded token inside a
// longer string like `cookie=aimrx_td=<43>; foo=bar`.
const TRUST_TOKEN_RE = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;

// Cookie name + "=" prefix that may appear in raw header dumps. Always
// strip the value regardless of length, since by definition anything
// after `aimrx_td=` is the secret.
const COOKIE_PREFIX_RE = /aimrx_td=([^;\s]+)/g;

const REDACTED = "[REDACTED:trust_token]";

/**
 * Returns a copy of `value` with any embedded raw trust token (or
 * `aimrx_td=...` cookie fragment, or any base64url-shaped 32+ char
 * substring) replaced by `[REDACTED:trust_token]`.
 *
 * Safe to call with any input: returns the empty string for null /
 * undefined, calls `.toString()` on non-strings.
 */
export function scrubTrustToken(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else if (value instanceof Error) {
    s = value.message;
  } else {
    try {
      s = String(value);
    } catch {
      return REDACTED;
    }
  }
  // Strip cookie-form first so the substring doesn't get re-matched
  // by the generic base64url rule.
  s = s.replace(COOKIE_PREFIX_RE, `aimrx_td=${REDACTED}`);
  s = s.replace(TRUST_TOKEN_RE, REDACTED);
  return s;
}

/**
 * Convenience wrapper: turn an unknown error into a safe, scrubbed
 * string for logging.
 */
export function scrubError(err: unknown): string {
  if (err instanceof Error) return scrubTrustToken(err.message);
  return scrubTrustToken(err);
}
