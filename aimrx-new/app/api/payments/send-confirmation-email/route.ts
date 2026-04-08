import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { paymentConfirmationEmailHtml } from "@core/services/email/emailTemplates";

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
    } = body;

    if (!patientEmail || !transactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
      return NextResponse.json({
        success: true,
        message: 'Email logged (demo mode - no actual email sent)',
        demoMode: true
      });
    }

    const safeName = escHtml(pharmacyName);
    const fromName = pharmacyName ? `${pharmacyName} via SmartConnect RX` : FROM_NAME;
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
      subject: `Payment Confirmed: ${medication} Prescription${pharmacyName ? ` - ${pharmacyName}` : ""}`,
      text: `
Hi ${patientName},

Payment Confirmed!

Your payment has been successfully processed. Thank you for completing your payment for ${medication}.

Transaction Details:
- Transaction ID: ${transactionId}
- Prescribed by: ${providerName}
- Medication: ${medication}
${pharmacyName ? `- Pharmacy: ${pharmacyName}` : ''}
- Fulfillment Method: ${deliveryDisplayText}
- Amount Paid: $${totalAmount}

What's Next?
${nextStepsText}

Order Progress:
\u2713 Payment Received
\u25cb Provider Approval
\u25cb Pharmacy Processing
\u25cb ${deliveryMethod === 'pickup' ? 'Ready for Pickup' : deliveryMethod === 'delivery' ? 'Out for Delivery' : 'Shipped'}

We'll send you updates as your order progresses through each stage.

Questions? Contact your provider or reply to this email.

Keep this email for your records.

\u00a9 ${new Date().getFullYear()} ${FROM_NAME}
      `,
      html: paymentConfirmationEmailHtml({
        patientName: safePatientName || "there",
        medication: safeMedication,
        providerName: safeProviderName,
        amountFormatted: `$${safeTotalAmount}`,
        transactionId: safeTransactionId,
        pharmacyName: safeName || undefined,
        fulfillmentMethod: deliveryMethod as string,
      }),
    };

    await sgMail.send(msg);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CONFIRM-EMAIL] Error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send email",
      },
      { status: 500 }
    );
  }
}
