import { createClient } from "@core/supabase/client";

import { Gender, Patient, PatientData } from "../types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreatePatientData {
  firstName: string;
  lastName: string;
  email: string; // Required for patient auth account creation
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  preferredLanguage?: string;
}

type PatientAddressRow = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string; // Used by basic-emr
  zip?: string; // Used by intake form
  country?: string;
};

type DbPatientRow = {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth: string;
  data?: PatientData;
  physical_address?: PatientAddressRow;
  billing_address?: PatientAddressRow;
  is_active: boolean;
  avatar_url?: string;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
};

class PatientService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getPatients(
    userId: string,
    searchQuery?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<EmrServiceResponse<{ patients: Patient[]; total?: number }>> {
    try {
      // Check if user is a provider
      const isProvider = await this.checkIfUserIsProvider(userId);

      if (isProvider) {
        // For providers, get all patients from the patients table
        let query = this.supabase
          .from("patients")
          .select(
            `
            id,
            user_id,
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            data,
            physical_address,
            billing_address,
            is_active,
            created_at,
            updated_at
          `,
          )
          .eq("is_active", true);

        // Add search filter if provided
        if (searchQuery) {
          query = query.or(
            `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`,
          );
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        // Map to Patient type
        const patients: Patient[] = (data || []).map(this.mapDbPatientToType);

        return {
          success: true,
          data: {
            patients,
            total: patients.length,
          },
        };
      } else {
        // For non-providers (patients), they can only see their own data
        let query = this.supabase
          .from("patients")
          .select(
            `
            id,
            first_name,
            last_name,
            email,
            phone,
            date_of_birth,
            data,
            physical_address,
            billing_address,
            is_active,
            created_at,
            updated_at
          `,
          )
          .eq("is_active", true)
          .eq("user_id", userId);

        // Add search filter if provided
        if (searchQuery) {
          query = query.ilike("first_name", `%${searchQuery}%`);
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

        const patients: Patient[] = data.map(this.mapDbPatientToType);

        return {
          success: true,
          data: {
            patients,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch patients",
      };
    }
  }

  async getPatientById(
    patientId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Patient>> {
    try {
      // Check if user has access to this patient
      const hasAccess = await this.verifyPatientAccess(patientId, userId);
      if (!hasAccess) {
        throw new Error("Patient not found or access denied");
      }

      const { data, error } = await this.supabase
        .from("patients")
        .select(
          "id, user_id, first_name, last_name, email, phone, date_of_birth, data, physical_address, billing_address, is_active, created_at, updated_at",
        )
        .eq("id", patientId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Patient not found");

      return {
        success: true,
        data: this.mapDbPatientToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch patient",
      };
    }
  }

  async createPatient(
    userId: string,
    patientData: CreatePatientData,
  ): Promise<EmrServiceResponse<Patient>> {
    // This method is now deprecated - use the API route instead
    // Keeping for backward compatibility but it will redirect to the API
    try {
      const response = await fetch("/api/basic-emr/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create patient");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create patient",
      };
    }
  }

  async updatePatient(
    patientId: string,
    userId: string,
    updates: Partial<CreatePatientData>,
  ): Promise<EmrServiceResponse<Patient>> {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.firstName) dbUpdates.first_name = updates.firstName;
      if (updates.lastName) dbUpdates.last_name = updates.lastName;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.phone) dbUpdates.phone = updates.phone;
      if (updates.dateOfBirth) dbUpdates.date_of_birth = updates.dateOfBirth;

      // Save address to physical_address column (not data.address)
      if (updates.address) {
        dbUpdates.physical_address = updates.address;
      }
      // Save billingAddress to billing_address column
      if (updates.billingAddress) {
        dbUpdates.billing_address = updates.billingAddress;
      }

      if (
        updates.gender ||
        updates.emergencyContact ||
        updates.insurance ||
        updates.preferredLanguage
      ) {
        // Get current data - RLS policies will verify access
        const { data: currentData } = await this.supabase
          .from("patients")
          .select("data")
          .eq("id", patientId)
          .eq("is_active", true)
          .single();
        const currentJsonData = currentData?.data || {};
        const newData = { ...currentJsonData };
        if (updates.gender) newData.gender = updates.gender;
        // address is now stored in physical_address column, not in data
        if (updates.emergencyContact)
          newData.emergencyContact = updates.emergencyContact;
        if (updates.insurance) newData.insurance = updates.insurance;
        if (updates.preferredLanguage)
          newData.preferredLanguage = updates.preferredLanguage;
        dbUpdates.data = newData;
      }
      // RLS policies handle access control (provider access or patient's own record)
      const { data, error } = await this.supabase
        .from("patients")
        .update(dbUpdates)
        .eq("id", patientId)
        .eq("is_active", true)
        .select()
        .single();
      if (error) throw error;
      return {
        success: true,
        data: this.mapDbPatientToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update patient",
      };
    }
  }

  private mapDbPatientToType(dbPatient: DbPatientRow): Patient {
    const data: PatientData = dbPatient.data as PatientData;
    // Map physical_address to PatientAddress format, with fallback to legacy data.address
    // Support both zipCode (standard) and zip (legacy intake form) field names
    const physicalAddress = dbPatient.physical_address
      ? {
          street: dbPatient.physical_address.street || "",
          city: dbPatient.physical_address.city || "",
          state: dbPatient.physical_address.state || "",
          zipCode:
            dbPatient.physical_address.zipCode ||
            dbPatient.physical_address.zip ||
            "",
          country: dbPatient.physical_address.country,
        }
      : data?.address;
    const billingAddress = dbPatient.billing_address
      ? {
          street: dbPatient.billing_address.street || "",
          city: dbPatient.billing_address.city || "",
          state: dbPatient.billing_address.state || "",
          zipCode:
            dbPatient.billing_address.zipCode ||
            dbPatient.billing_address.zip ||
            "",
          country: dbPatient.billing_address.country,
        }
      : undefined;
    return {
      id: dbPatient.id,
      firstName: dbPatient.first_name,
      lastName: dbPatient.last_name,
      email: dbPatient.email || "",
      phone: dbPatient.phone || "",
      dateOfBirth: dbPatient.date_of_birth,
      gender: data?.gender,
      // Use physical_address column, fallback to data.address for legacy records
      address: physicalAddress,
      physical_address: physicalAddress,
      billing_address: billingAddress,
      emergencyContact: data?.emergencyContact,
      insurance: data?.insurance,
      preferredLanguage: data?.preferredLanguage,
      is_active: dbPatient.is_active,
      avatar_url: dbPatient.avatar_url || null,
      stripe_customer_id: dbPatient.stripe_customer_id || null,
    };
  }

  async verifyPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    return this.verifyPatientAccess(patientId, userId);
  }

  async verifyPatientAccess(
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
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      return (
        !error && data && (data.role === "provider" || data.role === "admin")
      );
    } catch {
      return false;
    }
  }

  async getProviderIdByUserId(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle(); // Use maybeSingle() to handle 0 rows
      return !error && data ? data.id : null;
    } catch {
      return null;
    }
  }
}

export const patientService = new PatientService();
