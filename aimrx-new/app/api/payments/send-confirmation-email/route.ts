import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@smartconnectrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";

// Internal API key for server-to-server calls (prevents external abuse)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * POST /api/payments/send-confirmation-email
 * Send payment confirmation email to patient after successful payment
 * PROTECTED: Requires internal API key (server-to-server only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key to prevent external abuse
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
    } = body;

    if (!patientEmail || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Determine delivery method display text
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

    // If no API key is configured, run in demo mode
    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    // Send email using SendGrid
    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: `Payment Confirmed: ${medication} Prescription`,
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
✓ Payment Received
○ Provider Approval
○ Pharmacy Processing
○ ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}

We'll send you updates as your order progresses through each stage.

Questions? Contact your provider or reply to this email.

Keep this email for your records.

© ${new Date().getFullYear()} SmartConnect RX
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
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 36px;">✓</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Payment Confirmed!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Hi ${patientName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #333333;">
                Your payment has been successfully processed. Thank you for completing your payment for <strong>${medication}</strong>.
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #10B981;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Transaction ID:</p>
                    <p style="margin: 0 0 15px; font-size: 14px; font-family: monospace; color: #333333;">${transactionId}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Prescribed by:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #1E3A8A;">${providerName}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Medication:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${medication}</p>

                    ${pharmacyName ? `
                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Pharmacy:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${pharmacyName}</p>
                    ` : ''}

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Fulfillment Method:</p>
                    <p style="margin: 0 0 15px; font-size: 16px; font-weight: 600; color: #333333;">${deliveryDisplayText}</p>

                    <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">Amount Paid:</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #10B981;">$${totalAmount}</p>
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
                    <div style="padding: 15px; border-left: 3px solid #10B981; background-color: #f0fdf4; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #10B981;">✓ Payment Received</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">○ Provider Approval</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; margin-bottom: 10px; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">○ Pharmacy Processing</p>
                    </div>
                    <div style="padding: 15px; border-left: 3px solid #E5E7EB; background-color: #f9fafb; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6B7280;">○ ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}</p>
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
                Keep this email for your records. Transaction ID: ${transactionId}
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer Text -->
        <p style="margin: 20px 0 0; font-size: 11px; line-height: 16px; color: #999999; text-align: center;">
          © ${new Date().getFullYear()} SmartConnect RX. All rights reserved.
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
