/**
 * Prescriber credential completeness check.
 *
 * Centralized so the pre-payment submit-guard
 * (`app/api/prescriptions/submit/route.ts`) and any future caller
 * (admin tooling, dashboards, profile-check delegate branch) all agree
 * on what counts as "complete enough to legally submit a prescription".
 *
 * Required fields:
 *   - npi_number          (DEA Doctor block + Greenwich Electronic Rx PDF)
 *   - signature_url       (Greenwich Electronic Rx PDF "Signed
 *                          electronically by" footer)
 *   - >= 1 medical_licenses entry with both `licenseNumber` and `state`
 *
 * NOT required:
 *   - dea_number          AimRx ships peptides + non-controlled compounded
 *                          meds; Greenwich accepts those without a DEA in
 *                          the Electronic Rx. Joseph clarified May 9 2026:
 *                          "they have all the proper validations to do the
 *                          orders since they are assistance" — DEA on the
 *                          authorizing provider's row is optional, do not
 *                          block assistant submissions over it. Re-add as
 *                          required only when/if controlled substances are
 *                          introduced and detectable per-line-item.
 */

export interface PrescriberCredentialSource {
  npi_number?: string | null;
  dea_number?: string | null;
  signature_url?: string | null;
  medical_licenses?: unknown;
}

export type MissingCredential = "npi" | "signature" | "medicalLicense";

interface MedicalLicenseLike {
  licenseNumber?: string | null;
  state?: string | null;
}

function isLicenseLike(v: unknown): v is MedicalLicenseLike {
  return typeof v === "object" && v !== null;
}

/**
 * Returns the list of missing credential field codes. Empty array
 * means "complete enough to submit".
 *
 * Pass `null`/`undefined` source → all four codes returned (treated as
 * "no credentials at all"). This is the correct behavior for the
 * delegate-with-broken-delegation case.
 */
export function computeMissingPrescriberFields(
  source: PrescriberCredentialSource | null | undefined,
): MissingCredential[] {
  const missing: MissingCredential[] = [];
  if (!source?.npi_number?.toString().trim()) missing.push("npi");
  if (!source?.signature_url?.toString().trim()) missing.push("signature");
  const licenses = Array.isArray(source?.medical_licenses)
    ? source!.medical_licenses
    : [];
  const hasLicense = licenses.some(
    (l) =>
      isLicenseLike(l) &&
      typeof l.licenseNumber === "string" &&
      l.licenseNumber.trim().length > 0 &&
      typeof l.state === "string" &&
      l.state.trim().length > 0,
  );
  if (!hasLicense) missing.push("medicalLicense");
  return missing;
}
