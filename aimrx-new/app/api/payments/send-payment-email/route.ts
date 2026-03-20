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
  if (!color) return "#00AEEF";
  return /^#[0-9A-Fa-f]{3,8}$/.test(color) ? color : "#00AEEF";
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
      paymentUrl,
      pharmacyName,
      pharmacyLogoUrl,
      pharmacyColor,
    } = body;

    if (!patientEmail || !paymentUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const brandColor = sanitizeColor(pharmacyColor);
    const brandName = escHtml(pharmacyName) || "SmartConnect RX";
    const safeName = escHtml(pharmacyName);
    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;
    const safeLogoUrl = sanitizeUrl(pharmacyLogoUrl);
    const safePaymentUrl = sanitizeUrl(paymentUrl);
    const safePatientName = escHtml(patientName);
    const safeProviderName = escHtml(providerName);
    const safeMedication = escHtml(medication);
    const safeTotalAmount = escHtml(totalAmount);

    const logoHtml = safeLogoUrl
      ? `<img src="${safeLogoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 200px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />`
      : "";

    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: fromName,
      },
      subject: `Payment Required: ${medication} Prescription${pharmacyName ? ` - ${pharmacyName}` : ""}`,
      text: `
Hi ${patientName},

Your prescription for ${medication} is ready for payment.

Prescribed by: ${providerName}
${pharmacyName ? `Pharmacy: ${pharmacyName}` : ""}
Medication: ${medication}
Total Amount Due: $${totalAmount}

Complete your payment here:
${paymentUrl}

This link expires in 7 days.

Questions? Contact your provider or reply to this email.

\u00a9 ${new Date().getFullYear()} ${pharmacyName || "SmartConnect RX"}. All rights reserved.
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, ${brandColor} 0%, #1E3A8A 100%); border-radius: 8px 8px 0 0;">
              ${logoHtml}
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Payment Request</h1>
              ${safeName ? `<p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">from ${safeName}</p>` : ""}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Hi ${safePatientName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Your prescription for <strong>${safeMedication}</strong> is ready for payment. Please complete your payment to proceed with fulfillment.
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid ${brandColor};">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Prescribed by:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #1E3A8A;">${safeProviderName}</p>

                    ${safeName ? `
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Pharmacy:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${safeName}</p>
                    ` : ""}

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Medication:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${safeMedication}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Total Amount Due:</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${brandColor};">$${safeTotalAmount}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${safePaymentUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, ${brandColor} 0%, #1E3A8A 100%); color: #ffffff; text-decoration: none; font-size: 18px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      Pay Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 20px; color: #666666; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${safePaymentUrl}" style="color: ${brandColor}; word-break: break-all;">${safePaymentUrl}</a>
              </p>

              <!-- Security Note -->
              <div style="margin-top: 30px; padding: 15px; background-color: #f0f7ff; border-radius: 6px; border-left: 4px solid #1E3A8A;">
                <p style="margin: 0; font-size: 13px; line-height: 18px; color: #1E3A8A;">
                  <strong>\ud83d\udd12 Secure Payment:</strong> This link directs you to our secure payment processor. Your payment information is encrypted and protected.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e9ecef; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; line-height: 18px; color: #666666; text-align: center;">
                Questions? Contact your provider or reply to this email.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 16px; color: #999999; text-align: center;">
                This payment link expires in 7 days. Please complete payment before expiration.
              </p>
            </td>
          </tr>
        </table>

        <!-- Unsubscribe -->
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
    console.error("[SEND-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
      },
      { status: 500 }
    );
  }
}
