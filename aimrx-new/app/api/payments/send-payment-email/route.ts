import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { paymentRequestEmailHtml } from "@core/services/email/emailTemplates";
import { createAdminClient } from "@core/database/client";
import { checkEmailDedup } from "@core/services/email-guard";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";

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
    } = body;

    if (!patientEmail || !paymentUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const dedupCheck = await checkEmailDedup(patientEmail, "payment_request", paymentUrl, 30);
    if (!dedupCheck.allowed) {
      console.log(`[SEND-EMAIL] Skipped (dedup): ${dedupCheck.reason}`);
      return NextResponse.json({ success: true, skipped: true, reason: dedupCheck.reason });
    }

    const supabase = createAdminClient();

    if (!SENDGRID_API_KEY) {
      await supabase.from("system_logs").insert({
        action: "PATIENT_NOTIFICATION_SENT",
        details: `Payment Request Email (Demo) | To: ${patientEmail} | Rx: ${escHtml(medication)} | Amount: $${totalAmount} | Provider: ${escHtml(providerName)}`,
        user_email: patientEmail,
        user_name: patientName || "Patient",
        status: "success",
      });
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const safeName = escHtml(pharmacyName);
    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;
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

    const logDetails = [
      "Payment Request Email",
      `To: ${patientEmail}`,
      `Rx: ${medication || "N/A"}`,
      `Amount: $${totalAmount || "0"}`,
      `Provider: ${providerName || "N/A"}`,
      pharmacyName ? `Pharmacy: ${pharmacyName}` : null,
    ].filter(Boolean).join(" | ");

    await supabase.from("system_logs").insert({
      action: "PATIENT_NOTIFICATION_SENT",
      details: logDetails,
      user_email: patientEmail,
      user_name: patientName || "Patient",
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const supabaseErr = createAdminClient();
    const body = await request.clone().json().catch(() => ({}));
    try {
      await supabaseErr.from("system_logs").insert({
        action: "PATIENT_NOTIFICATION_FAILED",
        details: `Payment Request Email | To: ${body.patientEmail || "unknown"} | Error: ${error instanceof Error ? error.message : "Unknown"}`,
        user_email: body.patientEmail || "",
        user_name: body.patientName || "Patient",
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch {
    }

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
