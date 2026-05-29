import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { createCronClient } from "@/core/cron/supabase";
import { checkEmailDedup } from "@/core/services/email-guard";
import { sendSms, isSmsConfigured } from "@/core/services/sms";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      patientEmail,
      patientName,
      providerName,
      medication,
      medications,
      oversightFee,
      totalAmount,
      transactionId,
      deliveryMethod,
      pharmacyName,
    } = body;

    if (!patientEmail || !transactionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const medList: Array<{ name: string; price?: string; shippingFee?: string }> = medications && Array.isArray(medications)
      ? medications
      : [{ name: medication || "Prescription" }];
    const isMultiMed = medList.length > 1;
    const medicationDisplay = isMultiMed
      ? medList.map((m) => m.name).join(", ")
      : (medication || medList[0]?.name || "Prescription");

    const safePatientName = escapeHtml(patientName || "Valued Patient");
    const safeProviderName = escapeHtml(providerName || "Your Provider");
    const safeMedicationDisplay = escapeHtml(medicationDisplay);
    const safePharmacyName = pharmacyName ? escapeHtml(pharmacyName) : "";
    const safeMedList = medList.map((m) => ({
      name: escapeHtml(m.name),
      price: m.price,
      shippingFee: m.shippingFee,
    }));

    const hasAnyShipping = medList.some((m) => m.shippingFee && parseFloat(m.shippingFee) > 0);
    const hasOversight = oversightFee && parseFloat(oversightFee) > 0;
    const hasBreakdown = hasAnyShipping || hasOversight;
    const medicationSubtotal = medList.reduce((sum, m) => sum + (m.price ? parseFloat(m.price) : 0), 0);
    const shippingTotal = medList.reduce((sum, m) => sum + (m.shippingFee ? parseFloat(m.shippingFee) : 0), 0);
    const oversightTotal = hasOversight ? parseFloat(oversightFee) : 0;

    const deliveryTexts: Record<string, string> = {
      pickup: "Pharmacy Pickup",
      delivery: "Local Delivery",
      shipping: "Shipping with Tracking",
    };

    const nextStepsTexts: Record<string, string> = {
      pickup: "Your provider will approve the order, and the pharmacy will notify you when your medication is ready for pickup. We will send you an email as soon as it is ready.",
      delivery: "Your provider will approve the order, and the pharmacy will deliver your medication to your address. We will keep you updated on your delivery status.",
      shipping: "Your provider will approve the order, and the pharmacy will ship your medication. You will receive another email with full tracking details once it ships.",
    };

    const deliveryDisplayText = deliveryTexts[deliveryMethod] || "Pharmacy Pickup";
    const nextStepsText = nextStepsTexts[deliveryMethod] || "Your provider will approve the order, and the pharmacy will prepare your medication. We will keep you updated on your order status.";

    const lastStepLabel = deliveryMethod === "pickup" ? "Ready for Pickup" : "Shipped with Tracking";

    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: "Email logged (demo mode - no actual email sent)",
        demoMode: true,
      });
    }

    const dedupKey = transactionId || medicationDisplay;
    const guard = await checkEmailDedup(patientEmail, "Payment Confirmation Email", dedupKey, 30);
    if (!guard.allowed) {
      console.warn("[CONFIRM-EMAIL] Blocked:", guard.reason);
      return NextResponse.json({
        success: true,
        message: "Email already sent recently — skipped to prevent duplicate",
        skipped: true,
      });
    }

    const msg = {
      to: patientEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `Payment Confirmed: ${medicationDisplay} Prescription`,
      text: `Hi ${patientName},

Your payment has been successfully received. Thank you for completing your payment for ${medicationDisplay}.

Transaction ID: ${transactionId}
Prescribing Clinician: ${providerName}
Medication: ${medicationDisplay}
${pharmacyName ? `Pharmacy: ${pharmacyName}` : ""}
Fulfillment Method: ${deliveryDisplayText}
Amount Paid: $${totalAmount}

What Happens Next:
${nextStepsText}

Your Prescription Progress:
[x] Prescription Received
[x] Payment Confirmed <-- You are here
[ ] Pharmacy Processing
[ ] ${lastStepLabel}
[ ] Delivered / Completed

We will send you updates as your order progresses through each stage. Please keep this email for your records.

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
  <title>Payment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 28px; text-align: center; background: linear-gradient(135deg, #10B981 0%, #059669 100%);">
              <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">Payment Confirmed</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #334155;">
                Hi ${safePatientName},
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 26px; color: #334155;">
                Your payment has been successfully received. Thank you for completing your payment for <strong>${safeMedicationDisplay}</strong>, prescribed by <strong>${safeProviderName}</strong>.
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Transaction Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Transaction ID</p>
                          <p style="margin: 2px 0 0; font-size: 14px; font-weight: 600; font-family: monospace; color: #1e293b;">${transactionId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Prescribing Clinician</p>
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e3a8a;">${safeProviderName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Medication${isMultiMed ? "s" : ""}</p>
                          ${safeMedList.map((m) => `<p style="margin: 2px 0 0; font-size: 14px; color: #1e293b;">&#8226; <strong>${m.name}</strong>${m.price ? ` — $${m.price}` : ""}</p>`).join("")}
                        </td>
                      </tr>
                      ${hasBreakdown ? `
                      <tr>
                        <td style="padding: 10px 0 6px;">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 10px;">
                            <tr>
                              <td style="padding: 4px 0;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size: 14px; color: #475569;">Medications Subtotal</td>
                                    <td align="right" style="font-size: 14px; font-weight: 600; color: #1e293b;">$${medicationSubtotal.toFixed(2)}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            ${hasAnyShipping ? `<tr>
                              <td style="padding: 4px 0;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size: 14px; color: #475569;">Shipping &amp; Handling</td>
                                    <td align="right" style="font-size: 14px; font-weight: 600; color: #1e293b;">$${shippingTotal.toFixed(2)}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>` : ""}
                            ${hasOversight ? `<tr>
                              <td style="padding: 4px 0;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="font-size: 14px; color: #475569;">Oversight &amp; Monitoring Fees</td>
                                    <td align="right" style="font-size: 14px; font-weight: 600; color: #1e293b;">$${oversightTotal.toFixed(2)}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>` : ""}
                          </table>
                        </td>
                      </tr>` : ""}
                      ${pharmacyName ? `
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Fulfilling Pharmacy</p>
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${safePharmacyName}</p>
                        </td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Fulfillment Method</p>
                          <p style="margin: 2px 0 0; font-size: 15px; font-weight: 600; color: #1e293b;">${deliveryDisplayText}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">
                          <p style="margin: 0; font-size: 13px; color: #64748b;">Amount Paid</p>
                          <p style="margin: 2px 0 0; font-size: 22px; font-weight: 700; color: #10B981;">$${totalAmount}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Next -->
              <div style="margin: 24px 0; padding: 20px; background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                <p style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #0c4a6e;">What Happens Next</p>
                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #334155;">
                  ${nextStepsText}
                </p>
              </div>

              <!-- Progress Steps -->
              <div style="margin: 24px 0;">
                <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Your Prescription Progress</p>
                <div style="padding: 14px 16px; border-left: 3px solid #10B981; background-color: #fafafa; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #10B981;">\u2713 Prescription Received</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #10B981; background-color: #f0fdf4; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 700; color: #10B981;">\u2713 Payment Confirmed  \u2190 You are here</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB Pharmacy Processing</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 8px; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB ${lastStepLabel}</p>
                </div>
                <div style="padding: 14px 16px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #9CA3AF;">\u25CB Delivered / Completed</p>
                </div>
              </div>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 22px; color: #64748b;">
                We will send you updates as your order progresses through each stage. Please keep this email for your records.
              </p>
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
              <p style="margin: 0 0 4px; font-size: 11px; line-height: 16px; color: #94a3b8; text-align: center;">
                Transaction ID: ${transactionId}
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
      const smsMessage =
        `AIM Medical: Hi ${patientName || "Patient"}, ` +
        `your payment of $${totalAmount} for ${medication || "your prescription"} has been received. ` +
        `Transaction ID: ${transactionId}. ` +
        `Your pharmacy will begin preparing your order. ` +
        `Questions? Call (769) 304-1830. Reply STOP to opt out.`;
      const smsResult = await sendSms(patientPhone, smsMessage);
      smsSent = smsResult.success;

      try {
        const smsSupabase = createCronClient();
        await smsSupabase.from("system_logs").insert({
          user_id: null,
          user_email: patientPhone,
          user_name: patientName || "Patient",
          action: smsSent ? "PATIENT_SMS_SENT" : "PATIENT_SMS_FAILED",
          details: `Payment Confirmation SMS | To: ${patientPhone} | Medication: ${medication} | Amount: $${totalAmount} | Transaction: ${transactionId} | Provider: ${providerName}`,
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
        details: `Payment Confirmation Email | To: ${patientEmail} | Medication: ${medication} | Amount: $${totalAmount} | Transaction: ${transactionId} | Provider: ${providerName}`,
        status: "success",
      });
    } catch (_) {}

    return NextResponse.json({ success: true, smsSent });
  } catch (error) {
    console.error("[CONFIRM-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");

    try {
      const supabase = createCronClient();
      await supabase.from("system_logs").insert({
        user_id: null,
        user_email: "unknown",
        user_name: "Patient",
        action: "PATIENT_NOTIFICATION_FAILED",
        details: `Failed to send Payment Confirmation Email: ${error instanceof Error ? error.message : "Unknown error"}`,
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
