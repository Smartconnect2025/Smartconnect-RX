import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { paymentConfirmationEmailHtml } from "@core/services/email/emailTemplates";
import { checkEmailDedup, logEmailSent, logEmailFailed } from "@core/services/email/email-guard";
import { getPharmacyBranding, getFromName } from "@core/services/email/pharmacy-branding";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
      transactionId,
      deliveryMethod,
      pharmacyName,
      pharmacyId,
    } = body;

    const branding = pharmacyId ? await getPharmacyBranding(pharmacyId) : undefined;

    if (!patientEmail || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const detailsStr = `Payment Confirmation Email | To: ${patientEmail} | Medication: ${medication || "N/A"} | Amount: $${totalAmount || "0"} | Transaction: ${transactionId} | Provider: ${providerName || "N/A"}${pharmacyName ? ` | Pharmacy: ${pharmacyName}` : ""} | [dedup:${transactionId}]`;

    const deliveryTexts = {
      pickup: "Pharmacy Pickup",
      delivery: "Local Delivery",
      shipping: "Shipping with Tracking",
    } as const;

    const nextStepsTexts = {
      pickup: "Your provider will approve the order, and the pharmacy will notify you when your medication is ready for pickup.",
      delivery: "Your provider will approve the order, and the pharmacy will deliver your medication to your address.",
      shipping: "Your provider will approve the order, and the pharmacy will ship your medication. You'll receive tracking information once it ships.",
    } as const;

    const deliveryDisplayText = deliveryTexts[deliveryMethod as keyof typeof deliveryTexts] || "Pharmacy Pickup";
    const nextStepsText = nextStepsTexts[deliveryMethod as keyof typeof nextStepsTexts] || "Your provider will approve the order, and the pharmacy will prepare your medication.";

    if (!SENDGRID_API_KEY) {
      await logEmailSent(patientEmail, patientName || "Patient", detailsStr);
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const dedupKey = transactionId;
    const dedup = await checkEmailDedup(patientEmail, "Payment Confirmation Email", dedupKey, 30);
    if (!dedup.allowed) {
      console.log(`[send-confirmation-email] Dedup blocked: ${dedup.reason}`);
      return NextResponse.json({ success: true, message: "Duplicate blocked", deduplicated: true });
    }

    const displayPharmacyName = branding?.name || pharmacyName;
    const fromName = getFromName(branding);
    const safePatientName = escHtml(patientName);
    const safeProviderName = escHtml(providerName);
    const safeMedication = escHtml(medication);
    const safeTotalAmount = escHtml(totalAmount);
    const safeTransactionId = escHtml(transactionId);

    const msg = {
      to: patientEmail,
      from: {
        email: FROM_EMAIL,
        name: fromName,
      },
      subject: `Payment Confirmed: ${medication} Prescription${displayPharmacyName ? ` - ${displayPharmacyName}` : ""}`,
      text: `
Hi ${patientName},

Payment Confirmed!

Your payment has been successfully processed. Thank you for completing your payment for ${medication}.

Transaction Details:
- Transaction ID: ${transactionId}
- Prescribed by: ${providerName}
- Medication: ${medication}
${displayPharmacyName ? `- Pharmacy: ${displayPharmacyName}` : ''}
- Fulfillment Method: ${deliveryDisplayText}
- Amount Paid: $${totalAmount}

What's Next?
${nextStepsText}

Order Progress:
\u2713 Payment Received
\u25cb Provider Approval
\u25cb Pharmacy Processing
\u25cb ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}

You'll receive updates as your order progresses through each stage.

Questions? Contact ${displayPharmacyName || 'your pharmacy'} or your provider.

Keep this email for your records.

\u00a9 ${new Date().getFullYear()} ${displayPharmacyName || "SmartConnect RX"}
      `,
      html: paymentConfirmationEmailHtml({
        patientName: safePatientName || "there",
        medication: safeMedication,
        providerName: safeProviderName,
        amountFormatted: `$${safeTotalAmount}`,
        transactionId: safeTransactionId,
        pharmacyName: escHtml(displayPharmacyName) || undefined,
        fulfillmentMethod: deliveryMethod as string,
        branding,
      }),
    };

    await sgMail.send(msg);

    await logEmailSent(patientEmail, patientName || "Patient", detailsStr);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONFIRM-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");

    try {
      const { patientEmail, patientName, medication, transactionId } = await request.clone().json().catch(() => ({} as Record<string, string>));
      if (patientEmail) {
        await logEmailFailed(patientEmail, patientName || "Patient", `Payment Confirmation Email Failed | To: ${patientEmail} | Medication: ${medication || "N/A"} | Transaction: ${transactionId || "N/A"} | Error: ${error instanceof Error ? error.message : "Unknown"}`);
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
