export interface BillingGroup {
  readonly id: string;
  encounterId: string;
  procedureCode: string;
  procedureDescription: string;
  modifiers?: string;
  diagnoses: BillingDiagnosis[];
  procedures: BillingProcedure[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface BillingDiagnosis {
  readonly id: string;
  billingGroupId: string;
  icdCode: string;
  description: string;
  isPrimary: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface BillingProcedure {
  readonly id: string;
  billingGroupId: string;
  cptCode: string;
  description: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface CreateBillingGroupData {
  encounterId: string;
  procedureCode: string;
  procedureDescription: string;
  modifiers?: string;
}

export interface CreateBillingDiagnosisData {
  billingGroupId: string;
  icdCode: string;
  description: string;
  isPrimary?: boolean;
}

export interface CreateBillingProcedureData {
  billingGroupId: string;
  cptCode: string;
  description: string;
}

export interface UpdateBillingGroupData {
  procedureCode?: string;
  procedureDescription?: string;
  modifiers?: string;
}

export interface UpdateBillingDiagnosisData {
  icdCode?: string;
  description?: string;
  isPrimary?: boolean;
}

export interface UpdateBillingProcedureData {
  cptCode?: string;
  description?: string;
}

// Common CPT codes for reference
export const COMMON_CPT_CODES = {
  "99201": "New Patient Office Visit Level 1",
  "99202": "New Patient Office Visit Level 2",
  "99203": "New Patient Office Visit Level 3",
  "99204": "New Patient Office Visit Level 4",
  "99205": "New Patient Office Visit Level 5",
  "99211": "Established Patient Office Visit Level 1",
  "99212": "Established Patient Office Visit Level 2",
  "99213": "Established Patient Office Visit Level 3",
  "99214": "Established Patient Office Visit Level 4",
  "99215": "Established Patient Office Visit Level 5",
} as const;

export type CptCode = keyof typeof COMMON_CPT_CODES;
