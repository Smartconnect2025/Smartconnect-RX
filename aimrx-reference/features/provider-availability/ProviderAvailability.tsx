"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AvailabilityList } from "./components/AvailabilityList";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import NewScheduleForm from "./components/NewScheduleForm";
import EditScheduleForm from "./components/EditScheduleForm";
import { useProviderAvailabilityData } from "./hooks/useProviderAvailabilityData";
import { mapDbToUiModel, mapFormToDbModel } from "./utils/availability-mapper";
import { toast } from "sonner";
import { AvailabilityBlock } from "./types";
import { ScheduleFormData } from "./components/NewScheduleForm";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { useRouter } from "next/navigation";

const ProviderAvailability: React.FC = () => {
  const router = useRouter();
  const { user, userRole, isLoading: isAuthLoading } = useUser();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(
    null,
  );
  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [isLoadingProviderId, setIsLoadingProviderId] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);

  // Fetch provider ID based on authenticated user
  const fetchProviderId = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(); // Use maybeSingle() to handle 0 rows

      if (error) {
        console.error("Error fetching provider:", error);
        setProviderError("Your provider information has not been set yet!");
        return null;
      }

      if (!data?.id) {
        setProviderError("Your provider information has not been set yet!");
        return null;
      }

      return data.id;
    } catch (error) {
      console.error("Error in fetchProviderId:", error);
      setProviderError("Failed to load provider profile");
      return null;
    }
  }, [user?.id]);

  // Initialize provider ID
  useEffect(() => {
    const initializeProvider = async () => {
      setIsLoadingProviderId(true);
      setProviderError(null);

      // Check authentication and role
      if (!user) {
        router.push("/auth");
        return;
      }

      if (userRole !== "provider") {
        router.push("/");
        return;
      }

      // Fetch provider ID
      const id = await fetchProviderId();
      if (id) {
        setProviderId(id);
      }

      setIsLoadingProviderId(false);
    };

    if (!isAuthLoading) {
      initializeProvider();
    }
  }, [user, userRole, isAuthLoading, fetchProviderId, router]);

  const {
    weeklySchedule,
    exceptions,
    isLoading: isLoadingAvailability,
    error: availabilityError,
    saveWeeklySchedule,
    deleteWeeklySchedule,
  } = useProviderAvailabilityData(providerId || "");

  // Map DB data to UI blocks
  useEffect(() => {
    if (weeklySchedule && providerId) {
      const blocks = mapDbToUiModel(weeklySchedule, exceptions);
      setAvailability(blocks);
    }
  }, [weeklySchedule, exceptions, providerId]);

  const handleAddAvailability = async (formData: ScheduleFormData) => {
    if (!providerId) {
      toast.error("Provider profile not found");
      return;
    }

    try {
      // Convert UI form data to DB model
      const { weeklySchedules } = mapFormToDbModel(formData, providerId);

      // Save weekly schedule entries
      for (const schedule of weeklySchedules) {
        await saveWeeklySchedule(schedule);
      }

      setShowNewForm(false);
      toast("Availability schedule saved successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save availability";
      toast.error(errorMessage);
    }
  };

  const handleEditAvailability = async (formData: ScheduleFormData) => {
    if (!providerId) {
      toast.error("Provider profile not found");
      return;
    }

    try {
      // First find all availability records related to this block and delete them
      // We need to delete existing records to avoid the unique constraint error
      if (editingBlock) {
        // Extract the day of week numbers from the block's day range
        const blockDayRange = editingBlock.days;
        const dayIndices = parseDayIndicesFromBlock(blockDayRange);

        // Delete existing schedules for this provider on these days
        for (const dayIndex of dayIndices) {
          // Find records for this provider and day of week
          const supabase = createClient();
          const { data: existingSchedules } = await supabase
            .from("provider_availability")
            .select("id")
            .eq("provider_id", providerId)
            .eq("day_of_week", dayIndex);

          if (existingSchedules && existingSchedules.length > 0) {
            // Delete these records
            for (const schedule of existingSchedules) {
              await deleteWeeklySchedule(schedule.id);
            }
          }
        }
      }

      // Then add the new schedules
      const { weeklySchedules } = mapFormToDbModel(formData, providerId);
      for (const schedule of weeklySchedules) {
        await saveWeeklySchedule(schedule);
      }

      // Clear the editing state
      setEditingBlock(null);
      toast("Availability schedule updated successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update availability";
      toast.error(errorMessage);
    }
  };

  const handleDeleteAvailability = async () => {
    if (!providerId) {
      toast.error("Provider profile not found");
      return;
    }

    try {
      if (!editingBlock) return;

      const supabase = createClient();
      const timeRange = extractTimeRange(editingBlock.time);
      const dayIndices = parseDayIndicesFromBlock(editingBlock.days);

      // Map UI day indices (Mon=0) to DB indices (Sun=0)
      const mapUiDayToDb = (uiIdx: number) => (uiIdx + 1) % 7;
      const dbDayIndices = dayIndices.map(mapUiDayToDb);

      // Pad time to match DB format (HH:MM:00)
      const padTime = (t: string) => (t.length === 5 ? t + ":00" : t);
      const paddedStart = padTime(timeRange.start);
      const paddedEnd = padTime(timeRange.end);

      // Fetch all records for this provider
      const { data: allProviderSchedules, error: fetchError } = await supabase
        .from("provider_availability")
        .select("*")
        .eq("provider_id", providerId);

      if (fetchError) throw fetchError;

      if (!allProviderSchedules || allProviderSchedules.length === 0) {
        toast.warning("No schedules found to delete");
        setEditingBlock(null);
        return;
      }

      // Filter schedules that match both the time range and the day-of-week
      const schedulesToDelete = allProviderSchedules.filter((record) => {
        return (
          dbDayIndices.includes(record.day_of_week) &&
          record.start_time === paddedStart &&
          record.end_time === paddedEnd
        );
      });

      if (schedulesToDelete.length > 0) {
        for (const schedule of schedulesToDelete) {
          await deleteWeeklySchedule(schedule.id);
        }
        toast("Availability schedule deleted successfully");
      } else {
        toast.warning("No matching schedules found to delete");
      }

      setEditingBlock(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete availability";
      toast.error(errorMessage);
    }
  };

  // Helper function to extract time range from block.time (e.g., "8:30am - 5:00pm" -> {start: "08:30", end: "17:00"})
  const extractTimeRange = (
    timeString: string,
  ): { start: string; end: string } => {
    try {
      const [startStr, endStr] = timeString.split(" - ");

      // Parse start time
      const startMatch = startStr.match(/(\d+):(\d+)(am|pm)/i);
      if (!startMatch) throw new Error("Invalid start time format");

      let startHours = parseInt(startMatch[1], 10);
      const startMinutes = startMatch[2];
      const startPeriod = startMatch[3].toLowerCase();

      // Convert 12h to 24h for start time
      if (startPeriod === "pm" && startHours < 12) startHours += 12;
      if (startPeriod === "am" && startHours === 12) startHours = 0;

      // Parse end time
      const endMatch = endStr.match(/(\d+):(\d+)(am|pm)/i);
      if (!endMatch) throw new Error("Invalid end time format");

      let endHours = parseInt(endMatch[1], 10);
      const endMinutes = endMatch[2];
      const endPeriod = endMatch[3].toLowerCase();

      // Convert 12h to 24h for end time
      if (endPeriod === "pm" && endHours < 12) endHours += 12;
      if (endPeriod === "am" && endHours === 12) endHours = 0;

      return {
        start: `${startHours.toString().padStart(2, "0")}:${startMinutes}`,
        end: `${endHours.toString().padStart(2, "0")}:${endMinutes}`,
      };
    } catch (e) {
      console.error("Error extracting time range:", e);
      return { start: "08:30", end: "17:00" }; // Default fallback
    }
  };

  const handleEditClick = (blockId: string) => {
    const block = availability.find((b) => b.id === blockId);
    if (block) {
      setEditingBlock(block);
    }
  };

  // Helper function to parse day indices from block day range (e.g. "Mon - Fri" → [1,2,3,4,5])
  const parseDayIndicesFromBlock = (dayRange: string): number[] => {
    const result: number[] = [];
    // Use the same day ordering as in EditScheduleForm (Mon-Sun instead of Sun-Mon)
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const ranges = dayRange.split(", ");

    ranges.forEach((range) => {
      if (range.includes(" - ")) {
        // Handle ranges like "Mon - Fri"
        const [start, end] = range.split(" - ");
        const startIdx = daysOfWeek.indexOf(start);
        const endIdx = daysOfWeek.indexOf(end);

        if (startIdx !== -1 && endIdx !== -1) {
          // If end comes after start in the week
          if (endIdx >= startIdx) {
            for (let i = startIdx; i <= endIdx; i++) {
              result.push(i);
            }
          } else {
            // Handle wrapping (e.g., "Fri - Mon")
            for (let i = startIdx; i < daysOfWeek.length; i++) {
              result.push(i);
            }
            for (let i = 0; i <= endIdx; i++) {
              result.push(i);
            }
          }
        }
      } else {
        // Handle individual days
        const idx = daysOfWeek.indexOf(range);
        if (idx !== -1) {
          result.push(idx);
        }
      }
    });

    return result;
  };

  // Handle loading states
  if (isAuthLoading || isLoadingProviderId) {
    return (
      <div className="w-full flex flex-col items-center bg-background py-12 mt-16">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-8">
          <div className="text-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-teal-500 mx-auto" />
            <p className="mt-4">Loading provider profile...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle error states
  if (providerError) {
    return (
      <div className="w-full flex flex-col items-center bg-background py-12 mt-16">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-8">
          <div className="text-red-500 text-center py-8">{providerError}</div>
        </div>
      </div>
    );
  }

  if (showNewForm) {
    return (
      <NewScheduleForm
        onClose={() => setShowNewForm(false)}
        onSave={handleAddAvailability}
      />
    );
  }

  if (editingBlock) {
    return (
      <EditScheduleForm
        block={editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={handleEditAvailability}
        onDelete={handleDeleteAvailability}
      />
    );
  }

  return (
    <div className="w-full flex flex-col items-center bg-background py-12 mt-16">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">Availability</h1>
          <Button
            size="lg"
            variant="default"
            onClick={() => setShowNewForm(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            Add new
          </Button>
        </div>
        <hr className="mb-6" />
        {isLoadingProviderId ? (
          <div className="text-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
            <p className="mt-4">Loading provider profile...</p>
          </div>
        ) : providerError ? (
          <div className="text-red-500 text-center py-8">{providerError}</div>
        ) : isLoadingAvailability ? (
          <div className="text-center py-8">
            Loading availability schedules...
          </div>
        ) : availabilityError ? (
          <div className="text-red-500 text-center py-8">
            {availabilityError}
          </div>
        ) : availability.length > 0 ? (
          <AvailabilityList
            availability={availability}
            onEdit={handleEditClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No availability schedules found. Add a new schedule to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderAvailability;
