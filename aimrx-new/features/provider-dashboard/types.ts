/**
 * Provider Dashboard Types
 * Contains type definitions for the provider dashboard feature
 */

export interface Meeting {
  id: string;
  // Meeting details
  type: "video" | "phone" | "chat";
  duration: number; // in minutes
  timezone: string;
  date: string; // ISO date string
  time: string; // e.g., "10:00 AM"
  reason: string; // Purpose/reason for the meeting
  status: "scheduled" | "completed" | "cancelled" | "no-show";

  // Patient information
  patientName: string;
  patientAvatar?: string;
}

export interface ProviderDashboardProps {
  className?: string;
}

export interface ProviderAppointmentWithPatient {
  id: string;
  provider_id: string;
  patient_id: string;
  datetime: string;
  duration: number;
  type: string;
  reason: string;
  created_at?: string;
  updated_at?: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface TimeRange {
  startTime: string;
  endTime: string;
}
