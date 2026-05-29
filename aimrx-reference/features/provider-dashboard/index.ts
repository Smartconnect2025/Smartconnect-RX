/**
 * Provider Dashboard Feature Exports
 *
 * This file exports all components from the Provider Dashboard feature,
 * making imports cleaner throughout the application.
 */

export { ProviderDashboard } from "./ProviderDashboard";
export { TriageLists } from "./components/TriageLists";
export { UpcomingMeetings } from "./components/UpcomingMeetings";
export { PastAppointments } from "./components/PastAppointments";
export { useProviderAppointments } from "./hooks/useProviderAppointments";
export type { ProviderAppointment } from "./hooks/useProviderAppointments";
export { SetAvailability } from "./components/SetAvailability";
export type {
  Meeting,
  ProviderDashboardProps,
  ProviderAppointmentWithPatient,
} from "./types";
