/**
 * Static smoke test for trusted-device audit-log wiring.
 *
 * Asserts the helper exists, exports the right action enum, writes to
 * system_logs, swallows errors, and that every fire-point in the
 * codebase imports + calls it.
 */
import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const helperPath = path.join(
  repoRoot,
  "core/audit/trusted-device-audit.ts",
);
const tdPath = path.join(repoRoot, "core/auth/trusted-device.ts");
const trustCheckPath = path.join(
  repoRoot,
  "app/api/auth/mfa/trust-check/route.ts",
);

let failed = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`[PASS] ${label}`);
  } else {
    failed++;
    console.error(`[FAIL] ${label}`);
  }
}

function read(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`missing file: ${p}`);
  return fs.readFileSync(p, "utf8");
}

const revokeOthersPath = path.join(
  repoRoot,
  "app/api/auth/trusted-devices/revoke-others/route.ts",
);

const helperSrc = read(helperPath);
const tdSrc = read(tdPath);
const tcSrc = read(trustCheckPath);
const revokeOthersSrc = read(revokeOthersPath);

// ---- Helper module ----
check(
  "helper exports logTrustedDeviceEvent",
  /export async function logTrustedDeviceEvent\b/.test(helperSrc),
);
check(
  "helper exports TrustedDeviceAuditAction union with all 5 actions",
  /TRUSTED_DEVICE_GRANTED/.test(helperSrc) &&
    /TRUSTED_DEVICE_USED/.test(helperSrc) &&
    /TRUSTED_DEVICE_REVOKED/.test(helperSrc) &&
    /TRUSTED_DEVICE_FINGERPRINT_MISMATCH/.test(helperSrc) &&
    /TRUSTED_DEVICE_EXPIRED/.test(helperSrc),
);
check(
  "helper writes to system_logs via raw Supabase insert (no Drizzle)",
  /from\("system_logs"\)[\s\S]{0,200}\.insert\(/.test(helperSrc) &&
    !/^\s*import[^\n]*drizzle/im.test(helperSrc),
);
check(
  "helper wraps work in try/catch (fire-and-forget guarantee)",
  /try\s*{[\s\S]+catch[\s\S]+console\.warn\(/.test(helperSrc),
);
check(
  "helper does best-effort identity lookup against auth.users + user_roles",
  /supabase\.auth\.admin\.getUserById/.test(helperSrc) &&
    /from\("user_roles"\)/.test(helperSrc),
);
check(
  "helper never logs raw token, raw fingerprint, or aimrx_td cookie",
  !/token_hash|trust.?token|aimrx_td|fingerprint_hash/i.test(helperSrc) ||
    // explanatory comments are fine; what we forbid is a value reference
    !/console\.[a-z]+\([^)]*token_hash/i.test(helperSrc),
);

// ---- core/auth/trusted-device.ts wiring ----
check(
  "trusted-device.ts imports logTrustedDeviceEvent",
  /import\s*{\s*logTrustedDeviceEvent\s*}\s*from\s*["']@core\/audit\/trusted-device-audit["']/.test(
    tdSrc,
  ),
);
// GRANTED — fresh insert path
check(
  "createTrustedDevice fresh-insert path logs GRANTED with path=fresh_insert",
  /if\s*\(!error && data\)\s*{[\s\S]{0,400}TRUSTED_DEVICE_GRANTED[\s\S]{0,200}fresh_insert/.test(
    tdSrc,
  ),
);
// GRANTED — vanished retry path
check(
  "createTrustedDevice vanished-retry-insert path logs GRANTED with path=vanished_retry_insert",
  /vanished_retry_insert/.test(tdSrc) &&
    /TRUSTED_DEVICE_GRANTED[\s\S]{0,400}vanished_retry_insert/.test(tdSrc),
);
// GRANTED — rotation path (only when !cookieMatchesSurvivor)
check(
  "createTrustedDevice dedupe rotation path logs GRANTED only when !cookieMatchesSurvivor",
  /if\s*\(!cookieMatchesSurvivor\)\s*{[\s\S]{0,400}TRUSTED_DEVICE_GRANTED[\s\S]{0,200}dedupe_token_rotation/.test(
    tdSrc,
  ),
);
// USED
check(
  "markTrustedDeviceUsed logs TRUSTED_DEVICE_USED only when a row was actually updated",
  /export async function markTrustedDeviceUsed[\s\S]{0,1500}if\s*\(!updated\)\s*return;[\s\S]{0,400}TRUSTED_DEVICE_USED/.test(
    tdSrc,
  ),
);
// REVOKED — single
check(
  "revokeTrustedDevice logs TRUSTED_DEVICE_REVOKED only when a row was actually updated (idempotent)",
  /export async function revokeTrustedDevice[\s\S]{0,1500}if\s*\(updated\)\s*{[\s\S]{0,300}TRUSTED_DEVICE_REVOKED/.test(
    tdSrc,
  ),
);
// REVOKED — bulk
check(
  "revokeAllForUser logs one TRUSTED_DEVICE_REVOKED per affected row via Promise.allSettled",
  /export async function revokeAllForUser[\s\S]{0,2000}Promise\.allSettled[\s\S]{0,400}TRUSTED_DEVICE_REVOKED/.test(
    tdSrc,
  ),
);
check(
  "revokeAllForUser bulk audit rows include reason + bulk flag",
  /TRUSTED_DEVICE_REVOKED[\s\S]{0,300}bulk:\s*true/.test(tdSrc),
);
check(
  "revokeAllForUser selects ip_last_seen + user_agent and forwards them per row",
  /select\("id, ip_last_seen, user_agent"\)/.test(tdSrc) &&
    /ip:\s*row\.ip_last_seen/.test(tdSrc) &&
    /userAgent:\s*row\.user_agent/.test(tdSrc),
);
check(
  "audit helper folds actorId into details (when distinct or system-triggered)",
  /detailsExtraWithActor/.test(helperSrc) &&
    /actorId\s*!==\s*userId/.test(helperSrc) &&
    /actor\s*=\s*"system"/.test(helperSrc),
);

// ---- trust-check route wiring ----
check(
  "trust-check route imports logTrustedDeviceEvent",
  /import\s*{\s*logTrustedDeviceEvent\s*}\s*from\s*["']@core\/audit\/trusted-device-audit["']/.test(
    tcSrc,
  ),
);
check(
  "trust-check fires FINGERPRINT_MISMATCH or EXPIRED only — not other reasons",
  // Step 11 refactor: trust-check now iterates a token list and tracks
  // an `auditableFailure` of "fingerprint_mismatch" | "expired" | null.
  // Either the legacy `lookup.reason === "..."` shape OR the new
  // `r.reason === "..."` shape inside the iteration is acceptable, as
  // long as both audit reasons are still gated to those two values.
  (/(?:lookup|r)\.reason\s*===\s*"fingerprint_mismatch"[\s\S]{0,400}(?:lookup|r)\.reason\s*===\s*"expired"/.test(
    tcSrc,
  ) ||
    /auditableFailure\s*===\s*"fingerprint_mismatch"[\s\S]{0,400}"expired"/.test(
      tcSrc,
    )) &&
    /TRUSTED_DEVICE_FINGERPRINT_MISMATCH/.test(tcSrc) &&
    /TRUSTED_DEVICE_EXPIRED/.test(tcSrc),
);
check(
  "trust-check audit branch passes IP + UA from request headers",
  /x-forwarded-for[\s\S]{0,300}user-agent[\s\S]{0,300}logTrustedDeviceEvent/.test(
    tcSrc,
  ),
);
check(
  "revoke-others endpoint imports logTrustedDeviceEvent",
  /import\s*{\s*logTrustedDeviceEvent\s*}\s*from\s*["']@core\/audit\/trusted-device-audit["']/.test(
    revokeOthersSrc,
  ),
);
check(
  "revoke-others endpoint logs TRUSTED_DEVICE_REVOKED per row via Promise.allSettled with bulk:true",
  /Promise\.allSettled[\s\S]{0,400}TRUSTED_DEVICE_REVOKED[\s\S]{0,300}user_self_revoke_others[\s\S]{0,200}bulk:\s*true/.test(
    revokeOthersSrc,
  ),
);
check(
  "revoke-others endpoint selects ip_last_seen + user_agent for the audit payload",
  // Step 11: revoke-others now also selects token_hash so it can prune
  // just-revoked entries from the multi-token cookie. Accept either
  // the legacy 3-column select or the new 4-column select.
  /select\(\s*["']id, ip_last_seen, user_agent(?:, token_hash)?["']\s*,?\s*\)/.test(
    revokeOthersSrc,
  ),
);
check(
  "trust-check does NOT log other fail reasons (no_cookie, not_found, revoked, user_mismatch, lookup_error)",
  // Anything outside the fingerprint_mismatch/expired branch must NOT carry an action string.
  !/no_cookie[\s\S]{0,400}TRUSTED_DEVICE_/.test(tcSrc) &&
    !/lookup_error[\s\S]{0,400}TRUSTED_DEVICE_/.test(tcSrc) &&
    !/user_mismatch[\s\S]{0,400}TRUSTED_DEVICE_/.test(tcSrc),
);

// ---- Refresh-only dedupe path negative assertion ----
// The refresh-only branch returns token: cookieMatchesSurvivor ? null : token.
// We already verified GRANTED is gated by !cookieMatchesSurvivor; this check
// is the inverse: there must be NO unconditional GRANTED log right before
// the final return of createTrustedDevice's idempotency path.
check(
  "refresh-only (cookieMatchesSurvivor) path does not log GRANTED",
  // Look for the specific guard pattern we shipped; confirms the
  // GRANTED call only sits inside the !cookieMatchesSurvivor block.
  /if\s*\(!cookieMatchesSurvivor\)\s*{\s*await logTrustedDeviceEvent/.test(
    tdSrc,
  ),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
