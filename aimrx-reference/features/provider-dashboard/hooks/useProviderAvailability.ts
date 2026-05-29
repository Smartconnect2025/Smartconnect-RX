"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@core/supabase/client";
import { useUser } from "@core/auth";
import { TimeRange } from "../types";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

interface DaySchedule {
  label: string;
  enabled: boolean;
  times: Array<{ start: string; end: string }>;
}

interface DateOverride {
  id: string;
  date: Date;
  timeRanges: TimeRange[];
  unavailableAllDay: boolean;
}

interface ProviderAvailabilityData {
  days: DaySchedule[];
  timezone: string;
  dateOverrides: DateOverride[];
}

export function useProviderAvailability() {
  const { user } = useUser();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [availabilityData, setAvailabilityData] =
    useState<ProviderAvailabilityData>({
      days: [],
      timezone: "",
      dateOverrides: [],
    });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get browser timezone
  const getBrowserTimezone = useCallback(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  // Convert local time to UTC
  const convertToUTC = useCallback(
    (localTime: string, timezone: string): string => {
      try {
        // Use a reference date to avoid DST issues
        const referenceDate = "2024-01-15";
        const dateTimeStr = `${referenceDate}T${localTime}:00`;

        // Parse the date-time string as if it's in the provider's timezone
        const dateInProviderTz = parseISO(dateTimeStr);

        // Format this date as UTC time
        return formatInTimeZone(dateInProviderTz, timezone, "HH:mm", {
          timeZone: "UTC",
        });
      } catch (error) {
        console.error("Error converting to UTC:", error);
        return localTime; // Fallback to original time
      }
    },
    [],
  );

  // Convert UTC time to local timezone
  const convertFromUTC = useCallback(
    (utcTime: string, timezone: string): string => {
      try {
        // Handle both HH:MM and HH:MM:SS formats from database
        const timeOnly = utcTime.includes(":")
          ? utcTime.substring(0, 5)
          : utcTime;

        // Use a reference date to avoid DST issues
        const referenceDate = "2024-01-15";
        const utcDateTime = `${referenceDate}T${timeOnly}:00Z`; // 'Z' indicates UTC
        const dateInUtc = parseISO(utcDateTime);

        // Format this UTC date in the provider's timezone
        return formatInTimeZone(dateInUtc, "UTC", "HH:mm", {
          timeZone: timezone,
        });
      } catch (error) {
        console.error("Error converting from UTC:", error);
        // Return just the time part if conversion fails
        return utcTime.includes(":") ? utcTime.substring(0, 5) : utcTime;
      }
    },
    [],
  );

  // Get provider ID from user ID
  const fetchProviderId = useCallback(async () => {
    if (!user?.id) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(); // Use maybeSingle() to handle 0 rows

    if (error) {
      console.error("Error fetching provider:", error);
      return null;
    }

    return data?.id || null;
  }, [user?.id]);

  // Load availability data from database
  const loadAvailabilityData = useCallback(
    async (providerId: string) => {
      const supabase = createClient();

      // Load weekly availability
      const { data: weeklyData, error: weeklyError } = await supabase
        .from("provider_availability")
        .select("*")
        .eq("provider_id", providerId);

      if (weeklyError) {
        console.error("Error loading weekly availability:", weeklyError);
        throw new Error(
          `Failed to load weekly availability: ${weeklyError.message}`,
        );
      }

      // Load exceptions
      const { data: exceptionsData, error: exceptionsError } = await supabase
        .from("provider_availability_exceptions")
        .select("*")
        .eq("provider_id", providerId);

      if (exceptionsError) {
        console.error(
          "Error loading availability exceptions:",
          exceptionsError,
        );
        throw new Error(
          `Failed to load availability exceptions: ${exceptionsError.message}`,
        );
      }

      // Check if this is a new provider (no data found)
      const hasExistingData = weeklyData && weeklyData.length > 0;

      // Get timezone: use existing from DB, or auto-detect browser timezone for new providers
      const timezone =
        weeklyData?.[0]?.provider_timezone ||
        (hasExistingData ? "" : getBrowserTimezone());

      // Convert database data to UI format
      const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const days: DaySchedule[] = daysOfWeek.map((day, idx) => {
        const daySchedules = (weeklyData || []).filter(
          (schedule) => schedule.day_of_week === idx,
        );

        return {
          label: day,
          enabled: hasExistingData ? daySchedules.length > 0 : idx < 5, // Default Mon-Fri for new providers
          times:
            daySchedules.length > 0
              ? daySchedules.map((schedule) => ({
                  // Convert UTC times back to local timezone for display
                  start: timezone
                    ? convertFromUTC(schedule.start_time, timezone)
                    : schedule.start_time.substring(0, 5),
                  end: timezone
                    ? convertFromUTC(schedule.end_time, timezone)
                    : schedule.end_time.substring(0, 5),
                }))
              : [{ start: "08:30", end: "17:00" }],
        };
      });

      // Convert exceptions to UI format
      const dateOverrides: DateOverride[] = (exceptionsData || []).map(
        (exception) => ({
          id: exception.id,
          date: new Date(exception.exception_date),
          timeRanges:
            exception.is_available && exception.start_time && exception.end_time
              ? [
                  {
                    startTime: timezone
                      ? convertFromUTC(exception.start_time, timezone)
                      : exception.start_time,
                    endTime: timezone
                      ? convertFromUTC(exception.end_time, timezone)
                      : exception.end_time,
                  },
                ]
              : [],
          unavailableAllDay: !exception.is_available,
        }),
      );

      setAvailabilityData({
        days,
        timezone,
        dateOverrides,
      });
    },
    [getBrowserTimezone, convertFromUTC],
  );

  // Save availability data to database
  const saveAvailabilityData = useCallback(
    async (data: ProviderAvailabilityData) => {
      if (!providerId) {
        throw new Error("Provider ID not found");
      }

      const supabase = createClient();

      try {
        // Delete existing weekly schedules
        await supabase
          .from("provider_availability")
          .delete()
          .eq("provider_id", providerId);

        // Insert new weekly schedules
        const weeklySchedules = data.days.flatMap((day, dayIndex) => {
          if (!day.enabled) return [];

          return day.times.map((time) => ({
            provider_id: providerId,
            day_of_week: dayIndex,
            // Convert local times to UTC for storage
            start_time: convertToUTC(time.start, data.timezone),
            end_time: convertToUTC(time.end, data.timezone),
            provider_timezone: data.timezone,
          }));
        });

        if (weeklySchedules.length > 0) {
          const { error: insertError } = await supabase
            .from("provider_availability")
            .insert(weeklySchedules);

          if (insertError) throw insertError;
        }

        // Handle date overrides (simplified - just delete and re-insert)
        await supabase
          .from("provider_availability_exceptions")
          .delete()
          .eq("provider_id", providerId);

        if (data.dateOverrides.length > 0) {
          const exceptions = data.dateOverrides.map((override) => {
            // Ensure the date is formatted correctly according to the provider's timezone
            // The override.date is a JS Date object, representing midnight in the local system timezone.
            // We want the yyyy-MM-dd string for that day, but in the provider's timezone.
            const exceptionDateInProviderTz = formatInTimeZone(
              override.date,
              data.timezone,
              "yyyy-MM-dd",
            );

            return {
              provider_id: providerId,
              exception_date: exceptionDateInProviderTz,
              // Convert local times to UTC for storage
              start_time: override.unavailableAllDay
                ? null
                : override.timeRanges[0]?.startTime
                  ? convertToUTC(
                      override.timeRanges[0].startTime,
                      data.timezone,
                    )
                  : null,
              end_time: override.unavailableAllDay
                ? null
                : override.timeRanges[0]?.endTime
                  ? convertToUTC(override.timeRanges[0].endTime, data.timezone)
                  : null,
              is_available: !override.unavailableAllDay,
              provider_timezone: data.timezone,
            };
          });

          const { error: exceptionsError } = await supabase
            .from("provider_availability_exceptions")
            .insert(exceptions);

          if (exceptionsError) throw exceptionsError;
        }

        setAvailabilityData(data);
      } catch (err) {
        console.error("Error saving availability data:", err);
        throw new Error(
          err instanceof Error
            ? err.message
            : "Failed to save availability data",
        );
      }
    },
    [providerId, convertToUTC],
  );

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const fetchedProviderId = await fetchProviderId();
        if (fetchedProviderId) {
          setProviderId(fetchedProviderId);
          await loadAvailabilityData(fetchedProviderId);
        } else {
          setError("Provider not found for current user");
        }
      } catch (err) {
        console.error("Error initializing availability data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize data",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      initializeData();
    }
  }, [user?.id, fetchProviderId, loadAvailabilityData]);

  return {
    availabilityData,
    setAvailabilityData,
    saveAvailabilityData,
    isLoading,
    error,
    providerId,
  };
}
