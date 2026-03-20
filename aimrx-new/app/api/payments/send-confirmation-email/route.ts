import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@smartconnectrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sanitizeColor(color: string | undefined | null): string {
  if (!color) return "#10B981";
  return /^#[0-9A-Fa-f]{3,8}$/.test(color) ? color : "#10B981";
}

function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
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
      totalAmount,
      transactionId,
      deliveryMethod,
      pharmacyName,
      pharmacyLogoUrl,
      pharmacyColor,
    } = body;

    if (!patientEmail || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const deliveryTexts = {
      pickup: "Pharmacy Pickup",
      delivery: "Local Delivery",
      shipping: "Shipping with Tracking",
    } as const;

    const nextStepsTexts = {
      pickup: "Your provider will approve the order, and the pharmacy will notify you when your medication is ready for pickup.",
      delivery: "Your provider will approve the order, and the pharmacy will deliver your medication to your address.",
      shipping: "Your provider will approve the order, and the pharmacy will ship your medication. You'll receive tracking information once it ships.",
    } as const;

    const deliveryDisplayText = deliveryTexts[deliveryMethod as keyof typeof deliveryTexts] || "Pharmacy Pickup";
    const nextStepsText = nextStepsTexts[deliveryMethod as keyof typeof nextStepsTexts] || "Your provider will approve the order, and the pharmacy will prepare your medication.";

    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const brandColor = sanitizeColor(pharmacyColor);
    const accentColor = brandColor;
    const brandName = escHtml(pharmacyName) || "SmartConnect RX";
    const safeName = escHtml(pharmacyName);
    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;
    const safeLogoUrl = sanitizeUrl(pharmacyLogoUrl);
    const safePatientName = escHtml(patientName);
    const safeProviderName = escHtml(providerName);
    const safeMedication = escHtml(medication);
    const safeTotalAmount = escHtml(totalAmount);
    const safeTransactionId = escHtml(transactionId);

    const logoHtml = safeLogoUrl
      ? `<img src="${safeLogoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 200px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />`
      : "";

    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: fromName,
      },
      subject: `Payment Confirmed: ${medication} Prescription${pharmacyName ? ` - ${pharmacyName}` : ""}`,
      text: `
Hi ${patientName},

Payment Confirmed!

Your payment has been successfully processed. Thank you for completing your payment for ${medication}.

Transaction Details:
- Transaction ID: ${transactionId}
- Prescribed by: ${providerName}
- Medication: ${medication}
${pharmacyName ? `- Pharmacy: ${pharmacyName}` : ''}
- Fulfillment Method: ${deliveryDisplayText}
- Amount Paid: $${totalAmount}

What's Next?
${nextStepsText}

Order Progress:
\u2713 Payment Received
\u25cb Provider Approval
\u25cb Pharmacy Processing
\u25cb ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}

We'll send you updates as your order progresses through each stage.

Questions? Contact your provider or reply to this email.

Keep this email for your records.

\u00a9 ${new Date().getFullYear()} ${brandName}
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, ${brandColor} 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              ${logoHtml}
              <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 36px;">\u2713</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Payment Confirmed!</h1>
              ${safeName ? `<p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">via ${safeName}</p>` : ''}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Hi ${safePatientName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Your payment has been successfully processed. Thank you for completing your payment for <strong>${safeMedication}</strong>.
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid ${accentColor};">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Transaction ID:</p>
                    <p style="margin: 0 0 15px; font-size: 14px; font-family: monospace; color: #333333;">${safeTransactionId}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Prescribed by:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #1E3A8A;">${safeProviderName}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Medication:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${safeMedication}</p>

                    ${safeName ? `
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Pharmacy:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${safeName}</p>
                    ` : ''}

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Fulfillment Method:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${deliveryDisplayText}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Amount Paid:</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${accentColor};">$${safeTotalAmount}</p>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f0f9ff; border-radius: 6px; border-left: 4px solid #1E3A8A;">
                <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #1E3A8A;">What's Next?</h3>
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #334155;">
                  ${nextStepsText}
                </p>
              </div>

              <!-- Progress Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td>
                    <div style="padding: 15px; border-left: 3px solid ${accentColor}; background-color: #f0fdf4; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${accentColor};">\u2713 Payment Received</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">\u25cb Provider Approval</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">\u25cb Pharmacy Processing</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">\u25cb ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #666666;">
                We'll send you updates as your order progresses through each stage.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; line-height: 18px; color: #666666; text-align: center;">
                Questions? Contact your provider or reply to this email.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 16px; color: #999999; text-align: center;">
                Keep this email for your records. Transaction ID: ${safeTransactionId}
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer Text -->
        <p style="margin: 20px 0 0; font-size: 11px; line-height: 16px; color: #999999; text-align: center;">
          \u00a9 ${new Date().getFullYear()} ${brandName}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONFIRM-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
      },
      { status: 500 }
    );
  }
}
