"use client";

import { useCallback } from "react";

interface OrderData {
  id: string;
  patientId: string;
  title: string;
  details?: string;
  orderType: string;
  createdAt: string;
}

export function useOrderEncounterCreation() {
  const createEncounterForOrder = useCallback(async (orderData: OrderData) => {
    try {
      const response = await fetch("/api/basic-emr/orders/link-encounter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: orderData.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        return result.encounterId;
      } else {
        console.error("Failed to create encounter for order:", result.error);
        return null;
      }
    } catch (error) {
      console.error("Error creating encounter for order:", error);
      return null;
    }
  }, []);

  return {
    createEncounterForOrder,
  };
}
