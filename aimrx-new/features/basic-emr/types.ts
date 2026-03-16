// Import Drizzle schema types directly from individual files
import { type Patient as DrizzlePatient } from "@core/database/schema/patients";
import {
  type Encounter as DrizzleEncounter,
  type EncounterStatus as DrizzleEncounterStatus,
  type EncounterType as DrizzleEncounterType,
  type EncounterBusinessType as DrizzleEncounterBusinessType,
} from "@core/database/schema/encounters";
import {
  type Medication as DrizzleMedication,
  type MedicationStatus as DrizzleMedicationStatus,
} from "@core/database/schema/medications";
import {
  type ConditionStatus as DrizzleConditionStatus,
  type ConditionSeverity as DrizzleConditionSeverity,
} from "@core/database/schema/conditions";
import { type AllergySeverity as DrizzleAllergySeverity } from "@core/database/schema/allergies";
import { type Addendum as DrizzleAddendum } from "@core/database/schema/addendums";
import { Order } from "./types/order.types";

// Re-export Drizzle enum types as the primary types
export type AllergySeverity = DrizzleAllergySeverity;
export type ConditionSeverity = DrizzleConditionSeverity;
export type ConditionStatus = DrizzleConditionStatus;
export type EncounterStatus = DrizzleEncounterStatus;
export type EncounterType = DrizzleEncounterType;
export type EncounterBusinessType = DrizzleEncounterBusinessType;
export type Gender = "Male" | "Female" | "Other";
export type MedicationStatus = DrizzleMedicationStatus;

// Legacy enum definitions (keep for backward compatibility)
export enum AllergySeverityEnum {
  Mild = "mild",
  Moderate = "moderate",
  Severe = "severe",
}

export enum ConditionSeverityEnum {
  Mild = "mild",
  Moderate = "moderate",
  Severe = "severe",
}

export enum ConditionStatusEnum {
  Active = "active",
  Resolved = "resolved",
}

export enum EncounterStatusEnum {
  Upcoming = "upcoming",
  Completed = "completed",
  InProgress = "in_progress",
}

export enum EncounterTypeEnum {
  Routine = "routine",
  FollowUp = "follow_up",
  Urgent = "urgent",
  Consultation = "consultation",
}

export enum EncounterBusinessTypeEnum {
  AppointmentBased = "appointment_based",
  OrderBased = "order_based",
  OrderBasedAsync = "order_based_async",
  OrderBasedSync = "order_based_sync",
  Coaching = "coaching",
  Manual = "manual",
}

export enum GenderEnum {
  Male = "Male",
  Female = "Female",
  Other = "Other",
}

export enum MedicationStatusEnum {
  Active = "active",
  Discontinued = "discontinued",
}

export enum OrderTypeEnum {
  Lab = "lab",
  Imaging = "imaging",
  Medication = "medication",
  Referral = "referral",
}

export type PatientAddress = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
};

export type PatientEmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type PatientInsurance = {
  provider: string;
  policyNumber: string;
  groupNumber: string;
};

export type PatientData = {
  gender: Gender;
  /**
   * @deprecated Use physical_address column instead. This field is kept for backward compatibility with legacy records.
   */
  address?: PatientAddress;
  emergencyContact: PatientEmergencyContact;
  insurance: PatientInsurance;
  preferredLanguage: string;
};

export interface Patient extends Omit<
  DrizzlePatient,
  | "id"
  | "user_id"
  | "created_at"
  | "updated_at"
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "phone"
  | "email"
  | "data"
  | "emr_data"
  | "provider_id"
  | "status"
  | "emr_created_at"
  | "emr_updated_at"
  | "physical_address"
  | "billing_address"
> {
  readonly id: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: PatientData["gender"];
  address?: PatientAddress;
  physical_address?: PatientAddress | null;
  billing_address?: PatientAddress | null;
  emergencyContact?: PatientEmergencyContact;
  insurance?: PatientInsurance;
  preferredLanguage?: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  stripe_customer_id: string | null;
}

export interface Encounter extends Omit<
  DrizzleEncounter,
  | "user_id"
  | "patient_id"
  | "provider_id"
  | "encounter_date"
  | "status"
  | "encounter_type"
  | "business_type"
  | "appointment_id"
  | "appointment_reference"
  | "order_id"
  | "order_reference"
  | "provider_name"
  | "provider_notes"
  | "finalized_at"
  | "finalized_by"
  | "created_at"
  | "updated_at"
> {
  patientId: string;
  providerId?: string | null;
  date: string;
  status: EncounterStatus;
  type: EncounterType;
  businessType: EncounterBusinessType;
  appointmentId?: string | null;
  orderId?: string | null;
  providerName: string;
  providerNotes?: string;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface Medication extends Omit<
  DrizzleMedication,
  "patient_id" | "encounter_id" | "start_date" | "created_at" | "updated_at"
> {
  // Convert snake_case to camelCase for application consistency
  patientId?: string;
  encounterId?: string | null;
  startDate: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Condition {
  readonly id: string;
  patientId?: string;
  encounterId?: string | null;
  name: string;
  onsetDate: string;
  status: ConditionStatus;
  severity: ConditionSeverity;
  notes?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Allergy {
  readonly id: string;
  patientId?: string;
  encounterId?: string | null;
  name: string;
  reactionType: string;
  severity: AllergySeverity;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Vitals {
  readonly id: string;
  patientId: string;
  encounterId: string;
  bloodPressure?: string | null;
  heartRate?: string | null;
  weight?: string | null;
  height?: string | null;
  temperature?: string | null;
  bloodOxygen?: string | null;
  bmi?: string | null;
  respiratoryRate?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Addendum extends Omit<
  DrizzleAddendum,
  "encounter_id" | "created_at" | "updated_at"
> {
  encounterId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Store state interface
export interface EmrState {
  patients: Patient[];
  currentPatient: Patient | null;
  encounters: Encounter[];
  currentEncounter: Encounter | null;
  medications: Medication[];
  conditions: Condition[];
  allergies: Allergy[];
  orders: Order[]; // Changed from OrderType[]
  addendums: Addendum[];
  vitals: Vitals[];
  loading: boolean;
  error: string | null;
}

// Legacy interfaces for backward compatibility
export interface EmrActions {
  setPatients: (patients: Patient[]) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (patient: Patient) => void;
  setEncounters: (encounters: Encounter[]) => void;
  setCurrentEncounter: (encounter: Encounter | null) => void;
  addEncounter: (encounter: Encounter) => void;
  updateEncounter: (encounter: Encounter) => void;
  setMedications: (medications: Medication[]) => void;
  addMedication: (medication: Medication) => void;
  updateMedication: (medication: Medication) => void;
  setConditions: (conditions: Condition[]) => void;
  addCondition: (condition: Condition) => void;
  updateCondition: (condition: Condition) => void;
  setAllergies: (allergies: Allergy[]) => void;
  addAllergy: (allergy: Allergy) => void;
  updateAllergy: (allergy: Allergy) => void;
  addOrder: (order: Order) => void; // Changed from OrderType
  updateOrder: (order: Order) => void; // Changed from OrderType
  addAddendum: (addendum: Addendum) => void;
}

export interface UsePatientListProps {
  searchQuery: string;
  currentPage: number;
  itemsPerPage: number;
}

export interface UseEncounterProps {
  patientId: string;
  encounterId?: string;
}
