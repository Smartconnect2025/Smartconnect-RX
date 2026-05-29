import sgMail from "@sendgrid/mail";
import { createAdminClient } from "@core/database/client";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const AIM_ADMIN_NOTIFY = process.env.AIM_ADMIN_NOTIFY || "support@aimrx.com";
const AIM_SUPPORT_PHONE = "(769) 304-1830";
const AIM_SUPPORT_HOURS = "Mon\u2013Fri 9AM\u20136PM CST";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export type CancelRefundType = "cancelled" | "refunded";
export type CancelRefundRole = "patient" | "provider" | "admin";

export interface CancelRefundData {
  patientFirstName: string;
  patientLastName: string;
  patientFullName: string;
  patientId: string;
  patientEmail: string;
  providerName: string;
  providerEmail: string;
  pharmacyName: string;
  orderNumber: string;
  prescriptionId: string;
  medication: string;
  dose: string;
  quantity: number | string;
  reason: string;
  date: string;
  timestampUtc: string;
  performedByEmail: string;
  systemLogId: string | null;
  refundAmount: string;
  refundedAmountCents: number;
  originalAuthnetTxId: string | null;
  refundAuthnetTxId: string | null;
  cardType: string | null;
  cardLast4: string | null;
}

export interface SendCancellationEmailsArgs {
  prescription: any;
  paymentTx: any | null;
  reason: string;
  refundedAmountCents: number | null;
  adminUserEmail: string;
  refundAuthnetTxId?: string | null;
  systemLogId?: string | null;
}

export interface SendCancellationEmailsResult {
  sent: string[];
  failed: { to: string; error: string }[];
}

function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brandedWrapper(title: string, headerColor: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden;">
      <tr>
        <td style="padding:40px 40px 28px;text-align:center;background:${headerColor};">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">${escapeHtml(title)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 40px 20px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;font-weight:600;">Need Help?</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1e293b;">Support</p>
                <p style="margin:0 0 2px;font-size:13px;color:#475569;">Phone: <strong>${AIM_SUPPORT_PHONE}</strong> (${AIM_SUPPORT_HOURS})</p>
                <p style="margin:0;font-size:13px;color:#475569;">Email: ${escapeHtml(FROM_EMAIL)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;line-height:16px;color:#94a3b8;text-align:center;">
            &copy; ${new Date().getFullYear()} ${escapeHtml(FROM_NAME)}. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderCancelRefund(
  type: CancelRefundType,
  role: CancelRefundRole,
  data: CancelRefundData,
): { subject: string; html: string; text: string } {
  const e = escapeHtml;
  const headerColor =
    type === "refunded"
      ? "linear-gradient(135deg,#0EA5E9 0%,#0284C7 100%)"
      : "linear-gradient(135deg,#64748B 0%,#475569 100%)";

  if (type === "cancelled" && role === "patient") {
    const subject = `Your order for ${data.medication} has been cancelled`;
    const body = `
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">Hi ${e(data.patientFirstName)},</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">Your prescription order for <strong>${e(data.medication)}</strong> has been cancelled.</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">Reason: <strong>${e(data.reason)}</strong></p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">If you have questions, please contact your prescribing provider's office or reply to this email.</p>
    `;
    const text = `Hi ${data.patientFirstName},

Your prescription order for ${data.medication} has been cancelled.
Reason: ${data.reason}.

If you have questions, please contact your prescribing provider's office or reply to this email.`;
    return { subject, html: brandedWrapper("Your Order Has Been Cancelled", headerColor, body), text };
  }

  if (type === "cancelled" && role === "provider") {
    const subject = `Order cancelled: ${data.patientFullName} \u2014 ${data.medication}`;
    const body = `
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">Order <strong>#${e(data.orderNumber)}</strong> for <strong>${e(data.patientFullName)}</strong> (${e(data.medication)}, ${e(data.dose)}, qty ${e(data.quantity)}) was cancelled by admin on ${e(data.date)}.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">Reason: <strong>${e(data.reason)}</strong></p>
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">No payment action was taken. Please write a replacement Rx if clinically appropriate.</p>
    `;
    const text = `Order #${data.orderNumber} for ${data.patientFullName} (${data.medication}, ${data.dose}, qty ${data.quantity}) was cancelled by admin on ${data.date}.
Reason: ${data.reason}.

No payment action was taken. Please write a replacement Rx if clinically appropriate.`;
    return { subject, html: brandedWrapper("Prescription Order Cancelled", headerColor, body), text };
  }

  if (type === "cancelled" && role === "admin") {
    const subject = `[audit] CANCEL \u2014 order ${data.orderNumber} (${data.patientFullName})`;
    const text = `Action: CANCEL
Order: ${data.orderNumber}
Patient: ${data.patientFullName} (${data.patientId})
Provider: ${data.providerName} (${data.providerEmail})
Pharmacy: ${data.pharmacyName}
Medication: ${data.medication}
Reason: ${data.reason}
Performed by: ${data.performedByEmail} at ${data.timestampUtc}
system_logs id: ${data.systemLogId || "(pending)"}`;
    const html = `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;color:#111;background:#fafafa;padding:16px;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap;word-wrap:break-word;">${e(text)}</pre>`;
    return { subject, html, text };
  }

  if (type === "refunded" && role === "patient") {
    const subject = `Refund issued for your order \u2014 ${data.medication}`;
    const body = `
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">Hi ${e(data.patientFirstName)},</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">A refund of <strong>$${e(data.refundAmount)}</strong> has been issued for your order of <strong>${e(data.medication)}</strong>.</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">The refund returns to the original payment method on file. Please allow 3\u20135 business days for it to appear.</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">Reason for cancellation: <strong>${e(data.reason)}</strong></p>
    `;
    const text = `Hi ${data.patientFirstName},

A refund of $${data.refundAmount} has been issued for your order of ${data.medication}. The refund returns to the original payment method on file. Please allow 3\u20135 business days for it to appear.

Reason for cancellation: ${data.reason}.`;
    return { subject, html: brandedWrapper("Refund Issued", headerColor, body), text };
  }

  if (type === "refunded" && role === "provider") {
    const subject = `Order refunded: ${data.patientFullName} \u2014 ${data.medication} ($${data.refundAmount})`;
    const body = `
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">Order <strong>#${e(data.orderNumber)}</strong> for <strong>${e(data.patientFullName)}</strong> was cancelled and <strong>$${e(data.refundAmount)}</strong> was refunded on ${e(data.date)}.</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:22px;color:#475569;">Authorize.net refund transaction: <code>${e(data.refundAuthnetTxId || "—")}</code></p>
      <p style="margin:0 0 16px;font-size:13px;line-height:22px;color:#475569;">Original transaction: <code>${e(data.originalAuthnetTxId || "—")}</code> (card ending ${e(data.cardLast4 || "—")})</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">Reason: <strong>${e(data.reason)}</strong></p>
    `;
    const text = `Order #${data.orderNumber} for ${data.patientFullName} was cancelled and $${data.refundAmount} was refunded on ${data.date}.
Authorize.net refund transaction: ${data.refundAuthnetTxId || "—"}
Original transaction: ${data.originalAuthnetTxId || "—"} (card ending ${data.cardLast4 || "—"})
Reason: ${data.reason}.`;
    return { subject, html: brandedWrapper("Order Refunded", headerColor, body), text };
  }

  if (type === "refunded" && role === "admin") {
    const subject = `[audit] REFUND $${data.refundAmount} \u2014 order ${data.orderNumber}`;
    const text = `Action: REFUND
Amount: $${data.refundAmount}
Order: ${data.orderNumber}
Patient: ${data.patientFullName} (${data.patientId})
Provider: ${data.providerName}
Pharmacy: ${data.pharmacyName}
Medication: ${data.medication}
Original Authnet TX: ${data.originalAuthnetTxId || "—"} (card ${data.cardType || "—"} ending ${data.cardLast4 || "—"})
Refund Authnet TX: ${data.refundAuthnetTxId || "—"}
Reason: ${data.reason}
Performed by: ${data.performedByEmail} at ${data.timestampUtc}
system_logs id: ${data.systemLogId || "(pending)"}`;
    const html = `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;color:#111;background:#fafafa;padding:16px;border:1px solid #e2e8f0;border-radius:6px;white-space:pre-wrap;word-wrap:break-word;">${e(text)}</pre>`;
    return { subject, html, text };
  }

  return { subject: "Notification", html: "", text: "" };
}

export async function sendCancellationEmails(
  args: SendCancellationEmailsArgs,
): Promise<SendCancellationEmailsResult> {
  const {
    prescription,
    paymentTx,
    reason,
    refundedAmountCents,
    adminUserEmail,
    refundAuthnetTxId,
    systemLogId,
  } = args;

  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];

  if (!SENDGRID_API_KEY) {
    return { sent, failed: [{ to: "(no key)", error: "SendGrid not configured" }] };
  }

  const supabase = createAdminClient();
  const type: CancelRefundType =
    refundedAmountCents != null && refundedAmountCents > 0 ? "refunded" : "cancelled";

  let patientEmail: string = paymentTx?.patient_email || "";
  let patientName: string = paymentTx?.patient_name || "";
  let patientFirstName = "";
  let patientLastName = "";

  if (prescription?.patient_id) {
    try {
      const { data: patient } = await supabase
        .from("patients")
        .select("first_name, last_name, email")
        .eq("id", prescription.patient_id)
        .maybeSingle();
      if (patient) {
        patientFirstName = patient.first_name || "";
        patientLastName = patient.last_name || "";
        if (!patientEmail && patient.email) patientEmail = patient.email;
        if (!patientName) {
          patientName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim();
        }
      }
    } catch (_) {}
  }
  if (!patientFirstName && patientName) {
    patientFirstName = patientName.split(" ")[0] || "";
  }

  let providerEmail: string | null = null;
  let providerName: string = paymentTx?.provider_name || "";
  if (prescription?.prescriber_id) {
    try {
      const { data: provider } = await supabase
        .from("providers")
        .select("email, first_name, last_name, prefix")
        .eq("user_id", prescription.prescriber_id)
        .maybeSingle();
      if (provider) {
        providerEmail = provider.email || null;
        if (!providerName) {
          providerName = `${provider.prefix || ""} ${provider.first_name || ""} ${provider.last_name || ""}`
            .replace(/\s+/g, " ")
            .trim();
        }
      }
    } catch (_) {}
  }

  // Multi-pharmacy: always look up the pharmacy by the prescription's
  // pharmacy_id. Never hardcode a single pharmacy.
  let pharmacyName: string = paymentTx?.pharmacy_name || "";
  if (!pharmacyName && prescription?.pharmacy_id) {
    try {
      const { data: pharm } = await supabase
        .from("pharmacies")
        .select("name")
        .eq("id", prescription.pharmacy_id)
        .maybeSingle();
      if (pharm) pharmacyName = pharm.name || "";
    } catch (_) {}
  }

  const refundAmount =
    refundedAmountCents != null && refundedAmountCents > 0
      ? (refundedAmountCents / 100).toFixed(2)
      : "0.00";
  const orderNumber =
    prescription?.queue_id ||
    prescription?.rx_number ||
    (prescription?.id ? String(prescription.id).slice(0, 8) : "—");
  const now = new Date();

  const data: CancelRefundData = {
    patientFirstName: patientFirstName || "Patient",
    patientLastName,
    patientFullName:
      patientName || `${patientFirstName} ${patientLastName}`.trim() || "Patient",
    patientId: prescription?.patient_id || "—",
    patientEmail,
    providerName: providerName || "your prescriber",
    providerEmail: providerEmail || "—",
    pharmacyName: pharmacyName || "—",
    orderNumber,
    prescriptionId: prescription?.id || "—",
    medication: prescription?.medication || "your prescription",
    dose: prescription?.dosage || prescription?.dosage_amount || "—",
    quantity: prescription?.quantity ?? "—",
    reason: reason || "—",
    date: now.toISOString().slice(0, 10),
    timestampUtc: now.toISOString(),
    performedByEmail: adminUserEmail || "(unknown admin)",
    systemLogId: systemLogId || null,
    refundAmount,
    refundedAmountCents: refundedAmountCents || 0,
    originalAuthnetTxId: paymentTx?.authnet_transaction_id || null,
    refundAuthnetTxId: refundAuthnetTxId || null,
    cardType: paymentTx?.card_type || null,
    cardLast4: paymentTx?.card_last_four || null,
  };

  const adminEmails = Array.from(
    new Set(
      [adminUserEmail, AIM_ADMIN_NOTIFY].filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      ),
    ),
  );

  type Job = { to: string; role: CancelRefundRole };
  const jobs: Job[] = [];
  if (patientEmail) jobs.push({ to: patientEmail, role: "patient" });
  if (providerEmail) jobs.push({ to: providerEmail, role: "provider" });
  for (const adm of adminEmails) jobs.push({ to: adm, role: "admin" });

  await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        const { subject, html, text } = renderCancelRefund(type, job.role, data);
        await sgMail.send({
          to: job.to,
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject,
          html,
          text,
        });
        sent.push(`${job.to} (${job.role})`);
      } catch (err: any) {
        const msg =
          err?.response?.body?.errors?.[0]?.message ||
          err?.message ||
          "send failed";
        failed.push({ to: `${job.to} (${job.role})`, error: msg });
      }
    }),
  );

  try {
    await (supabase.from("system_logs") as any).insert({
      user_id: null,
      user_email: adminUserEmail || "system",
      user_name: "Admin",
      action:
        type === "refunded"
          ? "PRESCRIPTION_REFUND_NOTIFY"
          : "PRESCRIPTION_CANCEL_NOTIFY",
      details: JSON.stringify({
        prescription_id: prescription?.id,
        pharmacy_id: prescription?.pharmacy_id || null,
        type,
        recipients_attempted: jobs.map((j) => `${j.to} (${j.role})`),
        recipients_sent: sent,
        recipients_failed: failed,
        reason,
        refunded_amount_cents: refundedAmountCents || 0,
        related_system_log_id: systemLogId || null,
      }),
      status:
        failed.length === 0 ? "success" : sent.length === 0 ? "error" : "partial",
      ...(failed.length > 0
        ? { error_message: failed.map((f) => `${f.to}: ${f.error}`).join("; ") }
        : {}),
    });
  } catch (_) {}

  return { sent, failed };
}
