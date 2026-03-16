"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, XCircle, ArrowLeft, Phone, LogIn } from "lucide-react";

interface PaymentDetails {
  patientName: string;
  providerName: string;
  totalAmountCents: number;
  paymentLinkUrl: string;
}

export default function PaymentCancelledPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    if (!token) return;
    loadPaymentStatus();
  }, [token]);

  const loadPaymentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/details/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentDetails(data.payment);
      }
    } catch (error) {
      console.error("Error loading payment status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = () => {
    // Redirect to the payment details page (not the stored URL which is the same)
    // This allows the user to re-initiate the payment flow
    window.location.href = `/payment/${token}`;
  };

  const handleBackToDetails = () => {
    window.location.href = `/payment/${token}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/login")}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>
          <img
            src="https://i.imgur.com/r65O4DB.png"
            alt="AIM Medical Technologies"
            className="h-24 mx-auto mb-4"
          />
        </div>

        {/* Cancelled Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-4">
                <XCircle className="w-12 h-12 text-orange-600" />
              </div>
              <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
                Payment Cancelled
              </CardTitle>
              <p className="text-muted-foreground text-lg">
                Your payment was not processed
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payment Details */}
            {paymentDetails && (
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">You cancelled the payment for:</p>
                  <p className="font-semibold text-lg">{paymentDetails.patientName}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ${(paymentDetails.totalAmountCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* What This Means */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 text-lg mb-3">What This Means</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p>• Your payment was <strong>not</strong> processed</p>
                <p>• No charges were made to your payment method</p>
                <p>• Your order has <strong>not</strong> been submitted to the pharmacy</p>
                <p>• The payment link is still valid and can be used again</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRetryPayment}
                className="w-full text-lg py-6 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
              >
                Try Payment Again
              </Button>

              <Button
                onClick={handleBackToDetails}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payment Details
              </Button>
            </div>

            {/* Contact Information */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <Phone className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 mb-1">Need Help?</p>
                <p className="text-sm text-gray-700 mb-2">
                  If you&apos;re experiencing issues with payment, please contact us:
                </p>
                <p className="text-sm font-medium text-gray-900">
                  AIM Medical Technologies
                </p>
                <p className="text-sm text-gray-600">(512) 377-9898 · Mon–Fri 9AM–6PM CST</p>
              </div>
            </div>

            {/* Alternative Contact */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-600">
                You can also contact your provider{" "}
                {paymentDetails?.providerName && (
                  <span className="font-medium">({paymentDetails.providerName})</span>
                )}{" "}
                directly for assistance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Your payment link will remain active and you can try again at any time.
        </p>
      </div>
    </div>
  );
}
