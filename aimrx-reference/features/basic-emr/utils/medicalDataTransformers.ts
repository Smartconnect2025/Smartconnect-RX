import { Allergy, Condition, Medication } from "../types";

export interface MedicalDataItem {
  id: string;
  name: string;
  details: string;
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

export const transformMedications = (
  medications: Medication[],
): MedicalDataItem[] => {
  return medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    details: `${medication.dosage}, ${medication.frequency}${
      medication.startDate
        ? `, Started ${formatDate(medication.startDate)}`
        : ""
    }`,
  }));
};

export const transformConditions = (
  conditions: Condition[],
): MedicalDataItem[] => {
  return conditions.map((condition) => ({
    id: condition.id,
    name: condition.name,
    details: `${condition.status}, ${condition.severity}${
      condition.onsetDate ? `, Onset ${formatDate(condition.onsetDate)}` : ""
    }`,
  }));
};

export const transformAllergies = (allergies: Allergy[]): MedicalDataItem[] => {
  return allergies.map((allergy) => ({
    id: allergy.id,
    name: allergy.name,
    details: `${allergy.reactionType}, ${allergy.severity}`,
  }));
};
