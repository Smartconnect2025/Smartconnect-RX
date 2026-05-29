import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createCronClient } from "@/core/cron/supabase";
import { checkEmailDedup } from "@/core/services/email-guard";
import { sendPaymentLinkSms, isSmsConfigured } from "@/core/services/sms";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const AIM_SUPPORT_PHONE = "(769) 304-1830";
const AIM_SUPPORT_HOURS = "Mon\u2013Fri 9AM\u20136PM CST";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-internal-api-key");
    if (!INTERNAL_API_KEY || authHeader !== INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      patientEmail,
      patientName,
      providerName,
      medication,
      medications,
      totalAmount,
      paymentUrl,
    } = body;

    if (!patientEmail || !paymentUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const medList: Array<{ name: string; price?: string }> = medications && Array.isArray(medications)
      ? medications
      : [{ name: medication || "Prescription" }];
    const isMultiMed = medList.length > 1;
    const medicationDisplay = isMultiMed
      ? medList.map((m) => m.name).join(", ")
      : (medication || medList[0]?.name || "Prescription");

    const safePatientName = escapeHtml(patientName || "Valued Patient");
    const safeProviderName = escapeHtml(providerName || "Your Provider");
    const safeMedicationDisplay = escapeHtml(medicationDisplay);
    const safeMedList = medList.map((m) => ({
      name: escapeHtml(m.name),
      price: m.price,
    }));

    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const dedupKey = body.paymentToken || body.prescriptionId || medicationDisplay;
    const guard = await checkEmailDedup(patientEmail, "Payment Request Email", dedupKey, 30);
    if (!guard.allowed) {
      console.warn("[SEND-EMAIL] Blocked:", guard.reason);
      return NextResponse.json({
        success: true,
        message: "Email already sent recently — skipped to prevent duplicate",
        skipped: true,
      });
    }

    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: `Action Needed: Complete Payment for Your ${medicationDisplay} Prescription`,
      text: `Hi ${patientName},

AIM Medical is coordinating your prescription care.

Prescribing Clinician: ${providerName}
Medication: ${medicationDisplay}
Amount Due: $${totalAmount}

Please complete your secure payment using the link below:
${paymentUrl}

This payment link does not expire — you can complete payment at any time.

Your Prescription Progress:
[x] Prescription Received
[ ] Payment Pending <-- You are here
[ ] Pharmacy Processing
[ ] Shipped with Tracking
[ ] Delivered

Your payment is processed through Authorize.Net, a trusted and encrypted payment processor. Your financial information is never stored on our servers.

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
  <title>Complete Your Prescription Payment</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 28px; text-align: center; background: linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%);">
              <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">Complete Your Prescription Payment</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #334155;">
                Hi ${safePatientName},
              </p>

              <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #334155;">
                Your prescription for <strong>${safeMedicationDisplay}</strong>, prescribed by <strong>${safeProviderName}</strong>, is ready for payment. Please complete your payment so we can begin preparing your order.
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
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e3a8a;">${safeProviderName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Medication${isMultiMed ? "s" : ""}</p>
                          ${isMultiMed
                            ? safeMedList.map((m) => `<p style="margin: 2px 0 0; font-size: 14px; color: #1e293b;">&#8226; <strong>${m.name}</strong>${m.price ? ` — $${m.price}` : ""}</p>`).join("")
                            : `<p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${safeMedicationDisplay}</p>`}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Total Amount Due</p>
                          <p style="margin: 2px 0 0; font-size: 22px; font-weight: 700; color: #00AEEF;">$${totalAmount}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${paymentUrl}" style="display: inline-block; padding: 16px 52px; background: linear-gradient(135deg, #1E3A8A 0%, #00AEEF 100%); color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);">
                      Complete Secure Payment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 16px 0 0; font-size: 13px; line-height: 18px; color: #94a3b8; text-align: center;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${paymentUrl}" style="color: #00AEEF; word-break: break-all; font-size: 12px;">${paymentUrl}</a>
              </p>

              <!-- Security Note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #0c4a6e;">
                      <strong>Secure Payment:</strong> This link directs you to Authorize.Net, a trusted and encrypted payment processor. Your financial information is never stored on our servers and is fully protected.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Progress Steps -->
              <div style="margin: 24px 0;">
                <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Your Prescription Progress</p>
                <div style="padding: 14px 16px; border-left: 3px solid #10B981; background-color: #fafafa; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #10B981;">\u2713 Prescription Received</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #f59e0b; background-color: #fffbeb; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 700; color: #d97706;">\u25CB Payment Pending  \u2190 You are here</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB Pharmacy Processing</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB Shipped with Tracking</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB Delivered</p>
                </div>
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
              <p style="margin: 0 0 4px; font-size: 12px; line-height: 16px; color: #94a3b8; text-align: center;">
                This payment link does not expire &mdash; you can complete payment at any time.
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
    const patientPhone = body.patientPhone;
    if (patientPhone && isSmsConfigured()) {
      const smsResult = await sendPaymentLinkSms(
        patientPhone,
        patientName || "Patient",
        medication || medicationDisplay,
        totalAmount,
        paymentUrl,
        providerName,
      );
      smsSent = smsResult.success;

      try {
        const smsSupabase = createCronClient();
        await smsSupabase.from("system_logs").insert({
          user_id: null,
          user_email: patientPhone,
          user_name: patientName || "Patient",
          action: smsSent ? "PATIENT_SMS_SENT" : "PATIENT_SMS_FAILED",
          details: `Payment Request SMS | To: ${patientPhone} | Medication: ${medication} | Amount: $${totalAmount} | Provider: ${providerName}`,
          status: smsSent ? "success" : "error",
          ...(smsSent ? {} : { error_message: smsResult.error }),
        });
      } catch (_) {}
    }

    try {
      const supabase = createCronClient();
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: patientEmail,
        user_name: patientName || "Patient",
        action: "PATIENT_NOTIFICATION_SENT",
        details: `Payment Request Email | To: ${patientEmail} | Medication: ${medication} | Amount: $${totalAmount} | Provider: ${providerName}`,
        status: "success",
      });
    } catch (_) {}

    return NextResponse.json({ success: true, smsSent });
  } catch (error) {
    console.error("[SEND-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");

    try {
      const supabase = createCronClient();
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "unknown",
        user_name: "Patient",
        action: "PATIENT_NOTIFICATION_FAILED",
        details: `Failed to send Payment Request Email: ${error instanceof Error ? error.message : "Unknown error"}`,
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (_) {}

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
      },
      { status: 500 }
    );
  }
}
