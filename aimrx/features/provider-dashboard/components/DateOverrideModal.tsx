"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import TimeRangeInput from "./TimeRangeInput";
import { TimeRange } from "../types";

interface DateOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    dates: Date[],
    timeRanges: TimeRange[],
    unavailableAllDay: boolean,
  ) => void;
  initialDates?: Date[];
  initialTimeRanges?: TimeRange[];
  initialUnavailableAllDay?: boolean;
  isEditing?: boolean;
}

const DateOverrideModal = ({
  open,
  onOpenChange,
  onSave,
  initialDates = [],
  initialTimeRanges = [{ startTime: "08:30", endTime: "17:00" }],
  initialUnavailableAllDay = false,
  isEditing = false,
}: DateOverrideModalProps) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>(initialDates);
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>(initialTimeRanges);
  const [unavailableAllDay, setUnavailableAllDay] = useState(
    initialUnavailableAllDay,
  );

  // Reset state when modal opens with new initial values
  useEffect(() => {
    if (open) {
      setSelectedDates(initialDates);
      setTimeRanges(initialTimeRanges);
      setUnavailableAllDay(initialUnavailableAllDay);
    }
  }, [open, initialDates, initialTimeRanges, initialUnavailableAllDay]);

  const handleSave = () => {
    onSave(selectedDates, timeRanges, unavailableAllDay);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-h-[90vh] bg-white !max-w-[95vw] w-full mx-auto overflow-hidden sm:!max-w-3xl lg:!max-w-4xl">
        <DialogTitle className="sr-only">Add Date Override</DialogTitle>
        <div className="flex flex-col lg:flex-row w-full min-h-0">
          <div className="lg:w-1/2 p-6 border-b lg:border-b-0 lg:border-r border-gray-200 min-w-0">
            <h2 className="text-xl font-semibold mb-4">
              Select the dates you want to override
            </h2>
            <div className="flex justify-center overflow-x-auto">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                className="rounded-md border"
              />
            </div>
          </div>
          <div className="lg:w-1/2 p-6 flex flex-col min-h-0 min-w-0">
            <div className="flex-1 overflow-y-auto">
              <h2 className="text-xl font-semibold mb-6">
                What hours are you available?
              </h2>
              <div className="space-y-6 pr-2">
                {!unavailableAllDay && (
                  <div className="overflow-x-auto">
                    <TimeRangeInput
                      timeRanges={timeRanges}
                      onChange={setTimeRanges}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={unavailableAllDay}
                    onCheckedChange={(checked) => {
                      setUnavailableAllDay(checked);
                      // If switching from unavailable to available, ensure we have time ranges
                      if (!checked && timeRanges.length === 0) {
                        setTimeRanges([
                          { startTime: "08:30", endTime: "17:00" },
                        ]);
                      }
                    }}
                    className="data-[state=checked]:bg-primary"
                  />
                  <Label>Unavailable all day</Label>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white"
              >
                {isEditing ? "Update Override" : "Add Override"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DateOverrideModal;
