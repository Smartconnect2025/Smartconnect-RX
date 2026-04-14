import sgMail from "@sendgrid/mail";
import {
  emailWrapper,
  emailHeader,
  emailFooterSimple,
  GRADIENTS,
  APP_NAME,
  APP_URL,
} from "@core/services/email/emailTemplates";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "support@smartconnectrx.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface AdminAlertOptions {
  subject: string;
  headline: string;
  details: string[];
  severity: "warning" | "critical";
  prescriptionId?: string;
  patientName?: string;
  medication?: string;
  queueId?: string;
}

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function severityBadge(severity: "warning" | "critical"): string {
  const bg = severity === "critical" ? "#DC2626" : "#F59E0B";
  const text = severity === "critical" ? "#FFFFFF" : "#78350F";
  return `<span style="display: inline-block; background-color: ${bg}; color: ${text}; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${severity}</span>`;
}

export async function sendAdminAlert(options: AdminAlertOptions): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn("[admin-alerts] SendGrid not configured, skipping alert:", options.subject);
    return;
  }

  const gradient = options.severity === "critical" ? "linear-gradient(135deg, #991B1B 0%, #DC2626 100%)" : "linear-gradient(135deg, #92400E 0%, #F59E0B 100%)";

  const infoRows: string[] = [];
  if (options.patientName) infoRows.push(`<strong>Patient:</strong> ${escHtml(options.patientName)}`);
  if (options.medication) infoRows.push(`<strong>Medication:</strong> ${escHtml(options.medication)}`);
  if (options.queueId) infoRows.push(`<strong>Queue ID:</strong> ${escHtml(options.queueId)}`);
  if (options.prescriptionId) infoRows.push(`<strong>Prescription ID:</strong> <code style="font-family: monospace; font-size: 12px;">${escHtml(options.prescriptionId)}</code>`);

  const infoBox = infoRows.length > 0
    ? `<div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        ${infoRows.map(r => `<p style="margin: 4px 0; font-size: 13px; color: #334155;">${r}</p>`).join("")}
      </div>`
    : "";

  const detailsList = options.details.map(d =>
    `<li style="margin-bottom: 8px; font-size: 13px; color: #475569;">${d}</li>`
  ).join("");

  const htmlContent = emailWrapper(`
    ${emailHeader({ gradient, heading: `${APP_NAME} Alert` })}
    <tr>
      <td style="padding: 36px 40px;">
        <p style="margin: 0 0 12px;">${severityBadge(options.severity)}</p>
        <h2 style="margin: 0 0 16px; font-size: 18px; color: #1e293b;">${options.headline}</h2>
        ${infoBox}
        <ul style="margin: 16px 0; padding-left: 20px;">
          ${detailsList}
        </ul>
        <p style="margin: 20px 0 0; font-size: 13px; color: #475569;">
          <a href="${APP_URL}/admin/prescriptions" style="color: #2563EB;">Log in to ${APP_NAME}</a> to take action.
        </p>
      </td>
    </tr>
    ${emailFooterSimple()}
  `);

  try {
    await sgMail.send({
      to: ADMIN_ALERT_EMAIL,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: options.subject,
      html: htmlContent,
    });
    console.log(`[admin-alerts] Alert sent: ${options.subject}`);
  } catch (err) {
    console.error("[admin-alerts] Failed to send alert:", err);
  }
}

export async function alertUnknownDigitalRxStatus(
  patientName: string,
  medication: string,
  queueId: string,
  prescriptionId: string,
  rawStatus: string,
  rawData?: string,
): Promise<void> {
  await sendAdminAlert({
    subject: `${APP_NAME} WARNING — Unknown DigitalRx Status '${escHtml(rawStatus)}' — ${escHtml(patientName)}`,
    headline: `DigitalRx returned an unrecognized status: '${escHtml(rawStatus)}'`,
    details: [
      "The system received a status it doesn't recognize from DigitalRx.",
      "Contact the pharmacy to verify the order status.",
      rawData ? `Raw API response: <code style="font-family: monospace; font-size: 11px;">${escHtml(rawData.substring(0, 300))}</code>` : "",
    ].filter(Boolean),
    severity: "warning",
    patientName,
    medication,
    queueId,
    prescriptionId,
  });
}

export async function alertStuckOrder(
  patientName: string,
  medication: string,
  queueId: string,
  prescriptionId: string,
  stuckSinceHours: number,
): Promise<void> {
  const severity = stuckSinceHours >= 72 ? "critical" : "warning";
  const label = severity === "critical" ? "CRITICAL" : "WARNING";

  await sendAdminAlert({
    subject: `${APP_NAME} ${label} — Order Stuck ${Math.round(stuckSinceHours)}+ Hours — ${patientName}`,
    headline: `Prescription stuck in 'submitted' for ${Math.round(stuckSinceHours)} hours`,
    details: [
      "This order was submitted but has not progressed.",
      `No status change detected after ${Math.round(stuckSinceHours)} hours.`,
      "Check with the pharmacy to confirm they received and are processing this order.",
    ],
    severity,
    patientName,
    medication,
    queueId,
    prescriptionId,
  });
}

export async function alertBadTrackingNumber(
  patientName: string,
  medication: string,
  trackingNumber: string,
  prescriptionId: string,
  reason: string,
): Promise<void> {
  await sendAdminAlert({
    subject: `${APP_NAME} CRITICAL — Invalid Tracking Number — ${escHtml(patientName)}`,
    headline: `Tracking number '${escHtml(trackingNumber)}' is not valid`,
    details: [
      escHtml(reason),
      "EasyPost could not identify a carrier for this tracking number.",
      "The patient has NOT been notified about shipping yet.",
      "Verify the tracking number with the pharmacy.",
    ],
    severity: "critical",
    patientName,
    medication,
    prescriptionId,
  });
}
