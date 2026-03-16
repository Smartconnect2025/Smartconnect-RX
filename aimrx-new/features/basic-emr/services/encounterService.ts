import { createClient } from "@core/supabase/client";

import { Encounter, EncounterType, EncounterBusinessType } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateEncounterData {
  patientId: string;
  title: string;
  date: string;
  type: EncounterType;
  businessType?: EncounterBusinessType;
  provider: string;
  providerId?: string;
  appointmentId?: string;
  orderId?: string;
}

type DbEncounterRow = {
  id: string;
  patient_id: string;
  provider_id?: string;
  title: string;
  encounter_date: string;
  status: string;
  encounter_type: string;
  business_type: string;
  appointment_id?: string;
  order_id?: string;
  provider_name?: string;
  provider_notes?: string;
  finalized_at?: string;
  finalized_by?: string;
  created_at: Date;
  updated_at: Date;
};

class EncounterService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getEncounters(
    patientId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Encounter[]>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(patientId, userId);
      if (!patientCheck) throw new Error("Patient not found or access denied");

      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("patient_id", patientId)
        .order("encounter_date", { ascending: false });

      if (error) throw error;

      const encounters: Encounter[] = data.map(this.mapDbEncounterToType);

      return {
        success: true,
        data: encounters,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch encounters",
      };
    }
  }

  async getEncountersByOrderId(
    orderId: string,
    _userId: string,
  ): Promise<EmrServiceResponse<Encounter[]>> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("order_id", orderId)
        .order("encounter_date", { ascending: false });

      if (error) throw error;

      const encounters: Encounter[] = data.map(this.mapDbEncounterToType);

      return {
        success: true,
        data: encounters,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch encounters by order ID",
      };
    }
  }

  async getOrderBasedEncounters(
    _userId: string,
  ): Promise<EmrServiceResponse<Encounter[]>> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("business_type", "order_based")
        .order("encounter_date", { ascending: false });

      if (error) throw error;

      const encounters: Encounter[] = data.map(this.mapDbEncounterToType);

      return {
        success: true,
        data: encounters,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch order-based encounters",
      };
    }
  }

  async createEncounter(
    userId: string,
    encounterData: CreateEncounterData,
  ): Promise<EmrServiceResponse<Encounter>> {
    try {
      const patientCheck = await this.verifyPatientOwnership(
        encounterData.patientId,
        userId,
      );
      if (!patientCheck) throw new Error("Patient not found or access denied");

      // Use provided providerId or get it from the current user
      let providerId = encounterData.providerId || null;

      if (!providerId && !encounterData.appointmentId) {
        // Only try to get provider_id from user if this is not an appointment-based encounter
        const { data: provider } = await this.supabase
          .from("providers")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (provider) {
          providerId = provider.id;
        }
      }

      const dbEncounter = {
        patient_id: encounterData.patientId,
        provider_id: providerId,
        title: encounterData.title,
        encounter_date: encounterData.date,
        encounter_type: encounterData.type,
        business_type: encounterData.businessType || "manual",
        appointment_id: encounterData.appointmentId,
        order_id: encounterData.orderId,
        provider_name: encounterData.provider,
        status: "upcoming" as const,
      };

      const { data, error } = await this.supabase
        .from("encounters")
        .insert([dbEncounter])
        .select()
        .single();

      if (error) throw error;

      // If no appointment_id is provided, create an appointment record
      // for the provider dashboard to show upcoming appointments
      if (!encounterData.appointmentId && providerId) {
        const appointmentRecord = {
          patient_id: encounterData.patientId,
          provider_id: providerId,
          datetime: encounterData.date,
          duration: 30, // Default duration
          type: encounterData.type || "consultation",
          reason: encounterData.title,
        };

        await this.supabase.from("appointments").insert([appointmentRecord]);
      }

      return {
        success: true,
        data: this.mapDbEncounterToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create encounter",
      };
    }
  }

  async updateEncounter(
    encounterId: string,
    userId: string,
    updates: Partial<Encounter>,
  ): Promise<EmrServiceResponse<Encounter>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.date !== undefined) dbUpdates.encounter_date = updates.date;
      if (updates.type !== undefined) dbUpdates.encounter_type = updates.type;
      if (updates.businessType !== undefined)
        dbUpdates.business_type = updates.businessType;
      if (updates.appointmentId !== undefined)
        dbUpdates.appointment_id = updates.appointmentId;
      if (updates.orderId !== undefined) dbUpdates.order_id = updates.orderId;
      if (updates.providerName !== undefined)
        dbUpdates.provider_name = updates.providerName;
      if (updates.providerNotes !== undefined)
        dbUpdates.provider_notes = updates.providerNotes;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.finalizedAt !== undefined)
        dbUpdates.finalized_at = updates.finalizedAt;
      if (updates.finalizedBy !== undefined)
        dbUpdates.finalized_by = updates.finalizedBy;

      const { data, error } = await this.supabase
        .from("encounters")
        .update(dbUpdates)
        .eq("id", encounterId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbEncounterToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update encounter",
      };
    }
  }

  async deleteEncounter(
    encounterId: string,
    userId: string,
  ): Promise<EmrServiceResponse<void>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const { error } = await this.supabase
        .from("encounters")
        .delete()
        .eq("id", encounterId)
        .eq("user_id", userId);

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error deleting encounter:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete encounter",
      };
    }
  }

  public mapDbEncounterToType(dbEncounter: DbEncounterRow): Encounter {
    return {
      id: dbEncounter.id,
      patientId: dbEncounter.patient_id,
      providerId: dbEncounter.provider_id || null,
      title: dbEncounter.title,
      date: dbEncounter.encounter_date,
      status: dbEncounter.status as Encounter["status"],
      type: dbEncounter.encounter_type as EncounterType,
      businessType: dbEncounter.business_type as EncounterBusinessType,
      appointmentId: dbEncounter.appointment_id || null,
      orderId: dbEncounter.order_id || null,
      providerName: dbEncounter.provider_name || "",
      providerNotes: dbEncounter.provider_notes || undefined,
      finalizedAt: dbEncounter.finalized_at || undefined,
      finalizedBy: dbEncounter.finalized_by || undefined,
      createdAt: dbEncounter.created_at,
      updatedAt: dbEncounter.updated_at,
    };
  }

  async verifyPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      // Check if user is a provider using direct database query
      const { data: userRole, error: roleError } = await this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const isProvider =
        !roleError &&
        userRole &&
        (userRole.role === "provider" || userRole.role === "admin");

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
      const { data: userRole, error: roleError } = await this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      return (
        !roleError &&
        userRole &&
        (userRole.role === "provider" || userRole.role === "admin")
      );
    } catch {
      return false;
    }
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
}

export const encounterService = new EncounterService();
