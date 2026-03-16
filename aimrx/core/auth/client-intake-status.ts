/**
 * Client-side Intake Status Service (Minimal Version)
 *
 * Handles checking intake completion status from client components
 * Used only by authentication components after login/register
 */
import { createClient } from "@core/supabase/client";

export interface IntakeStatus {
  hasCompletedIntake: boolean;
  patientId?: string;
  currentStep?: string;
  nextStepUrl?: string;
}

/**
 * Client-side function to check if a user has completed their intake process
 * Used only after authentication in login/register components
 *
 * @param userId - The authenticated user's ID
 * @param userRole - Optional user role to determine if intake check is needed
 * @returns Promise resolving to intake completion status
 */
export async function checkIntakeStatusClient(
  userId: string,
  userRole?: string,
): Promise<IntakeStatus> {
  try {
    // Providers and admins don't need intake completion
    if (userRole === "provider" || userRole === "admin") {
      return {
        hasCompletedIntake: true,
        patientId: undefined,
        currentStep: undefined,
        nextStepUrl: undefined,
      };
    }

    const supabase = createClient();

    // Query the patients table to check if user has completed intake
    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, data")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (error || !patient) {
      return {
        hasCompletedIntake: false,
        nextStepUrl: "/intake/patient-information",
      };
    }

    // Check if intake is fully completed:
    // 1. intake_step must be "completed"
    // 2. intake_completed_at must be set
    const intakeStep = patient.data?.intake_step;
    const intakeCompletedAt = patient.data?.intake_completed_at;
    const hasCompletedIntake =
      intakeStep === "completed" && Boolean(intakeCompletedAt);

    // Determine next step URL if intake is not complete
    const nextStepUrl = hasCompletedIntake
      ? undefined
      : getNextIntakeStepUrl(intakeStep);

    return {
      hasCompletedIntake,
      patientId: patient.id,
      currentStep: intakeStep,
      nextStepUrl,
    };
  } catch (error) {
    console.error("🔍 CLIENT: Error checking intake status:", error);
    // Default to not completed on error for security
    return { hasCompletedIntake: false };
  }
}

/**
 * Helper function to determine the next intake step URL based on current progress
 */
function getNextIntakeStepUrl(currentStep?: string): string {
  switch (currentStep) {
    case "patient_information_completed":
      return "/intake/medical-history";
    case "medical_history_completed":
      return "/intake/insurance";
    case "insurance_completed":
      return "/intake/consent";
    case "completed":
      return "/intake/patient-information";
    default:
      return "/intake/patient-information";
  }
}
