import { createClient } from "@core/supabase/client";

import { Addendum } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type DbAddendumRow = {
  id: string;
  encounter_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
};

class AddendumService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getAddendums(
    encounterId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Addendum[]>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const { data, error } = await this.supabase
        .from("addendums")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data.map((row) => this.mapDbAddendumToType(row)),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch addendums",
      };
    }
  }

  async createAddendum(
    userId: string,
    encounterId: string,
    content: string,
  ): Promise<EmrServiceResponse<Addendum>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const dbAddendum = {
        encounter_id: encounterId,
        content,
      };

      const { data, error } = await this.supabase
        .from("addendums")
        .insert([dbAddendum])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbAddendumToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create addendum",
      };
    }
  }

  private mapDbAddendumToType(dbAddendum: DbAddendumRow): Addendum {
    return {
      id: dbAddendum.id,
      encounterId: dbAddendum.encounter_id,
      content: dbAddendum.content,
      createdAt: dbAddendum.created_at,
      updatedAt: dbAddendum.updated_at,
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

export const addendumService = new AddendumService();
