import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { paymentRequestEmailHtml } from "@core/services/email/emailTemplates";
import { checkEmailDedup, logEmailSent, logEmailFailed } from "@core/services/email/email-guard";
import { getPharmacyBranding, getFromName } from "@core/services/email/pharmacy-branding";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
      pharmacyId,
      paymentToken,
      patientPhone,
    } = body;

    const branding = pharmacyId ? await getPharmacyBranding(pharmacyId) : undefined;

    if (!patientEmail || !paymentUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const dedupKey = paymentToken || `${patientEmail}_${medication}`;
    const detailsStr = `Payment Request Email | To: ${patientEmail} | Medication: ${medication || "N/A"} | Amount: $${totalAmount || "0"} | Provider: ${providerName || "N/A"}${pharmacyName ? ` | Pharmacy: ${pharmacyName}` : ""} | [dedup:${dedupKey}]`;

    if (!SENDGRID_API_KEY) {
      await logEmailSent(patientEmail, patientName || "Patient", detailsStr);
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }
    const dedup = await checkEmailDedup(patientEmail, "Payment Request Email", dedupKey, 30);
    if (!dedup.allowed) {
      console.log(`[send-payment-email] Dedup blocked: ${dedup.reason}`);
      return NextResponse.json({ success: true, message: "Duplicate blocked", deduplicated: true });
    }

    const displayPharmacyName = branding?.name || pharmacyName;
    const fromName = getFromName(branding);
    const safePaymentUrl = sanitizeUrl(paymentUrl);
    const safePatientName = escHtml(patientName);
    const safeProviderName = escHtml(providerName);
    const safeMedication = escHtml(medication);
    const safeTotalAmount = escHtml(totalAmount);

    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: fromName,
      },
      subject: `Action Needed: Complete Payment for Your ${medication} Prescription${displayPharmacyName ? ` - ${displayPharmacyName}` : ""}`,
      text: `
Hi ${patientName},

Your prescription for ${medication} is ready for payment.

Prescribed by: ${providerName}
${displayPharmacyName ? `Pharmacy: ${displayPharmacyName}` : ""}
Medication: ${medication}
Total Amount Due: $${totalAmount}

Complete your payment here:
${paymentUrl}

This link expires in 7 days.

Questions? Contact your pharmacy${displayPharmacyName ? ` (${displayPharmacyName})` : ""} or your provider.

\u00a9 ${new Date().getFullYear()} ${displayPharmacyName || "SmartConnect RX"}. All rights reserved.
      `,
      html: paymentRequestEmailHtml({
        patientName: safePatientName || "there",
        medication: safeMedication,
        providerName: safeProviderName,
        totalAmountFormatted: `$${safeTotalAmount}`,
        paymentUrl: safePaymentUrl,
        pharmacyName: escHtml(displayPharmacyName) || undefined,
        branding,
      }),
    };

    await sgMail.send(msg);

    await logEmailSent(patientEmail, patientName || "Patient", detailsStr);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEND-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");

    try {
      const { patientEmail, patientName, medication } = await request.clone().json().catch(() => ({} as Record<string, string>));
      if (patientEmail) {
        await logEmailFailed(patientEmail, patientName || "Patient", `Payment Request Email Failed | To: ${patientEmail} | Medication: ${medication || "N/A"} | Error: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    } catch {}

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
      },
      { status: 500 }
    );
  }
}
