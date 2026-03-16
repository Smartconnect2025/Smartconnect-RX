"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
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
import {
  EncounterType,
  EncounterTypeEnum,
  EncounterBusinessTypeEnum,
} from "../types";
import { TIME_SLOTS } from "../constants";

interface CreateEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export function CreateEncounterModal({
  isOpen,
  onClose,
  patientId,
  patientName,
}: CreateEncounterModalProps) {
  const { user } = useUser();
  const createEncounter = useEmrStore((state) => state.createEncounter);
  const loading = useEmrStore((state) => state.loading);

  const [title, setTitle] = useState("");
  const [encounterType, setEncounterType] = useState<EncounterType>(
    EncounterTypeEnum.FollowUp,
  );
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleCreateEncounter = async () => {
    if (!user?.id) {
      toast.error("Please log in to create an encounter");
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

    // Create basic manual encounter
    const encounterData = {
      patientId,
      title: title.trim(),
      date: encounterDateTime.toISOString(),
      type: encounterType,
      businessType: EncounterBusinessTypeEnum.Manual,
      provider: user.email || "Unknown Provider",
    };

    const result = await createEncounter(user.id, encounterData);

    if (result) {
      toast.success("Encounter created successfully!");
      // Reset form on success
      setTitle("");
      setEncounterType(EncounterTypeEnum.FollowUp);
      setDate(undefined);
      setTime("");
      onClose();
    }
    // Error handling is done in the store with toast notifications
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setTitle("");
      setEncounterType(EncounterTypeEnum.FollowUp);
      setDate(undefined);
      setTime("");
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[400px] bg-white px-6 py-6 z-50 overflow-y-auto max-h-screen">
        <SheetHeader className="pb-6">
          <div>
            <SheetTitle className="text-lg font-semibold">
              Create New Encounter
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-600 mt-1">
              Schedule a new encounter with {patientName}.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6">
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
                side="bottom"
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
            onClick={handleCreateEncounter}
            disabled={loading}
            variant="default"
          >
            {loading ? "Creating..." : "Create Encounter"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
