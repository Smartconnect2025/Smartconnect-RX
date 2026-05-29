import { createAdminClient } from "@core/database/client";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";

const MFA_CODE_EXPIRY_MINUTES = 10;
const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCKOUT_MINUTES = 15;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function generateMFACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendMFACode(
  userId: string,
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!SENDGRID_API_KEY) {
      console.error("SendGrid API key not configured");
      return { success: false, error: "Email service not configured" };
    }

    const supabase = createAdminClient();

    const code = generateMFACode();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + MFA_CODE_EXPIRY_MINUTES);

    await supabase
      .from("mfa_codes")
      .update({ is_used: true })
      .eq("user_id", userId)
      .eq("is_used", false);

    const { error: dbError } = await supabase.from("mfa_codes").insert({
      user_id: userId,
      code: code,
      expires_at: expiresAt.toISOString(),
      is_used: false,
    });

    if (dbError) {
      console.error("Error storing MFA code:", dbError);
      return { success: false, error: "Failed to generate verification code" };
    }

    const msg = {
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}\n\nThis code will expire in ${MFA_CODE_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.\n\n(c) ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 28px; text-align: center; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">
              <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 60px; margin-bottom: 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">Verification Code</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Secure login to AIM RX Portal</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 40px 20px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 26px; color: #334155;">
                Enter the following code to complete your login:
              </p>

              <!-- Code Box -->
              <div style="margin: 24px 0; padding: 28px 20px; text-align: center; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 2px solid #bae6fd;">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #1e3a8a; font-family: 'Courier New', monospace;">${code}</span>
              </div>

              <!-- Expiry Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #fffbeb; border-left: 3px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; line-height: 22px; color: #92400e;">
                      <strong>&#9200; This code expires in ${MFA_CODE_EXPIRY_MINUTES} minutes.</strong> Do not share this code with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 22px; color: #64748b;">
                If you didn't request this code, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Security Notice</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">AIM RX will never ask for your verification code via phone or text. If someone requests your code, do not share it.</p>
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

    return { success: true };
  } catch (error: unknown) {
    const sgError = error as { response?: { body?: { errors?: Array<{ message: string }> } }; message?: string };
    if (sgError?.response?.body?.errors) {
      console.error("SendGrid API error:", JSON.stringify(sgError.response.body.errors));
    } else {
      console.error("Error sending MFA code:", sgError?.message || error);
    }
    return { success: false, error: "Failed to send verification code" };
  }
}

export async function verifyMFACode(
  userId: string,
  code: string,
): Promise<{ success: boolean; error?: string; locked?: boolean }> {
  try {
    const supabase = createAdminClient();

    const { data: lockoutRecord } = await supabase
      .from("mfa_verification_attempts")
      .select("locked_until, failed_attempts")
      .eq("user_id", userId)
      .single();

    if (lockoutRecord?.locked_until) {
      const lockedUntil = new Date(lockoutRecord.locked_until);
      if (lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        console.warn(`[MFA] User ${userId} is locked out until ${lockedUntil.toISOString()}`);
        return {
          success: false,
          error: `Too many failed attempts. Please wait ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} and try again.`,
          locked: true,
        };
      }
    }

    const { data: mfaCode, error: fetchError } = await supabase
      .from("mfa_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("code", code)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !mfaCode) {
      const currentAttempts = (lockoutRecord?.failed_attempts || 0) + 1;

      const updateData: Record<string, unknown> = {
        user_id: userId,
        failed_attempts: currentAttempts,
        last_failed_at: new Date().toISOString(),
      };

      if (currentAttempts >= MFA_MAX_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + MFA_LOCKOUT_MINUTES);
        updateData.locked_until = lockUntil.toISOString();
        console.warn(`[MFA] User ${userId} locked out after ${currentAttempts} failed attempts until ${lockUntil.toISOString()}`);
      }

      if (lockoutRecord) {
        await supabase
          .from("mfa_verification_attempts")
          .update(updateData)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("mfa_verification_attempts")
          .insert(updateData);
      }

      const remainingAttempts = MFA_MAX_ATTEMPTS - currentAttempts;

      if (remainingAttempts <= 0) {
        return {
          success: false,
          error: `Too many failed attempts. Please wait ${MFA_LOCKOUT_MINUTES} minutes and try again.`,
          locked: true,
        };
      }

      return {
        success: false,
        error: `Invalid or expired code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
      };
    }

    await supabase
      .from("mfa_codes")
      .update({ is_used: true })
      .eq("id", mfaCode.id);

    if (lockoutRecord) {
      await supabase
        .from("mfa_verification_attempts")
        .update({
          failed_attempts: 0,
          locked_until: null,
          last_failed_at: null,
        })
        .eq("user_id", userId);
    }

    return { success: true };
  } catch (error) {
    console.error("Error verifying MFA code:", error);
    return { success: false, error: "Failed to verify code" };
  }
}
