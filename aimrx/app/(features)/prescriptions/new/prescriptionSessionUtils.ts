const PRESCRIPTION_SESSION_KEYS = [
  "prescriptionFormData",
  "selectedPatientId",
  "encounterId",
  "appointmentId",
  "prescriptionPdfData",
  "prescriptionPdfName",
] as const;

// Legacy keys that may still exist from older sessions
const LEGACY_KEYS = ["prescriptionData", "prescriptionDraft"] as const;

/**
 * Clears all prescription wizard session storage.
 * Use `preserveEncounterContext: true` when entering step1 from an encounter flow
 * to keep encounterId/appointmentId.
 */
export function clearPrescriptionSession(options?: {
  preserveEncounterContext?: boolean;
}) {
  for (const key of PRESCRIPTION_SESSION_KEYS) {
    if (
      options?.preserveEncounterContext &&
      (key === "encounterId" || key === "appointmentId")
    ) {
      continue;
    }
    sessionStorage.removeItem(key);
  }
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
  }
}
