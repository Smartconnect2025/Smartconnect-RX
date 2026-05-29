/**
 * Static leak checker — Trusted Device Step 10.
 *
 * Fails (non-zero exit) if any trusted-device code path looks like it
 * could log a raw trust token, raw `aimrx_td` cookie value, or raw
 * fingerprint.
 *
 * Run with: `npx tsx scripts/verify-no-trust-token-leak.ts`
 *
 * The .husky/pre-push gate runs `npm run build`; this script is meant
 * to be run alongside it (and can also be wired into CI).
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const FILES_TO_SCAN = [
  "core/auth/trusted-device.ts",
  "core/audit/trusted-device-audit.ts",
  "core/auth/scrub-trust-token.ts",
  "core/observability/sentry-scrubber.ts",
  "app/api/auth/mfa/trust-check/route.ts",
  "app/api/auth/mfa/complete/route.ts",
  "app/api/auth/trusted-devices/route.ts",
  "app/api/auth/trusted-devices/[id]/route.ts",
  "app/api/auth/trusted-devices/revoke-others/route.ts",
];

const RAW_VARS = [
  "cookieValue",
  "trustToken",
  "rawToken",
  "rawFingerprint",
  "rawCookie",
];

const SCRUBBER_FILES = new Set([
  "core/auth/scrub-trust-token.ts",
  "core/observability/sentry-scrubber.ts",
  "scripts/verify-no-trust-token-leak.ts",
]);

let failures = 0;
function fail(file: string, line: number, why: string, snippet: string): void {
  failures++;
  const where = line > 0 ? `${file}:${line}` : file;
  console.error(`\n  ✗ ${where}\n    ${why}\n    > ${snippet.trim()}`);
}

/** Convert an absolute character offset into a 1-based line number. */
function offsetToLine(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Strip // line comments and /* block * / comments to avoid false positives. */
function stripComments(src: string): string {
  // Block comments
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  // Line comments
  out = out.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  return out;
}

/** Match a balanced (...) starting at the open paren index, return inside. */
function readBalancedArgs(src: string, openIdx: number): string | null {
  if (src[openIdx] !== "(") return null;
  let depth = 0;
  let inStr: string | null = null;
  let inTpl = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const prev = i > 0 ? src[i - 1] : "";
    if (inStr) {
      if (c === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (inTpl > 0) {
      if (c === "`" && prev !== "\\") inTpl--;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === "`") {
      inTpl++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

function rawVarRegex(name: string): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`);
}

function check(file: string, rawSrc: string): void {
  if (SCRUBBER_FILES.has(file)) return;

  const src = stripComments(rawSrc);

  // ---- console.* calls (multi-line aware) ----
  const consoleRe = /console\.(log|error|warn|info)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = consoleRe.exec(src)) !== null) {
    const openIdx = consoleRe.lastIndex - 1;
    const args = readBalancedArgs(src, openIdx);
    if (!args) continue;
    for (const v of RAW_VARS) {
      if (rawVarRegex(v).test(args)) {
        fail(
          file,
          offsetToLine(src, openIdx),
          `console.${m[1]}(...) references raw '${v}' across its argument block — must hash or scrub first`,
          args.replace(/\s+/g, " ").slice(0, 120),
        );
      }
    }
  }

  // ---- new Error(...) calls (multi-line aware) ----
  const errRe = /new\s+Error\s*\(/g;
  while ((m = errRe.exec(src)) !== null) {
    const openIdx = errRe.lastIndex - 1;
    const args = readBalancedArgs(src, openIdx);
    if (!args) continue;
    for (const v of RAW_VARS) {
      const tplRe = new RegExp(`\\$\\{[^}]*\\b${v}\\b[^}]*\\}`);
      if (tplRe.test(args) || rawVarRegex(v).test(args)) {
        fail(
          file,
          offsetToLine(src, openIdx),
          `new Error(...) references raw '${v}' — would leak via stack/message`,
          args.replace(/\s+/g, " ").slice(0, 120),
        );
      }
    }
  }

  // ---- detailsExtra: { ... } object literal (multi-line aware) ----
  const detailsRe = /detailsExtra\s*:\s*\{/g;
  while ((m = detailsRe.exec(src)) !== null) {
    const openBrace = detailsRe.lastIndex - 1;
    // Match balanced { ... }
    let depth = 0;
    let endIdx = openBrace;
    for (let i = openBrace; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    const body = src.slice(openBrace + 1, endIdx);
    for (const v of RAW_VARS) {
      if (rawVarRegex(v).test(body)) {
        fail(
          file,
          offsetToLine(src, openBrace),
          `detailsExtra references raw '${v}' — would land in system_logs row`,
          body.replace(/\s+/g, " ").slice(0, 120),
        );
      }
    }
  }

  if (file === "core/audit/trusted-device-audit.ts") {
    // Audit helper must never insert a column whose name screams "secret".
    if (/\btoken_hash\s*:/.test(src) || /\b(trust_token|raw_token)\s*:/.test(src)) {
      fail(file, 0, "audit helper appears to write a token-shaped column", "");
    }
  }
}

console.log("Scanning trusted-device code paths for raw-token leaks...\n");

for (const rel of FILES_TO_SCAN) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`  ! skipping missing file: ${rel}`);
    continue;
  }
  const src = fs.readFileSync(abs, "utf8");
  check(rel, src);
}

// Sanity checks on the scrubber itself.
import("../core/auth/scrub-trust-token.js")
  .catch(() => import("../core/auth/scrub-trust-token"))
  .then((mod: { scrubTrustToken: (v: unknown) => string }) => {
    const sample =
      "session blew up: aimrx_td=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd; user=joe";
    const scrubbed = mod.scrubTrustToken(sample);
    if (
      scrubbed.includes("AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd") ||
      !scrubbed.includes("[REDACTED:trust_token]")
    ) {
      fail("scrub-trust-token", 0, "sample token survived scrubbing", scrubbed);
    }

    // Step 11: multi-token cookie format `tokA.tokB.tokC`. Period is
    // outside the base64url alphabet so each 43-char segment must be
    // independently redacted, AND the `aimrx_td=...` cookie-prefix
    // form must redact the entire dotted value (we don't want even
    // the structure of the list leaking).
    // Real trust tokens are EXACTLY 43 base64url chars
    // (crypto.randomBytes(32).toString("base64url")). Build two
    // realistic-shape segments to exercise the multi-token path.
    const tokA = "A".repeat(20) + "a".repeat(20) + "_-A"; // 43 chars
    const tokB = "B".repeat(20) + "b".repeat(20) + "_-C"; // 43 chars
    if (tokA.length !== 43 || tokB.length !== 43) {
      fail("scrub-trust-token", 0, "test fixture wrong length", `${tokA.length}/${tokB.length}`);
    }
    const multiSample = `cookie=aimrx_td=${tokA}.${tokB}; foo=bar`;
    const multiScrubbed = mod.scrubTrustToken(multiSample);
    if (
      multiScrubbed.includes(tokA) ||
      multiScrubbed.includes(tokB) ||
      !multiScrubbed.includes("[REDACTED:trust_token]")
    ) {
      fail(
        "scrub-trust-token",
        0,
        "multi-token cookie value survived scrubbing",
        multiScrubbed,
      );
    }
    // The bare multi-token form (no `aimrx_td=` prefix) — each segment
    // must still be caught by the generic base64url rule. Period is
    // outside the base64url alphabet so it acts as a token boundary.
    const bareMulti = `leaked: ${tokA}.${tokB}`;
    const bareScrubbed = mod.scrubTrustToken(bareMulti);
    if (bareScrubbed.includes(tokA) || bareScrubbed.includes(tokB)) {
      fail(
        "scrub-trust-token",
        0,
        "bare multi-token list survived scrubbing",
        bareScrubbed,
      );
    }

    // Negative checks: must NOT redact UUIDs or SHA-256 hex.
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    if (mod.scrubTrustToken(`uid=${uuid} ok`).includes("[REDACTED")) {
      fail("scrub-trust-token", 0, "UUID was over-redacted", uuid);
    }
    const sha = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    if (mod.scrubTrustToken(`hash=${sha} ok`).includes("[REDACTED")) {
      fail("scrub-trust-token", 0, "SHA-256 hex hash was over-redacted", sha);
    }

    if (failures > 0) {
      console.error(`\n${failures} leak risk(s) found. Fix before pushing.\n`);
      process.exit(1);
    }
    console.log(
      `\n✓ No raw-token leak risks found in ${FILES_TO_SCAN.length} files. Scrubber sanity OK.\n`,
    );
  })
  .catch((err: unknown) => {
    console.error("Could not load scrubber for sanity check:", err);
    process.exit(1);
  });
