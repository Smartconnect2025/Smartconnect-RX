"use client";

import { X, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Order, LocalOrder } from "../../types/order.types";

interface EditableOrderViewProps {
  order: LocalOrder;
  isFinalized: boolean;
  getOrderFieldValue: (
    order: Order | LocalOrder,
    field: "type" | "title" | "details",
  ) => string;
  handleUpdateOrder: (orderId: string, field: string, value: string) => void;
  handleRemoveOrder: (order: Order | LocalOrder) => Promise<void>;
  handlePlaceOrder: (order: Order | LocalOrder) => Promise<void>;
  handlePrintOrder: (order: Order) => void;
}

export const EditableOrderView: React.FC<EditableOrderViewProps> = ({
  order,
  isFinalized,
  getOrderFieldValue,
  handleUpdateOrder,
  handleRemoveOrder,
  handlePlaceOrder,
  handlePrintOrder,
}) => {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Select
            value={getOrderFieldValue(order, "type")}
            onValueChange={(value) =>
              handleUpdateOrder(order.id, "type", value)
            }
            disabled={isFinalized}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Order type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="medication">Medication</SelectItem>
              <SelectItem value="lab">Lab Order</SelectItem>
              <SelectItem value="imaging">Imaging</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          {!isFinalized && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => handleRemoveOrder(order)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-gray-700">Title</Label>
          <Input
            value={getOrderFieldValue(order, "title")}
            onChange={(e) =>
              handleUpdateOrder(order.id, "title", e.target.value)
            }
            disabled={isFinalized}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-700">Details</Label>
          <Textarea
            value={getOrderFieldValue(order, "details")}
            onChange={(e) =>
              handleUpdateOrder(order.id, "details", e.target.value)
            }
            disabled={isFinalized}
            className="mt-1 h-24 resize-none"
          />
        </div>

        <div className="flex items-center space-x-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
            onClick={() => handlePrintOrder(order as unknown as Order)}
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          {!isFinalized && (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => handlePlaceOrder(order)}
            >
              Place Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
