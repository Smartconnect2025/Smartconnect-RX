import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.aimrx.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: true });
    }

    if (!SENDGRID_API_KEY) {
      console.error("SendGrid API key not configured");
      return NextResponse.json({ success: true });
    }

    const supabase = createAdminClient();

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: `${SITE_URL}/auth/reset-password`,
        },
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("Error generating reset link:", linkError);
      return NextResponse.json({ success: true });
    }

    const tokenHash = linkData.properties.hashed_token;
    const resetLink = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: "Reset Your Password",
      text: `You requested a password reset for your AIM RX Portal account.\n\nClick the following link to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\n© ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 28px; text-align: center; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">
              <img src="${SITE_URL}/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">Reset Your Password</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">AIM RX Portal</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #334155;">
                We received a request to reset your password. Click the button below to set a new password:
              </p>

              <!-- Button -->
              <div style="margin: 24px 0; text-align: center;">
                <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">Reset Password</a>
              </div>

              <!-- Expiry Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #fffbeb; border-left: 3px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; line-height: 22px; color: #92400e;">
                      <strong>&#9200; This link expires in 1 hour.</strong> Do not share this link with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 22px; color: #64748b;">
                If you didn't request this password reset, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f8fafc;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Security Notice</p>
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #64748b;">
                      AIM RX will never ask for your password via phone or text. If someone requests your code, do not share it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in send-reset-email:", error);
    return NextResponse.json({ success: true });
  }
}
