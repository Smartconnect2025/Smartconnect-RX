"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/tailwind-utils";
import { useUser } from "@core/auth";

import { conditionService } from "../services/conditionService";
import {
  Condition,
  ConditionSeverityEnum,
  ConditionStatusEnum,
} from "../types";

interface ConditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  condition?: Condition | null;
  onSuccess: () => void;
}

export function ConditionModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  condition,
  onSuccess,
}: ConditionModalProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(condition?.name || "");
  const [onsetDate, setOnsetDate] = useState<Date | undefined>(
    condition?.onsetDate ? new Date(condition.onsetDate) : undefined,
  );
  const [severity, setSeverity] = useState(
    condition?.severity || ConditionSeverityEnum.Mild,
  );
  const [status, setStatus] = useState(
    condition?.status || ConditionStatusEnum.Active,
  );
  const [notes, setNotes] = useState(condition?.notes || "");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const isEditing = !!condition;

  // Update form state when condition prop changes
  useEffect(() => {
    if (condition) {
      setName(condition.name || "");
      setOnsetDate(
        condition.onsetDate ? new Date(condition.onsetDate) : undefined,
      );
      setSeverity(condition.severity || ConditionSeverityEnum.Mild);
      setStatus(condition.status || ConditionStatusEnum.Active);
      setNotes(condition.notes || "");
    } else {
      // Reset form for new condition
      setName("");
      setOnsetDate(undefined);
      setSeverity(ConditionSeverityEnum.Mild);
      setStatus(ConditionStatusEnum.Active);
      setNotes("");
    }
  }, [condition]);

  const handleSaveCondition = async () => {
    if (!user?.id) {
      toast.error("Please log in to save condition");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter condition name");
      return;
    }

    if (!onsetDate) {
      toast.error("Please select onset date");
      return;
    }

    setLoading(true);

    try {
      const conditionData = {
        patientId,
        name: name.trim(),
        onsetDate: onsetDate.toISOString(),
        severity,
        status,
        notes: notes.trim() || undefined,
      };

      let result;
      if (isEditing && condition) {
        result = await conditionService.updateCondition(
          condition.id,
          user.id,
          conditionData,
        );
      } else {
        result = await conditionService.createCondition(user.id, conditionData);
      }

      if (result.success) {
        toast.success(
          isEditing
            ? "Condition updated successfully"
            : "Condition added successfully",
        );
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to save condition");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save condition";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setName(condition?.name || "");
      setOnsetDate(
        condition?.onsetDate ? new Date(condition.onsetDate) : undefined,
      );
      setSeverity(condition?.severity || ConditionSeverityEnum.Mild);
      setStatus(condition?.status || ConditionStatusEnum.Active);
      setNotes(condition?.notes || "");
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[400px] bg-white px-6 z-50">
        <SheetHeader className="pb-6">
          <div>
            <SheetTitle className="text-lg font-semibold">
              {isEditing ? "Edit Condition" : "Add Condition"}
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-600 mt-1">
              {isEditing ? "Update condition for" : "Add new condition for"}{" "}
              {patientName}.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Condition Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Condition Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hypertension"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Onset Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Onset Date</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50",
                    !onsetDate && "text-gray-500",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {onsetDate ? format(onsetDate, "PPP") : "Select onset date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 z-[9999] bg-white border shadow-lg relative"
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions={false}
                collisionPadding={0}
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{
                  zIndex: 9999,
                  position: "fixed",
                  pointerEvents: "auto",
                }}
              >
                <Calendar
                  mode="single"
                  selected={onsetDate}
                  onSelect={(selectedDate) => {
                    setOnsetDate(selectedDate);
                    setIsCalendarOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date > today;
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Severity</Label>
            <Select
              value={severity}
              onValueChange={(value) =>
                setSeverity(value as ConditionSeverityEnum)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ConditionSeverityEnum.Mild}>Mild</SelectItem>
                <SelectItem value={ConditionSeverityEnum.Moderate}>
                  Moderate
                </SelectItem>
                <SelectItem value={ConditionSeverityEnum.Severe}>
                  Severe
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ConditionStatusEnum)}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ConditionStatusEnum.Active}>
                  Active
                </SelectItem>
                <SelectItem value={ConditionStatusEnum.Resolved}>
                  Resolved
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about the condition..."
              className="w-full min-h-[80px]"
              disabled={loading}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveCondition}
            disabled={loading}
            variant="default"
          >
            {loading
              ? "Saving..."
              : isEditing
                ? "Update Condition"
                : "Add Condition"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
