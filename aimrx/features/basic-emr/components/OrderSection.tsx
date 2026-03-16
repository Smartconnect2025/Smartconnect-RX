"use client";

import {
  AlertCircle,
  CheckCircle,
  Circle,
  Calendar,
  Clock,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { orderRequiresAppointment } from "../config/order-types";

interface PatientOrder {
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
  order_line_items?: Array<{
    name: string;
    product_id: number;
    price: number;
  }>;
}

interface OrderSectionProps {
  title: string;
  orders: PatientOrder[];
  onStartCall?: (order: PatientOrder) => void;
  onReviewOrder?: (order: PatientOrder) => void;
  patientId?: string;
}

export function OrderSection({
  title,
  orders,
  onStartCall,
  onReviewOrder,
  patientId,
}: OrderSectionProps) {
  const router = useRouter();

  const getOrderIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  };

  const getOrderTypeBadge = (type: string) => {
    switch (type) {
      case "medication":
        return (
          <Badge
            variant="outline"
            className="border-blue-500 text-blue-700 text-xs"
          >
            Medication
          </Badge>
        );
      case "TRT":
        return (
          <Badge
            variant="outline"
            className="border-purple-500 text-purple-700 text-xs"
          >
            TRT
          </Badge>
        );
      case "controlled_medication":
        return (
          <Badge
            variant="outline"
            className="border-red-500 text-red-700 text-xs"
          >
            Controlled Medication
          </Badge>
        );
      case "lab_test":
        return (
          <Badge
            variant="outline"
            className="border-green-500 text-green-700 text-xs"
          >
            Lab Test
          </Badge>
        );
      case "weight_loss":
        return (
          <Badge
            variant="outline"
            className="border-orange-500 text-orange-700 text-xs"
          >
            Weight Loss
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {type}
          </Badge>
        );
    }
  };

  const getSyncAsyncBadge = (orderType: string, _order?: PatientOrder) => {
    const requiresAppointment = orderRequiresAppointment(orderType);

    if (requiresAppointment) {
      return (
        <Badge
          variant="outline"
          className="border-orange-500 text-orange-700 text-xs flex items-center gap-1"
        >
          <Video className="h-3 w-3" />
          Sync Order
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="outline"
          className="border-blue-500 text-blue-700 text-xs flex items-center gap-1"
        >
          <Clock className="h-3 w-3" />
          Async Order
        </Badge>
      );
    }
  };

  const getAppointmentStatusBadge = (order: PatientOrder) => {
    const requiresAppointment = orderRequiresAppointment(order.order_type);

    if (!requiresAppointment) {
      return null; // Don't show for async orders
    }

    if (order.appointment_id) {
      switch (order.appointment_status) {
        case "scheduled":
          return (
            <Badge
              variant="outline"
              className="bg-white border-green-500 text-green-700 text-xs flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              Appointment Scheduled
            </Badge>
          );
        case "completed":
          return (
            <Badge
              variant="outline"
              className="bg-white border-green-500 text-green-700 text-xs flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              Appointment Completed
            </Badge>
          );
        case "cancelled":
          return (
            <Badge
              variant="destructive"
              className="text-xs flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              Appointment Cancelled
            </Badge>
          );
        default:
          return (
            <Badge
              variant="secondary"
              className="text-xs flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              Appointment Scheduled
            </Badge>
          );
      }
    } else {
      return (
        <Badge
          variant="outline"
          className="border-red-500 text-red-700 text-xs flex items-center gap-1"
        >
          <Calendar className="h-3 w-3" />
          Requires Appointment
        </Badge>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-white border-border text-xs">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-white border-border text-xs">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-white border-border text-xs">
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-white border-border text-xs">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-white border-border text-xs">
            {status}
          </Badge>
        );
    }
  };

  const handleStartCall = (order: PatientOrder) => {
    if (onStartCall) {
      onStartCall(order);
    } else if (order.appointment_id) {
      // Navigate to the appointment page (same as provider dashboard Join button)
      window.location.href = `/appointment/${order.appointment_id}`;
    }
  };

  const handleReview = (order: PatientOrder) => {
    if (onReviewOrder) {
      onReviewOrder(order);
    } else if (order.encounter_id && patientId) {
      // Navigate to the existing encounter (same as Order-based Encounters section)
      router.push(
        `/basic-emr/patients/${patientId}/encounters/${order.encounter_id}`,
      );
    }
  };

  if (orders.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-600">No orders found</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-3">
        {orders.map((order) => {
          const dateTime = formatDateTime(order.ordered_at);
          const requiresAppointment = orderRequiresAppointment(
            order.order_type,
          );

          return (
            <div
              key={order.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getOrderIcon(order.status)}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{order.title}</div>
                  <div className="text-sm text-gray-600">
                    {dateTime.date} • {dateTime.time}
                    {order.encounter_id && (
                      <span className="ml-2 text-green-600">
                        • Order #{order.id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {getOrderTypeBadge(order.order_type)}
                    {getSyncAsyncBadge(order.order_type, order)}
                    {getAppointmentStatusBadge(order)}
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {requiresAppointment ? (
                  // Sync orders - show both Start Call and Review buttons
                  <>
                    {order.appointment_id &&
                      order.appointment_status === "scheduled" && (
                        <Button
                          variant="default"
                          onClick={() => handleStartCall(order)}
                        >
                          Start Call
                        </Button>
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReview(order)}
                      className="flex items-center gap-1 border-border"
                    >
                      Review
                    </Button>
                  </>
                ) : (
                  // Async orders - show only Review button
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReview(order)}
                    className="flex items-center gap-1 border-border"
                  >
                    Review
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
