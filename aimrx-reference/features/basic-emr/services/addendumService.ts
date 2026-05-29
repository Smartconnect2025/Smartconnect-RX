import { createClient } from "@core/supabase/client";
import { patientService } from "./patientService";

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
    // Delegate to canonical access check on PatientService so that all EMR
    // services share one source of truth for patient ownership/authorization
    // (including Provider Assistant / delegate access via active delegations).
    return patientService.verifyPatientOwnership(patientId, userId);
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
