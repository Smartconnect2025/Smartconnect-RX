/**
 * Type definitions for patient intake flow
 */

export type IntakeStep =
  | "patient_information"
  | "patient_information_completed"
  | "medical_history_completed"
  | "insurance_completed"
  | "completed";

export interface IntakeData {
  // Step tracking
  intake_step?: IntakeStep;
  intake_completed_at?: string;

  // Step 1: Patient Info
  gender?: string;

  // Step 2: Medical History
  height?: string;
  weight?: string;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  medical_conditions?: string[];

  // Step 3: Insurance
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group_number?: string;

  // Step 4: Consent
  consent_accepted?: boolean;
  consent_accepted_at?: string;
}

export interface PatientInfoFormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  email: string;
  gender: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface MedicalHistoryFormData {
  height: string;
  weight: string;
  blood_type: string;
  allergies: string;
  medications: string;
  medical_conditions: string;
}

export interface InsuranceFormData {
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_group_number: string;
}

export interface ConsentFormData {
  consent_accepted: boolean;
}

export const INTAKE_STEPS = [
  { id: 1, name: "Patient Information", path: "/intake/patient-information" },
  { id: 2, name: "Medical History", path: "/intake/medical-history" },
  { id: 3, name: "Insurance", path: "/intake/insurance" },
  { id: 4, name: "Consent", path: "/intake/consent" },
] as const;

export function getStepNumber(step?: IntakeStep): number {
  switch (step) {
    case "patient_information":
      return 1;
    case "patient_information_completed":
      return 2;
    case "medical_history_completed":
      return 3;
    case "insurance_completed":
      return 4;
    case "completed":
      return 5;
    default:
      return 1;
  }
}

export function getNextStepPath(currentStep: number): string {
  switch (currentStep) {
    case 1:
      return "/intake/medical-history";
    case 2:
      return "/intake/insurance";
    case 3:
      return "/intake/consent";
    case 4:
      return "/";
    default:
      return "/intake/patient-information";
  }
}
