import { createClient } from "@core/supabase/client";
import { Encounter, EncounterBusinessType } from "../types";
import { encounterService, CreateEncounterData } from "./encounterService";

export interface AppointmentData {
  id: string;
  reference: string;
  patientId: string;
  providerId?: string;
  appointmentDate: string;
  title: string;
  status: string;
}

export interface CreateAppointmentData {
  patientId: string;
  providerId: string;
  datetime: string;
  duration: number;
  type: string;
  reason: string;
}

class AppointmentEncounterService {
  public supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create encounter from appointment (when patient books appointment)
   */
  async createEncounterFromAppointment(
    userId: string,
    appointmentData: AppointmentData,
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
          error: "Encounter already exists for this appointment",
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
          error: "Provider information not found for appointment",
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
        title: `Appointment: ${appointmentData.title}`,
        date: appointmentData.appointmentDate,
        type: "consultation",
        provider: providerName,
        providerId: appointment.provider_id,
        businessType: "appointment_based" as EncounterBusinessType,
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
          error: result.error || "Failed to create encounter",
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
   * Create appointment from encounter (when provider creates encounter)
   */
  async createAppointmentFromEncounter(
    userId: string,
    encounterData: {
      patientId: string;
      providerId: string;
      title: string;
      date: string;
      duration?: number;
      type?: string;
    },
  ): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    try {
      // Check if user can create appointments
      const canCreate = await this.canUserCreateEncounters(userId);
      if (!canCreate) {
        return {
          success: false,
          error: "User not authorized to create appointments",
        };
      }

      // Create appointment data
      const appointmentData = {
        patient_id: encounterData.patientId,
        provider_id: encounterData.providerId,
        datetime: encounterData.date,
        duration: encounterData.duration || 30,
        type: encounterData.type || "consultation",
        reason: encounterData.title.replace("Appointment: ", ""),
      };

      // Insert appointment
      const { data: appointment, error: appointmentError } = await this.supabase
        .from("appointments")
        .insert([appointmentData])
        .select()
        .single();

      if (appointmentError) {
        throw new Error(
          `Failed to create appointment: ${appointmentError.message}`,
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
   * Get all appointment-based encounters for a patient
   */
  async getAppointmentEncounters(
    patientId: string,
    _userId: string,
  ): Promise<Encounter[]> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("patient_id", patientId)
        .eq("business_type", "appointment_based")
        .order("encounter_date", { ascending: false });

      if (error) throw error;

      return data.map(encounterService.mapDbEncounterToType);
    } catch {
      return [];
    }
  }

  /**
   * Check if user can create encounters/appointments
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
   * Sync appointment and encounter data
   */
  async syncAppointmentAndEncounter(
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
            `Failed to update appointment: ${appointmentError.message}`,
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
            `Failed to update encounter: ${encounterError.message}`,
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

export const appointmentEncounterService = new AppointmentEncounterService();
