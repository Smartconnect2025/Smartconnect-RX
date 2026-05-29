#!/usr/bin/env node
/**
 * resend-rejected.mjs — One-shot recovery driver for Group-1 rejections
 * from Lacy's 4.1–5.5 tracking report.
 *
 * What it does:
 *   - DRY-RUN by default: lists target prescriptions and what would happen.
 *   - With --commit + --rx-id <UUID>: resends ONE prescription (canary).
 *   - With --commit + --all: resends ALL targets sequentially with delay.
 *
 * It calls the production endpoint:
 *     POST https://app.aimrx.com/api/prescriptions/<id>/resend-rejected
 * which (a) backfills backend_id, (b) regenerates PDF in Greenwich format,
 * (c) clears the dead queue_id, (d) re-submits via the production code path.
 *
 * Required env:
 *   SUPABASE_DATABASE_URL   — for read-only DB checks (psql in shell)
 *   INTERNAL_API_SECRET     — to authenticate against the prod endpoint
 *
 * Usage:
 *   node resend-rejected.mjs                                  # dry-run preview
 *   node resend-rejected.mjs --commit --rx-id <UUID>          # canary (Brian Adams first)
 *   node resend-rejected.mjs --commit --all                   # all 9 in sequence
 *   node resend-rejected.mjs --base http://localhost:5000     # local dev target
 */

import { execSync } from "node:child_process";

// ─── Targets: Group-2 rejections from Lacy's 4.1–5.5 tracking report ────
// Six paid Greenwich orders DBS rejected with "WAITING MD CALLBACK - NO RX
// IMAGE ATTACHED" between Apr 26 and May 1. Same root cause as the Group-1
// nine we resubmitted earlier today: the prescription image DBS received
// was the pre-May-1 PDF without the AIM clinic identifier, so their intake
// flagged it as "no usable Rx image". Three of the six (Massie, Patel,
// Wienecke) still show stale "packed" status in our DB because the DBS
// status webhook stopped firing on Apr 15 — Lacy's tracking is the source
// of truth, and the endpoint will resubmit regardless of stale local state.
const TARGETS = [
  { rxId: "191281b2-ef94-4b94-bcd7-1fd46d24a407", queueId: "2109832", patient: "Paul Zerilli",     drug: "BPC-157/TB500 3mg/3mg/mL" },
  { rxId: "10e48344-88c5-42bc-8ba0-a9776c912c89", queueId: "2132864", patient: "Matthew Massie",   drug: "BPC-157/GHK-U/KPV/TB500" },
  { rxId: "1e68eddb-2d6e-4361-aa11-a0ac1fb2e3b4", queueId: "2133473", patient: "Brian Adams",     drug: "BPC-157 3MG/ML" },
  { rxId: "48ce0dc6-7df4-40b8-87d1-41d11d7dc76a", queueId: "2142711", patient: "Annia Chrisakis", drug: "BPC-157 3MG/ML" },
  { rxId: "45107049-c39a-4df2-89f3-0b630d89f880", queueId: "2145945", patient: "Matthew Wienecke", drug: "Sermorelin 3mg/mL" },
  { rxId: "7ed5cf6c-36d9-4241-803f-aa78098ccd87", queueId: "2170557", patient: "Yash Patel",       drug: "BPC-157/TB-500 3mg/3mg/mL" },
];

const EXTRAS = [];

// ─── CLI parse ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {
  commit: args.includes("--commit"),
  all: args.includes("--all"),
  rxId: argValue("--rx-id"),
  base: argValue("--base") || "https://app.aimrx.com",
  includeExtras: args.includes("--include-extras"),
};

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const allCandidates = flags.includeExtras ? [...EXTRAS, ...TARGETS] : TARGETS;
const selected = flags.rxId
  ? allCandidates.filter((t) => t.rxId === flags.rxId)
  : flags.all
  ? allCandidates
  : allCandidates;

if (flags.commit && !flags.rxId && !flags.all) {
  console.error("ERROR: --commit requires either --rx-id <UUID> or --all");
  process.exit(2);
}

// ─── DB sanity check via psql ─────────────────────────────────────────
function dbStatus(rxIds) {
  const dbUrl = process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    console.warn("(SUPABASE_DATABASE_URL not set — skipping DB sanity check)");
    return [];
  }
  const list = rxIds.map((id) => `'${id}'`).join(",");
  const sql = `SELECT id, queue_id, status, payment_status, backend_id, pdf_storage_path FROM prescriptions WHERE id IN (${list});`;
  try {
    const out = execSync(`psql "${dbUrl}" -A -F '|' -t -c "${sql}"`, {
      encoding: "utf8",
    });
    return out.trim().split("\n").map((line) => {
      const [id, queue_id, status, payment_status, backend_id, pdf_storage_path] = line.split("|");
      return { id, queue_id, status, payment_status, backend_id, pdf_storage_path };
    });
  } catch (err) {
    console.warn("(psql check failed:", err.message, ")");
    return [];
  }
}

// ─── Endpoint call ────────────────────────────────────────────────────
async function resend(rxId) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET is not set");
  }
  const url = `${flags.base}/api/prescriptions/${rxId}/resend-rejected`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-internal-secret": secret,
      "content-type": "application/json",
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: res.status, body };
}

// ─── Print preview ────────────────────────────────────────────────────
console.log(`\n=== Resend Rejected — ${flags.commit ? "COMMIT" : "DRY-RUN"} ===`);
console.log(`Target: ${flags.base}`);
console.log(`Selected ${selected.length} prescription(s):\n`);

const dbRows = dbStatus(selected.map((t) => t.rxId));
const dbByRx = Object.fromEntries(dbRows.map((r) => [r.id, r]));

for (const t of selected) {
  const db = dbByRx[t.rxId];
  console.log(`  • ${t.patient.padEnd(20)} | rx=${t.rxId.slice(0, 8)} | old_queue=${t.queueId} | ${t.drug}`);
  if (db) {
    console.log(`      DB: status=${db.status} payment=${db.payment_status} backend=${db.backend_id || "(NULL)"} pdf=${db.pdf_storage_path ? "set" : "(NONE)"}`);
  }
  if (t.noPdf) {
    console.log(`      ⚠ NO PDF in DB — endpoint will generate fresh from rx data.`);
  }
}

if (!flags.commit) {
  console.log("\nDRY-RUN complete. To execute:");
  console.log(`  CANARY:  node resend-rejected.mjs --commit --rx-id 1e68eddb-2d6e-4361-aa11-a0ac1fb2e3b4   # Brian Adams`);
  console.log(`  ALL  9:  node resend-rejected.mjs --commit --all`);
  console.log(`  ALL 12:  node resend-rejected.mjs --commit --all --include-extras   # 9 Group-1 + Brian/Annia/Paul`);
  process.exit(0);
}

// ─── Commit path ─────────────────────────────────────────────────────
console.log(`\n>>> COMMIT MODE — calling endpoint for ${selected.length} prescription(s) <<<\n`);

let okCount = 0, failCount = 0;
const results = [];

for (const t of selected) {
  process.stdout.write(`Resending ${t.patient.padEnd(20)} (rx=${t.rxId.slice(0, 8)})... `);
  try {
    const r = await resend(t.rxId);
    results.push({ ...t, ...r });
    if (r.status === 200 && r.body.success) {
      console.log(`OK new_queue=${r.body.new_queue_id ?? "(none)"}`);
      okCount++;
    } else {
      console.log(`FAIL status=${r.status} code=${r.body.submit_code ?? "?"} err=${r.body.submit_error ?? r.body.error ?? "?"}`);
      failCount++;
    }
  } catch (err) {
    console.log(`ERROR ${err.message}`);
    results.push({ ...t, error: err.message });
    failCount++;
  }
  // 3-second pause between calls so we don't hammer DBS or our serverless.
  if (selected.length > 1) await new Promise((r) => setTimeout(r, 3000));
}

console.log(`\n=== Done — ${okCount} ok, ${failCount} failed ===\n`);
console.log(JSON.stringify(results, null, 2));
process.exit(failCount === 0 ? 0 : 1);
