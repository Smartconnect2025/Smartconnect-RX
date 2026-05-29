import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  containerWidth?: number | null;
}

const DateOverrideModal = ({
  open,
  onOpenChange,
  onSave,
  containerWidth,
}: DateOverrideModalProps) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([
    { startTime: "08:30", endTime: "17:00" },
  ]);
  const [unavailableAllDay, setUnavailableAllDay] = useState(false);

  const handleSave = () => {
    onSave(selectedDates, timeRanges, unavailableAllDay);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-h-[90vh] overflow-auto bg-white"
        style={
          containerWidth
            ? { width: Math.round(containerWidth * 0.8), maxWidth: "64rem" }
            : {}
        }
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Date Override Settings</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">
              Select the dates you want to override
            </h2>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates || [])}
              className="rounded-md border mx-auto"
            />
          </div>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">
              What hours are you available?
            </h2>
            <div className="space-y-6">
              {!unavailableAllDay && (
                <TimeRangeInput
                  timeRanges={timeRanges}
                  onChange={setTimeRanges}
                />
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={unavailableAllDay}
                  onCheckedChange={setUnavailableAllDay}
                  className="data-[state=checked]:bg-primary"
                />
                <Label>Unavailable all day</Label>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
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
                Add Override
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DateOverrideModal;
