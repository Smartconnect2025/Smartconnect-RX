"use client";

import { Order, LocalOrder } from "../../types/order.types";
import { PlacedOrderView } from "./PlacedOrderView";
import { EditableOrderView } from "./EditableOrderView";

interface OrderCardProps {
  order: Order | LocalOrder;
  isFinalized: boolean;
  getOrderFieldValue: (order: Order | LocalOrder, field: "type" | "title" | "details") => string;
  handleUpdateOrder: (orderId: string, field: string, value: string) => void;
  handleRemoveOrder: (order: Order | LocalOrder) => Promise<void>;
  handlePlaceOrder: (order: Order | LocalOrder) => Promise<void>;
  handlePrintOrder: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isFinalized,
  getOrderFieldValue,
  handleUpdateOrder,
  handleRemoveOrder,
  handlePlaceOrder,
  handlePrintOrder,
}) => {
  return (
    <div className="border border-gray-200 rounded-sm p-6 bg-white">
      {"orderedAt" in order && order.orderedAt ? (
        <PlacedOrderView order={order as Order} handlePrintOrder={() => handlePrintOrder(order as Order)} />
      ) : (
        <EditableOrderView
          order={order as LocalOrder}
          isFinalized={isFinalized}
          getOrderFieldValue={getOrderFieldValue}
          handleUpdateOrder={handleUpdateOrder}
          handleRemoveOrder={handleRemoveOrder}
          handlePlaceOrder={handlePlaceOrder}
          handlePrintOrder={() => handlePrintOrder(order as unknown as Order)}
        />
      )}
    </div>
  );
};
