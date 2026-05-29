import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) { console.error("No SENDGRID_API_KEY"); process.exit(1); }
sgMail.setApiKey(apiKey);

const pdfDir = "attached_assets/misty-followup-pdfs";
const files = [
  { name: "koch-2199336.pdf", queue: "2199336" },
  { name: "paesani-2209939.pdf", queue: "2209939" },
  { name: "duffie-2226877.pdf", queue: "2226877" },
];

const attachments = files.map((f) => {
  const filePath = path.join(pdfDir, f.name);
  const content = fs.readFileSync(filePath).toString("base64");
  console.log(`Attaching ${f.name} (${fs.statSync(filePath).size} bytes)`);
  return {
    content,
    filename: f.name,
    type: "application/pdf",
    disposition: "attachment",
  };
});

const html = `<p>Hi Misty,</p>
<p>Thank you so much for the detailed breakdown — that helps a lot. Here's where we landed on each:</p>
<p><strong>Koch (2199336)</strong> — PDF attached. On our side it generated cleanly (1.2 MB Greenwich Electronic Rx). Could you also let us know what email address Alliyah sent her note to, so we can chase it down on our end too?</p>
<p><strong>Paesani (2209939)</strong> — PDF attached. Easiest path for everyone is probably for your team to re-key this one under a new queue ID rather than waiting on Doug. Whatever works for you.</p>
<p><strong>Duffie (2226877)</strong> — PDF attached. Please re-key under a new queue ID whenever convenient.</p>
<p><strong>Aguilar (2225037)</strong> — Could you share what specifically Alliyah flagged on the dosing? Dr. Omire Mayor wrote it as "Inject 20 units subcutaneously every day, Monday through Friday" on TB-500 3mg/mL. Once we know what's needed we'll get the doctor to clarify or adjust.</p>
<p><strong>Chase (2198891)</strong> — Wonderful, thank you for getting that added on your end. We'll sit tight.</p>
<p>Really appreciate you working through these with us, Misty.</p>
<p>Warmest regards,<br/>Joseph Sughayer<br/>AimRX</p>`;

const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

const msg = {
  to: ["misty.hinson@greenwichrx.org", "laci.k@greenwichrx.org"],
  cc: ["jerry@smartconnects.com", "joseph@smartconnects.com"],
  from: { email: "support@aimrx.com", name: "Joseph Sughayer" },
  replyTo: "joseph@smartconnects.com",
  subject: "Re: Follow-up — fresh PDFs + a quick question",
  text,
  html,
  attachments,
};

sgMail.send(msg).then(([r]) => {
  console.log("\n✅ SENT. Status:", r.statusCode, "Msg-Id:", r.headers["x-message-id"]);
}).catch((e) => {
  console.error("FAIL:", e.response?.body || e.message);
  process.exit(1);
});
