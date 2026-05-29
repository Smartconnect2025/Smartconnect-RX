import "server-only";

import sgMail from "@sendgrid/mail";

import { createAdminClient } from "@core/database/client";
import { scrubError } from "@core/auth/scrub-trust-token";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const SECURITY_PAGE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/security`
    : "https://app.aimrx.com/security";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface NewTrustedDeviceEmailArgs {
  userId: string;
  userAgent: string | null;
  ip: string | null;
  grantedAt: Date;
}

/**
 * Step 13 (HIPAA best-practice security alert): notify the account
 * owner whenever a NEW browser is trusted on their account, similar to
 * Google's "new sign-in detected" or a bank's new-device alert.
 *
 * Fire-and-forget. Never throws. Email-send failure must NEVER affect
 * the calling MFA flow. Only the SHA-256 fingerprint is stored in
 * trusted_devices (HIPAA Step 10) so this email also avoids printing
 * the raw fingerprint or any token; only the user-agent string and IP
 * are surfaced, both of which the user already knows.
 *
 * Recipient policy: the email goes ONLY to the email on file in
 * Supabase Auth for `userId` — never to admins, never to other
 * providers, never to patients. Sending it elsewhere would itself be
 * a privacy issue.
 */
export async function sendNewTrustedDeviceEmail(
  args: NewTrustedDeviceEmailArgs,
): Promise<void> {
  try {
    if (!SENDGRID_API_KEY) {
      // SendGrid intentionally not configured in dev — silently skip,
      // never warn loudly because that would spam every dev grant.
      return;
    }
    if (!args.userId) return;

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.getUserById(args.userId);
    if (error || !data?.user?.email) {
      console.error("[trusted-device-email] could not resolve user email", {
        userId: args.userId,
        error: scrubError(error),
      });
      return;
    }
    const recipient = data.user.email;

    const browserLabel = describeUserAgent(args.userAgent);
    const ipLabel = args.ip ?? "unknown";
    const timeLabel = formatTime(args.grantedAt);

    const subject = "A new device was trusted on your AimRX account";
    const text = `Hi,

A new browser was just trusted on your AIM Rx Portal account. Future logins from this browser will skip the 6-digit verification code for the next 90 days.

  Browser: ${browserLabel}
  IP address: ${ipLabel}
  Time: ${timeLabel}

If this was you, no action needed.

If this WASN'T you, please:
  1) Open ${SECURITY_PAGE_URL} and remove the device immediately.
  2) Change your AimRX password.
  3) Contact support@aimrx.com if anything looks wrong.

(c) ${new Date().getFullYear()} AIM Medical Technologies. All rights reserved.
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New trusted device</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="padding: 36px 40px 24px; text-align: center; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">
              <img src="https://app.aimrx.com/logo-header.png" alt="AIM Rx" style="height: 56px; margin-bottom: 14px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">New device trusted</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Security notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 12px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #334155;">
                A new browser was just trusted on your AIM Rx Portal account. Future logins from this browser will skip the 6-digit verification code for the next 90 days.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">Trust details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; line-height: 22px; color: #475569;"><strong style="color:#1e293b;">Browser:</strong> ${escapeHtml(browserLabel)}</p>
                    <p style="margin: 0 0 8px; font-size: 14px; line-height: 22px; color: #475569;"><strong style="color:#1e293b;">IP address:</strong> ${escapeHtml(ipLabel)}</p>
                    <p style="margin: 0; font-size: 14px; line-height: 22px; color: #475569;"><strong style="color:#1e293b;">Time:</strong> ${escapeHtml(timeLabel)}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 8px; border-radius: 8px; border: 1px solid #fecaca; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #fef2f2; border-left: 3px solid #dc2626;">
                    <p style="margin: 0 0 8px; font-size: 14px; line-height: 22px; color: #991b1b;"><strong>Wasn't you?</strong></p>
                    <p style="margin: 0; font-size: 13px; line-height: 21px; color: #7f1d1d;">
                      <a href="${SECURITY_PAGE_URL}" style="color: #b91c1c; text-decoration: underline;">Open your Security page</a> to remove the device, then change your AimRX password.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 18px 0 0; font-size: 13px; line-height: 21px; color: #64748b;">
                If this was you, no action needed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 22px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
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
    `;

    await sgMail.send({
      to: recipient,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text,
      html,
    });
  } catch (err) {
    // Step 13 hard rule: NEVER let an email failure escape into the
    // MFA flow. scrubError covers any accidental token leak in case
    // the SendGrid SDK ever surfaces a request body in its errors.
    console.error("[trusted-device-email] send failed", {
      error: scrubError(err),
    });
  }
}

/**
 * Best-effort, dependency-free user-agent → friendly label. We don't
 * pull in a UA-parser package because (a) HIPAA dependency review and
 * (b) the email is informational; perfect parsing isn't required.
 */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows NT/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

function formatTime(d: Date): string {
  // Render in America/Chicago since AimRX operations are based there
  // and that's the timezone Joseph uses in every other ops surface.
  try {
    return d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return d.toISOString();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
