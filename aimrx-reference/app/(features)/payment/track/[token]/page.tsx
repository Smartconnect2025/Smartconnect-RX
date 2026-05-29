"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Clock, Package, Truck, AlertCircle, XCircle, RefreshCw } from "lucide-react";

interface PrescriptionStatus {
  id: string;
  medication: string;
  status: string;
  paymentStatus: string | null;
  patientPrice: number | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

interface OrderStatus {
  orderProgress: string;
  paymentStatus: string;
  patientName: string;
  description: string;
  totalAmountCents: number;
  createdAt: string;
  paidAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  providerName: string;
  pharmacyName: string | null;
  refundAmountCents?: number;
  prescriptions?: PrescriptionStatus[];
}

// Progress stages with descriptions
const progressStages = [
  {
    key: "payment_pending",
    label: "Payment Pending",
    description: "Waiting for payment — order will NOT be sent to pharmacy until paid",
    icon: Clock,
    color: "text-yellow-600",
  },
  {
    key: "payment_received",
    label: "Payment Received",
    description: "Payment confirmed — order is now being sent to the pharmacy",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  {
    key: "provider_approved",
    label: "Sent to Pharmacy",
    description: "Order submitted to pharmacy for processing",
    icon: CheckCircle2,
    color: "text-blue-600",
  },
  {
    key: "pharmacy_processing",
    label: "Pharmacy Processing",
    description: "Medication is being compounded and prepared",
    icon: Package,
    color: "text-purple-600",
  },
  {
    key: "shipped",
    label: "Shipped / Ready",
    description: "Order shipped or ready for pickup",
    icon: Truck,
    color: "text-indigo-600",
  },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid tracking link");
      setLoading(false);
      return;
    }

    loadOrderStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadOrderStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const loadOrderStatus = async () => {
    try {
      const response = await fetch(`/api/payments/status/${token}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setOrderStatus(data.order);
        setError(null);
      } else {
        setError(data.error || "Order not found");
      }
    } catch (error) {
      console.error("Error loading order status:", error);
      setError("Failed to load order status");
    } finally {
      setLoading(false);
    }
  };

  // Get current stage index
  const getCurrentStageIndex = () => {
    if (!orderStatus) return -1;
    return progressStages.findIndex((stage) => stage.key === orderStatus.orderProgress);
  };

  const currentStageIndex = getCurrentStageIndex();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading order status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !orderStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="https://app.aimrx.com/logo-header.png"
            alt="AIM Medical Technologies"
            className="h-24 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">Real-time updates on your prescription</p>
        </div>

        {/* Order Information */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Order Details</CardTitle>
              <Badge className="bg-blue-500">
                {progressStages[currentStageIndex]?.label || "Unknown"}
              </Badge>
            </div>
            <CardDescription>
              Order placed on {new Date(orderStatus.createdAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Patient</p>
                <p className="font-medium">{orderStatus.patientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Provider</p>
                <p className="font-medium">{orderStatus.providerName}</p>
              </div>
            </div>

            {orderStatus.pharmacyName && (
              <div>
                <p className="text-sm text-gray-600">Pharmacy</p>
                <p className="font-medium">{orderStatus.pharmacyName}</p>
              </div>
            )}

            {orderStatus.prescriptions && orderStatus.prescriptions.length > 1 ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">Medications</p>
                <div className="space-y-2">
                  {orderStatus.prescriptions.map((rx) => {
                    const isRejected = rx.status === "rejected";
                    const isRefunded = rx.paymentStatus === "rejected_refunded";
                    const isRefundPending = rx.paymentStatus === "rejected_refund_pending";

                    return (
                      <div key={rx.id} className={`rounded-lg px-3 py-2 ${isRejected ? "bg-red-50 border border-red-200" : "bg-gray-50"}`} data-testid={`track-item-${rx.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isRejected && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                            <span className={`font-medium ${isRejected ? "text-red-800 line-through" : "text-gray-900"}`}>{rx.medication}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isRefunded && rx.patientPrice && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300" data-testid={`refund-badge-${rx.id}`}>
                                ${rx.patientPrice.toFixed(2)} Refunded
                              </Badge>
                            )}
                            {isRefundPending && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300" data-testid={`refund-pending-${rx.id}`}>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Refund Processing
                              </Badge>
                            )}
                            <Badge variant="outline" className={
                              isRejected ? "bg-red-50 text-red-700 border-red-300" :
                              rx.status === "delivered" ? "bg-green-50 text-green-700 border-green-300" :
                              rx.status === "picked_up" || rx.status === "shipped" ? "bg-indigo-50 text-indigo-700 border-indigo-300" :
                              rx.status === "packed" || rx.status === "approved" ? "bg-purple-50 text-purple-700 border-purple-300" :
                              rx.status === "payment_received" || rx.status === "paid" || rx.status === "submitted" ? "bg-blue-50 text-blue-700 border-blue-300" :
                              "bg-gray-50 text-gray-700 border-gray-300"
                            }>
                              {isRejected ? "Rejected by Pharmacy" :
                               rx.status === "delivered" ? "Delivered" :
                               rx.status === "picked_up" || rx.status === "shipped" ? "Shipped" :
                               rx.status === "packed" ? "Packed" :
                               rx.status === "approved" ? "Approved" :
                               rx.status === "submitted" ? "At Pharmacy" :
                               rx.status === "payment_received" || rx.status === "paid" ? "Paid" :
                               rx.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                        {isRejected && (
                          <p className="text-xs text-red-600 mt-1 ml-6">
                            {isRefunded
                              ? "This medication was rejected by the pharmacy. A refund has been issued."
                              : isRefundPending
                              ? "This medication was rejected by the pharmacy. Your refund is being processed."
                              : "This medication was rejected by the pharmacy. Please contact support."}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-medium">{orderStatus.description}</p>
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Paid</span>
                <span className="text-xl font-bold text-green-600">
                  ${(orderStatus.totalAmountCents / 100).toFixed(2)}
                </span>
              </div>
              {orderStatus.paidAt && (
                <p className="text-sm text-gray-500 mt-1">
                  Paid on {new Date(orderStatus.paidAt).toLocaleString()}
                </p>
              )}
              {(orderStatus.refundAmountCents ?? 0) > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg" data-testid="refund-summary">
                  <div className="flex justify-between items-center">
                    <span className="text-amber-800 font-medium">Refunded Amount</span>
                    <span className="text-amber-800 font-bold">
                      -${((orderStatus.refundAmountCents ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-gray-600 text-sm">Net Charged</span>
                    <span className="text-gray-900 font-semibold">
                      ${((orderStatus.totalAmountCents - (orderStatus.refundAmountCents ?? 0)) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Progress</CardTitle>
            <CardDescription>
              Your order is currently at stage {currentStageIndex + 1} of {progressStages.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {progressStages.map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isPending = index > currentStageIndex;

                const StageIcon = stage.icon;

                return (
                  <div key={stage.key} className="relative">
                    {/* Connector Line */}
                    {index < progressStages.length - 1 && (
                      <div
                        className={`absolute left-6 top-12 w-0.5 h-12 ${
                          isCompleted ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    )}

                    {/* Stage Item */}
                    <div className="flex items-start gap-4">
                      {/* Icon Circle */}
                      <div
                        className={`flex items-center justify-center w-12 h-12 rounded-full border-2 shrink-0 ${
                          isCompleted
                            ? "bg-green-500 border-green-500"
                            : isCurrent
                            ? "bg-blue-500 border-blue-500"
                            : "bg-white border-gray-300"
                        }`}
                      >
                        <StageIcon
                          className={`w-6 h-6 ${
                            isCompleted || isCurrent ? "text-white" : "text-gray-400"
                          }`}
                        />
                      </div>

                      {/* Stage Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className={`font-semibold ${
                              isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-500"
                            }`}
                          >
                            {stage.label}
                          </h3>
                          {isCompleted && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              Completed
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge className="bg-blue-500">In Progress</Badge>
                          )}
                        </div>
                        <p
                          className={`text-sm ${
                            isPending ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tracking Information */}
        {orderStatus.trackingNumber && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                  <p className="font-mono text-lg font-semibold">{orderStatus.trackingNumber}</p>
                </div>
                {orderStatus.trackingUrl && (
                  <a
                    href={orderStatus.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:text-blue-700 underline"
                  >
                    Track Your Package →
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline Info */}
        <Card>
          <CardHeader>
            <CardTitle>Expected Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">•</div>
                <p>
                  <strong>Typical preparation time:</strong> 5–10 business days from payment
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">•</div>
                <p>
                  You will receive email or text updates as your order progresses through each
                  stage
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">•</div>
                <p>
                  This page automatically refreshes every 30 seconds to show the latest status
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600 mb-2">Questions about your order?</p>
              <p className="text-sm font-medium text-gray-900">AIM Medical Technologies</p>
              <p className="text-sm text-gray-600">(769) 304-1830 · Mon–Fri 9AM–6PM CST</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
