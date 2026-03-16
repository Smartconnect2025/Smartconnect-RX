import { createClient } from "@core/supabase/client";
import { Encounter, EncounterBusinessType } from "../types";
import { encounterService, CreateEncounterData } from "./encounterService";

export interface CoachingSessionData {
  id: string;
  patientId: string;
  providerId?: string;
  sessionDate: string;
  title: string;
  status: string;
  sessionType?: "life_coaching" | "wellness_coaching" | "career_coaching";
}

export interface CreateCoachingSessionData {
  patientId: string;
  providerId: string;
  datetime: string;
  duration: number;
  type: string;
  reason: string;
  sessionType?: "life_coaching" | "wellness_coaching" | "career_coaching";
}

class CoachingEncounterService {
  public supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create coaching encounter from appointment (when patient books coaching appointment)
   */
  async createEncounterFromAppointment(
    userId: string,
    appointmentData: CoachingSessionData,
  ): Promise<{ success: boolean; encounterId?: string; error?: string }> {
    try {
      // Check if encounter already exists for this appointment
      const existingEncounter = await this.getEncounterByAppointmentId(
        appointmentData.id,
      );
      if (existingEncounter) {
        return {
          success: true,
          encounterId: existingEncounter.id,
          error: "Encounter already exists for this coaching session",
        };
      }

      // Get provider details from the appointment
      const { data: appointment } = await this.supabase
        .from("appointments")
        .select(
          `
          provider_id,
          provider:providers(first_name, last_name)
        `,
        )
        .eq("id", appointmentData.id)
        .single();

      if (!appointment?.provider_id || !appointment.provider) {
        return {
          success: false,
          error: "Provider information not found for coaching session",
        };
      }

      const provider = appointment.provider as unknown as {
        first_name: string;
        last_name: string;
      };
      const providerName = `${provider.first_name} ${provider.last_name}`;

      // Create encounter data
      const encounterData: CreateEncounterData = {
        patientId: appointmentData.patientId,
        title: `Coaching Session: ${appointmentData.title}`,
        date: appointmentData.sessionDate,
        type: "consultation",
        provider: providerName,
        providerId: appointment.provider_id,
        businessType: "coaching" as EncounterBusinessType,
        appointmentId: appointmentData.id,
      };

      // We don't need to check if the user can create encounters here
      // since this is an automated process tied to appointment creation
      const result = await encounterService.createEncounter(
        userId,
        encounterData,
      );

      if (result.success && result.data) {
        return { success: true, encounterId: result.data.id };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create coaching encounter",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create coaching encounter ad-hoc (when provider creates coaching session directly)
   */
  async createAdHocCoachingEncounter(
    userId: string,
    encounterData: {
      patientId: string;
      title: string;
      date: string;
      type?: string;
      provider: string;
      sessionType?: "life_coaching" | "wellness_coaching" | "career_coaching";
    },
  ): Promise<{ success: boolean; encounterId?: string; error?: string }> {
    try {
      // Check if user can create coaching encounters
      const canCreate = await this.canUserCreateCoachingEncounters(userId);
      if (!canCreate) {
        return {
          success: false,
          error: "User not authorized to create coaching encounters",
        };
      }

      // Get provider details from the current user
      const { data: providerData } = await this.supabase
        .from("providers")
        .select("id, first_name, last_name")
        .eq("user_id", userId)
        .single();

      if (!providerData) {
        return {
          success: false,
          error: "Provider information not found",
        };
      }

      // Create encounter data
      const coachingEncounterData: CreateEncounterData = {
        patientId: encounterData.patientId,
        title: encounterData.title.trim(),
        date: encounterData.date,
        type:
          (encounterData.type as
            | "routine"
            | "follow_up"
            | "urgent"
            | "consultation") || "consultation",
        provider: `${providerData.first_name} ${providerData.last_name}`,
        providerId: providerData.id,
        businessType: "coaching" as EncounterBusinessType,
      };

      const result = await encounterService.createEncounter(
        userId,
        coachingEncounterData,
      );

      if (result.success && result.data) {
        return { success: true, encounterId: result.data.id };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create coaching encounter",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create appointment from coaching encounter (when provider creates coaching encounter)
   */
  async createAppointmentFromCoachingEncounter(
    userId: string,
    encounterData: {
      patientId: string;
      providerId: string;
      title: string;
      date: string;
      duration?: number;
      type?: string;
      sessionType?: "life_coaching" | "wellness_coaching" | "career_coaching";
    },
  ): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    try {
      // Check if user can create appointments
      const canCreate = await this.canUserCreateEncounters(userId);
      if (!canCreate) {
        return {
          success: false,
          error: "User not authorized to create coaching appointments",
        };
      }

      // Create appointment data
      const appointmentData = {
        patient_id: encounterData.patientId,
        provider_id: encounterData.providerId,
        datetime: encounterData.date,
        duration: encounterData.duration || 60, // Default 60 minutes for coaching
        type: encounterData.type || "consultation",
        reason: encounterData.title.replace("Coaching Session: ", ""),
      };

      // Insert appointment
      const { data: appointment, error: appointmentError } = await this.supabase
        .from("appointments")
        .insert([appointmentData])
        .select()
        .single();

      if (appointmentError) {
        throw new Error(
          `Failed to create coaching appointment: ${appointmentError.message}`,
        );
      }

      // Return the appointment ID for manual linking
      return { success: true, appointmentId: appointment.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get encounter by appointment ID
   */
  async getEncounterByAppointmentId(
    appointmentId: string,
  ): Promise<Encounter | null> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("business_type", "coaching")
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return encounterService.mapDbEncounterToType(data[0]);
    } catch {
      return null;
    }
  }

  /**
   * Get all coaching encounters for a patient
   */
  async getCoachingEncounters(
    patientId: string,
    _userId: string,
  ): Promise<Encounter[]> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("patient_id", patientId)
        .eq("business_type", "coaching")
        .order("encounter_date", { ascending: false });

      if (error) throw error;

      return data.map(encounterService.mapDbEncounterToType);
    } catch {
      return [];
    }
  }

  /**
   * Check if user can create coaching encounters
   */
  async canUserCreateCoachingEncounters(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return false;
      }

      // Allow providers and admins to create coaching encounters
      return data.role === "provider" || data.role === "admin";
    } catch {
      return false;
    }
  }

  /**
   * Check if user can create encounters/appointments (general)
   */
  async canUserCreateEncounters(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.role === "provider" || data.role === "admin";
    } catch {
      return false;
    }
  }

  /**
   * Sync coaching appointment and encounter data
   */
  async syncCoachingAppointmentAndEncounter(
    appointmentId: string,
    encounterId: string,
    updates: {
      datetime?: string;
      reason?: string;
      title?: string;
      date?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update appointment
      if (updates.datetime || updates.reason) {
        const appointmentUpdates: { datetime?: string; reason?: string } = {};
        if (updates.datetime) appointmentUpdates.datetime = updates.datetime;
        if (updates.reason) appointmentUpdates.reason = updates.reason;

        const { error: appointmentError } = await this.supabase
          .from("appointments")
          .update(appointmentUpdates)
          .eq("id", appointmentId);

        if (appointmentError) {
          throw new Error(
            `Failed to update coaching appointment: ${appointmentError.message}`,
          );
        }
      }

      // Update encounter
      if (updates.title || updates.date) {
        const encounterUpdates: { title?: string; encounter_date?: string } =
          {};
        if (updates.title) encounterUpdates.title = updates.title;
        if (updates.date) encounterUpdates.encounter_date = updates.date;

        const { error: encounterError } = await this.supabase
          .from("encounters")
          .update(encounterUpdates)
          .eq("id", encounterId);

        if (encounterError) {
          throw new Error(
            `Failed to update coaching encounter: ${encounterError.message}`,
          );
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const coachingEncounterService = new CoachingEncounterService();
