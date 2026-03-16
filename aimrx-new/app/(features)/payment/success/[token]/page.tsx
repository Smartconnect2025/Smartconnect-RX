"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Package, Clock, LogIn } from "lucide-react";

const printStyles = `
@media print {
  @page {
    size: auto;
    margin: 10mm;
  }

  /* Hide non-print elements */
  .print-hide {
    display: none !important;
  }

  /* Reset page container */
  .print-container {
    min-height: auto !important;
    padding: 0 !important;
    background: white !important;
  }

  .print-content {
    max-width: 100% !important;
    padding: 0 !important;
  }

  /* Smaller logo */
  .print-logo {
    height: 40px !important;
    margin-bottom: 0.25rem !important;
  }

  /* Compact header */
  .print-header {
    margin-bottom: 0.5rem !important;
    text-align: center !important;
  }

  /* Smaller success icon */
  .print-icon-container {
    width: 2.5rem !important;
    height: 2.5rem !important;
    margin-bottom: 0.5rem !important;
  }

  .print-icon-container svg {
    width: 1.5rem !important;
    height: 1.5rem !important;
  }

  /* Smaller title */
  .print-title {
    font-size: 1.25rem !important;
    margin-bottom: 0.25rem !important;
  }

  .print-subtitle {
    font-size: 0.875rem !important;
  }

  /* Compact card */
  .print-card {
    margin-bottom: 0.5rem !important;
    box-shadow: none !important;
    border: 1px solid #e5e7eb !important;
  }

  .print-card-header {
    padding: 0.75rem !important;
  }

  .print-card-content {
    padding: 0.75rem !important;
    padding-top: 0 !important;
  }

  /* Compact payment details */
  .print-details {
    padding: 0.5rem !important;
  }

  .print-details-row {
    padding-bottom: 0.375rem !important;
    margin-bottom: 0 !important;
    font-size: 0.8rem !important;
  }

  /* Compact sections */
  .print-section {
    padding: 0.5rem !important;
    margin-bottom: 0 !important;
  }

  .print-section-title {
    font-size: 0.875rem !important;
    margin-bottom: 0.25rem !important;
  }

  .print-section-text {
    font-size: 0.7rem !important;
    line-height: 1.3 !important;
  }

  .print-step {
    margin-bottom: 0.125rem !important;
  }

  /* Compact contact info */
  .print-contact {
    padding-top: 0.5rem !important;
    font-size: 0.75rem !important;
  }

  .print-contact p {
    margin-bottom: 0.125rem !important;
  }
}
`;

// Function to print receipt using iframe (avoids CSS color compatibility issues)
const printReceipt = () => {
  const element = document.getElementById("payment-receipt");
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".print-hide").forEach((el) => el.remove());

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Receipt</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        img { max-width: 100%; height: auto; }
        /* Tailwind utility classes */
        .text-center { text-align: center; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 500; }
        .text-sm { font-size: 0.875rem; }
        .text-lg { font-size: 1.125rem; }
        .text-xl { font-size: 1.25rem; }
        .text-2xl { font-size: 1.5rem; }
        .text-3xl { font-size: 1.875rem; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-700 { color: #374151; }
        .text-gray-900 { color: #111827; }
        .text-green-600 { color: #16a34a; }
        .text-blue-600 { color: #2563eb; }
        .text-yellow-600 { color: #ca8a04; }
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-green-100 { background-color: #dcfce7; }
        .bg-blue-50 { background-color: #eff6ff; }
        .bg-yellow-50 { background-color: #fefce8; }
        .border { border: 1px solid #e5e7eb; }
        .border-b { border-bottom: 1px solid #e5e7eb; }
        .border-blue-200 { border-color: #bfdbfe; }
        .border-yellow-200 { border-color: #fef08a; }
        .rounded-lg { border-radius: 0.5rem; }
        .rounded-full { border-radius: 9999px; }
        .p-4 { padding: 1rem; }
        .p-6 { padding: 1.5rem; }
        .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .pt-3, .pt-4 { padding-top: 0.75rem; }
        .pb-3 { padding-bottom: 0.75rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .flex { display: flex; }
        .inline-flex { display: inline-flex; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .w-5 { width: 1.25rem; }
        .w-6 { width: 1.5rem; }
        .w-12 { width: 3rem; }
        .w-20 { width: 5rem; }
        .h-5 { height: 1.25rem; }
        .h-6 { height: 1.5rem; }
        .h-12 { height: 3rem; }
        .h-20 { height: 5rem; }
        .h-24 { height: 6rem; }
        .max-w-2xl { max-width: 42rem; }
        .max-w-\\[60\\%\\] { max-width: 60%; }
        .text-right { text-align: right; }
        @media print { body { padding: 10px; } @page { margin: 8mm; } .print-logo { height: 40px !important; margin-bottom: 0.25rem !important; } }
      </style>
    </head>
    <body>${clone.innerHTML}</body>
    </html>
  `);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };
};

interface PaymentDetails {
  patientName: string;
  providerName: string;
  totalAmountCents: number;
  description: string;
  orderProgress: string;
  paymentStatus: string;
  deliveryMethod?: string;
  pharmacyName?: string;
}

export default function PaymentSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const from = params.from as string;

  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(
    null,
  );
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 30; // Poll for up to 30 seconds

  useEffect(() => {
    if (!token) return;
    loadPaymentStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Poll for payment confirmation if webhook hasn't processed yet
  useEffect(() => {
    if (isPaymentConfirmed || pollCount >= MAX_POLLS || !paymentDetails) return;

    const timer = setTimeout(() => {
      loadPaymentStatus();
      setPollCount((prev) => prev + 1);
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDetails, isPaymentConfirmed, pollCount]);

  const loadPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/payments/details/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentDetails(data.payment);
        // Check if payment is actually completed (webhook processed)
        if (data.payment.paymentStatus === "completed") {
          setIsPaymentConfirmed(true);
        }
      }
    } catch {
      // Silently handle fetch errors during polling
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                Loading payment details...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show processing state while waiting for webhook confirmation
  if (!isPaymentConfirmed && pollCount < MAX_POLLS) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Confirming your payment...
              </p>
              <p className="text-muted-foreground text-center">
                Please wait while we verify your payment with our processor.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show timeout message if webhook never arrived
  if (!isPaymentConfirmed && pollCount >= MAX_POLLS) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Payment Processing</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <p className="text-gray-700">
              Your payment is being processed. This may take a few minutes.
            </p>
            <p className="text-sm text-muted-foreground">
              You will receive an email confirmation once the payment is
              complete. If you don&apos;t receive confirmation within 10
              minutes, please contact support.
            </p>
            <div className="pt-4">
              <p className="text-sm text-gray-600">(512) 377-9898</p>
              <p className="text-sm text-gray-600">Mon–Fri 9AM–6PM CST</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="min-h-screen bg-gray-50 py-12 px-4 print-container">
        <div
          id="payment-receipt"
          className="container max-w-2xl mx-auto print-content"
        >
          {/* Header */}
          <div className="text-center mb-8 print-header">
            <div className="flex justify-end mb-4 print-hide">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    from === "provider-dashboard"
                      ? "/prescriptions"
                      : "/auth/login",
                  )
                }
              >
                <LogIn className="mr-2 h-4 w-4" />
                {from === "provider-dashboard"
                  ? "Return to Dashboard"
                  : "Sign In"}
              </Button>
            </div>
            <img
              src="https://i.imgur.com/r65O4DB.png"
              alt="AIM Medical Technologies"
              className="h-[80px] mx-auto mb-4 print-logo"
            />
          </div>

          {/* Success Card */}
          <Card className="mb-6 print-card">
            <CardHeader className="print-card-header">
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4 print-icon-container">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <CardTitle className="text-3xl font-bold text-gray-900 mb-2 print-title">
                  Payment Successful!
                </CardTitle>
                <p className="text-muted-foreground text-lg print-subtitle">
                  Thank you for your payment
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 print-card-content">
              {/* Payment Details */}
              {paymentDetails && (
                <div className="bg-gray-50 rounded-lg p-6 space-y-4 print-details">
                  <div className="flex justify-between items-center pb-3 border-b print-details-row">
                    <span className="text-gray-600">Patient</span>
                    <span className="font-semibold">
                      {paymentDetails.patientName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b print-details-row">
                    <span className="text-gray-600">Provider</span>
                    <span className="font-semibold">
                      {paymentDetails.providerName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b print-details-row">
                    <span className="text-gray-600">Description</span>
                    <span className="font-semibold text-right max-w-[60%]">
                      {paymentDetails.description}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 print-details-row">
                    <span className="text-lg font-bold text-gray-900">
                      Amount Paid
                    </span>
                    <span className="text-2xl font-bold text-green-600">
                      ${(paymentDetails.totalAmountCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* What Happens Next */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 print-section">
                <div className="flex items-start gap-3 mb-4">
                  <Package className="w-6 h-6 text-blue-600 mt-1 print-hide" />
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2 print-section-title">
                      What Happens Next?
                    </h3>
                    <div className="space-y-3 text-sm text-gray-700 print-section-text">
                      <div className="flex items-start gap-2 print-step">
                        <div className="mt-1">1.</div>
                        <p>
                          <strong>Payment Confirmation:</strong> You will
                          receive a confirmation email shortly with your
                          receipt.
                        </p>
                      </div>
                      <div className="flex items-start gap-2 print-step">
                        <div className="mt-1">2.</div>
                        <p>
                          <strong>Provider Approval:</strong> Your provider will
                          review and approve the order.
                        </p>
                      </div>
                      <div className="flex items-start gap-2 print-step">
                        <div className="mt-1">3.</div>
                        <p>
                          <strong>Pharmacy Processing:</strong> The pharmacy
                          will prepare your medication.
                        </p>
                      </div>
                      <div className="flex items-start gap-2 print-step">
                        <div className="mt-1">4.</div>
                        <p>
                          <strong>
                            {paymentDetails?.deliveryMethod === "pickup" &&
                              "Ready for Pickup"}
                            {paymentDetails?.deliveryMethod === "delivery" &&
                              "Local Delivery"}
                            {paymentDetails?.deliveryMethod === "shipping" &&
                              "Shipping"}
                            {!paymentDetails?.deliveryMethod && "Fulfillment"}:
                          </strong>{" "}
                          {paymentDetails?.deliveryMethod === "pickup" &&
                            `You'll receive a notification when your medication is ready to collect at ${paymentDetails?.pharmacyName || "the pharmacy"}.`}
                          {paymentDetails?.deliveryMethod === "delivery" &&
                            `The pharmacy will deliver your medication to your address.`}
                          {paymentDetails?.deliveryMethod === "shipping" &&
                            "You'll receive tracking information once your order ships."}
                          {!paymentDetails?.deliveryMethod &&
                            "You'll receive updates on how to receive your medication."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Estimate */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 print-section">
                <Clock className="w-5 h-5 text-yellow-600 mt-0.5 print-hide" />
                <div>
                  <p className="font-semibold text-gray-900 mb-1 print-section-title">
                    Expected Timeline
                  </p>
                  <p className="text-sm text-gray-700 print-section-text">
                    {paymentDetails?.deliveryMethod === "pickup" &&
                      "Your medication will typically be ready for pickup within 3-7 business days."}
                    {paymentDetails?.deliveryMethod === "delivery" &&
                      "Your medication will typically be delivered within 3-7 business days."}
                    {paymentDetails?.deliveryMethod === "shipping" &&
                      "Your medication will typically ship within 3-5 business days and arrive within 5-10 business days."}
                    {!paymentDetails?.deliveryMethod &&
                      "Your medication will typically be ready within 5-10 business days."}{" "}
                    We&apos;ll send you updates via email.
                  </p>
                </div>
              </div>

              {/* Contact Information */}
              <div className="text-center pt-4 print-contact">
                <p className="text-sm text-gray-600 mb-2">
                  Questions about your order?
                </p>
                <p className="text-sm font-medium text-gray-900">
                  Contact AIM Medical Technologies
                </p>
                <p className="text-sm text-gray-600">
                  (512) 377-9898 · Mon–Fri 9AM–6PM CST
                </p>
                <p className="text-sm text-gray-600">
                  106 E 6th St, Suite 900 · Austin, TX 78701
                </p>
              </div>

              {/* Print Button */}
              <Button
                onClick={() => printReceipt()}
                variant="outline"
                className="w-full print-hide"
              >
                Print Receipt
              </Button>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground print-hide">
            You can safely close this page. A confirmation has been sent to your
            email.
          </p>
        </div>
      </div>
    </>
  );
}
