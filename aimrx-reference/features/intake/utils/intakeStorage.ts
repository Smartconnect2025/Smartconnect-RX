/**
 * Utility functions for managing intake form persistence storage
 */

const INTAKE_STORAGE_KEYS = {
  patientInfo: (userId: string) => `patient-intake-info-${userId}`,
  medicalHistory: (userId: string) => `patient-intake-medical-history-${userId}`,
  insurance: (userId: string) => `patient-intake-insurance-${userId}`,
} as const;

export { INTAKE_STORAGE_KEYS };

/**
 * Clears all intake form data from localStorage for a specific user
 * Call this when intake is completed successfully
 */
export function clearAllIntakeData(userId: string): void {
  if (!userId) return;

  try {
    localStorage.removeItem(INTAKE_STORAGE_KEYS.patientInfo(userId));
    localStorage.removeItem(INTAKE_STORAGE_KEYS.medicalHistory(userId));
    localStorage.removeItem(INTAKE_STORAGE_KEYS.insurance(userId));
  } catch (error) {
    console.error("Error clearing intake data from localStorage:", error);
  }
}
