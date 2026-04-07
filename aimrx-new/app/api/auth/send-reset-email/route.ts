import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import sgMail from "@sendgrid/mail";
import {
  emailWrapper,
  emailHeader,
  emailFooterWithSupport,
  GRADIENTS,
} from "@core/services/email/emailTemplates";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://smartconnect-rx.onrender.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: true });
    }

    if (!SENDGRID_API_KEY) {
      console.error("SendGrid API key not configured for password reset");
      return NextResponse.json({ success: true });
    }

    const supabase = createAdminClient();

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: email.trim().toLowerCase(),
      });

    if (linkError || !linkData) {
      console.error("Error generating recovery link:", linkError?.message);
      return NextResponse.json({ success: true });
    }

    const hashedToken =
      linkData.properties?.hashed_token || "";

    if (!hashedToken) {
      console.error("No hashed_token in recovery link response");
      return NextResponse.json({ success: true });
    }

    const resetUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const htmlContent = emailWrapper(`
      ${emailHeader({
        gradient: GRADIENTS.navyBlue,
        heading: "Password Reset Request",
        subtext: "We received a request to reset your password",
      })}
      <tr>
        <td style="padding: 36px 40px;">
          <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
            Hello,
          </p>
          <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.6;">
            We received a request to reset the password for your SmartConnect RX account.
            Click the button below to set a new password.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding: 8px 0 24px;">
                <a href="${resetUrl}" target="_blank"
                   style="display: inline-block; background: ${GRADIENTS.ctaButton}; color: #ffffff;
                          font-size: 16px; font-weight: 600; padding: 14px 40px;
                          border-radius: 8px; text-decoration: none;">
                  Reset My Password
                </a>
              </td>
            </tr>
          </table>

          <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #92400E; line-height: 1.5;">
              <strong>⏱ This link expires in 1 hour.</strong> If you did not request a password reset,
              please ignore this email. Your password will remain unchanged.
            </p>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #475569;">🔒 Security Notice</p>
            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
              This is an automated message. SmartConnect RX will never ask you for your password via email.
              If you didn't request this reset, your account is still secure — no action is needed.
            </p>
          </div>
        </td>
      </tr>
      ${emailFooterWithSupport()}
    `);

    const msg = {
      to: email.trim().toLowerCase(),
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: "Reset Your SmartConnect RX Password",
      html: htmlContent,
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in send-reset-email:", error);
    return NextResponse.json({ success: true });
  }
}
