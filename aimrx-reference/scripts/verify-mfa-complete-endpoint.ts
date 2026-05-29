/**
 * Smoke test for /api/auth/mfa/complete (Step 4 of 14 — Trusted Device).
 *
 * Validates that the route file exists, exports a POST handler, and that
 * the supporting session-finalize helper exports the expected surface.
 * This is a static-analysis test — does not hit a live HTTP server.
 *
 * Usage: npx tsx scripts/verify-mfa-complete-endpoint.ts
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const routePath = resolve(ROOT, "app/api/auth/mfa/complete/route.ts");
const helperPath = resolve(ROOT, "core/auth/session-finalize.ts");
const trustedDevicePath = resolve(ROOT, "core/auth/trusted-device.ts");

check("route file exists", existsSync(routePath), routePath);
check("session-finalize helper exists", existsSync(helperPath), helperPath);
check("trusted-device helper exists", existsSync(trustedDevicePath));

if (existsSync(routePath)) {
  const src = readFileSync(routePath, "utf8");
  check("exports POST handler", /export\s+async\s+function\s+POST/.test(src));
  check(
    "supports email_code method",
    src.includes("email_code") && src.includes("verifyMFACode"),
  );
  check(
    "supports totp method",
    src.includes('"totp"') &&
      src.includes("getAuthenticatorAssuranceLevel"),
  );
  check(
    "supports recovery_code method",
    src.includes("recovery_code") &&
      src.includes("consume_mfa_recovery_code"),
  );
  check(
    "creates trusted device when rememberDevice is true",
    src.includes("if (rememberDevice)") &&
      src.includes("createTrustedDevice"),
  );
  check(
    "fingerprint computed server-side (NOT trusted from request body)",
    src.includes("prepareDeviceFingerprint") &&
      !/createTrustedDevice\([^)]*fingerprint:\s*body\.fingerprint/.test(src) &&
      !/fingerprint:\s*body\.fingerprint/.test(src),
  );
  check(
    "client `fingerprint` field accepted in request schema (back-compat)",
    /fingerprint\??\s*:\s*z?\.?\s*string\(\)?\s*\.?optional\(\)?/.test(src) ||
      /fingerprint\?:\s*string/.test(src),
  );
  check(
    "client `fingerprint` body value never reaches createTrustedDevice",
    !/createTrustedDevice\([^)]*body\.fingerprint/.test(src) &&
      !/fingerprint:\s*body\.fingerprint/.test(src),
  );
  check(
    "trusted-device failure does not abort MFA success",
    /trusted-device create failed[\s\S]{0,600}?\}\s*\n\s*\}/.test(src),
  );
  check(
    "aimrx_dvc setter invocation only triggered inside rememberDevice branch",
    /if \(rememberDevice\)[\s\S]{0,800}?prepareDeviceFingerprint/.test(src),
  );
  check(
    "single NextResponse construction in success path (no copying)",
    !src.includes("for (const c of response.cookies.getAll()") &&
      !src.includes("patched.cookies.set"),
  );
  check(
    "calls applyMfaFinishLineCookies + resolveSessionRole",
    src.includes("applyMfaFinishLineCookies") &&
      src.includes("resolveSessionRole"),
  );
  check(
    "returns role + redirect in JSON",
    src.includes("role") && src.includes("redirect"),
  );
  check(
    "builds ONE final response (no second NextResponse.json wrap)",
    (src.match(/NextResponse\.json\(/g) || []).length <= 4 &&
      !src.includes("headers: response.headers"),
  );
  check(
    "sets trust cookie on the response (not via next/headers cookies())",
    src.includes("setTrustCookieOnResponse"),
  );
}

if (existsSync(helperPath)) {
  const src = readFileSync(helperPath, "utf8");
  check(
    "session-finalize exports resolveSessionRole",
    /export\s+async\s+function\s+resolveSessionRole/.test(src),
  );
  check(
    "session-finalize exports applyMfaFinishLineCookies",
    /export\s+async\s+function\s+applyMfaFinishLineCookies/.test(src),
  );
  check("session-finalize sets totp_verified", src.includes("totp_verified"));
  check("session-finalize clears mfa_pending", src.includes("mfa_pending"));
  check(
    "session-finalize role-default for admin",
    src.includes('"/admin"') && src.includes("admin"),
  );
  check(
    "session-finalize role-default for provider",
    src.includes('"/prescriptions"'),
  );
  check(
    "session-finalize rejects open redirects",
    /startsWith\(['"]\/\/['"]\)/.test(src),
  );
}

let allOk = true;
for (const c of checks) {
  const status = c.ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  if (!c.ok) allOk = false;
}

if (!allOk) {
  console.error(`\n${checks.filter((c) => !c.ok).length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
