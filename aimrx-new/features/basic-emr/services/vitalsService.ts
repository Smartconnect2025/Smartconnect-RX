import { createClient } from "@core/supabase/client";

import { Vitals } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateVitalsData {
  patientId: string;
  encounterId: string;
  bloodPressure?: string;
  heartRate?: string;
  weight?: string;
  height?: string;
  temperature?: string;
  bloodOxygen?: string;
  bmi?: string;
  respiratoryRate?: string;
}

type DbVitalsRow = {
  id: string;
  patient_id: string;
  encounter_id: string;
  blood_pressure?: string;
  heart_rate?: number;
  weight?: string;
  height?: string;
  temperature?: string;
  blood_oxygen?: number;
  bmi?: string;
  respiratory_rate?: number;
  created_at: Date;
  updated_at: Date;
};

class VitalsService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getVitals(
    encounterId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Vitals[]>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const { data, error } = await this.supabase
        .from("vitals")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const vitals: Vitals[] = data.map(this.mapDbVitalsToType);

      return {
        success: true,
        data: vitals,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch vitals",
      };
    }
  }

  async createVitals(
    userId: string,
    vitalsData: CreateVitalsData,
  ): Promise<EmrServiceResponse<Vitals>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        vitalsData.encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const dbVitals = {
        patient_id: vitalsData.patientId,
        encounter_id: vitalsData.encounterId,
        blood_pressure: vitalsData.bloodPressure,
        heart_rate: vitalsData.heartRate
          ? parseInt(vitalsData.heartRate)
          : undefined,
        weight: vitalsData.weight,
        height: vitalsData.height,
        temperature: vitalsData.temperature,
        blood_oxygen: vitalsData.bloodOxygen
          ? parseInt(vitalsData.bloodOxygen)
          : undefined,
        bmi: vitalsData.bmi,
        respiratory_rate: vitalsData.respiratoryRate
          ? parseInt(vitalsData.respiratoryRate)
          : undefined,
      };

      const { data, error } = await this.supabase
        .from("vitals")
        .insert([dbVitals])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbVitalsToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create vitals",
      };
    }
  }

  async updateVitalsAsync(
    vitalsId: string,
    userId: string,
    updates: Partial<CreateVitalsData>,
  ): Promise<EmrServiceResponse<Vitals>> {
    try {
      // First check if vitals exist and user has access
      const { data: vitalsData, error: fetchError } = await this.supabase
        .from("vitals")
        .select("encounter_id")
        .eq("id", vitalsId)
        .single();

      if (fetchError || !vitalsData) throw new Error("Vitals not found");

      const encounterCheck = await this.verifyEncounterOwnership(
        vitalsData.encounter_id,
        userId,
      );
      if (!encounterCheck) throw new Error("Access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.bloodPressure !== undefined)
        dbUpdates.blood_pressure = updates.bloodPressure;
      if (updates.heartRate !== undefined)
        dbUpdates.heart_rate = updates.heartRate
          ? parseInt(updates.heartRate)
          : null;
      if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
      if (updates.height !== undefined) dbUpdates.height = updates.height;
      if (updates.temperature !== undefined)
        dbUpdates.temperature = updates.temperature;
      if (updates.bloodOxygen !== undefined)
        dbUpdates.blood_oxygen = updates.bloodOxygen
          ? parseInt(updates.bloodOxygen)
          : null;
      if (updates.bmi !== undefined) dbUpdates.bmi = updates.bmi;
      if (updates.respiratoryRate !== undefined)
        dbUpdates.respiratory_rate = updates.respiratoryRate
          ? parseInt(updates.respiratoryRate)
          : null;

      const { data, error } = await this.supabase
        .from("vitals")
        .update(dbUpdates)
        .eq("id", vitalsId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbVitalsToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update vitals",
      };
    }
  }

  private mapDbVitalsToType(dbVitals: DbVitalsRow): Vitals {
    return {
      id: dbVitals.id,
      patientId: dbVitals.patient_id,
      encounterId: dbVitals.encounter_id,
      bloodPressure: dbVitals.blood_pressure || null,
      heartRate: dbVitals.heart_rate?.toString() || null,
      weight: dbVitals.weight?.toString() || null,
      height: dbVitals.height || null,
      temperature: dbVitals.temperature?.toString() || null,
      bloodOxygen: dbVitals.blood_oxygen?.toString() || null,
      bmi: dbVitals.bmi?.toString() || null,
      respiratoryRate: dbVitals.respiratory_rate?.toString() || null,
      createdAt: dbVitals.created_at,
      updatedAt: dbVitals.updated_at,
    };
  }

  async verifyEncounterOwnership(
    encounterId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("patient_id")
        .eq("id", encounterId)
        .single();
      if (error || !data) return false;
      return await this.verifyPatientOwnership(data.patient_id, userId);
    } catch {
      return false;
    }
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

export const vitalsService = new VitalsService();
