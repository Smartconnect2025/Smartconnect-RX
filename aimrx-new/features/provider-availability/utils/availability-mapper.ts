import { format } from "date-fns";
import {
  WeeklySchedule,
  AvailabilityException,
  AvailabilityBlock,
} from "../types";

const UI_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Map database schedules to UI blocks
export function mapDbToUiModel(
  schedules: WeeklySchedule[],

  _exceptions: AvailabilityException[],
): AvailabilityBlock[] {
  // Group by common time ranges and UI day index
  const schedulesByTime: Record<string, WeeklySchedule[]> = {};

  schedules.forEach((schedule) => {
    // Convert DB day_of_week to UI index
    const uiDayIndex = (schedule.day_of_week + 6) % 7;
    const key = `${schedule.start_time}-${schedule.end_time}`;
    if (!schedulesByTime[key]) {
      schedulesByTime[key] = [];
    }
    // Attach UI day index for grouping
    schedulesByTime[key].push({ ...schedule, day_of_week: uiDayIndex });
  });

  // Create UI blocks from grouped schedules
  const blocks: AvailabilityBlock[] = [];

  Object.entries(schedulesByTime).forEach(([timeKey, items], index) => {
    const [startTime, endTime] = timeKey.split("-");

    // Sort days in order
    const sortedItems = [...items].sort(
      (a, b) => a.day_of_week - b.day_of_week,
    );

    // Get UI day names
    const dayIndices = sortedItems.map((item) => item.day_of_week);
    const days = dayIndices.map((idx) => UI_DAYS[idx]);

    // Format time for display
    const formattedStartTime = formatTime(startTime);
    const formattedEndTime = formatTime(endTime);

    blocks.push({
      id: `block-${index + 1}`,
      label: days.length > 3 ? "Week" : days.join(", "),
      isDefault: index === 0,
      days: formatDayRange(days),
      time: `${formattedStartTime} - ${formattedEndTime}`,
      timezone: "Dublin (GMT+1)", // Would typically come from provider settings
    });
  });

  // We're not handling exceptions in this basic implementation

  return blocks;
}

// Format HH:MM to am/pm format
function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return format(date, "h:mma").toLowerCase();
  } catch {
    return time;
  }
}

// Format days into ranges like "Mon - Fri" or "Mon, Wed, Fri"
function formatDayRange(days: string[]): string {
  if (days.length <= 2) {
    return days.join(", ");
  }

  // Check for consecutive days
  const consecutiveRanges: string[][] = [];
  let currentRange: string[] = [days[0]];

  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (let i = 1; i < days.length; i++) {
    const prevIndex = orderedDays.indexOf(days[i - 1]);
    const currIndex = orderedDays.indexOf(days[i]);

    // Check if days are consecutive in our ordered week
    if (currIndex === (prevIndex + 1) % 7) {
      currentRange.push(days[i]);
    } else {
      consecutiveRanges.push([...currentRange]);
      currentRange = [days[i]];
    }
  }

  if (currentRange.length > 0) {
    consecutiveRanges.push(currentRange);
  }

  // Format each range
  return consecutiveRanges
    .map((range) => {
      if (range.length >= 3) {
        return `${range[0]} - ${range[range.length - 1]}`;
      } else {
        return range.join(", ");
      }
    })
    .join(", ");
}

// Map UI form data to database models
export function mapFormToDbModel(
  formData: {
    days: Array<{
      label: string;
      enabled: boolean;
      times: Array<{ start: string; end: string }>;
    }>;
    timezone: string;
  },
  providerId: string,
) {
  const weeklySchedules: Array<Omit<WeeklySchedule, "id">> = [];

  // Convert days and times to weekly schedules
  formData.days.forEach((day, index) => {
    if (day.enabled) {
      day.times.forEach((timeRange) => {
        weeklySchedules.push({
          provider_id: providerId,
          day_of_week: (index + 1) % 7, // UI index to DB index
          start_time: timeRange.start,
          end_time: timeRange.end,
          provider_timezone: formData.timezone,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
    }
  });

  return {
    weeklySchedules,
    // We're not handling exceptions in this implementation for simplicity
    exceptions: [] as Array<Omit<AvailabilityException, "id">>,
  };
}
