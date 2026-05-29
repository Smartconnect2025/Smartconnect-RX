"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { OrderCard } from "../orders";
import { Order, LocalOrder } from "../../types/order.types";

interface OrdersTabProps {
  orders: (Order | LocalOrder)[];
  isFinalized: boolean;
  getOrderFieldValue: (
    order: Order | LocalOrder,
    field: "type" | "title" | "details",
  ) => string;
  onUpdateOrder: (orderId: string, field: string, value: string) => void;
  onRemoveOrder: (order: Order | LocalOrder) => Promise<void>;
  onPlaceOrder: (order: Order | LocalOrder) => Promise<void>;
  onPrintOrder: (order: Order) => void;
  onAddOrder: () => void;
}

export function OrdersTab({
  orders,
  isFinalized,
  getOrderFieldValue,
  onUpdateOrder,
  onRemoveOrder,
  onPlaceOrder,
  onPrintOrder,
  onAddOrder,
}: OrdersTabProps) {
  return (
    <div className="space-y-6">
      {/* Dynamic Orders */}
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          isFinalized={isFinalized}
          getOrderFieldValue={getOrderFieldValue}
          handleUpdateOrder={onUpdateOrder}
          handleRemoveOrder={onRemoveOrder}
          handlePlaceOrder={onPlaceOrder}
          handlePrintOrder={onPrintOrder}
        />
      ))}

      {/* Add Order Button */}
      {!isFinalized && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="w-full flex items-center space-x-2 text-gray-600 bg-white hover:bg-gray-100"
            onClick={onAddOrder}
          >
            <Plus className="h-4 w-4" />
            <span>Add Order</span>
          </Button>
        </div>
      )}
    </div>
  );
}
