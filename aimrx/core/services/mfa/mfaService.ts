import { createAdminClient } from "@core/database/client";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM Medical";

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
      text: `Your verification code is: ${code}\n\nThis code will expire in ${MFA_CODE_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p style="font-size: 16px; color: #666;">Enter this code to complete your login:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #999;">This code will expire in ${MFA_CODE_EXPIRY_MINUTES} minutes.</p>
          <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    await sgMail.send(msg);

    return { success: true };
  } catch (error) {
    console.error("Error sending MFA code:", error);
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
