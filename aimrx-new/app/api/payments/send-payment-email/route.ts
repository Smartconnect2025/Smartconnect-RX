import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { paymentRequestEmailHtml } from "@core/services/email/emailTemplates";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
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
      html: paymentRequestEmailHtml({
        patientName: safePatientName || "there",
        medication: safeMedication,
        providerName: safeProviderName,
        totalAmountFormatted: `$${safeTotalAmount}`,
        paymentUrl: safePaymentUrl,
        pharmacyName: safeName || undefined,
      }),
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
