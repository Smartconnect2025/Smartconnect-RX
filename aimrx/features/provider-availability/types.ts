export interface AvailabilityBlock {
  id: string;
  label: string;
  isDefault: boolean;
  days: string;
  time: string;
  timezone: string;
}

// Import schema types
import type { 
  ProviderAvailability, 
  InsertProviderAvailability,
  ProviderAvailabilityException,
  InsertProviderAvailabilityException
} from "@/core/database/schema";

// Use schema types instead of manual interfaces
export type WeeklySchedule = ProviderAvailability;
export type InsertWeeklySchedule = InsertProviderAvailability;
export type AvailabilityException = ProviderAvailabilityException;
export type InsertAvailabilityException = InsertProviderAvailabilityException;

export interface TimeRange {
  startTime: string;
  endTime: string;
} 