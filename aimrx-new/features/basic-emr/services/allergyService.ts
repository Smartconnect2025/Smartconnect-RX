import { createClient } from "@core/supabase/client";

import { Allergy, AllergySeverity } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateAllergyData {
  patientId: string;
  encounterId?: string;
  name: string;
  reactionType: string;
  severity: AllergySeverity;
}

type DbAllergyRow = {
  id: string;
  patient_id: string;
  encounter_id?: string;
  allergen: string;
  reaction_type: string;
  severity: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

class AllergyService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getAllergies(
    patientId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Allergy[]>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(patientId, userId);
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const { data, error } = await this.supabase
        .from("allergies")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allergies: Allergy[] = data.map(this.mapDbAllergyToType);

      return {
        success: true,
        data: allergies,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch allergies",
      };
    }
  }

  async createAllergy(
    userId: string,
    allergyData: CreateAllergyData,
  ): Promise<EmrServiceResponse<Allergy>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(
        allergyData.patientId,
        userId,
      );
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const dbAllergy = {
        patient_id: allergyData.patientId,
        encounter_id: allergyData.encounterId,
        allergen: allergyData.name, // Map name to allergen
        reaction_type: allergyData.reactionType,
        severity: allergyData.severity,
      };

      const { data, error } = await this.supabase
        .from("allergies")
        .insert([dbAllergy])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbAllergyToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create allergy",
      };
    }
  }

  async updateAllergy(
    allergyId: string,
    userId: string,
    updates: Partial<CreateAllergyData>,
  ): Promise<EmrServiceResponse<Allergy>> {
    try {
      // First check if allergy exists and user has access
      const { data: allergyData, error: fetchError } = await this.supabase
        .from("allergies")
        .select("patient_id")
        .eq("id", allergyId)
        .single();

      if (fetchError || !allergyData) throw new Error("Allergy not found");

      const patientCheck = await this.verifyPatientOwnership(
        allergyData.patient_id,
        userId,
      );
      if (!patientCheck) throw new Error("Access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.allergen = updates.name;
      if (updates.reactionType !== undefined)
        dbUpdates.reaction_type = updates.reactionType;
      if (updates.severity !== undefined) dbUpdates.severity = updates.severity;

      const { data, error } = await this.supabase
        .from("allergies")
        .update(dbUpdates)
        .eq("id", allergyId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbAllergyToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update allergy",
      };
    }
  }

  private mapDbAllergyToType(dbAllergy: DbAllergyRow): Allergy {
    return {
      id: dbAllergy.id,
      patientId: dbAllergy.patient_id,
      encounterId: dbAllergy.encounter_id || null,
      name: dbAllergy.allergen, // Map allergen to name
      reactionType: dbAllergy.reaction_type,
      severity: dbAllergy.severity as AllergySeverity,
      createdAt: dbAllergy.created_at,
      updatedAt: dbAllergy.updated_at,
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

export const allergyService = new AllergyService();
