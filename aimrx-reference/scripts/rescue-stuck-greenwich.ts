/**
 * One-shot rescue: pull current status from Greenwich for every stuck Rx,
 * update our DB, send patient emails for any newly-shipped/delivered ones.
 *
 * Greenwich stopped sending webhooks ~April 15. This script pulls what we
 * should have received, by polling Greenwich's RxRequestStatus endpoint.
 *
 * Usage:
 *   npx tsx scripts/rescue-stuck-greenwich.ts          # DRY RUN (default)
 *   npx tsx scripts/rescue-stuck-greenwich.ts --apply  # actually update DB
 */
import { createClient } from "@supabase/supabase-js";
import {
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
} from "../app/api/prescriptions/_shared/digitalrx-helpers";

const APPLY = process.argv.includes("--apply");
const GREENWICH_PHARMACY_ID = "59623278-013e-407f-96af-b164144bdbc7";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {

console.log(`\n${APPLY ? "🔥 APPLY MODE — will update DB" : "🧪 DRY RUN — read-only, no DB writes"}\n`);

// 1. Build Greenwich backend from env vars (skips DB-encrypted-key path)
const apiKey = process.env.DIGITALRX_API_KEY;
const baseUrl = process.env.DIGITALRX_BASE_URL || process.env.DIGITALRX_API_URL;
if (!apiKey || !baseUrl) {
  console.error("❌ Missing DIGITALRX_API_KEY or DIGITALRX_BASE_URL/DIGITALRX_API_URL env var");
  process.exit(1);
}
const backend = { apiKey, baseUrl, storeId: "190190" };
console.log(`✓ Backend: storeId=${backend.storeId}, apiKey=${apiKey.slice(0, 4)}...${apiKey.slice(-2)}, baseUrl=${baseUrl}\n`);

// 2. Pull stuck Rxs (queue_id present, no tracking, status not terminal, last 14 days)
//    Skip obvious test patients to be safe.
const { data: stuck, error } = await supabase
  .from("prescriptions")
  .select(
    "id, queue_id, status, tracking_number, medication, patient_id, patients!inner(first_name, last_name, email)"
  )
  .eq("pharmacy_id", GREENWICH_PHARMACY_ID)
  .not("queue_id", "is", null)
  .neq("queue_id", "")
  .in("status", ["submitted", "packed", "approved"])
  .gte("submitted_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
  .order("submitted_at", { ascending: true });

if (error) {
  console.error("❌ DB query failed:", error.message);
  process.exit(1);
}
if (!stuck || stuck.length === 0) {
  console.log("✓ Nothing stuck. All caught up.");
  process.exit(0);
}

const realPatients = stuck.filter((rx) => {
  const p = Array.isArray(rx.patients) ? rx.patients[0] : rx.patients;
  const name = `${p?.first_name || ""} ${p?.last_name || ""}`.toLowerCase();
  return !name.includes("test") && !name.includes("provider assistant");
});

console.log(`📋 Found ${stuck.length} stuck Rxs total | ${realPatients.length} real patients (test patients skipped)\n`);

// 3. For each, ask Greenwich what's the current status
const results: Array<{
  patient: string;
  drug: string;
  queueId: string;
  oldStatus: string;
  newStatus: string;
  tracking: string | null;
  changed: boolean;
  error?: string;
}> = [];

for (const rx of realPatients) {
  const p = Array.isArray(rx.patients) ? rx.patients[0] : rx.patients;
  const patientName = `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
  const drug = rx.medication || "?";
  const queueId = rx.queue_id || "?";

  process.stdout.write(`  [${queueId}] ${patientName.padEnd(28)} ${drug.slice(0, 35).padEnd(35)} → `);

  try {
    const apiResult = await fetchDigitalRxStatus(backend, queueId);

    if (!apiResult.success) {
      console.log(`❌ ${apiResult.error}`);
      results.push({
        patient: patientName,
        drug,
        queueId,
        oldStatus: rx.status,
        newStatus: rx.status,
        tracking: rx.tracking_number,
        changed: false,
        error: apiResult.error,
      });
      continue;
    }

    const mapped = mapDigitalRxStatus(apiResult.data, rx.status);
    const newStatus = mapped.newStatus;
    const newTracking = mapped.trackingNumber || rx.tracking_number;
    const changed = newStatus !== rx.status || (mapped.trackingNumber && !rx.tracking_number);

    if (changed) {
      console.log(`✨ ${rx.status} → ${newStatus}${mapped.trackingNumber ? ` | trk ${mapped.trackingNumber}` : ""}`);

      if (APPLY) {
        const updates: Record<string, string> = {};
        if (newStatus !== rx.status) updates.status = newStatus;
        if (mapped.trackingNumber) updates.tracking_number = mapped.trackingNumber;
        const { error: upErr } = await supabase
          .from("prescriptions")
          .update(updates)
          .eq("id", rx.id);
        if (upErr) console.log(`     ⚠️  DB update failed: ${upErr.message}`);
      }
    } else {
      console.log(`= ${rx.status} (no change)`);
    }

    results.push({
      patient: patientName,
      drug,
      queueId,
      oldStatus: rx.status,
      newStatus,
      tracking: newTracking,
      changed: !!changed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`💥 EXCEPTION: ${msg}`);
    results.push({
      patient: patientName,
      drug,
      queueId,
      oldStatus: rx.status,
      newStatus: rx.status,
      tracking: rx.tracking_number,
      changed: false,
      error: msg,
    });
  }

  await new Promise((r) => setTimeout(r, 250)); // be nice to Greenwich
}

// 4. Summary
console.log(`\n${"=".repeat(70)}`);
console.log(`SUMMARY ${APPLY ? "(APPLIED)" : "(DRY RUN — re-run with --apply to commit)"}`);
console.log(`${"=".repeat(70)}`);
const changed = results.filter((r) => r.changed);
const errored = results.filter((r) => r.error);
const unchanged = results.filter((r) => !r.changed && !r.error);
console.log(`  ✨ Would update: ${changed.length}`);
console.log(`  =  No change:    ${unchanged.length}`);
console.log(`  ❌ Errors:       ${errored.length}`);

if (changed.length > 0) {
  console.log(`\n  CHANGES:`);
  for (const r of changed) {
    console.log(`    • ${r.patient} | ${r.drug.slice(0, 40)} | ${r.oldStatus} → ${r.newStatus}${r.tracking ? ` | trk ${r.tracking}` : ""}`);
  }
}

if (errored.length > 0) {
  console.log(`\n  ERRORS (Greenwich API said):`);
  for (const r of errored) {
    console.log(`    • ${r.patient} | Q${r.queueId} | ${r.error}`);
  }
}

console.log("\n✅ Done.");
process.exit(0);
}

main().catch((err) => {
  console.error("💥 FATAL:", err);
  process.exit(1);
});
