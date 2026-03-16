"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, AlertCircle, XCircle, Clock, LogIn } from "lucide-react";
import { toast } from "sonner";

interface PaymentDetails {
  id: string;
  totalAmountCents: number;
  consultationFeeCents: number;
  medicationCostCents: number;
  shippingFeeCents?: number;
  patientName: string;
  patientEmail: string;
  providerName: string;
  description: string;
  paymentLinkUrl: string;
  paymentStatus: string;
  expiresAt: string;
  prescriptionMedication?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid payment link");
      setLoading(false);
      return;
    }

    loadPaymentDetails();
  }, [token]);

  const loadPaymentDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/details/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentDetails(data.payment);
      } else {
        setError(data.error || "Payment link not found or expired");
      }
    } catch (error) {
      console.error("Payment page fetch error:", error);
      setError("Failed to load payment details");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    setProcessing(true);
    try {
      // Get hosted payment token from our API
      const response = await fetch("/api/payments/get-hosted-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentToken: token }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      // Create and submit form to Authorize.Net
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentUrl;

      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "token";
      tokenInput.value = data.formToken;
      form.appendChild(tokenInput);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("Payment initialization error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to initialize payment. Please try again."
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading payment details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !paymentDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-600" />
              <CardTitle>Payment Link Invalid</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground">
              This payment link may have expired or is no longer valid. Please contact your
              healthcare provider for a new payment link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if payment is already completed
  if (paymentDetails.paymentStatus === "completed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Payment Already Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This payment has already been processed. If you have any questions, please contact
                your healthcare provider.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if payment link expired
  const expiresAt = new Date(paymentDetails.expiresAt);
  const isExpired = expiresAt < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-orange-600" />
              <CardTitle>Payment Link Expired</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This payment link expired on {expiresAt.toLocaleDateString()}. Please contact your
                healthcare provider for a new payment link.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAmount = (paymentDetails.totalAmountCents / 100).toFixed(2);
  const consultationFee = (paymentDetails.consultationFeeCents / 100).toFixed(2);
  const medicationCost = (paymentDetails.medicationCostCents / 100).toFixed(2);
  const shippingFee = ((paymentDetails.shippingFeeCents || 0) / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container max-w-3xl mx-auto">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
          <p className="text-muted-foreground">
            Complete your payment securely through Authorize.Net
          </p>
        </div>

        {/* Payment Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment Details</CardTitle>
              <Badge className="bg-green-500">Secure Payment</Badge>
            </div>
            <CardDescription>Review your payment information below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Patient Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Patient Name</p>
                  <p className="font-medium">{paymentDetails.patientName}</p>
                </div>
                {paymentDetails.patientEmail && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{paymentDetails.patientEmail}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Provider</p>
                <p className="font-medium">{paymentDetails.providerName}</p>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Payment Breakdown</h3>

              {paymentDetails.description && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{paymentDetails.description}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">Consultation Fee</span>
                  <span className="font-semibold">${consultationFee}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">Medication Cost</span>
                  <span className="font-semibold">${medicationCost}</span>
                </div>
                {parseFloat(shippingFee) > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-700">Shipping Fee</span>
                    <span className="font-semibold">${shippingFee}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-4">
                  <span className="text-lg font-bold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-blue-600">${totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Expiration Notice */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This payment link expires on {expiresAt.toLocaleDateString()} at{" "}
                {expiresAt.toLocaleTimeString()}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Security Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Secure Payment Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p>Your payment is processed securely through Authorize.Net</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p>All payment information is encrypted and PCI compliant</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p>Your credit card details are never stored on our servers</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p>You will receive a confirmation email after successful payment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Button */}
        <Button
          onClick={handleProceedToPayment}
          className="w-full text-lg py-6 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
          size="lg"
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Redirecting to Secure Payment...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Proceed to Secure Payment - ${totalAmount}
            </>
          )}
        </Button>

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          By clicking &quot;Proceed to Secure Payment&quot;, you will be redirected to
          Authorize.Net&apos;s secure payment page to complete your transaction.
        </p>
      </div>
    </div>
  );
}
