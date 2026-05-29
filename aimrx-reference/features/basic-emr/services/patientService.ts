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
  allergies?: string;
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
  allergies?: string | null;
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
      // ORIGINAL behaviour for real providers (direct supabase). Only
      // delegate-role users (Provider Assistants) take the new server
      // endpoint, because RLS blocks the direct query for them.
      let role: string | null = null;
      try {
        const { data: roleRow } = await this.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        role = (roleRow as { role?: string } | null)?.role ?? null;
      } catch { /* fall back to legacy provider path */ }

      // Route BOTH providers and delegates through the server endpoint.
      // The browser-side path that follows used RLS-evaluated reads against
      // providers / provider_patient_mappings / patients with the user's
      // anon key — any drift in cookies/JWT/role caching silently returned
      // an empty list ("No patients found") even when the database had
      // mappings, exactly the same failure mode that hid admin metrics.
      // The /api/basic-emr/patients endpoint already implements the
      // identical clinic-grouping logic with the admin client server-side,
      // so it works deterministically regardless of session state. Admin
      // role still falls through to the legacy admin branch below.
      if (role === "provider" || role === "delegate") {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        params.set("page", String(page));
        params.set("limit", String(limit));
        const res = await fetch(
          `/api/basic-emr/patients?${params.toString()}`,
          { credentials: "include", cache: "no-store" },
        );
        if (res.ok) {
          const json = await res.json();
          const patients: Patient[] = (json.patients || []).map(
            this.mapDbPatientToType,
          );
          return {
            success: true,
            data: { patients, total: patients.length },
          };
        }
        return { success: true, data: { patients: [], total: 0 } };
      }

      const isProvider = await this.checkIfUserIsProvider(userId);

      if (isProvider) {
        const isAdmin = await this.checkIfUserIsAdmin(userId);

        if (isAdmin) {
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

          if (searchQuery) {
            query = query.or(
              `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`,
            );
          }

          const { data, error } = await query
            .order("created_at", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          if (error) throw error;

          const patients: Patient[] = (data || []).map(this.mapDbPatientToType);

          return {
            success: true,
            data: {
              patients,
              total: patients.length,
            },
          };
        }

        const providerId = await this.getProviderIdByUserId(userId);
        if (!providerId) {
          return { success: true, data: { patients: [], total: 0 } };
        }

        const providerIds = await this.getClinicProviderIds(providerId);

        if (providerIds.length === 0) {
          return { success: true, data: { patients: [], total: 0 } };
        }

        const { data: mappings, error: mappingError } = await this.supabase
          .from("provider_patient_mappings")
          .select("patient_id")
          .in("provider_id", providerIds);

        if (mappingError) throw mappingError;

        const patientIdSet = new Set((mappings || []).map((m: { patient_id: string }) => m.patient_id));
        const patientIds = Array.from(patientIdSet);
        if (patientIds.length === 0) {
          return { success: true, data: { patients: [], total: 0 } };
        }

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
          .in("id", patientIds)
          .eq("is_active", true);

        if (searchQuery) {
          query = query.or(
            `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`,
          );
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;

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
      // Route provider/delegate fetches through the server endpoint. The
      // browser-side verifyPatientAccess + .from('patients') path silently
      // failed under RLS drift and surfaced as "Patient not found or
      // access denied" on the edit screen even when the patient was
      // clearly in the user's clinic. The server endpoint runs the same
      // clinic-scope check with the admin client.
      let role: string | null = null;
      try {
        const { data: roleRow } = await this.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        role = (roleRow as { role?: string } | null)?.role ?? null;
      } catch { /* fall through */ }

      if (role === "provider" || role === "delegate") {
        const res = await fetch(
          `/api/basic-emr/patients/${patientId}`,
          { credentials: "include", cache: "no-store" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false || !json?.data) {
          return {
            success: false,
            error:
              json?.error ||
              (res.status === 404
                ? "Patient not found or access denied"
                : "Failed to fetch patient"),
          };
        }
        return {
          success: true,
          data: this.mapDbPatientToType(json.data),
        };
      }

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
      // Route provider/delegate updates through the server endpoint, same
      // reason as getPatients: the browser-side update went through RLS
      // with the user's anon key and silently failed when the session
      // drifted. The server endpoint applies the identical clinic-scope
      // check with the admin client and returns a clear error otherwise.
      let role: string | null = null;
      try {
        const { data: roleRow } = await this.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        role = (roleRow as { role?: string } | null)?.role ?? null;
      } catch { /* fall through to legacy direct path */ }

      if (role === "provider" || role === "delegate") {
        const res = await fetch("/api/basic-emr/patients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ patientId, updates }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          return {
            success: false,
            error: json?.error || "Failed to update patient",
          };
        }
        return {
          success: true,
          data: this.mapDbPatientToType(json.data),
        };
      }

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
      if (updates.allergies !== undefined) {
        const trimmed = (updates.allergies || "").trim();
        dbUpdates.allergies = trimmed.length > 0 ? trimmed : null;
      }

      if (
        updates.gender ||
        updates.emergencyContact ||
        updates.insurance ||
        updates.preferredLanguage
      ) {
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
      // Surface the real reason (PostgrestError is not an Error instance,
      // so the generic fallback was hiding the message/details/hint).
      console.error("updatePatient failed:", error);
      const e = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const reason =
        e?.message ||
        e?.details ||
        e?.hint ||
        (typeof error === "string" ? error : "Failed to update patient");
      return {
        success: false,
        error: e?.code ? `${reason} (code ${e.code})` : reason,
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
      allergies: dbPatient.allergies ?? null,
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
      const isProvider = await this.checkIfUserIsProvider(userId);

      if (isProvider) {
        const isAdmin = await this.checkIfUserIsAdmin(userId);
        if (isAdmin) {
          const { data, error } = await this.supabase
            .from("patients")
            .select("id")
            .eq("id", patientId)
            .eq("is_active", true)
            .single();
          return !error && !!data;
        }

        // Provider Assistants (role 'delegate') may also have an
        // auto-provisioned row in the `providers` table (NPI-less, used as
        // their personal terminal). For access decisions we always want to
        // scope to the SUPERVISING provider's clinic — not the assistant's
        // shell row, which only owns mappings for patients the assistant
        // personally created. Without this preference, an assistant cannot
        // access patients the supervising provider created before the
        // assistant existed (they have no personal mapping for those).
        const delegationProviderId =
          await this.getActiveDelegationProviderId(userId);
        const ownProviderId = await this.getProviderIdByUserId(userId);
        const providerId = delegationProviderId ?? ownProviderId;

        if (!providerId) return false;

        const providerIds = await this.getClinicProviderIds(providerId);

        const { data: mapping, error: mapErr } = await this.supabase
          .from("provider_patient_mappings")
          .select("id")
          .in("provider_id", providerIds)
          .eq("patient_id", patientId)
          .limit(1)
          .maybeSingle();
        return !mapErr && !!mapping;
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
      // Provider Assistants (role "delegate") use the regular provider
      // terminal as their own account, so they take the same code path.
      return (
        !error &&
        data &&
        (data.role === "provider" ||
          data.role === "admin" ||
          data.role === "delegate")
      );
    } catch {
      return false;
    }
  }

  async checkIfUserIsAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      return !error && data && data.role === "admin";
    } catch {
      return false;
    }
  }

  async getClinicProviderIds(providerId: string): Promise<string[]> {
    try {
      const { data: currentProvider } = await this.supabase
        .from("providers")
        .select("company_name")
        .eq("id", providerId)
        .single();

      const companyName = currentProvider?.company_name?.trim();
      if (!companyName) {
        return [];
      }

      const normalizedName = companyName.toLowerCase();
      const { data: allActiveProviders } = await this.supabase
        .from("providers")
        .select("id, company_name")
        .eq("is_active", true)
        .not("company_name", "is", null);

      const clinicProviders = (allActiveProviders || []).filter(
        (p: { id: string; company_name: string }) =>
          p.company_name?.trim().toLowerCase() === normalizedName
      );

      if (!clinicProviders || clinicProviders.length === 0) {
        return [providerId];
      }

      const ids = clinicProviders.map((p: { id: string }) => p.id);
      if (!ids.includes(providerId)) {
        ids.push(providerId);
      }
      return ids;
    } catch {
      return [providerId];
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

  /**
   * Resolves a Provider Assistant (delegate) to their supervising provider's
   * id by looking up an ACTIVE delegation row. Returns null if no active
   * delegation exists, which correctly denies access for revoked / rejected /
   * pending delegations and for users who are not delegates at all.
   *
   * Used by verifyPatientAccess to fall back from the standard
   * providers.user_id lookup (which never matches an assistant, since
   * assistants have no row in the providers table).
   */
  async getActiveDelegationProviderId(
    userId: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("delegations")
        .select("provider_id")
        .eq("delegate_user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return !error && data ? data.provider_id : null;
    } catch {
      return null;
    }
  }
}

export const patientService = new PatientService();
