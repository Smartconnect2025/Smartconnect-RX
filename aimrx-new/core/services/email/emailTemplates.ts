const APP_NAME = "SmartConnect RX";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://smartconnect-rx.onrender.com";
const LOGIN_URL = `${APP_URL}/auth/login`;
const LOGO_URL = `${APP_URL}/logo-header.png`;
const SUPPORT_PHONE = "+(769) 304-1830";
const SUPPORT_HOURS = "Mon–Fri 9AM–6PM CST";
const SUPPORT_EMAIL = "support@smartconnects.com";
const CURRENT_YEAR = new Date().getFullYear();

export const GRADIENTS = {
  navyCyan: "linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%)",
  greenSuccess: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  navyBlue: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
  welcome: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #00AEEF 100%)",
  solidNavy: "#1E3A8A",
  ctaButton: "linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%)",
};

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background-color: #ffffff;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailHeader(options: {
  gradient: string;
  heading: string;
  subtext?: string;
  logoHeight?: number;
}): string {
  const { gradient, heading, subtext, logoHeight = 60 } = options;
  return `
    <tr>
      <td style="background: ${gradient}; padding: 36px 40px; text-align: center;">
        <img src="${LOGO_URL}" alt="${APP_NAME}" height="${logoHeight}" style="height: ${logoHeight}px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;" />
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${heading}</h1>
        ${subtext ? `<p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">${subtext}</p>` : ""}
      </td>
    </tr>`;
}

export function emailFooterWithSupport(): string {
  return `
    <tr>
      <td style="padding: 28px 40px; border-top: 1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 20px;">
              <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #1E3A8A;">Need Help?</p>
              <p style="margin: 0 0 4px; font-size: 13px; color: #475569;">📞 ${SUPPORT_PHONE}</p>
              <p style="margin: 0 0 4px; font-size: 13px; color: #475569;">🕐 ${SUPPORT_HOURS}</p>
              <p style="margin: 0; font-size: 13px; color: #475569;">✉️ <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563EB; text-decoration: none;">${SUPPORT_EMAIL}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">Thank you for trusting <strong style="color: #1E3A8A;">${APP_NAME}</strong> with your care.</p>
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ${CURRENT_YEAR} SmartConnect Technologies. All rights reserved.</p>
      </td>
    </tr>`;
}

export function emailFooterSimple(): string {
  return `
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">Thank you for trusting <strong style="color: #1E3A8A;">${APP_NAME}</strong>.</p>
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">© ${CURRENT_YEAR} SmartConnect Technologies. All rights reserved.</p>
      </td>
    </tr>`;
}

export function contentSection(content: string, bgColor: string = "#ffffff"): string {
  return `
    <tr>
      <td style="padding: 36px 40px; background-color: ${bgColor};">
        ${content}
      </td>
    </tr>`;
}

export function detailRow(label: string, value: string, valueStyle?: string): string {
  return `
    <tr>
      <td style="padding: 10px 16px; font-size: 13px; font-weight: 400; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; width: 40%;">${label}</td>
      <td style="padding: 10px 16px; font-size: 15px; font-weight: 600; color: ${valueStyle || "#1e293b"}; border-bottom: 1px solid #f1f5f9;">${value}</td>
    </tr>`;
}

export function detailsCard(title: string, rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 20px 0;">
      <tr>
        <td colspan="2" style="background-color: #f8fafc; padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">${title}</td>
      </tr>
      ${rows}
    </table>`;
}

export function ctaButton(text: string, url: string, style: "gradient" | "navy" = "gradient"): string {
  const bg = style === "gradient" ? GRADIENTS.ctaButton : GRADIENTS.solidNavy;
  const padding = style === "gradient" ? "16px 52px" : "12px 30px";
  const fontSize = style === "gradient" ? "17px" : "14px";
  const shadow = style === "gradient" ? "box-shadow: 0 4px 12px rgba(30,58,138,0.3);" : "";
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${url}" style="display: inline-block; padding: ${padding}; background: ${bg}; color: #ffffff; font-size: ${fontSize}; font-weight: 700; text-decoration: none; border-radius: 8px; ${shadow}">${text}</a>
    </div>`;
}

export function infoBox(content: string, options?: { bgColor?: string; borderColor?: string }): string {
  const bg = options?.bgColor || "#f0f9ff";
  const border = options?.borderColor || "#bae6fd";
  return `
    <div style="background-color: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      ${content}
    </div>`;
}

export function warningBox(content: string): string {
  return `
    <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; padding: 14px 18px; margin: 20px 0;">
      ${content}
    </div>`;
}

export function calloutBox(content: string, borderColor: string = "#2563EB", bgColor: string = "#DBEAFE"): string {
  return `
    <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 4px; padding: 14px 18px; margin: 20px 0;">
      ${content}
    </div>`;
}

export function securityNoticeBox(text: string): string {
  return `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; overflow: hidden;">
      <div style="background-color: #f8fafc; padding: 10px 16px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Security Notice</div>
      <div style="padding: 14px 16px; font-size: 13px; color: #475569;">${text}</div>
    </div>`;
}

interface ProgressStep {
  label: string;
  done: boolean;
  current?: boolean;
}

export function progressTracker(steps: ProgressStep[]): string {
  const stepsHtml = steps.map((step) => {
    const borderColor = step.done || step.current ? "#10B981" : "#E5E7EB";
    const bgColor = step.current ? (step.done ? "#f0fdf4" : "#fffbeb") : step.done ? "#fafafa" : "#f9fafb";
    const textColor = step.done ? "#10B981" : step.current ? "#1e293b" : "#9CA3AF";
    const fontWeight = step.current ? "700" : "600";
    const icon = step.done ? "✓" : "○";
    const marker = step.current ? ' <span style="color: #10B981; font-size: 12px;">← You are here</span>' : "";
    return `<div style="border-left: 3px solid ${borderColor}; background-color: ${bgColor}; padding: 10px 14px; margin-bottom: 8px; border-radius: 4px;">
      <span style="font-size: 14px; font-weight: ${fontWeight}; color: ${textColor};">${icon} ${step.label}${marker}</span>
    </div>`;
  }).join("");

  return `<div style="margin: 24px 0;">${stepsHtml}</div>`;
}

export function credentialsCard(rows: { label: string; value: string; isCode?: boolean; isLink?: boolean }[]): string {
  const rowsHtml = rows.map((row) => {
    let valueHtml: string;
    if (row.isCode) {
      valueHtml = `<code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${row.value}</code>`;
    } else if (row.isLink) {
      valueHtml = `<a href="${row.value}" style="color: #00AEEF; text-decoration: none; font-size: 14px;">${row.value}</a>`;
    } else {
      valueHtml = `<span style="font-size: 14px; color: #1e293b;">${row.value}</span>`;
    }
    return `<div style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
      <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">${row.label}</span>
      ${valueHtml}
    </div>`;
  }).join("");

  return `
    <div style="border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 20px 0; background-color: #ffffff;">
      ${rowsHtml}
    </div>`;
}

export function mfaEmailHtml(code: string): string {
  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.navyBlue,
      heading: "Verification Code",
      subtext: `Secure login to ${APP_NAME} Portal`,
    }) +
    contentSection(`
      <p style="font-size: 16px; color: #334155; margin: 0 0 20px;">Enter the following code to complete your login:</p>
      <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 2px solid #bae6fd; border-radius: 12px; padding: 28px; text-align: center; margin: 20px 0;">
        <span style="font-family: 'Courier New', monospace; font-size: 40px; font-weight: 800; color: #1e3a8a; letter-spacing: 12px;">${code}</span>
      </div>
      <div style="border-left: 4px solid #F59E0B; background-color: #fffbeb; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">⚠️ <strong>This code expires in 10 minutes.</strong> Do not share this code with anyone.</p>
      </div>
      <p style="font-size: 14px; color: #475569; margin: 16px 0 0;">If you didn't request this code, you can safely ignore this email. Your account remains secure.</p>
      ${securityNoticeBox(`${APP_NAME} will never ask for your verification code via phone or text. If someone requests your code, do not share it.`)}
    `) +
    emailFooterSimple()
  );
}

export function welcomeEmailHtml(options: {
  greeting: string;
  message: string;
  portalUrl?: string;
  email: string;
  tempPassword: string;
  pharmacyName?: string;
  extraContent?: string;
}): string {
  const creds: { label: string; value: string; isCode?: boolean; isLink?: boolean }[] = [];
  creds.push({ label: "Portal URL", value: options.portalUrl || LOGIN_URL, isLink: true });
  if (options.pharmacyName) {
    creds.push({ label: "Pharmacy", value: options.pharmacyName });
  }
  creds.push({ label: "Username (Email)", value: options.email });
  creds.push({ label: "Temporary Password", value: options.tempPassword, isCode: true });

  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.welcome,
      heading: `Welcome to ${APP_NAME}`,
      logoHeight: 80,
    }) +
    contentSection(`
      <p style="font-size: 16px; color: #334155; margin: 0 0 8px;">${options.greeting}</p>
      <p style="font-size: 16px; color: #334155; margin: 0 0 20px;">${options.message}</p>
      ${credentialsCard(creds)}
      ${options.extraContent || ""}
      ${warningBox(`<p style="margin: 0; font-size: 13px; color: #92400e;"><strong>⚠️ Security Notice:</strong> This is a temporary password. Please change it immediately after your first login for security purposes.</p>`)}
      ${ctaButton("Log In to Portal", options.portalUrl || LOGIN_URL, "navy")}
      <p style="font-size: 13px; color: #475569; margin: 20px 0 0;">If you need any assistance, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563EB;">${SUPPORT_EMAIL}</a></p>
      <p style="font-size: 14px; color: #334155; margin: 20px 0 0;">Best regards,<br><strong>${APP_NAME} Team</strong></p>
    `, "#f9fafb") +
    emailFooterSimple()
  );
}

export function paymentRequestEmailHtml(options: {
  patientName: string;
  medication: string;
  providerName: string;
  totalAmountFormatted: string;
  paymentUrl: string;
  pharmacyName?: string;
}): string {
  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.navyCyan,
      heading: "Complete Your Prescription Payment",
    }) +
    contentSection(`
      <p style="font-size: 16px; color: #334155; margin: 0 0 8px;">Hi ${options.patientName},</p>
      <p style="font-size: 16px; color: #334155; margin: 0 0 20px;">Your prescription for <strong>${options.medication}</strong>, prescribed by <strong style="color: #1E3A8A;">${options.providerName}</strong>, is ready for payment.</p>
      ${detailsCard("Prescription Details",
        detailRow("Prescribing Clinician", `<strong style="color: #1E3A8A;">${options.providerName}</strong>`, "#1E3A8A") +
        detailRow("Medication(s)", options.medication) +
        (options.pharmacyName ? detailRow("Fulfilling Pharmacy", options.pharmacyName) : "") +
        `<tr><td colspan="2" style="padding: 14px 16px; text-align: right;">
          <span style="font-size: 13px; color: #64748b;">Total Amount Due</span><br>
          <span style="font-size: 22px; font-weight: 700; color: #00AEEF;">${options.totalAmountFormatted}</span>
        </td></tr>`
      )}
      ${ctaButton("Complete Secure Payment", options.paymentUrl, "gradient")}
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Or copy this link: <a href="${options.paymentUrl}" style="color: #2563EB; word-break: break-all;">${options.paymentUrl}</a></p>
      ${infoBox(`<p style="margin: 0; font-size: 13px; color: #334155;">🔒 <strong>Secure Payment:</strong> This link directs you to our secure payment processor. Your payment information is encrypted and protected.</p>`)}
      ${progressTracker([
        { label: "Prescription Received", done: true },
        { label: "Payment Pending", done: false, current: true },
        { label: "Pharmacy Processing", done: false },
        { label: "Shipped with Tracking", done: false },
        { label: "Delivered", done: false },
      ])}
    `) +
    emailFooterWithSupport()
  );
}

export function paymentConfirmationEmailHtml(options: {
  patientName: string;
  medication: string;
  providerName: string;
  amountFormatted: string;
  transactionId: string;
  pharmacyName?: string;
  fulfillmentMethod?: string;
}): string {
  let nextStepsText = "Your prescription has been sent to the pharmacy for processing. We will notify you with updates.";
  if (options.fulfillmentMethod === "pickup") {
    nextStepsText = "Your prescription has been sent to the pharmacy. They will notify you when it's ready for pickup.";
  } else if (options.fulfillmentMethod === "delivery") {
    nextStepsText = "Your prescription has been sent to the pharmacy. They will deliver it to your address on file.";
  } else if (options.fulfillmentMethod === "shipping") {
    nextStepsText = "Your prescription has been sent to the pharmacy. Once shipped, you'll receive tracking information.";
  }

  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.greenSuccess,
      heading: "Payment Confirmed",
    }) +
    contentSection(`
      <p style="font-size: 16px; color: #334155; margin: 0 0 8px;">Hi ${options.patientName},</p>
      <p style="font-size: 16px; color: #334155; margin: 0 0 20px;">Thank you! Your payment has been successfully processed.</p>
      ${detailsCard("Transaction Details",
        detailRow("Transaction ID", `<code style="font-family: monospace; font-size: 14px; font-weight: 600; color: #1e293b;">${options.transactionId}</code>`) +
        detailRow("Prescribing Clinician", `<strong style="color: #1E3A8A;">${options.providerName}</strong>`, "#1E3A8A") +
        detailRow("Medication(s)", options.medication) +
        (options.pharmacyName ? detailRow("Fulfilling Pharmacy", options.pharmacyName) : "") +
        `<tr><td colspan="2" style="padding: 14px 16px; text-align: right;">
          <span style="font-size: 13px; color: #64748b;">Amount Paid</span><br>
          <span style="font-size: 22px; font-weight: 700; color: #10B981;">${options.amountFormatted}</span>
        </td></tr>`
      )}
      ${infoBox(`<p style="margin: 0; font-size: 14px; color: #334155;"><strong>What Happens Next</strong></p><p style="margin: 8px 0 0; font-size: 13px; color: #475569;">${nextStepsText}</p>`)}
      ${progressTracker([
        { label: "Prescription Received", done: true },
        { label: "Payment Confirmed", done: true, current: true },
        { label: "Pharmacy Processing", done: false },
        { label: "Shipped / Ready for Pickup", done: false },
        { label: "Delivered / Completed", done: false },
      ])}
    `) +
    emailFooterWithSupport()
  );
}

export function accessRequestConfirmationHtml(firstName: string): string {
  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.welcome,
      heading: "Request Received",
      logoHeight: 80,
    }) +
    contentSection(`
      <p style="font-size: 16px; color: #334155; margin: 0 0 8px;">Hello ${firstName},</p>
      <p style="font-size: 16px; color: #334155; margin: 0 0 20px;">Thank you for your interest in ${APP_NAME}. We have received your access request.</p>
      ${calloutBox(`
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;"><strong>What's next?</strong></p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #334155;">Our team is currently reviewing your application. You can expect to receive an update within <strong>24 to 48 hours</strong>.</p>
      `)}
      <p style="font-size: 14px; color: #334155; margin: 20px 0 0;">Best regards,<br><strong>${APP_NAME} Team</strong></p>
    `, "#f9fafb") +
    emailFooterSimple()
  );
}

export function adminAccessRequestHtml(options: {
  heading: string;
  detailCards: string;
}): string {
  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.welcome,
      heading: options.heading,
      logoHeight: 80,
    }) +
    contentSection(`
      ${options.detailCards}
      ${calloutBox(`
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;"><strong>Action Required</strong></p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #334155;">Please review this application and set up the account if approved.</p>
      `)}
      <p style="font-size: 13px; color: #475569; margin: 20px 0 0;"><a href="${LOGIN_URL}" style="color: #2563EB;">Log in to ${APP_NAME}</a> to take action.</p>
    `, "#f9fafb") +
    emailFooterSimple()
  );
}

export function adminDetailCard(title: string, fields: { label: string; value: string }[]): string {
  const rows = fields.map(f =>
    `<div style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
      <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${f.label}</span><br>
      <span style="font-size: 14px; color: #1e293b; font-weight: 500;">${f.value || "—"}</span>
    </div>`
  ).join("");

  return `
    <div style="border: 2px solid #1E3A8A; border-radius: 8px; padding: 20px; margin: 16px 0; background-color: #ffffff;">
      <p style="margin: 0 0 12px; font-size: 13px; font-weight: 700; color: #1E3A8A; text-transform: uppercase; letter-spacing: 0.5px;">${title}</p>
      ${rows}
    </div>`;
}

export { APP_NAME, APP_URL, LOGIN_URL, LOGO_URL, SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_HOURS };
