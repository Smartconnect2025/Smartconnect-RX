"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { OrderSection } from "./OrderSection";

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

interface PatientOrdersTabProps {
  patientId: string;
}

export function PatientOrdersTab({ patientId }: PatientOrdersTabProps) {
  const [orders, setOrders] = useState<PatientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatientOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/basic-emr/patients/${patientId}/orders`,
      );
      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
      } else {
        setError(result.error || "Failed to load orders");
        toast.error("Failed to load patient orders");
      }
    } catch (err) {
      console.error("Error loading patient orders:", err);
      setError("Failed to load orders");
      toast.error("Failed to load patient orders");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatientOrders();
  }, [loadPatientOrders]);

  const handleStartCall = (order: PatientOrder) => {
    if (order.appointment_id) {
      // Navigate to the appointment page (same as provider dashboard Join button)
      window.location.href = `/appointment/${order.appointment_id}`;
    } else {
      toast.error("No appointment found for this order");
    }
  };

  const handleReviewOrder = (order: PatientOrder) => {
    if (order.encounter_id) {
      // Navigate to the existing encounter (same as Order-based Encounters section)
      window.location.href = `/basic-emr/patients/${patientId}/encounters/${order.encounter_id}`;
    } else {
      toast.error("No encounter found for this order");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading orders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-center text-red-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={loadPatientOrders}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={loadPatientOrders} size="sm">
          Refresh
        </Button>
      </div>

      <OrderSection
        title="Patient Orders"
        orders={orders}
        onStartCall={handleStartCall}
        onReviewOrder={handleReviewOrder}
        patientId={patientId}
      />
    </div>
  );
}
