"use client";

import React, { useState, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimezoneCombobox } from "./TimezoneCombobox";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DateOverrideModal from "./DateOverrideModal";
import { TimeRange } from "../types";
import { useProviderAvailability } from "../hooks/useProviderAvailability";

const defaultTimes = { start: "08:30", end: "17:00" };

interface SetAvailabilityProps {
  onSubmitStateChange?: (isSubmitting: boolean) => void;
}

export const SetAvailability: React.FC<SetAvailabilityProps> = ({
  onSubmitStateChange,
}) => {
  const {
    availabilityData,
    setAvailabilityData,
    saveAvailabilityData,
    isLoading,
    error,
  } = useProviderAvailability();

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(
    null,
  );
  const containerRef = useRef<HTMLFormElement>(null);

  const handleToggleDay = (idx: number) => {
    setAvailabilityData((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === idx ? { ...d, enabled: !d.enabled } : d,
      ),
    }));
  };

  const handleTimeChange = (
    dayIdx: number,
    timeIdx: number,
    field: "start" | "end",
    value: string,
  ) => {
    setAvailabilityData((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              times: d.times.map((t, j) =>
                j === timeIdx ? { ...t, [field]: value } : t,
              ),
            }
          : d,
      ),
    }));
  };

  const handleAddTime = (dayIdx: number) => {
    setAvailabilityData((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx ? { ...d, times: [...d.times, { ...defaultTimes }] } : d,
      ),
    }));
  };

  const handleRemoveTime = (dayIdx: number, timeIdx: number) => {
    setAvailabilityData((prev) => ({
      ...prev,
      days: prev.days.map((d, i) =>
        i === dayIdx
          ? { ...d, times: d.times.filter((_, j) => j !== timeIdx) }
          : d,
      ),
    }));
  };

  const handleTimezoneChange = (value: string) => {
    setAvailabilityData((prev) => ({
      ...prev,
      timezone: value,
    }));
  };

  const handleSave = async () => {
    // Validate timezone is selected
    if (!availabilityData.timezone || availabilityData.timezone === "") {
      toast("Please select a timezone before saving.");
      return;
    }

    onSubmitStateChange?.(true);
    try {
      await saveAvailabilityData(availabilityData);
      toast("Availability saved successfully!");
    } catch (err) {
      console.error("Error saving availability:", err);
      toast("Failed to save availability. Please try again.");
    } finally {
      onSubmitStateChange?.(false);
    }
  };

  const handleSaveDateOverride = (
    dates: Date[],
    timeRanges: TimeRange[],
    unavailableAllDay: boolean,
  ) => {
    if (editingOverrideId) {
      // Update existing override (only one date per override)
      if (dates.length > 0) {
        setAvailabilityData((prev) => ({
          ...prev,
          dateOverrides: prev.dateOverrides.map((override) =>
            override.id === editingOverrideId
              ? { ...override, date: dates[0], timeRanges, unavailableAllDay }
              : override,
          ),
        }));
      }
      setEditingOverrideId(null);
    } else {
      // Create separate overrides for each selected date
      const newOverrides = dates.map((date, index) => ({
        id: `${Date.now()}-${index}`, // Unique ID for each date
        date,
        timeRanges,
        unavailableAllDay,
      }));
      setAvailabilityData((prev) => ({
        ...prev,
        dateOverrides: [...prev.dateOverrides, ...newOverrides],
      }));
    }
    setOverrideModalOpen(false);
  };

  const handleEditOverride = (overrideId: string) => {
    setEditingOverrideId(overrideId);
    setOverrideModalOpen(true);
  };

  const handleDeleteOverride = (overrideId: string) => {
    setAvailabilityData((prev) => ({
      ...prev,
      dateOverrides: prev.dateOverrides.filter(
        (override) => override.id !== overrideId,
      ),
    }));
  };

  const getEditingOverride = () => {
    if (!editingOverrideId) return null;
    return (
      availabilityData.dateOverrides.find(
        (override) => override.id === editingOverrideId,
      ) || null
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full mx-auto bg-white rounded-2xl shadow p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading availability...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full mx-auto bg-white rounded-2xl shadow p-8">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      id="availability-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      ref={containerRef}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Weekly Hours and Date Overrides */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Hours Section */}
          <div>
            <div className="bg-gray-50 rounded-lg p-4">
              {availabilityData.days.map((day, dayIdx) => (
                <div
                  key={day.label}
                  className="py-2 border-b border-border last:border-b-0"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
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
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                      {/* First time slot */}
                      {day.times.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={day.times[0].start}
                            onChange={(e) =>
                              handleTimeChange(
                                dayIdx,
                                0,
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
                            value={day.times[0].end}
                            onChange={(e) =>
                              handleTimeChange(dayIdx, 0, "end", e.target.value)
                            }
                            className="w-28"
                            disabled={!day.enabled}
                          />
                        </div>
                      )}
                      <div className="w-full sm:w-[90px] flex justify-start sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddTime(dayIdx)}
                          className="text-xs border border-border"
                          disabled={!day.enabled}
                        >
                          + Add time
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Additional time slots below */}
                  {day.times.length > 1 && (
                    <div className="mt-2 space-y-2">
                      {day.times.slice(1).map((time, timeIdx) => (
                        <div
                          key={timeIdx + 1}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0"
                        >
                          {/* Left spacer to match the day label width on desktop */}
                          <div className="hidden sm:block min-w-[90px]"></div>
                          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={time.start}
                                onChange={(e) =>
                                  handleTimeChange(
                                    dayIdx,
                                    timeIdx + 1,
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
                                    timeIdx + 1,
                                    "end",
                                    e.target.value,
                                  )
                                }
                                className="w-28"
                                disabled={!day.enabled}
                              />
                            </div>
                            {/* Remove button */}
                            <div className="w-full sm:w-[90px] flex justify-start sm:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleRemoveTime(dayIdx, timeIdx + 1)
                                }
                                disabled={!day.enabled}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Date overrides Section - Now below Weekly Hours */}
          <div>
            <div className="font-medium mb-2">Date overrides</div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 text-sm mb-4">
                Override your availability for specific dates
              </div>

              {/* Display existing overrides */}
              {availabilityData.dateOverrides.length > 0 && (
                <div className="space-y-2 mb-4">
                  {availabilityData.dateOverrides.map((override) => (
                    <div
                      key={override.id}
                      className="bg-white rounded-md p-2 border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-sm">
                          {override.date.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-600">
                          {override.unavailableAllDay
                            ? "Unavailable all day"
                            : override.timeRanges
                                .map(
                                  (range) =>
                                    `${range.startTime}-${range.endTime}`,
                                )
                                .join(", ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOverride(override.id)}
                          className="text-xs h-6 px-2"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOverride(override.id)}
                          className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full border border-border"
                onClick={() => {
                  setEditingOverrideId(null);
                  setOverrideModalOpen(true);
                }}
              >
                + Add an override
              </Button>
            </div>
          </div>
        </div>

        {/* Right column - Timezone */}
        <div className="lg:col-span-1">
          {/* Timezone Section */}
          <div>
            <div className="font-medium mb-2 text-sm">
              Timezone <span className="text-red-500">*</span>
            </div>
            <TimezoneCombobox
              value={availabilityData.timezone}
              onValueChange={handleTimezoneChange}
              placeholder="Select timezone"
              searchPlaceholder="Search timezones..."
              emptyMessage="No timezone found."
              className={`w-full border border-border ${
                !availabilityData.timezone || availabilityData.timezone === ""
                  ? "border-red-300 focus:border-red-500"
                  : ""
              }`}
            />
            {(!availabilityData.timezone ||
              availabilityData.timezone === "") && (
              <p className="text-red-500 text-xs mt-1">Timezone is required</p>
            )}
          </div>
        </div>
      </div>

      <DateOverrideModal
        open={overrideModalOpen}
        onOpenChange={(open) => {
          setOverrideModalOpen(open);
          if (!open) {
            setEditingOverrideId(null);
          }
        }}
        onSave={handleSaveDateOverride}
        initialDates={getEditingOverride() ? [getEditingOverride()!.date] : []}
        initialTimeRanges={
          getEditingOverride()?.timeRanges || [
            { startTime: "08:30", endTime: "17:00" },
          ]
        }
        initialUnavailableAllDay={
          getEditingOverride()?.unavailableAllDay || false
        }
        isEditing={!!editingOverrideId}
      />
    </form>
  );
};
