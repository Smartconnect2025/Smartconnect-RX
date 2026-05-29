import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) { console.error("No SENDGRID_API_KEY"); process.exit(1); }
sgMail.setApiKey(apiKey);

const html = `<p>Hi Laci, Misty,</p>
<p><strong>Urgent — we need a status check on these 5 orders right now.</strong> Have any of them shipped yet?</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#f3f4f6;"><th>Queue ID</th><th>Patient</th><th>Provider</th><th>Medication</th></tr>
<tr><td><strong>2233282</strong></td><td>Brian Bielot</td><td>Dr. Whipps</td><td>BPC-157 / TB-500 3mg</td></tr>
<tr><td><strong>2186204</strong></td><td>Andrew Wicks</td><td>Dr. Whipps</td><td>BPC-157 / TB-500 3mg</td></tr>
<tr><td><strong>2203179</strong></td><td>Michael Landow</td><td>Dr. Whipps</td><td>BPC-157 / GHK-Cu / KPV / TB-500</td></tr>
<tr><td><strong>2222233</strong></td><td>Scott Province</td><td>NP Cole</td><td>BPC-157 / TB-500 3mg</td></tr>
<tr><td><strong>2199336</strong></td><td>Charles Koch</td><td>Dr. Whipps</td><td>BPC-157 / TB-500 3mg</td></tr>
</table>
<p>For each one, please confirm: <strong>shipped Y/N</strong>, and if shipped, the tracking number.</p>
<p>This is time-sensitive — please get back to us tonight if at all possible.</p>
<p>Thank you,<br/>Joseph Sughayer<br/>AimRX</p>`;

const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const msg = {
  to: ["laci.k@greenwichrx.org", "misty.hinson@greenwichrx.org"],
  cc: ["jerry@smartconnects.com", "joseph@smartconnects.com"],
  from: { email: "support@aimrx.com", name: "Joseph Sughayer" },
  replyTo: "joseph@smartconnects.com",
  subject: "URGENT — shipping status check on 5 orders",
  text, html,
};

sgMail.send(msg).then(([r]) => {
  console.log("✅ SENT. Status:", r.statusCode, "Msg-Id:", r.headers["x-message-id"]);
}).catch((e) => {
  console.error("FAIL:", e.response?.body || e.message);
  process.exit(1);
});
