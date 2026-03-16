"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useUser } from "@core/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Type definition for orders that need review
interface OrderForReview {
  id: string;
  title: string;
  details?: string;
  order_type: string;
  status: string;
  ordered_at: string;
  patient_id: string;
  patient_name: string;
  encounter_id?: string;
  appointment_id?: string;
  appointment_status?: string;
}

export function ReviewOrdersPage() {
  const { user } = useUser();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderForReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadOrdersForReview();
    }
  }, [user?.id]);

  const loadOrdersForReview = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/basic-emr/orders/review-list");
      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
      } else {
        toast.error("Failed to load orders for review");
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders for review");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewOrder = (order: OrderForReview) => {
    if (order.encounter_id) {
      // Navigate to existing encounter
      router.push(
        `/basic-emr/patients/${order.patient_id}/encounters/${order.encounter_id}`,
      );
    } else {
      // Create new encounter for this order
      createEncounterForOrder(order);
    }
  };

  const createEncounterForOrder = async (order: OrderForReview) => {
    try {
      const response = await fetch("/api/basic-emr/orders/link-encounter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Encounter created for order review");
        router.push(
          `/basic-emr/patients/${order.patient_id}/encounters/${result.encounterId}`,
        );
      } else {
        toast.error(result.error || "Failed to create encounter");
      }
    } catch (error) {
      console.error("Error creating encounter:", error);
      toast.error("Failed to create encounter for order");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600">
            Approved
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOrderTypeBadge = (type: string) => {
    switch (type) {
      case "medication":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700">
            Medication
          </Badge>
        );
      case "lab_test":
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-700"
          >
            Lab Test
          </Badge>
        );
      case "imaging":
        return (
          <Badge
            variant="outline"
            className="border-orange-500 text-orange-700"
          >
            Imaging
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading orders for review...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4  py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Review Orders
        </h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Review and approve/reject patient orders that require provider action
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500">
              <p>No orders require review at this time</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg truncate">
                      {order.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {getOrderTypeBadge(order.order_type)}
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleReviewOrder(order)}
                    variant="outline"
                    className="border border-border w-full sm:w-auto flex-shrink-0"
                    size="sm"
                  >
                    {order.encounter_id ? "Review" : "Create Review"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {order.details && (
                    <p className="text-gray-600 text-sm">{order.details}</p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-500">
                    <span className="truncate">
                      Patient: {order.patient_name}
                    </span>
                    <span className="flex-shrink-0">
                      Ordered: {new Date(order.ordered_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
