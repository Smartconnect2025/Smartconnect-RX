"use client";
import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ArrowLeft, Trash } from "lucide-react";
import DateOverrideModal from "./DateOverrideModal";
import { AvailabilityBlock } from "../types";
import { ScheduleFormData, DaySchedule } from "./NewScheduleForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultTimes = { start: "08:30", end: "17:00" };

interface EditScheduleFormProps {
  block: AvailabilityBlock;
  onClose: () => void;
  onSave: (formData: ScheduleFormData) => void;
  onDelete?: () => void;
}

// Helper function to parse time string like "8:30am - 5:00pm" into start and end objects
const parseTimeRange = (timeString: string): { start: string; end: string } => {
  try {
    const [startStr, endStr] = timeString.split(" - ");

    // Convert from 12h to 24h format
    const parseTime = (timeStr: string): string => {
      const isPM = timeStr.toLowerCase().includes("pm");
      const [hours, minutesPart] = timeStr
        .toLowerCase()
        .replace("am", "")
        .replace("pm", "")
        .trim()
        .split(":");

      let hoursNum = parseInt(hours, 10);
      if (isPM && hoursNum < 12) hoursNum += 12;
      if (!isPM && hoursNum === 12) hoursNum = 0;

      return `${hoursNum.toString().padStart(2, "0")}:${minutesPart || "00"}`;
    };

    return {
      start: parseTime(startStr),
      end: parseTime(endStr),
    };
  } catch (e) {
    console.error("Error parsing time range:", e);
    return defaultTimes;
  }
};

// Helper to convert day range like "Mon - Fri" to array of enabled days
const parseDayRange = (dayRange: string): boolean[] => {
  const enabledDays = Array(7).fill(false);

  const dayRanges = dayRange.split(", ");

  dayRanges.forEach((range) => {
    if (range.includes(" - ")) {
      // Handle ranges like "Mon - Fri"
      const [start, end] = range.split(" - ");
      const startIdx = daysOfWeek.indexOf(start);
      const endIdx = daysOfWeek.indexOf(end);

      if (startIdx !== -1 && endIdx !== -1) {
        // If end comes after start in the week
        if (endIdx >= startIdx) {
          for (let i = startIdx; i <= endIdx; i++) {
            enabledDays[i] = true;
          }
        } else {
          // Handle wrapping (e.g., "Fri - Mon")
          for (let i = startIdx; i < 7; i++) {
            enabledDays[i] = true;
          }
          for (let i = 0; i <= endIdx; i++) {
            enabledDays[i] = true;
          }
        }
      }
    } else {
      // Handle individual days
      const dayIdx = daysOfWeek.indexOf(range);
      if (dayIdx !== -1) {
        enabledDays[dayIdx] = true;
      }
    }
  });

  return enabledDays;
};

export default function EditScheduleForm({
  block,
  onClose,
  onSave,
  onDelete,
}: EditScheduleFormProps) {
  const [days, setDays] = useState<DaySchedule[]>(
    daysOfWeek.map((day) => ({
      label: day,
      enabled: false,
      times: [{ ...defaultTimes }],
    })),
  );
  const [isDefault, setIsDefault] = useState(block.isDefault);
  const [timezone, setTimezone] = useState("Europe/Ireland");
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Initialize form with data from the block
  useEffect(() => {
    // Parse timezone
    if (block.timezone.includes("Dublin")) {
      setTimezone("Europe/Ireland");
    } else if (block.timezone.includes("London")) {
      setTimezone("Europe/London");
    } else if (
      block.timezone.includes("New_York") ||
      block.timezone.includes("New York")
    ) {
      setTimezone("America/New_York");
    }

    // Parse time range
    const timeRange = parseTimeRange(block.time);

    // Parse day ranges
    const enabledDays = parseDayRange(block.days);

    // Set days
    setDays(
      daysOfWeek.map((day, idx) => ({
        label: day,
        enabled: enabledDays[idx],
        times: [timeRange],
      })),
    );
  }, [block]);

  useLayoutEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleToggleDay = (idx: number) => {
    setDays((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, enabled: !d.enabled } : d)),
    );
  };

  const handleTimeChange = (
    dayIdx: number,
    timeIdx: number,
    field: "start" | "end",
    value: string,
  ) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              times: d.times.map((t, j) =>
                j === timeIdx ? { ...t, [field]: value } : t,
              ),
            }
          : d,
      ),
    );
  };

  const handleAddTime = (dayIdx: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx ? { ...d, times: [...d.times, { ...defaultTimes }] } : d,
      ),
    );
  };

  const handleRemoveTime = (dayIdx: number, timeIdx: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, times: d.times.filter((_, j) => j !== timeIdx) }
          : d,
      ),
    );
  };

  const handleSave = () => {
    // Send the complete form data to parent
    onSave({
      days,
      isDefault,
      timezone,
    });
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete();
    }
    setDeleteDialogOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 mt-24 mb-24"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h2 className="text-2xl font-semibold">Edit schedule</h2>
            <div className="text-gray-500 text-sm">
              Update your availability
            </div>
          </div>
        </div>
        {onDelete && (
          <Button
            variant="outline"
            size="icon"
            className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700"
            onClick={handleDelete}
          >
            <Trash className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            {days.map((day, dayIdx) => (
              <div
                key={day.label}
                className="flex items-center py-2 border-b last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-[90px]">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={() => handleToggleDay(dayIdx)}
                  />
                  <span
                    className={
                      day.enabled
                        ? "text-base font-medium"
                        : "text-base text-gray-400"
                    }
                  >
                    {day.label}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-end gap-2">
                  {day.times.map((time, timeIdx) => (
                    <div key={timeIdx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={time.start}
                        onChange={(e) =>
                          handleTimeChange(
                            dayIdx,
                            timeIdx,
                            "start",
                            e.target.value,
                          )
                        }
                        className="w-28"
                        disabled={!day.enabled}
                      />
                      <span className="text-gray-500">-</span>
                      <Input
                        type="time"
                        value={time.end}
                        onChange={(e) =>
                          handleTimeChange(
                            dayIdx,
                            timeIdx,
                            "end",
                            e.target.value,
                          )
                        }
                        className="w-28"
                        disabled={!day.enabled}
                      />
                      {timeIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTime(dayIdx, timeIdx)}
                          disabled={!day.enabled}
                          className="h-9 w-9 text-gray-400"
                        >
                          &times;
                        </Button>
                      )}
                    </div>
                  ))}
                  {day.enabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddTime(dayIdx)}
                      className="ml-2 text-xs"
                    >
                      + Add time
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <div className="font-medium mb-2">Date overrides</div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 text-sm mb-2">
                Override your availability for specific dates
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  className="flex-1"
                  placeholder="No date overrides added"
                  disabled
                />
              </div>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => setOverrideModalOpen(true)}
              >
                + Add an override
              </Button>
            </div>
          </div>
        </div>
        <div className="w-full md:w-64 flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Set as default</span>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="text-gray-500 text-xs">
              Make this your default availability schedule
            </div>
          </div>
          <div>
            <div className="font-medium mb-2">Timezone</div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Ireland">
                  (GMT+1) Europe/Ireland
                </SelectItem>
                <SelectItem value="Europe/London">
                  (GMT+1) Europe/London
                </SelectItem>
                <SelectItem value="America/New_York">
                  (GMT-4) America/New_York
                </SelectItem>
                {/* Add more timezones as needed */}
              </SelectContent>
            </Select>
          </div>
          <Button variant="default" className="mt-4" onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>
      <DateOverrideModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        onSave={() => setOverrideModalOpen(false)}
        containerWidth={containerWidth}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this schedule?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              schedule and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
