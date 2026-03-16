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

import { useEmrStore } from "../store/emr-store";
import { Encounter, EncounterType, EncounterTypeEnum } from "../types";
import { TIME_SLOTS } from "../constants";
import { appointmentEncounterService } from "../services/appointmentEncounterService";

interface EditEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: Encounter | null;
  patientId: string;
  patientName: string;
}

export function EditEncounterModal({
  isOpen,
  onClose,
  encounter,
  patientName,
}: EditEncounterModalProps) {
  const { user } = useUser();
  const updateEncounterAsync = useEmrStore(
    (state) => state.updateEncounterAsync,
  );
  const loading = useEmrStore((state) => state.loading);

  const [title, setTitle] = useState("");
  const [encounterType, setEncounterType] = useState<EncounterType>(
    EncounterTypeEnum.FollowUp,
  );
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [provider, setProvider] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    if (encounter) {
      setTitle(encounter.title || "");
      setEncounterType(encounter.type || EncounterTypeEnum.FollowUp);

      const encounterDate = new Date(encounter.date);
      setDate(encounterDate);

      // Format time for display
      const hours = encounterDate.getHours();
      const minutes = encounterDate.getMinutes();
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      const timeString = `${displayHours}:${minutes
        .toString()
        .padStart(2, "0")} ${period}`;
      setTime(timeString);

      setProvider(encounter.providerName || "");
    }
  }, [encounter]);

  const handleUpdateEncounter = async () => {
    if (!user?.id || !encounter) {
      toast.error("Please log in to update an encounter");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter an encounter title");
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    if (!time) {
      toast.error("Please select a time");
      return;
    }

    if (!provider.trim()) {
      toast.error("Please enter a provider name");
      return;
    }

    // Convert time string to 24-hour format for date creation
    const [timeStr, period] = time.split(" ");
    const [hours, minutes] = timeStr.split(":").map(Number);
    const hour24 =
      period === "PM" && hours !== 12
        ? hours + 12
        : period === "AM" && hours === 12
          ? 0
          : hours;

    const encounterDateTime = new Date(date);
    encounterDateTime.setHours(hour24, minutes, 0, 0);

    const updates = {
      title: title.trim(),
      date: encounterDateTime.toISOString(),
      type: encounterType,
      providerName: provider.trim(),
    };

    // If this is an appointment-based encounter, also update the linked appointment
    if (
      encounter.businessType === "appointment_based" &&
      encounter.appointmentId
    ) {
      try {
        // Use the appointment encounter service to sync both appointment and encounter
        const syncResult =
          await appointmentEncounterService.syncAppointmentAndEncounter(
            encounter.appointmentId,
            encounter.id,
            {
              datetime: encounterDateTime.toISOString(),
              reason: title.trim(),
              title: title.trim(),
              date: encounterDateTime.toISOString(),
            },
          );

        if (!syncResult.success) {
          // Silently handle sync failure
        }
      } catch (error) {
        // Silently handle sync error
      }
    }

    const result = await updateEncounterAsync(encounter.id, user.id, updates);

    if (result) {
      onClose();
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!encounter) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[400px] bg-white px-6 py-6 z-50 overflow-y-auto max-h-screen">
        <SheetHeader className="pb-6">
          <div>
            <SheetTitle className="text-lg font-semibold">
              Edit Encounter
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-600 mt-1">
              Update encounter details for {patientName}.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Warning for appointment-based encounters */}
          {encounter.businessType === "appointment_based" && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is an appointment-based encounter.
                Changes will also update the linked appointment.
              </p>
            </div>
          )}

          {/* Encounter Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Encounter Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow-up Visit"
              className="w-full"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Enter a descriptive title for this encounter.
            </p>
          </div>

          {/* Encounter Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Encounter Type</Label>
            <Select
              value={encounterType}
              onValueChange={(value) =>
                setEncounterType(value as EncounterType)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select encounter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EncounterTypeEnum.Routine}>
                  Routine
                </SelectItem>
                <SelectItem value={EncounterTypeEnum.FollowUp}>
                  Follow-up
                </SelectItem>
                <SelectItem value={EncounterTypeEnum.Urgent}>Urgent</SelectItem>
                <SelectItem value={EncounterTypeEnum.Consultation}>
                  Consultation
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider" className="text-sm font-medium">
              Provider
            </Label>
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Enter provider name"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  disabled={loading}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50",
                    !date && "text-gray-500",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-white border border-border shadow-lg z-99"
                align="start"
                side="top"
                sideOffset={4}
                avoidCollisions={true}
                collisionPadding={20}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => {
                    setDate(selectedDate);
                    setIsCalendarOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Time</Label>
            <Select value={time} onValueChange={setTime} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdateEncounter}
            disabled={loading}
            variant="default"
          >
            {loading ? "Updating..." : "Update Encounter"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
