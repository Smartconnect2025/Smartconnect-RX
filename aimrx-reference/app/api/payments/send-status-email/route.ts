import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createCronClient } from "@/core/cron/supabase";
import { checkEmailDedup } from "@/core/services/email-guard";
import { sendStatusSms, isSmsConfigured } from "@/core/services/sms";
import {
  renderCancelRefund,
  type CancelRefundRole,
  type CancelRefundType,
  type CancelRefundData,
} from "@/core/services/cancellation-emails";

export { sendCancellationEmails } from "@/core/services/cancellation-emails";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const AIM_SUPPORT_PHONE = "(769) 304-1830";
const AIM_SUPPORT_HOURS = "Mon\u2013Fri 9AM\u20136PM CST";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

type LegacyStatusType =
  | "pharmacy_processing"
  | "shipped"
  | "delivered"
  | "ready_for_pickup";
type StatusType = LegacyStatusType | CancelRefundType;

interface StatusEmailRequest {
  patientEmail: string;
  patientName: string;
  patientPhone?: string;
  medication: string;
  providerName: string;
  statusType: StatusType;
  trackingNumber?: string;
  trackingUrl?: string;
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  prescriptionId?: string;
}

interface StepInfo {
  label: string;
  done: boolean;
  current?: boolean;
}

interface StatusConfig {
  subject: string;
  heading: string;
  headerColor: string;
  message: string;
  nextSteps: string;
  steps: StepInfo[];
}

function getStatusContent(statusType: LegacyStatusType, data: StatusEmailRequest): StatusConfig {
  const pharmacy = data.pharmacyName || "your pharmacy";
  const pharmacyContact = data.pharmacyPhone ? ` at ${data.pharmacyPhone}` : "";

  const configs: Record<LegacyStatusType, StatusConfig> = {
    pharmacy_processing: {
      subject: `Prescription Update: ${data.medication} Is Being Prepared`,
      heading: "Your Prescription Is Being Prepared",
      headerColor: "linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%)",
      message: `We wanted to let you know that <strong>${pharmacy}</strong> has received your prescription for <strong>${data.medication}</strong>, prescribed by <strong>${data.providerName}</strong>, and has begun preparing your order.`,
      nextSteps: `We will notify you as soon as your order ships with full tracking details so you can follow your package every step of the way.${data.pharmacyPhone ? ` If you have any questions about your order, you can reach the pharmacy directly at <strong>${data.pharmacyPhone}</strong>.` : ""}`,
      steps: [
        { label: "Prescription Received", done: true },
        { label: "Payment Confirmed", done: true },
        { label: "Pharmacy Preparing Your Order", done: true, current: true },
        { label: "Shipped with Tracking", done: false },
        { label: "Delivered", done: false },
      ],
    },
    shipped: {
      subject: `Your ${data.medication} Prescription Has Shipped!`,
      heading: "Your Prescription Has Shipped!",
      headerColor: "linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%)",
      message: `Great news! Your prescription for <strong>${data.medication}</strong>, prescribed by <strong>${data.providerName}</strong>, has been shipped by <strong>${pharmacy}</strong> and is on its way to you.`,
      nextSteps: data.trackingNumber
        ? `Your tracking number is <strong>${data.trackingNumber}</strong>. You can use the tracking link below to follow your package in real time. Please allow 3\u20135 business days for standard delivery.`
        : `Your package is on its way. Tracking details will be updated shortly. Please allow 3\u20135 business days for standard delivery.`,
      steps: [
        { label: "Prescription Received", done: true },
        { label: "Payment Confirmed", done: true },
        { label: "Pharmacy Prepared", done: true },
        { label: "Shipped with Tracking", done: true, current: true },
        { label: "Delivered", done: false },
      ],
    },
    delivered: {
      subject: `Delivery Confirmed: ${data.medication} Prescription`,
      heading: "Your Prescription Has Been Delivered!",
      headerColor: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
      message: `Your prescription for <strong>${data.medication}</strong>, prescribed by <strong>${data.providerName}</strong>, has been successfully delivered. Please check your delivery location.`,
      nextSteps: `If you have any questions about your medication, need dosage guidance, or would like to arrange a refill, please contact your provider or reach out to us.${data.pharmacyPhone ? ` You can also contact <strong>${pharmacy}</strong> directly at <strong>${data.pharmacyPhone}</strong>.` : ""} If you cannot locate your package, please contact us immediately.`,
      steps: [
        { label: "Prescription Received", done: true },
        { label: "Payment Confirmed", done: true },
        { label: "Pharmacy Prepared", done: true },
        { label: "Shipped", done: true },
        { label: "Delivered", done: true, current: true },
      ],
    },
    ready_for_pickup: {
      subject: `Your ${data.medication} Prescription Is Ready for Pickup`,
      heading: "Your Prescription Is Ready for Pickup!",
      headerColor: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
      message: `Your prescription for <strong>${data.medication}</strong>, prescribed by <strong>${data.providerName}</strong>, is ready to be picked up at <strong>${pharmacy}</strong>.`,
      nextSteps: `Please bring a valid photo ID when picking up your medication.${data.pharmacyAddress ? ` The pharmacy is located at <strong>${data.pharmacyAddress}</strong>.` : ""}${data.pharmacyPhone ? ` You can reach them at <strong>${data.pharmacyPhone}</strong>.` : ""} The pharmacy is available during regular business hours.`,
      steps: [
        { label: "Prescription Received", done: true },
        { label: "Payment Confirmed", done: true },
        { label: "Pharmacy Prepared", done: true },
        { label: "Ready for Pickup", done: true, current: true },
      ],
    },
  };

  return configs[statusType];
}

function buildStepsHtml(steps: StepInfo[]) {
  return steps
    .map(
      (step) => `
    <div style="padding: 14px 16px; border-left: 3px solid ${step.done ? "#10B981" : "#E5E7EB"}; background-color: ${step.current ? "#f0fdf4" : step.done ? "#fafafa" : "#f9fafb"}; margin-bottom: 8px; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; font-weight: ${step.current ? "700" : "600"}; color: ${step.done ? "#10B981" : "#9CA3AF"};">${step.done ? "\u2713" : "\u25CB"} ${step.label}${step.current ? "  \u2190 You are here" : ""}</p>
    </div>`,
    )
    .join("\n");
}

function buildPharmacyContactHtml(data: StatusEmailRequest) {
  if (!data.pharmacyName) return "";
  let html = `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
    <tr>
      <td style="padding: 16px 20px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Fulfilling Pharmacy</p>
        <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1e293b;">${data.pharmacyName}</p>`;
  if (data.pharmacyPhone) {
    html += `<p style="margin: 0 0 2px; font-size: 13px; color: #475569;">Phone: ${data.pharmacyPhone}</p>`;
  }
  if (data.pharmacyAddress) {
    html += `<p style="margin: 0; font-size: 13px; color: #475569;">Address: ${data.pharmacyAddress}</p>`;
  }
  html += `
      </td>
    </tr>
  </table>`;
  return html;
}

interface CancelRefundEmailRequest {
  statusType: CancelRefundType;
  recipientRole?: CancelRefundRole;
  patientEmail?: string;
  patientName?: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientId?: string;
  providerEmail?: string;
  providerName?: string;
  pharmacyName?: string;
  prescriptionId?: string;
  orderNumber?: string;
  medication?: string;
  dose?: string;
  quantity?: number | string;
  reason?: string;
  refundedAmountCents?: number | null;
  originalAuthnetTxId?: string | null;
  refundAuthnetTxId?: string | null;
  cardType?: string | null;
  cardLast4?: string | null;
  adminEmail?: string;
  logId?: string | null;
}

async function handleCancelRefundEmail(
  body: CancelRefundEmailRequest,
): Promise<NextResponse> {
  const role: CancelRefundRole =
    body.recipientRole === "provider" || body.recipientRole === "admin"
      ? body.recipientRole
      : "patient";

  const to =
    role === "patient"
      ? body.patientEmail
      : role === "provider"
        ? body.providerEmail
        : body.adminEmail;

  if (!to) {
    return NextResponse.json(
      { success: false, error: `Missing ${role} email address` },
      { status: 400 },
    );
  }

  const refundedAmountCents = body.refundedAmountCents || 0;
  const refundAmount =
    refundedAmountCents > 0 ? (refundedAmountCents / 100).toFixed(2) : "0.00";
  const now = new Date();
  const fullName =
    body.patientName ||
    `${body.patientFirstName || ""} ${body.patientLastName || ""}`.trim() ||
    "Patient";
  const firstName =
    body.patientFirstName ||
    (body.patientName || "").split(" ")[0] ||
    "Patient";

  const data: CancelRefundData = {
    patientFirstName: firstName,
    patientLastName: body.patientLastName || "",
    patientFullName: fullName,
    patientId: body.patientId || "—",
    patientEmail: body.patientEmail || "",
    providerName: body.providerName || "your AIMRx prescriber",
    providerEmail: body.providerEmail || "—",
    pharmacyName: body.pharmacyName || "—",
    orderNumber:
      body.orderNumber ||
      (body.prescriptionId ? String(body.prescriptionId).slice(0, 8) : "—"),
    prescriptionId: body.prescriptionId || "—",
    medication: body.medication || "your prescription",
    dose: body.dose || "—",
    quantity: body.quantity ?? "—",
    reason: body.reason || "—",
    date: now.toISOString().slice(0, 10),
    timestampUtc: now.toISOString(),
    performedByEmail: body.adminEmail || "(unknown admin)",
    systemLogId: body.logId || null,
    refundAmount,
    refundedAmountCents,
    originalAuthnetTxId: body.originalAuthnetTxId || null,
    refundAuthnetTxId: body.refundAuthnetTxId || null,
    cardType: body.cardType || null,
    cardLast4: body.cardLast4 || null,
  };

  const { subject, html, text } = renderCancelRefund(body.statusType, role, data);

  if (!SENDGRID_API_KEY) {
    return NextResponse.json({
      success: true,
      demoMode: true,
      subject,
      message: "Email logged (demo mode - no actual email sent)",
    });
  }

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
      text,
    });
    return NextResponse.json({ success: true, sent: to, role });
  } catch (err: any) {
    const msg =
      err?.response?.body?.errors?.[0]?.message ||
      err?.message ||
      "send failed";
    console.error("[STATUS-EMAIL] cancel/refund send failed:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-internal-api-key");
    if (!INTERNAL_API_KEY || authHeader !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const incomingStatusType = rawBody?.statusType;

    if (!incomingStatusType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (incomingStatusType === "cancelled" || incomingStatusType === "refunded") {
      return await handleCancelRefundEmail(rawBody as CancelRefundEmailRequest);
    }

    const body: StatusEmailRequest = rawBody;
    const { patientEmail, patientName, medication, providerName, statusType, trackingNumber, trackingUrl, prescriptionId } = body;

    if (!patientEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = getStatusContent(statusType as LegacyStatusType, body);
    const supabase = createCronClient();

    if (!SENDGRID_API_KEY) {
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: patientEmail,
        user_name: patientName || "Patient",
        action: "PATIENT_NOTIFICATION_SENT",
        details: `[DEMO MODE] ${config.subject} | To: ${patientEmail} | Medication: ${medication} | Provider: ${providerName} | Status: ${statusType}`,
        status: "success",
      });
      return NextResponse.json({
        success: true,
        message: "Email logged (demo mode - no actual email sent)",
        demoMode: true,
      });
    }

    const dedupKey = prescriptionId || `${medication}-${statusType}`;
    const guard = await checkEmailDedup(patientEmail, `${statusType}`, dedupKey, 60);
    if (!guard.allowed) {
      console.warn("[STATUS-EMAIL] Blocked:", guard.reason);
      return NextResponse.json({
        success: true,
        message: "Email already sent recently — skipped to prevent duplicate",
        skipped: true,
      });
    }

    const trackingButtonHtml = trackingNumber && trackingUrl
      ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 16px 20px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; font-weight: 600;">Tracking Number</p>
                  <p style="margin: 0; font-size: 16px; font-weight: 700; font-family: monospace; color: #1e3a8a;">${trackingNumber}</p>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <a href="${trackingUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px;">
                    Track Package
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
      : trackingNumber
        ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 16px 20px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
            <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; font-weight: 600;">Tracking Number</p>
            <p style="margin: 0; font-size: 16px; font-weight: 700; font-family: monospace; color: #1e3a8a;">${trackingNumber}</p>
          </td>
        </tr>
      </table>`
        : "";

    const plainPharmacy = body.pharmacyName ? `Pharmacy: ${body.pharmacyName}${body.pharmacyPhone ? ` | ${body.pharmacyPhone}` : ""}${body.pharmacyAddress ? ` | ${body.pharmacyAddress}` : ""}` : "";

    const msg = {
      to: patientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: config.subject,
      text: `Hi ${patientName},

${config.heading}

${config.message.replace(/<[^>]*>/g, "")}

${config.nextSteps.replace(/<[^>]*>/g, "")}
${trackingNumber ? `\nTracking Number: ${trackingNumber}` : ""}
${trackingUrl ? `Track your package: ${trackingUrl}` : ""}

Prescribing Clinician: ${providerName}
Medication: ${medication}
${plainPharmacy}

Your Prescription Progress:
${config.steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.label}${s.current ? " <-- You are here" : ""}`).join("\n")}

Need Help?
AIM Medical Support: ${AIM_SUPPORT_PHONE} (${AIM_SUPPORT_HOURS})
Email: support@aimrx.com

Thank you for trusting AIM Medical with your care.

(c) ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.
`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 28px; text-align: center; background: ${config.headerColor};">
              <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">${config.heading}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #334155;">
                Hi ${patientName},
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #334155;">
                ${config.message}
              </p>

              <!-- Prescription Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Prescription Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Prescribing Clinician</p>
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e3a8a;">${providerName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Medication</p>
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${medication}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${trackingButtonHtml}

              ${buildPharmacyContactHtml(body)}

              <!-- What's Next -->
              <div style="margin: 24px 0; padding: 20px; background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                <p style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #0c4a6e;">What Happens Next</p>
                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #334155;">
                  ${config.nextSteps}
                </p>
              </div>

              <!-- Progress Steps -->
              <div style="margin: 24px 0;">
                <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Your Prescription Progress</p>
                ${buildStepsHtml(config.steps)}
              </div>
            </td>
          </tr>

          <!-- AIM Support -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Need Help?</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1e293b;">AIM Medical Support</p>
                    <p style="margin: 0 0 2px; font-size: 13px; color: #475569;">Phone: <strong>${AIM_SUPPORT_PHONE}</strong> (${AIM_SUPPORT_HOURS})</p>
                    <p style="margin: 0; font-size: 13px; color: #475569;">Email: support@aimrx.com</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #64748b; text-align: center;">
                Thank you for trusting <strong>AIM Medical</strong> with your care.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #94a3b8; text-align: center;">
                &copy; ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    await sgMail.send(msg);

    let smsSent = false;
    const smsStatusMap: Record<string, "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup"> = {
      pharmacy_received: "pharmacy_processing",
      pharmacy_processing: "pharmacy_processing",
      shipped: "shipped",
      delivered: "delivered",
      ready_for_pickup: "ready_for_pickup",
    };
    const smsType = smsStatusMap[statusType];
    if (smsType && body.patientPhone && isSmsConfigured()) {
      const smsResult = await sendStatusSms(
        body.patientPhone,
        patientName || "Patient",
        medication || "your prescription",
        smsType,
        trackingNumber,
      );
      smsSent = smsResult.success;

      try {
        const smsStatusLabels: Record<string, string> = {
          pharmacy_processing: "Pharmacy Processing SMS",
          shipped: "Prescription Shipped SMS",
          delivered: "Delivery Confirmed SMS",
          ready_for_pickup: "Ready for Pickup SMS",
        };
        await supabase.from("system_logs").insert({
          user_id: null,
          user_email: body.patientPhone,
          user_name: patientName || "Patient",
          action: smsSent ? "PATIENT_SMS_SENT" : "PATIENT_SMS_FAILED",
          details: `${smsStatusLabels[smsType] || "Status SMS"} | To: ${body.patientPhone} | Medication: ${medication} | Provider: ${providerName} | Pharmacy: ${body.pharmacyName || "N/A"} | Status: ${statusType}${trackingNumber ? ` | Tracking: ${trackingNumber}` : ""}${prescriptionId ? ` | Rx: ${prescriptionId}` : ""}`,
          status: smsSent ? "success" : "error",
          ...(smsSent ? {} : { error_message: smsResult.error }),
        });
      } catch (_) {}
    }

    try {
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: patientEmail,
        user_name: patientName || "Patient",
        action: "PATIENT_NOTIFICATION_SENT",
        details: `${config.subject} | To: ${patientEmail} | Medication: ${medication} | Provider: ${providerName} | Pharmacy: ${body.pharmacyName || "N/A"} | Status: ${statusType}${trackingNumber ? ` | Tracking: ${trackingNumber}` : ""}${prescriptionId ? ` | Rx: ${prescriptionId}` : ""}`,
        status: "success",
      });
    } catch (_) {}

    return NextResponse.json({ success: true, smsSent });
  } catch (error) {
    console.error("[STATUS-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");

    try {
      const supabase = createCronClient();
      const body = await request.clone().json().catch(() => ({} as StatusEmailRequest));
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: body.patientEmail || "unknown",
        user_name: body.patientName || "Patient",
        action: "PATIENT_NOTIFICATION_FAILED",
        details: `Failed to send ${body.statusType} notification to ${body.patientEmail}: ${error instanceof Error ? error.message : "Unknown error"}`,
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (_) {}

    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 },
    );
  }
}
