/**
 * Task #49 backfill — collapse duplicate active trusted_devices rows.
 *
 * For every (user_id, device_fingerprint_hash) pair that has more than
 * one row with revoked_at IS NULL, keep the newest by created_at and
 * mark the rest revoked (revoke_reason='dedupe_backfill').
 *
 * Idempotent: rerunning after a clean state finds zero duplicates and
 * exits 0 without writes.
 *
 * Usage:
 *   npx tsx scripts/backfill-trusted-devices-dedupe.ts        # dry-run
 *   npx tsx scripts/backfill-trusted-devices-dedupe.ts --apply
 */
import { createAdminClient } from "../core/database/client";

interface Row {
  id: string;
  user_id: string;
  device_fingerprint_hash: string;
  created_at: string;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id, user_id, device_fingerprint_hash, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.user_id}::${r.device_fingerprint_hash}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const toRevoke: string[] = [];
  let dupGroups = 0;
  for (const arr of groups.values()) {
    if (arr.length <= 1) continue;
    dupGroups += 1;
    // arr is already sorted desc by created_at; keep [0], revoke the rest.
    for (let i = 1; i < arr.length; i++) toRevoke.push(arr[i].id);
  }

  console.log(
    `scanned ${rows.length} active rows; ${dupGroups} duplicate groups; ${toRevoke.length} rows to revoke`,
  );

  if (toRevoke.length === 0) {
    console.log("nothing to do.");
    return;
  }

  if (!apply) {
    console.log("DRY RUN — pass --apply to revoke. Sample IDs:", toRevoke.slice(0, 10));
    return;
  }

  // Revoke in batches to keep the in() filter manageable.
  const BATCH = 100;
  let revoked = 0;
  for (let i = 0; i < toRevoke.length; i += BATCH) {
    const ids = toRevoke.slice(i, i + BATCH);
    const { data: upd, error: updErr } = await supabase
      .from("trusted_devices")
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: "dedupe_backfill",
      })
      .in("id", ids)
      .is("revoked_at", null)
      .select("id");
    if (updErr) {
      console.error("update failed:", updErr.message);
      process.exit(1);
    }
    revoked += upd?.length ?? 0;
  }

  console.log(`revoked ${revoked} duplicate rows.`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
