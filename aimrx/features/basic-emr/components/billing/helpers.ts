import { BillingGroup, COMMON_CPT_CODES } from "../../types/billing.types";

export const getProcedureDescription = (code: string): string => {
  return COMMON_CPT_CODES[code as keyof typeof COMMON_CPT_CODES] || code;
};

export const findBillingGroup = (
  groups: BillingGroup[],
  groupId: string
): BillingGroup | undefined => {
  return groups.find((group) => group.id === groupId);
};

export const findDiagnosis = (group: BillingGroup, diagnosisId: string) => {
  return group.diagnoses.find((dx) => dx.id === diagnosisId);
};

export const validatePrimaryDiagnosisRemoval = (
  group: BillingGroup,
  diagnosisId: string
): boolean => {
  const primaryDiagnoses = group.diagnoses.filter((dx) => dx.isPrimary);
  const isRemovingPrimary = group.diagnoses.find(
    (dx) => dx.id === diagnosisId
  )?.isPrimary;

  return !(
    isRemovingPrimary &&
    primaryDiagnoses.length === 1 &&
    group.diagnoses.length > 1
  );
};
