import { createClient } from "@/core/supabase/client";
import { ProfileFormValues } from "../components/profile/types";
import { ProfessionalInfoValues } from "../components/professional-info/types";
import { PracticeDetailsValues } from "../components/practice-details/types";
import { toast } from "sonner";

/**
 * Provider Profile Service
 * Handles all provider profile data operations using Supabase
 */
export class ProviderProfileService {
  private supabase = createClient();

  /**
   * Get provider profile by user ID
   */
  async getProviderProfile(userId: string) {
    const { data, error } = await this.supabase
      .from("providers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle() to handle 0 rows

    if (error) {
      toast.error("Failed to fetch provider profile");
      return null;
    }

    return data;
  }

  /**
   * Change user password
   */
  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ) {
    // Verify current password by attempting to sign in
    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    const { error: updatePasswordError } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updatePasswordError) {
      throw updatePasswordError;
    }
  }

  /**
   * Update provider personal information
   */
  async updatePersonalInfo(userId: string, data: ProfileFormValues) {
    // Clean medical licenses data
    const medicalLicenses = (data.medicalLicenses || [])
      .filter(license => license.licenseNumber && license.state)
      .map(license => ({
        licenseNumber: license.licenseNumber,
        state: license.state,
      }));

    // Extract licensed states for backward compatibility
    const licensedStates = medicalLicenses.map(l => l.state);

    // Convert payment details to snake_case for database consistency
    const paymentDetails = data.paymentDetails ? {
      bank_name: data.paymentDetails.bankName || null,
      account_holder_name: data.paymentDetails.accountHolderName || null,
      account_number: data.paymentDetails.accountNumber || null,
      routing_number: data.paymentDetails.routingNumber || null,
      account_type: data.paymentDetails.accountType || null,
      swift_code: data.paymentDetails.swiftCode || null,
    } : null;

    // Only save addresses if they have actual data (check for non-empty, non-USA-only values)
    // If no data provided, we DON'T include the field in the update to preserve existing values
    const hasPhysicalAddressData = data.physicalAddress && (
      data.physicalAddress.street ||
      data.physicalAddress.city ||
      data.physicalAddress.state ||
      data.physicalAddress.zipCode
    );
    const hasBillingAddressData = data.billingAddress && (
      data.billingAddress.street ||
      data.billingAddress.city ||
      data.billingAddress.state ||
      data.billingAddress.zipCode
    );

    // Build update data, only including address fields if they have data
    // This prevents overwriting existing addresses with null when saving from tabs that don't show address fields
    const updateData: Record<string, unknown> = {
      avatar_url: data.avatarUrl,
      signature_url: data.signatureUrl || null,
      npi_number: data.npiNumber || null,
      company_name: data.companyName || null,
      medical_licenses: medicalLicenses,
      licensed_states: licensedStates, // Backward compatibility
      tax_id: data.taxId || null,
      payment_method: data.paymentMethod || null,
      payment_schedule: data.paymentSchedule || null,
      payment_details: paymentDetails,
      default_shipping_fee: data.defaultShippingFee ?? null,
      // Note: is_verified and is_active columns don't exist in the database schema yet
      updated_at: new Date().toISOString(),
    };

    // Only include address fields if they have actual data - otherwise preserve existing DB values
    if (hasPhysicalAddressData) {
      updateData.physical_address = data.physicalAddress;
    }
    if (hasBillingAddressData) {
      updateData.billing_address = data.billingAddress;
    }

    const exists = await this.profileExists(userId);

    if (exists) {
      const { data: result, error } = await this.supabase
        .from("providers")
        .update(updateData)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("Error saving profile:", error);
        const errorMsg = error?.message || error?.details || 'Unknown database error';
        toast.error(`Failed to save profile: ${errorMsg}`);
        throw error;
      }

      return result;
    } else {
      // Create new profile with personal info
      const { data: result, error } = await this.supabase
        .from("providers")
        .insert({
          user_id: userId,
          ...updateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create personal information");
      }

      return result;
    }
  }

  /**
   * Update provider avatar URL
   */
  async updateAvatarUrl(userId: string, avatarUrl: string) {
    const { data, error } = await this.supabase
      .from("providers")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      toast.error("Failed to update avatar");
      throw error;
    }

    return data;
  }

  /**
   * Update provider professional information
   */
  async updateProfessionalInfo(userId: string, data: ProfessionalInfoValues) {
    // Clean and structure the data for storage
    const specialties = data.specialties
      .filter((item) => item.specialty && item.specialty.trim() !== "")
      .map((item) => ({ specialty: item.specialty }));

    const licenses = data.licenses
      .filter(
        (license) =>
          license.licenseNumber && license.licenseNumber.trim() !== "",
      )
      .map((license) => ({
        licenseNumber: license.licenseNumber,
        state: license.state,
      }));

    const certifications = data.certifications
      .filter((cert) => cert.certification && cert.certification.trim() !== "")
      .map((cert) => ({ certification: cert.certification }));

    const education = data.educationTraining
      .filter((edu) => edu.education && edu.education.trim() !== "")
      .map((edu) => ({ education: edu.education }));

    const languages = data.languages
      .filter((lang) => lang.language && lang.language.trim() !== "")
      .map((lang) => ({ language: lang.language }));

    const associations = data.associations
      .filter((assoc) => assoc.association && assoc.association.trim() !== "")
      .map((assoc) => ({ association: assoc.association }));

    const updateData = {
      npi_number: data.npiNumber || null,
      dea_number: data.deaNumber || null,
      specialties: specialties,
      medical_licenses: licenses,
      board_certifications: certifications,
      education_training: education,
      languages_spoken: languages,
      professional_associations: associations,
      years_of_experience: data.yearsOfExperience,
      professional_bio: data.professionalBio,
      // Backward compatibility - set primary specialty
      specialty: specialties.length > 0 ? specialties[0].specialty : null,
      // Set licensed states for backward compatibility
      licensed_states: licenses.map((l) => l.state).filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    const exists = await this.profileExists(userId);

    if (exists) {
      const { data: result, error } = await this.supabase
        .from("providers")
        .update(updateData)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        toast.error("Failed to update professional information");
      }

      return result;
    } else {
      // Create new profile with professional info
      const { data: result, error } = await this.supabase
        .from("providers")
        .insert({
          user_id: userId,
          ...updateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create professional information");
      }

      return result;
    }
  }

  /**
   * Update provider practice details
   */
  async updatePracticeDetails(userId: string, data: PracticeDetailsValues) {
    // Clean and structure services, insurance, and affiliations
    const services = data.services
      .filter((service) => service.service && service.service.trim() !== "")
      .map((service) => ({ service: service.service }));

    const insurancePlans = data.insurancePlans
      .filter((plan) => plan.insurancePlan && plan.insurancePlan.trim() !== "")
      .map((plan) => ({ insurancePlan: plan.insurancePlan }));

    const affiliations = data.hospitalAffiliations
      .filter((affil) => affil.affiliation && affil.affiliation.trim() !== "")
      .map((affil) => ({ affiliation: affil.affiliation }));

    const updateData = {
      services_offered: services,
      insurance_plans_accepted: insurancePlans,
      hospital_affiliations: affiliations,
      // Backward compatibility
      service_types: services.map((s) => s.service),
      insurance_plans: insurancePlans.map((p) => p.insurancePlan),
      updated_at: new Date().toISOString(),
    };

    const exists = await this.profileExists(userId);

    if (exists) {
      const { data: result, error } = await this.supabase
        .from("providers")
        .update(updateData)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        toast.error("Failed to update practice details");
      }

      return result;
    } else {
      // Create new profile with practice details
      const { data: result, error } = await this.supabase
        .from("providers")
        .insert({
          user_id: userId,
          ...updateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to create practice details");
      }

      return result;
    }
  }

  /**
   * Create a new provider profile
   */
  async createProviderProfile(userId: string) {
    const { data, error } = await this.supabase
      .from("providers")
      .insert({
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create provider profile");
    }

    return data;
  }

  /**
   * Check if provider profile exists for user
   */
  async profileExists(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("providers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      toast.error("Failed to check if profile exists");
      return false;
    }

    return !!data;
  }

  /**
   * Get or create provider profile
   */
  async getOrCreateProfile(userId: string) {
    const exists = await this.profileExists(userId);

    if (exists) {
      return await this.getProviderProfile(userId);
    } else {
      // Profile doesn't exist, create it
      return await this.createProviderProfile(userId);
    }
  }
}

export const providerProfileService = new ProviderProfileService();
