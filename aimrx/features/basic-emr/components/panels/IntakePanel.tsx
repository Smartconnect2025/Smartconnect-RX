"use client";

import { ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { IntakeWorkflowProps } from "../../types/workflow.types";

export function IntakePanel({ encounter, onOpenIntake }: IntakeWorkflowProps) {
  return (
    <Button
      variant="outline"
      className="w-full justify-between py-2 h-auto bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-sm"
      onClick={onOpenIntake}
    >
      <div className="flex flex-col items-start">
        <h4 className="font-medium text-gray-900">Intake</h4>
        <p className="text-sm text-gray-600">
          {format(new Date(encounter.date), "MMMM d, yyyy")}
        </p>
        <p className="text-xs text-gray-500">
          {format(new Date(encounter.date), "h:mm a")}
        </p>
      </div>
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
