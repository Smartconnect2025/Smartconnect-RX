"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Clock, Package, Truck, AlertCircle, LogIn } from "lucide-react";

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
  pharmacyLogoUrl?: string | null;
  pharmacyColor?: string | null;
  pharmacyPhone?: string | null;
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
  const router = useRouter();
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
            src={orderStatus.pharmacyLogoUrl || "https://i.imgur.com/r65O4DB.png"}
            alt={orderStatus.pharmacyName || "SmartConnect RX"}
            className="h-24 mx-auto mb-4"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://i.imgur.com/r65O4DB.png"; }}
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

            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="font-medium">{orderStatus.description}</p>
            </div>

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
              <p className="text-sm font-medium text-gray-900">{orderStatus.pharmacyName || "SmartConnect RX"}</p>
              <p className="text-sm text-gray-600">{orderStatus.pharmacyPhone || "(512) 377-9898"} · Mon–Fri 9AM–6PM CST</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
