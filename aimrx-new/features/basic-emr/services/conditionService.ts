import { createClient } from "@core/supabase/client";

import { Condition, ConditionSeverity, ConditionStatus } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateConditionData {
  patientId: string;
  encounterId?: string;
  name: string;
  onsetDate: string;
  severity: ConditionSeverity;
  notes?: string;
}

type DbConditionRow = {
  id: string;
  patient_id: string;
  encounter_id?: string;
  name: string;
  onset_date: string;
  status: string;
  severity: string;
  notes?: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

class ConditionService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getConditions(
    patientId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Condition[]>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(patientId, userId);
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const { data, error } = await this.supabase
        .from("conditions")
        .select("*")
        .eq("patient_id", patientId)
        .order("onset_date", { ascending: false });

      if (error) throw error;

      const conditions: Condition[] = data.map(this.mapDbConditionToType);

      return {
        success: true,
        data: conditions,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch conditions",
      };
    }
  }

  async createCondition(
    userId: string,
    conditionData: CreateConditionData,
  ): Promise<EmrServiceResponse<Condition>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(
        conditionData.patientId,
        userId,
      );
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const dbCondition = {
        patient_id: conditionData.patientId,
        encounter_id: conditionData.encounterId,
        name: conditionData.name,
        onset_date: conditionData.onsetDate,
        severity: conditionData.severity,
        notes: conditionData.notes,
        status: "active" as const,
      };

      const { data, error } = await this.supabase
        .from("conditions")
        .insert([dbCondition])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbConditionToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create condition",
      };
    }
  }

  async updateCondition(
    conditionId: string,
    userId: string,
    updates: Partial<CreateConditionData & { status: ConditionStatus }>,
  ): Promise<EmrServiceResponse<Condition>> {
    try {
      // First check if condition exists and user has access
      const { data: conditionData, error: fetchError } = await this.supabase
        .from("conditions")
        .select("patient_id")
        .eq("id", conditionId)
        .single();

      if (fetchError || !conditionData) throw new Error("Condition not found");

      const patientCheck = await this.verifyPatientOwnership(
        conditionData.patient_id,
        userId,
      );
      if (!patientCheck) throw new Error("Access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.onsetDate !== undefined)
        dbUpdates.onset_date = updates.onsetDate;
      if (updates.severity !== undefined) dbUpdates.severity = updates.severity;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { data, error } = await this.supabase
        .from("conditions")
        .update(dbUpdates)
        .eq("id", conditionId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbConditionToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update condition",
      };
    }
  }

  private mapDbConditionToType(dbCondition: DbConditionRow): Condition {
    return {
      id: dbCondition.id,
      patientId: dbCondition.patient_id,
      encounterId: dbCondition.encounter_id || null,
      name: dbCondition.name,
      onsetDate: dbCondition.onset_date,
      status: dbCondition.status as ConditionStatus,
      severity: dbCondition.severity as ConditionSeverity,
      notes: dbCondition.notes ?? undefined,
      createdAt: dbCondition.created_at,
      updatedAt: dbCondition.updated_at,
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

export const conditionService = new ConditionService();
