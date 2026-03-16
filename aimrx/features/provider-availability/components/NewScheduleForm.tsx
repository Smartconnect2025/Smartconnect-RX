import React, { useState, useRef, useLayoutEffect } from "react";
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
import { ArrowLeft } from "lucide-react";
import DateOverrideModal from "./DateOverrideModal";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const defaultTimes = { start: "08:30", end: "17:00" };

export interface DaySchedule {
  label: string;
  enabled: boolean;
  times: Array<{ start: string; end: string }>;
}

export interface ScheduleFormData {
  days: DaySchedule[];
  isDefault: boolean;
  timezone: string;
}

interface NewScheduleFormProps {
  onClose: () => void;
  onSave: (entry: ScheduleFormData) => void;
}

export default function NewScheduleForm({
  onClose,
  onSave,
}: NewScheduleFormProps) {
  const [days, setDays] = useState<DaySchedule[]>(
    daysOfWeek.map((day, idx) => ({
      label: day,
      enabled: idx < 5, // Mon-Fri enabled by default
      times: [{ ...defaultTimes }],
    })),
  );
  const [isDefault, setIsDefault] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Ireland");
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

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

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 mt-24 mb-24"
    >
      <div className="flex items-center mb-6 gap-2">
        <Button variant="ghost" size="icon" className="mr-2" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">New schedule</h2>
          <div className="text-gray-500 text-sm">Set your availability</div>
        </div>
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
    </div>
  );
}
