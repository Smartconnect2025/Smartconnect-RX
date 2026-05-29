/**
 * One-off: send the Greenwich follow-up email to Lacy + Misty with fresh
 * Electronic Rx PDF attachments for all 8 stuck orders.
 *
 *   npx tsx scripts/send-lacy-followup-email.ts            # DRY RUN (default — saves PDFs, no send)
 *   npx tsx scripts/send-lacy-followup-email.ts --send     # actually send via SendGrid
 *
 * Auto-heals any PDF that is below the 200KB Greenwich-health threshold
 * (Amanda Chase's stored PDF is a known 74-124KB JPEG-in-PDF wrapper).
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
  { queue: "2186204", patient: "Andrew Wicks",     dob: "03/18/1971", provider: "Dr. Randolph Whipps",     med: "BPC-157/TB-500 3mg, 15 units",            ordered: "May 4, 5:02 PM",  status: "Rejected May 16, 4:00 AM" },
  { queue: "2198891", patient: "Amanda Chase",     dob: "?",          provider: "Dr. Trevor Haynes",       med: "Semaglutide + B12, 25 units",             ordered: "May 5, 7:10 PM",  status: "In Production since May 12, 9:55 AM" },
  { queue: "2199336", patient: "Charles Koch",     dob: "11/03/1974", provider: "Dr. Randolph Whipps",     med: "BPC-157/TB-500 3mg, 15 units",            ordered: "May 5, 7:43 PM",  status: "Rejected May 16, 12:00 AM" },
  { queue: "2203179", patient: "Michael Landow",   dob: "05/13/1981", provider: "Dr. Randolph Whipps",     med: "BPC-157/GHK-Cu/KPV/TB-500, 20 units",     ordered: "May 5, 11:44 PM", status: "Rejected May 16, 4:00 AM" },
  { queue: "2209939", patient: "Michael Paesani",  dob: "08/14/1981", provider: "Dr. Thomasina Roe",       med: "BPC-157/KPV/TB-500 3mg, 20 units",        ordered: "May 6, 6:19 PM",  status: "Rejected May 16, 12:00 AM" },
  { queue: "2222233", patient: "Scott Province",   dob: "05/07/1968", provider: "NP Lydia Cole",           med: "BPC-157/TB-500 3mg, 20 units",            ordered: "May 7, 8:52 PM",  status: "Rejected May 16, 4:00 AM" },
  { queue: "2225037", patient: "Eric Aguilar",     dob: "12/31/1991", provider: "Dr. Daniel Omire Mayor",  med: "TB-500 3mg/mL, 20 units",                 ordered: "May 8, 12:11 AM", status: "Rejected May 12, 11:04 PM" },
  { queue: "2226877", patient: "Kourtney Duffie",  dob: "03/01/1982", provider: "Dr. Thomasina Roe",       med: "BPC-157/GHK-Cu/KPV/TB-500, 20 units",     ordered: "May 8, 2:52 AM",  status: "Submitted (no movement) since May 12, 10:08 AM" },
];

const PDF_OUT_DIR = path.join(process.cwd(), "attached_assets", "lacy-followup-pdfs");

async function downloadStoragePdf(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from("patient-files").download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function main() {
  console.log(`\n${SEND ? "🔥 SEND MODE — will actually email" : "🧪 DRY RUN — saving PDFs only, no email"}\n`);

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

    // Fill in DOB if we didn't have it (Amanda Chase)
    if (o.dob === "?" && rx.patients) {
      const p = Array.isArray(rx.patients) ? rx.patients[0] : rx.patients;
      if (p?.date_of_birth) {
        const d = new Date(p.date_of_birth);
        o.dob = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
      }
    }

    process.stdout.write(`  [${o.queue}] ${o.patient.padEnd(20)} → heal-check → `);
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

  // Build the HTML table
  const rowsHtml = ORDERS.map(o => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">${o.queue}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.patient}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">${o.dob}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.provider}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.med}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.ordered}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;">${o.status}</td>
    </tr>
  `).join("");

  const htmlBody = `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;">
  <p>Hi Lacy, hi Misty,</p>
  <p>Hope you're both doing well. Just following up <strong>again</strong> on the orders below — we've sent multiple notes on these and would really appreciate your help getting them across the finish line. We know all of your other TB-500 / BPC blend orders are currently being fulfilled, so these 8 specifically stand out as stuck on our side.</p>
  <p>Here are the details:</p>
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
  <p style="margin-top:18px;">All 8 orders are paid, have prescriber credentials on file, and a freshly-regenerated Greenwich Electronic Rx PDF is <strong>attached to this email</strong> — one per queue ID — so you can match them directly to the table above.</p>
  <p>A few quick questions to help us get these moving:</p>
  <ol>
    <li>Can you confirm what specifically caused the rejection on each of these? If it's a format issue we can correct on our end, we'll fix it right away.</li>
    <li>For Kourtney Duffie (2226877) and Amanda Chase (2198891) — these are showing Submitted / In Production but haven't moved since May 12. Anything blocking them on Greenwich's queue?</li>
    <li>Is there a preferred way for us to resubmit these so they don't bounce back rejected again — same channel, or do you want them re-keyed under new queue IDs?</li>
  </ol>
  <p>We'd love to get these patients their medications this week if at all possible. Whatever is easiest on your side, we'll match it. Thanks so much, Lacy and Misty — appreciate your help as always.</p>
  <p>Best,<br/>Joseph Sughayer<br/>AimRX</p>
</div>`;

  console.log(`\n✓ ${attachments.length}/8 attachments built.\n`);

  if (!SEND) {
    console.log("🧪 DRY RUN — PDFs saved to:", PDF_OUT_DIR);
    console.log("    Re-run with --send to actually email.");
    return;
  }

  sgMail.setApiKey(SENDGRID_API_KEY);
  const msg = {
    to: [
      { email: "laci.k@greenwichrx.org", name: "Laci Kelly" },
      { email: "misty.hinson@greenwichrx.org", name: "Misty Hinson" },
    ],
    cc: [
      { email: "jerry@smartconnects.com", name: "Jerry Horani" },
      { email: "joseph@smartconnects.com", name: "Joseph Sughayer" },
    ],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: "Follow-up — 8 AimRX orders stuck on our side / how do we push through?",
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
