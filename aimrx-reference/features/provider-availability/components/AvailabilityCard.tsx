import React from "react";
import { AvailabilityBlock } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

interface AvailabilityCardProps {
  block: AvailabilityBlock;
  onEdit: (blockId: string) => void;
}

export const AvailabilityCard: React.FC<AvailabilityCardProps> = ({
  block,
  onEdit,
}) => {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(block.id);
  };

  return (
    <div className="bg-white border rounded-lg px-6 py-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-lg">{block.label}</span>
          {block.isDefault && (
            <Badge className="bg-green-100 text-green-700 font-medium">
              Default
            </Badge>
          )}
        </div>
        <div className="text-gray-700 text-sm">
          {block.days}, {block.time}
        </div>
        <div className="text-gray-500 text-xs">{block.timezone}</div>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="border-gray-200"
        onClick={handleEditClick}
      >
        <MoreHorizontal className="h-5 w-5" />
      </Button>
    </div>
  );
};
