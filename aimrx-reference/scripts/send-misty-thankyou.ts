import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) { console.error("No SENDGRID_API_KEY"); process.exit(1); }
sgMail.setApiKey(apiKey);

const html = `<p>Hi Misty,</p>
<p>Thank you so much — we just saw the movement on our side and we're really grateful you dug into these so quickly. Four of them are already back in active production on our screens:</p>
<ul>
  <li>✅ <strong>Brian Bielot (2233282)</strong> — now approved</li>
  <li>✅ <strong>Andrew Wicks (2186204)</strong> — re-submitted</li>
  <li>✅ <strong>Michael Landow (2203179)</strong> — re-submitted</li>
  <li>✅ <strong>Scott Province (2222233)</strong> — re-submitted</li>
</ul>
<p>That's a huge help for the providers — really appreciate it.</p>
<p>When you have a moment, there are still 5 we'd love your eyes on whenever it's convenient — no rush, just sharing where they sit on our side so you have the full picture:</p>
<ol>
  <li><strong>Charles Koch (2199336)</strong> — Dr. Whipps — BPC-157/TB-500 3mg — still showing rejected on our side</li>
  <li><strong>Michael Paesani (2209939)</strong> — Dr. Roe — BPC-157/KPV/TB-500 3mg — still showing rejected</li>
  <li><strong>Eric Aguilar (2225037)</strong> — Dr. Omire Mayor — TB-500 3mg/mL — still showing rejected</li>
  <li><strong>Kourtney Duffie (2226877)</strong> — Dr. Roe — BPC-157/GHK-Cu/KPV/TB-500 — still showing submitted with no movement since May 12</li>
  <li><strong>Amanda Chase (2198891)</strong> — Dr. Haynes — Semaglutide + B12 — totally understand you're researching the hold on this one, just keeping it on the list</li>
</ol>
<p>Whatever path is easiest for your team works for us — re-keying, fresh PDFs, anything. The PDFs from Sunday's email are still attached and good to go.</p>
<p>Thank you again, Misty — we genuinely appreciate you and the Greenwich team. Talk soon!</p>
<p>Warmest regards,<br/>Joseph Sughayer<br/>AimRX</p>`;

const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n\s*\n/g, "\n\n");

const msg = {
  to: ["misty.hinson@greenwichrx.org", "laci.k@greenwichrx.org"],
  cc: ["jerry@smartconnects.com", "joseph@smartconnects.com"],
  from: { email: "support@aimrx.com", name: "Joseph Sughayer" },
  replyTo: "joseph@smartconnects.com",
  subject: "Re: Follow-up — Thank you + a few still need your eyes",
  text,
  html,
};

sgMail.send(msg).then(([r]) => {
  console.log("Status:", r.statusCode, "Msg-Id:", r.headers["x-message-id"]);
}).catch((e) => {
  console.error("FAIL:", e.response?.body || e.message);
  process.exit(1);
});
