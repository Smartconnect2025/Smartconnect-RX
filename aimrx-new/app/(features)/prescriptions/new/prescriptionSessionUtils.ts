const PRESCRIPTION_SESSION_KEYS = [
  "prescriptionFormData",
  "selectedPatientId",
  "encounterId",
  "appointmentId",
  "prescriptionPdfData",
  "prescriptionPdfName",
] as const;

const LEGACY_KEYS = ["prescriptionData", "prescriptionDraft"] as const;

export function clearPrescriptionSession(options?: {
  preserveEncounterContext?: boolean;
  preserveFormData?: boolean;
}) {
  for (const key of PRESCRIPTION_SESSION_KEYS) {
    if (
      options?.preserveEncounterContext &&
      (key === "encounterId" || key === "appointmentId")
    ) {
      continue;
    }
    if (options?.preserveFormData && key === "prescriptionFormData") {
      continue;
    }
    sessionStorage.removeItem(key);
  }
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
  }
}
