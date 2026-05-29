/**
 * Sentry beforeSend scrubber — Trusted Device Step 10 / HIPAA hard rule.
 *
 * STATUS: Sentry is NOT currently installed in this project. This module
 * exists so the moment `@sentry/nextjs` is added, the redaction is
 * already in place and the maintainer just has to import + wire it.
 *
 * RULE (replit.md): the raw `aimrx_td` cookie value, the trust token,
 * and the raw fingerprint MUST NEVER appear in `system_logs`, console
 * logs, error messages, or Sentry events.
 *
 * USAGE (when Sentry is added):
 *
 *   // sentry.server.config.ts
 *   import * as Sentry from "@sentry/nextjs";
 *   import { sentryBeforeSend } from "@core/observability/sentry-scrubber";
 *
 *   Sentry.init({
 *     dsn: process.env.SENTRY_DSN,
 *     beforeSend: sentryBeforeSend,
 *     // Cookies are off by default in @sentry/nextjs server SDK, but
 *     // make this explicit:
 *     sendDefaultPii: false,
 *   });
 *
 * The same scrubber is safe to use for `beforeSendTransaction`.
 */

import { scrubTrustToken } from "@core/auth/scrub-trust-token";

const TRUST_COOKIE_NAME = "aimrx_td";

const SENSITIVE_KEYS = new Set([
  "fingerprint",
  "device_fingerprint",
  "deviceFingerprint",
  "fingerprint_hash",
  "token",
  "trust_token",
  "trustToken",
  "token_hash",
  "tokenHash",
  "cookieValue",
  "aimrx_td",
]);

/**
 * Walks a Sentry event payload and:
 *  1) drops the `aimrx_td` entry from event.request.cookies / headers
 *  2) redacts any value at any depth whose key is in SENSITIVE_KEYS
 *  3) runs every string value through scrubTrustToken so embedded raw
 *     tokens (e.g. inside a stacked error message) are masked
 *
 * The function is intentionally permissive on shape — Sentry event
 * payloads vary across SDK versions. Anything we don't recognize is
 * left alone.
 */
export function sentryBeforeSend<T>(event: T): T {
  if (!event || typeof event !== "object") return event;

  try {
    scrubInPlace(event as Record<string, unknown>, new WeakSet());
    stripTrustCookieFromRequest(event as Record<string, unknown>);
  } catch {
    // Never break Sentry on a scrubbing error — better to send a
    // partially-scrubbed event than nothing.
  }
  return event;
}

function scrubInPlace(
  node: Record<string, unknown>,
  seen: WeakSet<object>,
): void {
  if (seen.has(node)) return;
  seen.add(node);

  for (const key of Object.keys(node)) {
    const v = node[key];
    if (SENSITIVE_KEYS.has(key)) {
      node[key] = "[REDACTED:trust_token]";
      continue;
    }
    if (typeof v === "string") {
      node[key] = scrubTrustToken(v);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const item = v[i];
        if (typeof item === "string") {
          v[i] = scrubTrustToken(item);
        } else if (item && typeof item === "object") {
          scrubInPlace(item as Record<string, unknown>, seen);
        }
      }
    } else if (v && typeof v === "object") {
      scrubInPlace(v as Record<string, unknown>, seen);
    }
  }
}

function stripTrustCookieFromRequest(event: Record<string, unknown>): void {
  const req = event.request as Record<string, unknown> | undefined;
  if (!req) return;

  const cookies = req.cookies;
  if (cookies && typeof cookies === "object") {
    delete (cookies as Record<string, unknown>)[TRUST_COOKIE_NAME];
  }

  const headers = req.headers as Record<string, unknown> | undefined;
  if (headers && typeof headers["cookie"] === "string") {
    headers["cookie"] = (headers["cookie"] as string)
      .split(/;\s*/)
      .filter((p) => !p.toLowerCase().startsWith(`${TRUST_COOKIE_NAME}=`))
      .join("; ");
  }
  if (headers && typeof headers["Cookie"] === "string") {
    headers["Cookie"] = (headers["Cookie"] as string)
      .split(/;\s*/)
      .filter((p) => !p.toLowerCase().startsWith(`${TRUST_COOKIE_NAME}=`))
      .join("; ");
  }
}
