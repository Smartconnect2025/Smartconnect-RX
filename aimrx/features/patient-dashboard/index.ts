/**
 * Patient Dashboard Feature
 *
 * Dashboard landing page for patients after login.
 * Displays patient profile, provider info, and prescriptions.
 */

export { PatientDashboard } from "./components/PatientDashboard";
export { PatientProfileCard } from "./components/PatientProfileCard";
export { MyProviderCard } from "./components/MyProviderCard";
export { MyPrescriptionsCard } from "./components/MyPrescriptionsCard";
export { CompleteIntakeBanner } from "./components/CompleteIntakeBanner";

export { usePatientProfile } from "./hooks/usePatientProfile";
export { usePatientPrescriptions } from "./hooks/usePatientPrescriptions";

export type * from "./types";
