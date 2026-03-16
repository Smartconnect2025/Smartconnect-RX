"use client";

import { format } from "date-fns";
import { CheckCircle, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Order } from "../../types/order.types";

interface PlacedOrderViewProps {
  order: Order;
  handlePrintOrder: (order: Order) => void;
}

export const PlacedOrderView: React.FC<PlacedOrderViewProps> = ({
  order,
  handlePrintOrder,
}) => {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <Badge className="bg-slate-200 text-slate-700 capitalize">
          {order.type}
        </Badge>
        <div className="flex items-center gap-2 p-1.5 rounded text-xs text-muted-foreground bg-slate-100">
          <CheckCircle className="h-3 w-3" />
          <span>
            Placed:{" "}
            {order.orderedAt && format(order.orderedAt, "MMM d, yyyy h:mm a")}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {order.title}
        </h3>
        {order.details && (
          <p className="text-sm text-gray-600">{order.details}</p>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
          onClick={() => handlePrintOrder(order)}
        >
          <Printer className="h-4 w-4" />
          <span>Print</span>
        </Button>
      </div>
    </div>
  );
};
