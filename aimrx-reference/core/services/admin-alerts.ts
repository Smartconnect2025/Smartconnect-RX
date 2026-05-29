import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "joseph@smartconnects.com";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com";
const AIM_LOGO = "https://app.aimrx.com/logo-header.png";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface AlertOptions {
  subject: string;
  headline: string;
  details: string[];
  prescriptionId?: string;
  patientName?: string;
  medication?: string;
  queueId?: string;
  severity: "warning" | "critical";
}

export async function sendAdminAlert(options: AlertOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("[admin-alerts] SendGrid not configured, skipping alert");
    return false;
  }

  const severityColor = options.severity === "critical" ? "#DC2626" : "#F59E0B";
  const severityLabel = options.severity === "critical" ? "CRITICAL" : "WARNING";

  const detailsHtml = options.details
    .map((d) => `<li style="margin-bottom:6px;color:#374151;font-size:14px;">${d}</li>`)
    .join("");

  const prescriptionInfo = [
    options.patientName && `<strong>Patient:</strong> ${options.patientName}`,
    options.medication && `<strong>Medication:</strong> ${options.medication}`,
    options.queueId && `<strong>Queue ID:</strong> ${options.queueId}`,
    options.prescriptionId && `<strong>Prescription ID:</strong> ${options.prescriptionId}`,
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:2px 0;font-size:13px;color:#4B5563;">${line}</p>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#1E3A8A;padding:16px 24px;text-align:center;">
        <img src="${AIM_LOGO}" alt="AIM Rx" style="height:40px;" />
      </div>
      <div style="padding:24px;">
        <div style="background:${severityColor};color:#ffffff;padding:8px 16px;border-radius:6px;margin-bottom:16px;font-size:13px;font-weight:bold;display:inline-block;">
          ${severityLabel}
        </div>
        <h2 style="color:#1E3A8A;margin:0 0 12px 0;font-size:18px;">${options.headline}</h2>
        ${prescriptionInfo ? `<div style="background:#F3F4F6;border-radius:8px;padding:12px 16px;margin-bottom:16px;">${prescriptionInfo}</div>` : ""}
        <ul style="padding-left:20px;margin:0 0 16px 0;">
          ${detailsHtml}
        </ul>
        <p style="font-size:12px;color:#9CA3AF;margin-top:24px;">
          This is an automated alert from AIM Rx Portal. Log in to <a href="https://app.aimrx.com" style="color:#1E3A8A;">app.aimrx.com</a> to take action.
        </p>
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: ADMIN_ALERT_EMAIL,
      from: { email: FROM_EMAIL, name: "AIM Rx Alerts" },
      subject: `[AIM Rx ${severityLabel}] ${options.subject}`,
      html,
    });
    console.log(`[admin-alerts] Alert sent: ${options.subject}`);
    return true;
  } catch (err) {
    console.error("[admin-alerts] Failed to send alert:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function alertUnknownDigitalRxStatus(
  patientName: string,
  medication: string,
  queueId: string,
  prescriptionId: string,
  rawStatus: string,
  rawData: Record<string, unknown>,
) {
  return sendAdminAlert({
    subject: `Unknown DigitalRx Status "${rawStatus}" — ${patientName}`,
    headline: `DigitalRx returned an unrecognized status: "${rawStatus}"`,
    details: [
      `The system received a status it doesn't recognize from DigitalRx.`,
      `This usually means the pharmacy has the order in an unusual state.`,
      `Contact the pharmacy to verify the order status.`,
      `Raw API response: ${JSON.stringify(rawData).substring(0, 300)}`,
    ],
    prescriptionId,
    patientName,
    medication,
    queueId,
    severity: "warning",
  });
}

export async function alertStuckOrder(
  patientName: string,
  medication: string,
  queueId: string,
  prescriptionId: string,
  stuckSinceHours: number,
) {
  return sendAdminAlert({
    subject: `Order Stuck ${Math.round(stuckSinceHours)}+ Hours — ${patientName}`,
    headline: `Prescription stuck in "submitted" for ${Math.round(stuckSinceHours)} hours`,
    details: [
      `This order was submitted to the pharmacy but has not progressed.`,
      `No status change has been detected from DigitalRx after ${Math.round(stuckSinceHours)} hours.`,
      `Check with the pharmacy to confirm they received and are processing this order.`,
    ],
    prescriptionId,
    patientName,
    medication,
    queueId,
    severity: stuckSinceHours >= 72 ? "critical" : "warning",
  });
}

export async function alertBadTrackingNumber(
  patientName: string,
  medication: string,
  trackingNumber: string,
  prescriptionId: string,
  reason: string,
) {
  return sendAdminAlert({
    subject: `Invalid Tracking Number — ${patientName}`,
    headline: `Tracking number "${trackingNumber}" is not valid`,
    details: [
      reason,
      `EasyPost could not identify a carrier for this tracking number.`,
      `The patient has NOT been notified about shipping yet.`,
      `Verify the tracking number with the pharmacy before updating the patient.`,
    ],
    prescriptionId,
    patientName,
    medication,
    severity: "critical",
  });
}
