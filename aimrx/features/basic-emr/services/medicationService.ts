import { createClient } from "@core/supabase/client";

import { Medication, MedicationStatus } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateMedicationData {
  patientId: string;
  encounterId?: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  status?: MedicationStatus;
}

type DbMedicationRow = {
  id: string;
  patient_id: string;
  encounter_id?: string;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  status: MedicationStatus;
  created_at: string;
  updated_at: string;
};

class MedicationService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getMedications(
    patientId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Medication[]>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(patientId, userId);
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const { data, error } = await this.supabase
        .from("medications")
        .select("*")
        .eq("patient_id", patientId)
        .order("start_date", { ascending: false });

      if (error) throw error;

      const medications: Medication[] = data.map(this.mapDbMedicationToType);

      return {
        success: true,
        data: medications,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch medications",
      };
    }
  }

  async createMedication(
    userId: string,
    medicationData: CreateMedicationData,
  ): Promise<EmrServiceResponse<Medication>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(
        medicationData.patientId,
        userId,
      );
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const dbMedication = {
        patient_id: medicationData.patientId,
        encounter_id: medicationData.encounterId,
        name: medicationData.name,
        dosage: medicationData.dosage,
        frequency: medicationData.frequency,
        start_date: medicationData.startDate,
        status: medicationData.status || "active",
      };

      const { data, error } = await this.supabase
        .from("medications")
        .insert([dbMedication])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbMedicationToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create medication",
      };
    }
  }

  async updateMedication(
    medicationId: string,
    userId: string,
    updates: Partial<Medication>,
  ): Promise<EmrServiceResponse<Medication>> {
    try {
      // First check if medication exists and user has access
      const { data: medicationData, error: fetchError } = await this.supabase
        .from("medications")
        .select("patient_id")
        .eq("id", medicationId)
        .single();

      if (fetchError || !medicationData)
        throw new Error("Medication not found");

      const patientCheck = await this.verifyPatientOwnership(
        medicationData.patient_id,
        userId,
      );
      if (!patientCheck) throw new Error("Access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.dosage !== undefined) dbUpdates.dosage = updates.dosage;
      if (updates.frequency !== undefined)
        dbUpdates.frequency = updates.frequency;
      if (updates.startDate !== undefined)
        dbUpdates.start_date = updates.startDate;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { data, error } = await this.supabase
        .from("medications")
        .update(dbUpdates)
        .eq("id", medicationId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbMedicationToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update medication",
      };
    }
  }

  private mapDbMedicationToType(dbMedication: DbMedicationRow): Medication {
    return {
      id: dbMedication.id,
      patientId: dbMedication.patient_id,
      encounterId: dbMedication.encounter_id || null,
      name: dbMedication.name,
      dosage: dbMedication.dosage,
      frequency: dbMedication.frequency,
      startDate: dbMedication.start_date,
      status: dbMedication.status,
      createdAt: new Date(dbMedication.created_at),
      updatedAt: new Date(dbMedication.updated_at),
    };
  }

  async verifyPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      // Check if user is a provider
      const isProvider = await this.checkIfUserIsProvider(userId);

      if (isProvider) {
        // Providers can access any active patient
        const { data, error } = await this.supabase
          .from("patients")
          .select("id")
          .eq("id", patientId)
          .eq("is_active", true)
          .single();
        return !error && !!data;
      } else {
        // Non-providers can only access their own patient record
        const { data, error } = await this.supabase
          .from("patients")
          .select("id")
          .eq("id", patientId)
          .eq("user_id", userId)
          .eq("is_active", true)
          .single();
        return !error && !!data;
      }
    } catch {
      return false;
    }
  }

  async checkIfUserIsProvider(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .single();
      return !error && !!data;
    } catch {
      return false;
    }
  }
}

export const medicationService = new MedicationService();
