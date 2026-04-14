import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { statusEmailHtml, GRADIENTS } from "@core/services/email/emailTemplates";
import { checkEmailDedup, logEmailSent } from "@core/services/email/email-guard";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

type StatusType = "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup";

interface StatusConfig {
  subject: (medication: string) => string;
  heading: string;
  gradient: string;
  message: (medication: string, pharmacyName?: string) => string;
  nextSteps: string;
  steps: { label: string; done: boolean; current?: boolean }[];
}

const STATUS_CONFIGS: Record<StatusType, StatusConfig> = {
  pharmacy_processing: {
    subject: (med) => `Prescription Update: ${med} Is Being Prepared`,
    heading: "Your Prescription Is Being Prepared",
    gradient: GRADIENTS.navyCyan,
    message: (med, pharmacy) =>
      `${pharmacy ? `${pharmacy} has` : "The pharmacy has"} received your prescription for <strong>${med}</strong> and has begun preparing your order.`,
    nextSteps: "We will notify you as soon as your order ships with tracking details.",
    steps: [
      { label: "Prescription Received", done: true },
      { label: "Payment Confirmed", done: true },
      { label: "Pharmacy Preparing", done: true, current: true },
      { label: "Shipped with Tracking", done: false },
      { label: "Delivered", done: false },
    ],
  },
  shipped: {
    subject: (med) => `Your ${med} Prescription Has Shipped!`,
    heading: "Your Prescription Has Shipped!",
    gradient: GRADIENTS.navyCyan,
    message: (med, pharmacy) =>
      `Your prescription for <strong>${med}</strong> has been shipped${pharmacy ? ` by ${pharmacy}` : ""} and is on its way to you.`,
    nextSteps: "Allow 3–5 business days for standard delivery. You can track your package using the tracking number above.",
    steps: [
      { label: "Prescription Received", done: true },
      { label: "Payment Confirmed", done: true },
      { label: "Pharmacy Prepared", done: true },
      { label: "Shipped", done: true, current: true },
      { label: "Delivered", done: false },
    ],
  },
  delivered: {
    subject: (med) => `Delivery Confirmed: ${med} Prescription`,
    heading: "Your Prescription Has Been Delivered!",
    gradient: GRADIENTS.greenSuccess,
    message: (med) =>
      `Your prescription for <strong>${med}</strong> has been successfully delivered. Please check your delivery location.`,
    nextSteps: "Contact your provider for dosage guidance or refills. If you cannot locate your package, contact us immediately.",
    steps: [
      { label: "Prescription Received", done: true },
      { label: "Payment Confirmed", done: true },
      { label: "Pharmacy Prepared", done: true },
      { label: "Shipped", done: true },
      { label: "Delivered", done: true, current: true },
    ],
  },
  ready_for_pickup: {
    subject: (med) => `Your ${med} Prescription Is Ready for Pickup`,
    heading: "Your Prescription Is Ready for Pickup!",
    gradient: GRADIENTS.greenSuccess,
    message: (med, pharmacy) =>
      `Your prescription for <strong>${med}</strong> is ready to be picked up${pharmacy ? ` at ${pharmacy}` : ""}.`,
    nextSteps: "Bring a valid photo ID when picking up your prescription.",
    steps: [
      { label: "Prescription Received", done: true },
      { label: "Payment Confirmed", done: true },
      { label: "Pharmacy Prepared", done: true },
      { label: "Ready for Pickup", done: true, current: true },
    ],
  },
};

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
      pharmacyPhone,
      pharmacyAddress,
      prescriptionId,
    } = body;

    if (!patientEmail || !statusType || !medication) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config = STATUS_CONFIGS[statusType as StatusType];
    if (!config) {
      return NextResponse.json({ error: `Unknown statusType: ${statusType}` }, { status: 400 });
    }

    if (!SENDGRID_API_KEY) {
      return NextResponse.json({
        success: true,
        message: "Email logged (demo mode - no actual email sent)",
        demoMode: true,
      });
    }

    const dedupKey = prescriptionId ? `${prescriptionId}_${statusType}` : `${patientEmail}_${statusType}`;
    const dedup = await checkEmailDedup(patientEmail, `STATUS_${statusType}`, dedupKey, 60);
    if (!dedup.allowed) {
      console.log(`[send-status-email] Dedup blocked: ${dedup.reason}`);
      return NextResponse.json({ success: true, message: "Duplicate blocked", deduplicated: true });
    }

    const safePatientName = escHtml(patientName) || "there";
    const safeMedication = escHtml(medication);
    const safeProviderName = escHtml(providerName);
    const safePharmacyName = escHtml(pharmacyName);

    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;

    const htmlContent = statusEmailHtml({
      patientName: safePatientName,
      medication: safeMedication,
      providerName: safeProviderName || "Your Provider",
      heading: config.heading,
      gradient: config.gradient,
      message: config.message(safeMedication, safePharmacyName || undefined),
      nextSteps: config.nextSteps + (pharmacyPhone ? ` Reach the pharmacy at ${escHtml(pharmacyPhone)}.` : "") + (pharmacyAddress ? ` Located at ${escHtml(pharmacyAddress)}.` : ""),
      steps: config.steps,
      trackingNumber: escHtml(trackingNumber),
      trackingUrl: trackingUrl || undefined,
      pharmacyName: safePharmacyName || undefined,
      pharmacyPhone: escHtml(pharmacyPhone),
      pharmacyAddress: escHtml(pharmacyAddress),
    });

    const msg = {
      to: patientEmail,
      from: { email: FROM_EMAIL, name: fromName },
      subject: config.subject(medication) + (pharmacyName ? ` - ${pharmacyName}` : ""),
      html: htmlContent,
    };

    await sgMail.send(msg);

    await logEmailSent(patientEmail, `STATUS_${statusType}`, dedupKey, `Status email: ${statusType} for ${medication}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-status-email] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }
}
