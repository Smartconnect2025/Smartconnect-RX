import { readFileSync } from 'fs';
import pg from 'pg';

const REPORT = 'attached_assets/Pasted--TRACKING-REPORT-4-1-5-5-RxDate-RxNumber-PatientName-Pa_1777987943081.txt';
const raw = readFileSync(REPORT, 'utf8');
const lines = raw.split('\n');

const shipped = [];   // has real tracking number
const rejected = [];  // tracking col = "REJECTED"
const cancelled = []; // tracking col = "CANCELLED"
const tests = [];     // tracking col = "N/A" or test patient
const group1 = [];    // resend list
let inGroup1 = false;

for (const line of lines) {
  const t = line.trim();
  if (!t) continue;
  if (t.includes('GROUP 1')) { inGroup1 = true; continue; }
  if (t.startsWith('**TRACKING') || t.startsWith('RxDate')) continue;
  const cols = line.split('\t').map(c => c.trim());
  if (inGroup1) {
    // queue_id, '', name, dob, ...
    const queueId = cols[0];
    if (!/^\d{7}$/.test(queueId)) continue;
    group1.push({ queueId, name: cols[2], dob: cols[3], drug: cols[6] || cols[7] || '', notes: cols[cols.length-1] });
    continue;
  }
  if (cols.length < 9) continue;
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cols[0])) continue;
  const row = {
    rxDate: cols[0], rxNumber: cols[1], name: cols[2], dob: cols[3],
    street: cols[4], state: cols[6], drug: cols[7],
    tracking: cols[8], notes: cols[9] || ''
  };
  if (row.tracking === 'REJECTED') rejected.push(row);
  else if (row.tracking === 'CANCELLED') cancelled.push(row);
  else if (row.tracking === 'N/A' || /TEST/i.test(row.name)) tests.push(row);
  else if (/^\d{12}$/.test(row.tracking)) shipped.push(row);
  else { /* unparseable */ console.error('SKIP', row); }
}

console.log(`PARSED:  shipped=${shipped.length}  rejected=${rejected.length}  cancelled=${cancelled.length}  tests=${tests.length}  group1=${group1.length}`);

// --- DB compare ---
const client = new pg.Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
await client.connect();

function toIsoDob(mdy) {
  const [m,d,y] = mdy.split('/');
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function nameParts(s) {
  // "ADAMS,BRIAN" or "TEST 1,TEST"
  const [last, first] = s.split(',').map(x=>x.trim());
  return { last, first };
}

async function findRx(row) {
  const { last, first } = nameParts(row.name);
  const dob = toIsoDob(row.dob);
  // match by last name + dob + drug substring (loose); window: rxDate ± 30 days
  const rxDateIso = toIsoDob(row.rxDate);
  // Pull patient candidates first
  const ps = await client.query(
    `SELECT p.id, p.first_name, p.last_name FROM patients p
     WHERE upper(p.last_name) = $1 AND p.date_of_birth = $2`,
    [last.toUpperCase(), dob]
  );
  if (ps.rows.length === 0) return { match: 'NO_PATIENT', candidates: [] };
  const patientIds = ps.rows.map(r=>r.id);
  // medication keyword: take the drug body without "AIM" prefix
  const drugBody = row.drug.replace(/^AIM\s+/i,'').replace(/\s+/g,' ').trim();
  const keyword = drugBody.split(/[\s\/]+/)[0].toLowerCase(); // first token like BPC-157, GHK-CU, etc
  const rxs = await client.query(
    `SELECT id, queue_id, rx_number, status, tracking_number, pharmacy_notes,
            medication, submitted_at::date AS sub_date, updated_at::date AS upd_date
     FROM prescriptions
     WHERE patient_id = ANY($1::uuid[])
       AND lower(medication) LIKE $2
       AND submitted_at >= ($3::date - INTERVAL '14 days')
       AND submitted_at <= ($3::date + INTERVAL '14 days')
     ORDER BY abs(extract(epoch from (submitted_at - $3::timestamp))) ASC`,
    [patientIds, '%'+keyword.toLowerCase()+'%', rxDateIso]
  );
  return { match: rxs.rows.length === 1 ? 'UNIQUE' : (rxs.rows.length > 1 ? 'MULTI' : 'NO_RX'),
           candidates: rxs.rows };
}

const buckets = { shipped, rejected, cancelled, group1 };
const results = {};
for (const [name, list] of Object.entries(buckets)) {
  results[name] = [];
  for (const row of list) {
    if (name === 'group1') {
      // group1 has queue_id directly
      const r = await client.query(`SELECT queue_id, status, tracking_number, pharmacy_notes FROM prescriptions WHERE queue_id=$1`, [row.queueId]);
      results[name].push({ row, db: r.rows[0] || null });
    } else {
      const m = await findRx(row);
      results[name].push({ row, ...m });
    }
  }
}

// --- Summary ---
console.log('\n========== SHIPPED (' + shipped.length + ') ==========');
const sStats = {ok:0, statusWrong:0, trackMissing:0, noMatch:0, multi:0};
for (const r of results.shipped) {
  if (r.match === 'NO_PATIENT' || r.match === 'NO_RX') sStats.noMatch++;
  else if (r.match === 'MULTI') sStats.multi++;
  else {
    const c = r.candidates[0];
    const trackMatch = c.tracking_number === r.row.tracking;
    const statusOk = ['delivered','picked_up'].includes(c.status);
    if (statusOk && trackMatch) sStats.ok++;
    else if (!trackMatch) sStats.trackMissing++;
    else sStats.statusWrong++;
  }
}
console.log(JSON.stringify(sStats, null, 2));

console.log('\n========== REJECTED (' + rejected.length + ') ==========');
const rStats = {ok:0, wrongStatus:0, noMatch:0, multi:0, missingNote:0};
for (const r of results.rejected) {
  if (r.match === 'NO_PATIENT' || r.match === 'NO_RX') { rStats.noMatch++; continue; }
  if (r.match === 'MULTI') { rStats.multi++; continue; }
  const c = r.candidates[0];
  if (c.status === 'rejected') rStats.ok++;
  else rStats.wrongStatus++;
  if (!c.pharmacy_notes || !c.pharmacy_notes.toLowerCase().includes(r.row.notes.split(' ')[0].toLowerCase())) rStats.missingNote++;
}
console.log(JSON.stringify(rStats, null, 2));

console.log('\nREJECTED detail:');
for (const r of results.rejected) {
  const c = r.candidates[0];
  console.log(`  ${r.row.name.padEnd(28)} ${r.row.drug.substring(0,40).padEnd(40)} match=${r.match} db_status=${c?.status||'-'} db_note=${(c?.pharmacy_notes||'').substring(0,30)}`);
}

console.log('\n========== CANCELLED (' + cancelled.length + ') ==========');
for (const r of results.cancelled) {
  const c = r.candidates[0];
  console.log(`  ${r.row.name.padEnd(28)} ${r.row.drug.substring(0,40).padEnd(40)} match=${r.match} db_status=${c?.status||'-'}`);
}

console.log('\n========== GROUP 1 RESEND (' + group1.length + ') ==========');
for (const r of results.group1) {
  console.log(`  q=${r.row.queueId}  ${r.row.name.padEnd(22)}  db_status=${r.db?.status||'NOT_IN_DB'}`);
}

console.log('\n========== SHIPPED detail (mismatches only) ==========');
for (const r of results.shipped) {
  if (r.match === 'NO_PATIENT' || r.match === 'NO_RX') {
    console.log(`  NO_MATCH  ${r.row.name.padEnd(28)} ${r.row.drug.substring(0,30).padEnd(30)} dob=${r.row.dob}`);
    continue;
  }
  if (r.match === 'MULTI') {
    console.log(`  MULTI(${r.candidates.length})  ${r.row.name.padEnd(28)} ${r.row.drug.substring(0,30).padEnd(30)}`);
    continue;
  }
  const c = r.candidates[0];
  if (c.status !== 'delivered' && c.status !== 'picked_up') {
    console.log(`  STATUS_WRONG  ${r.row.name.padEnd(28)} ${r.row.drug.substring(0,30).padEnd(30)} db=${c.status} lacy_track=${r.row.tracking}`);
  } else if (c.tracking_number !== r.row.tracking) {
    console.log(`  TRACK_DIFF    ${r.row.name.padEnd(28)} db_track=${c.tracking_number||'-'} lacy_track=${r.row.tracking}`);
  }
}

await client.end();
