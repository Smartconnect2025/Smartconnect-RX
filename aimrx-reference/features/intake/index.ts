/**
 * Patient Intake Feature
 *
 * Multi-step intake flow for new patients.
 * Steps: Patient Info → Medical History → Insurance → Consent
 */

export { IntakeLayout } from "./components/IntakeLayout";
export { PatientInfoForm } from "./components/PatientInfoForm";
export { MedicalHistoryForm } from "./components/MedicalHistoryForm";
export { InsuranceForm } from "./components/InsuranceForm";
export { ConsentForm } from "./components/ConsentForm";

export { useIntakeProgress } from "./hooks/useIntakeProgress";

export { clearAllIntakeData, INTAKE_STORAGE_KEYS } from "./utils/intakeStorage";

export * from "./types";
