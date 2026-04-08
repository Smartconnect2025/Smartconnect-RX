import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { prescriptionStatusEmailHtml } from "@core/services/email/emailTemplates";
import { createAdminClient } from "@core/database/client";
import { checkEmailDedup } from "@core/services/email-guard";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-internal-api-key");
    if (!INTERNAL_API_KEY || authHeader !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      patientEmail,
      patientName,
      medication,
      providerName,
      statusType,
      trackingNumber,
      trackingUrl,
      pharmacyName,
      prescriptionId,
    } = body;

    if (!patientEmail || !statusType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validStatuses = ["pharmacy_processing", "shipped", "delivered", "ready_for_pickup"];
    if (!validStatuses.includes(statusType)) {
      return NextResponse.json({ error: `Invalid status type: ${statusType}` }, { status: 400 });
    }

    const dedupKey = prescriptionId ? `${prescriptionId}_${statusType}` : `${patientEmail}_${statusType}`;
    const dedupCheck = await checkEmailDedup(patientEmail, "status_email", dedupKey, 60);
    if (!dedupCheck.allowed) {
      console.log(`[STATUS-EMAIL] Skipped (dedup): ${dedupCheck.reason}`);
      return NextResponse.json({ success: true, skipped: true, reason: dedupCheck.reason });
    }

    const supabase = createAdminClient();

    if (!SENDGRID_API_KEY) {
      await supabase.from("system_logs").insert({
        action: "PATIENT_NOTIFICATION_SENT",
        details: `Status Update Email (Demo) | To: ${patientEmail} | Rx: ${escHtml(medication)} | Status: ${statusType} | Provider: ${escHtml(providerName)}`,
        user_email: patientEmail,
        user_name: patientName || "Patient",
        status: "success",
      });
      return NextResponse.json({ success: true, demoMode: true });
    }

    const { subject, html } = prescriptionStatusEmailHtml({
      patientName: escHtml(patientName) || "there",
      medication: escHtml(medication),
      providerName: escHtml(providerName),
      statusType,
      trackingNumber: trackingNumber || undefined,
      trackingUrl: trackingUrl || undefined,
      pharmacyName: escHtml(pharmacyName) || undefined,
    });

    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;

    const msg = {
      to: patientEmail,
      from: { email: FROM_EMAIL, name: fromName },
      subject,
      html,
    };

    await sgMail.send(msg);

    const logDetails = [
      `${subject}`,
      `To: ${patientEmail}`,
      `Rx: ${medication || "N/A"}`,
      `Provider: ${providerName || "N/A"}`,
      pharmacyName ? `Pharmacy: ${pharmacyName}` : null,
      `Status: ${statusType}`,
      trackingNumber ? `Tracking: ${trackingNumber}` : null,
      prescriptionId ? `RxID: ${prescriptionId}` : null,
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
    const supabase = createAdminClient();
    const body = await request.clone().json().catch(() => ({}));

    try {
      await supabase.from("system_logs").insert({
        action: "PATIENT_NOTIFICATION_FAILED",
        details: `Status Update Email | To: ${body.patientEmail || "unknown"} | Error: ${error instanceof Error ? error.message : "Unknown"}`,
        user_email: body.patientEmail || "",
        user_name: body.patientName || "Patient",
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch {
    }

    console.error("[STATUS-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }
}
