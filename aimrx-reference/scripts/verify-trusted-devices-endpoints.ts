/**
 * Static smoke test for the new /api/auth/trusted-devices endpoints
 * (Step 7 of the 14-step Trusted Device feature).
 *
 * Asserts the source of the GET and DELETE handlers contains the
 * server-side guards we promised in the plan, without spinning up
 * Next.js. Mirrors scripts/verify-mfa-complete-endpoint.ts.
 */
import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const listRoute = path.join(
  repoRoot,
  "app/api/auth/trusted-devices/route.ts",
);
const itemRoute = path.join(
  repoRoot,
  "app/api/auth/trusted-devices/[id]/route.ts",
);
const revokeOthersRoute = path.join(
  repoRoot,
  "app/api/auth/trusted-devices/revoke-others/route.ts",
);
const viewHelper = path.join(repoRoot, "core/auth/trusted-device-view.ts");

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
  if (!fs.existsSync(p)) {
    throw new Error(`missing file: ${p}`);
  }
  return fs.readFileSync(p, "utf8");
}

const listSrc = read(listRoute);
const itemSrc = read(itemRoute);
const othersSrc = read(revokeOthersRoute);
const viewSrc = read(viewHelper);

// ---- GET /api/auth/trusted-devices ----
check("GET handler exported", /export async function GET\b/.test(listSrc));
check(
  "GET requires authenticated user (401 on no user)",
  /supabase\.auth\.getUser/.test(listSrc) &&
    /status:\s*401/.test(listSrc),
);
check(
  "GET query is scoped by user_id",
  /from\("trusted_devices"\)[\s\S]{0,300}\.eq\("user_id",\s*user\.id\)/.test(
    listSrc,
  ),
);
check(
  "GET filters revoked + expired rows",
  /\.is\("revoked_at",\s*null\)/.test(listSrc) &&
    /\.gt\("expires_at"/.test(listSrc),
);
check(
  "GET orders by last_used_at DESC",
  /order\("last_used_at",\s*\{\s*ascending:\s*false\s*\}\)/.test(listSrc),
);
check(
  "GET resolves currentDeviceId via aimrx_td cookie hash",
  /TRUST_COOKIE_NAME/.test(listSrc) &&
    /hashTrustToken/.test(listSrc) &&
    /currentDeviceId/.test(listSrc),
);
check(
  "GET never sends token_hash to the client (uses toTrustedDeviceView)",
  /toTrustedDeviceView/.test(listSrc) &&
    !/token_hash:\s*row\.token_hash/.test(listSrc),
);

// ---- DELETE /api/auth/trusted-devices/[id] ----
check(
  "DELETE handler exported",
  /export async function DELETE\b/.test(itemSrc),
);
check(
  "DELETE requires authenticated user (401)",
  /supabase\.auth\.getUser/.test(itemSrc) &&
    /status:\s*401/.test(itemSrc),
);
check(
  "DELETE enforces row ownership (user_id equality, 404 otherwise)",
  /row\.user_id\s*!==\s*user\.id/.test(itemSrc) &&
    /status:\s*404/.test(itemSrc),
);
check(
  "DELETE calls revokeTrustedDevice with reason 'user_self_revoke'",
  /revokeTrustedDevice/.test(itemSrc) &&
    /user_self_revoke/.test(itemSrc) &&
    /revokedBy:\s*user\.id/.test(itemSrc),
);
check(
  "DELETE clears aimrx_td cookie when revoking the current device",
  /TRUST_COOKIE_NAME/.test(itemSrc) &&
    /maxAge:\s*0/.test(itemSrc) &&
    /clearedCurrent/.test(itemSrc),
);
check(
  "DELETE is idempotent on already-revoked rows (skips revoke when revoked_at is set)",
  /if\s*\(!row\.revoked_at\)/.test(itemSrc),
);

// ---- POST /api/auth/trusted-devices/revoke-others (Step 8) ----
check(
  "revoke-others POST handler exported",
  /export async function POST\b/.test(othersSrc),
);
check(
  "revoke-others requires authenticated user (401)",
  /supabase\.auth\.getUser/.test(othersSrc) &&
    /status:\s*401/.test(othersSrc),
);
check(
  "revoke-others scopes update by user_id and only-active rows",
  /\.eq\("user_id",\s*user\.id\)/.test(othersSrc) &&
    /\.is\("revoked_at",\s*null\)/.test(othersSrc),
);
check(
  "revoke-others excludes the current device via aimrx_td cookie hash",
  /TRUST_COOKIE_NAME/.test(othersSrc) &&
    /hashTrustToken/.test(othersSrc) &&
    /\.neq\("id",\s*currentRowId\)/.test(othersSrc),
);
check(
  "revoke-others stamps revoke_reason='user_self_revoke_others' and revoked_by=user.id",
  /revoke_reason:\s*"user_self_revoke_others"/.test(othersSrc) &&
    /revoked_by:\s*user\.id/.test(othersSrc),
);
check(
  "revoke-others returns a counted revokedCount",
  /revokedCount/.test(othersSrc) && /\.select\("id"\)/.test(othersSrc),
);
check(
  "revoke-others current-device lookup is also user-scoped (no cross-user cookie reach)",
  // Step 11: lookup may use .eq("token_hash", ...) (legacy single-token)
  // OR .in("token_hash", hashes) (multi-token cookie). Both stay
  // user-scoped via the leading .eq("user_id", user.id).
  /from\("trusted_devices"\)[\s\S]{0,400}\.eq\("user_id",\s*user\.id\)[\s\S]{0,200}\.(?:eq|in)\("token_hash"/.test(
    othersSrc,
  ),
);

// ---- view helper ----
check(
  "trusted-device-view exports parseUserAgent + toTrustedDeviceView",
  /export function parseUserAgent\b/.test(viewSrc) &&
    /export function toTrustedDeviceView\b/.test(viewSrc),
);
check(
  "view helper recognizes major browsers and OS families",
  /Edg\\\/|Chrome\\\/|Safari\\\/|Firefox\\\//.test(viewSrc) &&
    /Windows|Mac OS X|iPhone|Android|Linux/.test(viewSrc),
);
check(
  "view helper falls back to Unknown for unparseable UA",
  /Unknown browser/.test(viewSrc) && /Unknown OS/.test(viewSrc),
);
check(
  "view helper never leaks token_hash or device_fingerprint_hash",
  !/token_hash:/.test(viewSrc) &&
    !/device_fingerprint_hash:/.test(viewSrc),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
