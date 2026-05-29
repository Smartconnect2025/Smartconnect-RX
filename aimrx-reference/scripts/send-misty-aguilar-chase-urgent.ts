/**
 * URGENT follow-up to Misty + Laci with fresh Electronic Rx PDFs attached
 * for the 2 still-stuck Greenwich orders:
 *   - Eric Aguilar  (queue 2225037) — Rejected May 12
 *   - Amanda Chase  (queue 2198891) — Paused since May 12
 *
 *   npx tsx scripts/send-misty-aguilar-chase-urgent.ts           # dry run (default)
 *   npx tsx scripts/send-misty-aguilar-chase-urgent.ts --send    # actually email
 *
 * Auto-heals any PDF below the 200KB Greenwich-health threshold (Chase's
 * stored PDF is the known Trevor Haynes JPEG-in-PDF scan wrapper from May 5).
 */
import { createClient } from "@supabase/supabase-js";
import sgMail from "@sendgrid/mail";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureHealthyGreenwichPdf } from "@core/services/regenerate-stale-pdf";

const SEND = process.argv.includes("--send");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL!;
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AimRX Provider Support";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (SEND && (!SENDGRID_API_KEY || !FROM_EMAIL)) {
  console.error("❌ --send requires SENDGRID_API_KEY and SENDGRID_FROM_EMAIL");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ORDERS = [
  {
    queue: "2225037",
    patient: "Eric Aguilar",
    dob: "12/31/1991",
    provider: "Dr. Daniel Omire Mayor",
    med: "TB-500 3mg/mL — Inject 20 units subcutaneously every day, Mon-Fri",
    ordered: "May 8, 12:11 AM CT",
    status: "Rejected on Greenwich May 12 (no reason captured)",
  },
  {
    queue: "2198891",
    patient: "Amanda Chase",
    dob: "?",
    provider: "Dr. Trevor Haynes",
    med: "Semaglutide + B12 1mg/0.5mg/mL — 25 units",
    ordered: "May 5, 7:10 PM CT",
    status: "Paused on Greenwich since May 12",
  },
];

const PDF_OUT_DIR = path.join(process.cwd(), "attached_assets", "misty-urgent-aguilar-chase");

async function downloadStoragePdf(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from("patient-files").download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  console.log(`\n${SEND ? "🔥 SEND MODE — will actually email" : "🧪 DRY RUN — saving PDFs only"}\n`);
  await fs.mkdir(PDF_OUT_DIR, { recursive: true });

  const attachments: Array<{ filename: string; content: string; type: string; disposition: string }> = [];

  for (const o of ORDERS) {
    const { data: rx, error } = await supabase
      .from("prescriptions")
      .select("id, pdf_storage_path, pharmacy_id, patients!inner(date_of_birth)")
      .eq("queue_id", o.queue)
      .single();
    if (error || !rx) {
      console.log(`  [${o.queue}] ❌ DB lookup failed: ${error?.message}`);
      continue;
    }

    if (o.dob === "?" && rx.patients) {
      const p = Array.isArray(rx.patients) ? rx.patients[0] : rx.patients;
      if (p?.date_of_birth) {
        const d = new Date(p.date_of_birth);
        o.dob = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
      }
    }

    process.stdout.write(`  [${o.queue}] ${o.patient.padEnd(18)} → heal-check → `);
    const heal = await ensureHealthyGreenwichPdf(supabase, rx.id, rx.pdf_storage_path, rx.pharmacy_id);
    console.log(heal.regenerated ? `✨ REGENERATED (${heal.reason})` : `✓ ${heal.reason}`);

    const pdfPath = heal.storagePath || rx.pdf_storage_path;
    if (!pdfPath) { console.log(`    ❌ no PDF path — skipping`); continue; }

    const pdf = await downloadStoragePdf(pdfPath);
    if (!pdf) { console.log(`    ❌ download failed — skipping`); continue; }

    const safeName = o.patient.replace(/[^A-Za-z0-9]+/g, "-");
    const fname = `queue-${o.queue}-${safeName}.pdf`;
    await fs.writeFile(path.join(PDF_OUT_DIR, fname), pdf);
    console.log(`    💾 saved ${fname} (${(pdf.length / 1024).toFixed(0)}KB)`);

    attachments.push({
      filename: fname,
      content: pdf.toString("base64"),
      type: "application/pdf",
      disposition: "attachment",
    });
  }

  const rowsHtml = ORDERS.map(o => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">${o.queue}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.patient}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">${o.dob}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.provider}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.med}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.ordered}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.status}</td>
    </tr>`).join("");

  const htmlBody = `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;">
  <p>Hi Misty, hi Laci,</p>
  <p><strong>Urgent follow-up</strong> — these are the last two orders we still have stuck on Greenwich's side. Both have a freshly-regenerated Greenwich Electronic Rx PDF <strong>attached to this email</strong> (one per queue ID, file name matches the queue).</p>
  <table style="border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#f4f4f4;">
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Queue ID</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Patient</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">DOB</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Provider</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Medication</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Ordered</th>
        <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Current Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="margin-top:18px;">A couple of quick asks so we can close these out today:</p>
  <ol>
    <li><strong>Eric Aguilar (2225037)</strong> — could you let us know <em>why</em> this was rejected on May 12? We received the rejection status but no reason. Once we know, we'll correct on our end and resubmit immediately.</li>
    <li><strong>Amanda Chase (2198891)</strong> — please find the attached fresh Electronic Rx PDF and use that for this order. It is paid, has the prescriber's credentials on file, and we'd love to get it moving today.</li>
  </ol>
  <p>Both patients are waiting on their medication — we'd really appreciate your help getting these across the finish line today. Whatever's easiest on your side (resubmit, re-key under a new queue ID, replace the PDF on the existing queue) — just let us know and we'll match it.</p>
  <p>Thanks so much, Misty and Laci.</p>
  <p>Best,<br/>Joseph Sughayer<br/>AimRX</p>
</div>`;

  console.log(`\n✓ ${attachments.length}/${ORDERS.length} attachments built.\n`);

  if (!SEND) {
    console.log("🧪 DRY RUN — PDFs saved to:", PDF_OUT_DIR);
    console.log("    Re-run with --send to actually email.");
    return;
  }

  sgMail.setApiKey(SENDGRID_API_KEY);
  const msg = {
    to: [
      { email: "misty.hinson@greenwichrx.org", name: "Misty Hinson" },
      { email: "laci.k@greenwichrx.org", name: "Laci Kelly" },
    ],
    cc: [
      { email: "jerry@smartconnects.com", name: "Jerry Horani" },
      { email: "joseph@smartconnects.com", name: "Joseph Sughayer" },
    ],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: "joseph@smartconnects.com",
    subject: "URGENT follow-up — Aguilar (2225037) + Chase (2198891) — fresh Rx PDFs attached",
    html: htmlBody,
    attachments,
  };

  console.log(`📤 sending via SendGrid (from ${FROM_EMAIL})...`);
  const [res] = await sgMail.send(msg as any);
  console.log(`✅ sent. status=${res.statusCode}, x-message-id=${res.headers["x-message-id"]}`);
}

main().catch(err => {
  console.error("❌ FAILED:", err?.response?.body || err);
  process.exit(1);
});
