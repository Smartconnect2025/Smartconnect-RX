import {
  Patient,
  Encounter,
  Medication,
  Condition,
  Allergy,
  Vitals,
  Addendum,
  ConditionStatus,
} from "../types";
import { Order } from "../types/order.types";
import {
  BillingGroup,
  CreateBillingGroupData,
  CreateBillingDiagnosisData,
  CreateBillingProcedureData,
  UpdateBillingGroupData,
  UpdateBillingDiagnosisData,
  UpdateBillingProcedureData,
  BillingDiagnosis,
  BillingProcedure
} from "../types/billing.types";
import { CreatePatientData } from "../services/patientService";
import { CreateEncounterData } from "../services/encounterService";
import { CreateMedicationData } from "../services/medicationService";
import { CreateConditionData } from "../services/conditionService";
import { CreateAllergyData } from "../services/allergyService";
import { CreateVitalsData } from "../services/vitalsService";

export interface EmrState {
  patients: Patient[];
  currentPatient: Patient | null;
  encounters: Encounter[];
  currentEncounter: Encounter | null;
  medications: Medication[];
  conditions: Condition[];
  allergies: Allergy[];
  orders: Order[];
  addendums: Addendum[];
  vitals: Vitals[];
  billingGroups: BillingGroup[];
  loading: boolean;
  error: string | null;
}

export interface PatientActions {
  setPatients: (patients: Patient[]) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (patient: Patient) => void;
  fetchPatients: (
    userId: string,
    searchQuery?: string,
    page?: number,
    limit?: number
  ) => Promise<void>;
  fetchPatientById: (patientId: string, userId: string) => Promise<Patient | null>;
  createPatient: (userId: string, data: CreatePatientData) => Promise<Patient | null>;
  updatePatientAsync: (
    patientId: string,
    userId: string,
    updates: Partial<CreatePatientData>
  ) => Promise<Patient | null>;
}

export interface EncounterActions {
  setEncounters: (encounters: Encounter[]) => void;
  setCurrentEncounter: (encounter: Encounter | null) => void;
  addEncounter: (encounter: Encounter) => void;
  updateEncounter: (encounter: Encounter) => void;
  fetchEncounters: (patientId: string, userId: string) => Promise<void>;
  createEncounter: (userId: string, data: CreateEncounterData) => Promise<Encounter | null>;
  updateEncounterAsync: (
    encounterId: string,
    userId: string,
    updates: Partial<Encounter>
  ) => Promise<Encounter | null>;
  deleteEncounterAsync: (
    encounterId: string,
    userId: string
  ) => Promise<void>;
}

export interface MedicationActions {
  setMedications: (medications: Medication[]) => void;
  addMedication: (medication: Medication) => void;
  updateMedication: (medication: Medication) => void;
  fetchMedications: (patientId: string, userId: string) => Promise<void>;
  createMedication: (userId: string, data: CreateMedicationData) => Promise<Medication | null>;
  updateMedicationAsync: (
    medicationId: string,
    userId: string,
    updates: Partial<Medication>
  ) => Promise<Medication | null>;
}

export interface ConditionActions {
  setConditions: (conditions: Condition[]) => void;
  addCondition: (condition: Condition) => void;
  updateCondition: (condition: Condition) => void;
  fetchConditions: (patientId: string, userId: string) => Promise<void>;
  createCondition: (userId: string, data: CreateConditionData) => Promise<Condition | null>;
  updateConditionAsync: (
    conditionId: string,
    userId: string,
    updates: Partial<CreateConditionData & { status: ConditionStatus }>
  ) => Promise<Condition | null>;
}

export interface AllergyActions {
  setAllergies: (allergies: Allergy[]) => void;
  addAllergy: (allergy: Allergy) => void;
  updateAllergy: (allergy: Allergy) => void;
  fetchAllergies: (patientId: string, userId: string) => Promise<void>;
  createAllergy: (userId: string, data: CreateAllergyData) => Promise<Allergy | null>;
  updateAllergyAsync: (
    allergyId: string,
    userId: string,
    updates: Partial<CreateAllergyData>
  ) => Promise<Allergy | null>;
}

export interface OrderActions {
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  fetchOrders: (encounterId: string, userId: string) => Promise<void>;
  createOrder: (userId: string, data: Partial<Order>) => Promise<Order | null>;
  updateOrderAsync: (
    orderId: string,
    userId: string,
    updates: Partial<Order>
  ) => Promise<Order | null>;
}

export interface AddendumActions {
  setAddendums: (addendums: Addendum[]) => void;
  addAddendum: (addendum: Addendum) => void;
  createAddendum: (userId: string, encounterId: string, content: string) => Promise<Addendum | null>;
  fetchAddendums: (encounterId: string, userId: string) => Promise<void>;
}

export interface VitalsActions {
  setVitals: (vitals: Vitals[]) => void;
  addVitals: (vitals: Vitals) => void;
  updateVitals: (vitals: Vitals) => void;
  fetchVitals: (encounterId: string, userId: string) => Promise<void>;
  createVitals: (userId: string, data: CreateVitalsData) => Promise<Vitals | null>;
  updateVitalsAsync: (
    vitalsId: string,
    userId: string,
    updates: Partial<CreateVitalsData>
  ) => Promise<Vitals | null>;
}

export interface BillingActions {
  setBillingGroups: (billingGroups: BillingGroup[]) => void;
  addBillingGroup: (billingGroup: BillingGroup) => void;
  updateBillingGroup: (billingGroup: BillingGroup) => void;
  fetchBillingGroups: (encounterId: string, userId: string) => Promise<void>;
  createBillingGroup: (userId: string, data: CreateBillingGroupData) => Promise<BillingGroup | null>;
  updateBillingGroupAsync: (
    billingGroupId: string,
    userId: string,
    updates: UpdateBillingGroupData
  ) => Promise<BillingGroup | null>;
  deleteBillingGroupAsync: (
    billingGroupId: string,
    userId: string
  ) => Promise<void>;
  createBillingDiagnosis: (userId: string, data: CreateBillingDiagnosisData) => Promise<BillingDiagnosis | null>;
  updateBillingDiagnosisAsync: (
    diagnosisId: string,
    userId: string,
    updates: UpdateBillingDiagnosisData
  ) => Promise<BillingDiagnosis | null>;
  deleteBillingDiagnosisAsync: (
    diagnosisId: string,
    userId: string
  ) => Promise<void>;
  createBillingProcedure: (userId: string, data: CreateBillingProcedureData) => Promise<BillingProcedure | null>;
  updateBillingProcedureAsync: (
    procedureId: string,
    userId: string,
    updates: UpdateBillingProcedureData
  ) => Promise<BillingProcedure | null>;
  deleteBillingProcedureAsync: (
    procedureId: string,
    userId: string
  ) => Promise<void>;
}

export interface UtilityActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type EmrActions = PatientActions &
  EncounterActions &
  MedicationActions &
  ConditionActions &
  AllergyActions &
  OrderActions &
  AddendumActions &
  VitalsActions &
  BillingActions &
  UtilityActions;

export type EmrStore = EmrState & EmrActions;
