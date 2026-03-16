/**
 * Account Management Service
 *
 * Handles role-based account creation and user role assignment
 * Separates user account creation from patient profile creation
 */

import { createAdminClient } from "@core/database/client";
import { createClient } from "@core/supabase";
export interface CreateAccountParams {
  email: string;
  password: string;
  role: "admin" | "provider" | "user";
  firstName?: string;
  lastName?: string;
  phone?: string;
  tierLevel?: string;
  groupId?: string;
}

export interface AccountCreationResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Create a new user account with role assignment
 * This function creates the auth user and assigns the appropriate role
 * without creating patient profiles for admin/provider users
 */
export async function createUserAccount(
  params: CreateAccountParams,
): Promise<AccountCreationResult> {
  const supabase = createAdminClient();

  try {
    // Create the auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
      });

    if (authError) {
      return {
        success: false,
        error: `Failed to create auth user: ${authError.message}`,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: "No user data returned from auth creation",
      };
    }

    const userId = authData.user.id;

    // Assign the user role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: params.role,
    });

    if (roleError) {
      // Clean up the auth user if role assignment fails
      await supabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Failed to assign role: ${roleError.message}`,
      };
    }

    // For providers, create a provider profile
    if (params.role === "provider") {
      const providerData: {
        user_id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone_number?: string;
        is_active: boolean;
        is_verified: boolean;
        group_id?: string;
      } = {
        user_id: userId,
        first_name: params.firstName || "",
        last_name: params.lastName || "",
        email: params.email,
        phone_number: params.phone,
        is_active: false,
        is_verified: false,
      };

      if (params.groupId) {
        providerData.group_id = params.groupId;
      }

      const { error: providerError, data: providerRecord } = await supabase
        .from("providers")
        .insert(providerData)
        .select()
        .single();

      if (providerError) {
        console.error("Failed to create provider profile:", providerError);
        // Clean up the auth user and role if provider profile creation fails
        await supabase.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: `Failed to create provider profile: ${providerError.message}`,
        };
      }

      // Update tier_level in providers table if tier was specified
      if (params.tierLevel && providerRecord) {
        await supabase
          .from("providers")
          .update({ tier_level: params.tierLevel })
          .eq("id", providerRecord.id);
      }
    }

    // Note: We intentionally don't create patient profiles for admin/provider users
    // Patient profiles should only be created when patients sign up themselves

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error("Error creating user account:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get user role information
 */
export async function getUserRoleInfo(userId: string): Promise<{
  role: string | null;
  hasPatientProfile: boolean;
  hasProviderProfile: boolean;
}> {
  const supabase = createClient();

  try {
    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    // Check if user has patient profile (for backward compatibility)
    const { data: patientData } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .single();

    // Check if user has provider profile
    const { data: providerData } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", userId)
      .single();

    return {
      role: roleData?.role || null,
      hasPatientProfile: !!patientData,
      hasProviderProfile: !!providerData,
    };
  } catch (error) {
    console.error("Error getting user role info:", error);
    return {
      role: null,
      hasPatientProfile: false,
      hasProviderProfile: false,
    };
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: "admin" | "provider" | "user",
): Promise<AccountCreationResult> {
  const supabase = createClient();

  try {
    const { error } = await supabase.from("user_roles").upsert({
      user_id: userId,
      role: newRole,
    });

    if (error) {
      return {
        success: false,
        error: `Failed to update role: ${error.message}`,
      };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error("Error updating user role:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Create patient profile for existing user account
 * This is called after patient registration to create the patient profile
 */
export async function createPatientProfile(
  userId: string,
  patientData: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  },
): Promise<AccountCreationResult> {
  const supabase = createClient();

  try {
    // Verify user has "user" role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!roleData || roleData.role !== "user") {
      return {
        success: false,
        error: "User does not have patient role",
      };
    }

    // Create patient profile
    const { error: patientError } = await supabase.from("patients").insert({
      user_id: userId,
      first_name: patientData.firstName,
      last_name: patientData.lastName,
      date_of_birth: patientData.dateOfBirth,
      phone_number: patientData.phone,
      address: patientData.address,
      city: patientData.city,
      state: patientData.state,
      zip_code: patientData.zipCode,
      name: `${patientData.firstName} ${patientData.lastName}`,
    });

    if (patientError) {
      return {
        success: false,
        error: `Failed to create patient profile: ${patientError.message}`,
      };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error("Error creating patient profile:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Delete user account and all associated data
 */
export async function deleteUserAccount(
  userId: string,
): Promise<AccountCreationResult> {
  const supabase = createClient();

  try {
    // Delete the auth user (this will cascade to user_roles and other related tables)
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return {
        success: false,
        error: `Failed to delete user: ${error.message}`,
      };
    }

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
