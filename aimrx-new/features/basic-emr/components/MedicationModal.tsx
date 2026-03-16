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
import { cn } from "@/utils/tailwind-utils";
import { useUser } from "@core/auth";

import { medicationService } from "../services/medicationService";
import { Medication, MedicationStatus, MedicationStatusEnum } from "../types";

interface MedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  medication?: Medication | null;
  onSuccess: () => void;
}

export function MedicationModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  medication,
  onSuccess,
}: MedicationModalProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(medication?.name || "");
  const [dosage, setDosage] = useState(medication?.dosage || "");
  const [frequency, setFrequency] = useState(medication?.frequency || "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    medication?.startDate ? new Date(medication.startDate) : undefined,
  );
  const [status, setStatus] = useState(
    medication?.status || MedicationStatusEnum.Active,
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const isEditing = !!medication;

  // Update form state when medication prop changes
  useEffect(() => {
    if (medication) {
      setName(medication.name || "");
      setDosage(medication.dosage || "");
      setFrequency(medication.frequency || "");
      setStartDate(
        medication.startDate ? new Date(medication.startDate) : undefined,
      );
      setStatus(medication.status || MedicationStatusEnum.Active);
    } else {
      setName("");
      setDosage("");
      setFrequency("");
      setStartDate(undefined);
      setStatus(MedicationStatusEnum.Active);
    }
  }, [medication]);

  const handleSaveMedication = async () => {
    if (!user?.id) {
      toast.error("Please log in to save medication");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter medication name");
      return;
    }

    if (!dosage.trim()) {
      toast.error("Please enter dosage");
      return;
    }

    if (!frequency.trim()) {
      toast.error("Please enter frequency");
      return;
    }

    if (!startDate) {
      toast.error("Please select start date");
      return;
    }

    setLoading(true);

    try {
      const medicationData = {
        patientId,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        startDate: startDate.toISOString(),
        status: status as MedicationStatus,
      };

      let result;
      if (isEditing && medication) {
        result = await medicationService.updateMedication(
          medication.id,
          user.id,
          medicationData,
        );
      } else {
        result = await medicationService.createMedication(
          user.id,
          medicationData,
        );
      }

      if (result.success) {
        toast.success(
          isEditing
            ? "Medication updated successfully"
            : "Medication added successfully",
        );
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to save medication");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save medication";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setName(medication?.name || "");
      setDosage(medication?.dosage || "");
      setFrequency(medication?.frequency || "");
      setStartDate(
        medication?.startDate ? new Date(medication.startDate) : undefined,
      );
      setStatus(medication?.status || MedicationStatusEnum.Active);
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[400px] bg-white px-6 z-50">
        <SheetHeader className="pb-6">
          <div>
            <SheetTitle className="text-lg font-semibold">
              {isEditing ? "Edit Medication" : "Add Medication"}
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-600 mt-1">
              {isEditing ? "Update medication for" : "Add new medication for"}{" "}
              {patientName}.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Medication Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Medication Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lisinopril"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Start Date</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50",
                    !startDate && "text-gray-500",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {startDate ? format(startDate, "PPP") : "Select start date"}
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
                  selected={startDate}
                  onSelect={(selectedDate) => {
                    setStartDate(selectedDate);
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

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as MedicationStatusEnum)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MedicationStatusEnum.Active}>
                  Active
                </SelectItem>
                <SelectItem value={MedicationStatusEnum.Discontinued}>
                  Discontinued
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dosage */}
          <div className="space-y-2">
            <Label htmlFor="dosage" className="text-sm font-medium">
              Dosage
            </Label>
            <Input
              id="dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g., 10mg"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-sm font-medium">
              Frequency
            </Label>
            <Input
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g., Once daily"
              className="w-full"
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
            onClick={handleSaveMedication}
            disabled={loading}
            variant="default"
          >
            {loading
              ? "Saving..."
              : isEditing
                ? "Update Medication"
                : "Add Medication"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
