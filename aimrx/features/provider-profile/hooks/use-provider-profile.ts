"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/core/auth";
import { toast } from "sonner";
import { providerProfileService } from "../services/provider-profile-service";
import { ProfileFormValues } from "../components/profile/types";
import { ProfessionalInfoValues } from "../components/professional-info/types";
import { PracticeDetailsValues } from "../components/practice-details/types";
import { safeParseTyped, safeParseObjectTyped } from "../utils/json-parsers";

export interface ProviderProfile {
  id: string;
  user_id: string;
  // Personal Information
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone_number?: string;
  company_name?: string;
  avatar_url?: string;
  signature_url?: string;
  email_verified?: string;
  phone_verified?: string;
  // Professional Information
  npi_number?: string;
  dea_number?: string;
  specialties?: string;
  medical_licenses?: string;
  board_certifications?: string;
  education_training?: string;
  languages_spoken?: string;
  professional_associations?: string;
  years_of_experience?: number;
  professional_bio?: string;
  // Practice Details
  practice_address?: string;
  services_offered?: string;
  insurance_plans_accepted?: string;
  hospital_affiliations?: string;
  // Payment & Billing Information
  physical_address?: string;
  billing_address?: string;
  tax_id?: string;
  payment_details?: string;
  payment_method?: string;
  payment_schedule?: string;
  discount_rate?: string;
  default_shipping_fee?: number;
  // Group
  group_id?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing provider profile data
 */
export function useProviderProfile() {
  const { user } = useUser();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const profileData = await providerProfileService.getOrCreateProfile(
        user.id,
      );
      setProfile(profileData);
    } catch (err) {
      console.error("Error loading profile:", err);
      setError("Failed to load profile data");
      toast.error("Failed to load profile data");

      hasLoadedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load profile data
  useEffect(() => {
    if (user?.id && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadProfile();
    }
  }, [user?.id, loadProfile]);

  const resetProfile = () => {
    setProfile(null);
    setError(null);
    hasLoadedRef.current = false;
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const updatePersonalInfo = async (data: ProfileFormValues) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    setIsSubmitting(true);
    try {
      const updatedProfile = await providerProfileService.updatePersonalInfo(
        user.id,
        data,
      );
      setProfile(updatedProfile);

      // Show success message (is_verified doesn't exist in database yet)
      toast.success("Profile saved successfully!");

      return true;
    } catch (err) {
      console.error("Error updating personal info:", err);
      toast.error("Failed to update personal information");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    if (!user?.email) {
      toast.error("User email not found");
      return false;
    }

    setIsSubmitting(true);
    try {
      await providerProfileService.changePassword(
        user.email,
        currentPassword,
        newPassword,
      );
      toast.success("Password updated successfully");
      return true;
    } catch (err) {
      console.error("Error changing password:", err);
      if (
        err instanceof Error &&
        err.message === "Current password is incorrect"
      ) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to update password");
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAvatarUrl = async (avatarUrl: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    setIsSubmitting(true);
    try {
      const updatedProfile = await providerProfileService.updateAvatarUrl(
        user.id,
        avatarUrl,
      );
      setProfile(updatedProfile);
      // Remove the duplicate success message - it's handled by the avatar upload hook
      return true;
    } catch (err) {
      console.error("Error updating avatar:", err);
      toast.error("Failed to update avatar");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProfessionalInfo = async (data: ProfessionalInfoValues) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    setIsSubmitting(true);
    try {
      const updatedProfile =
        await providerProfileService.updateProfessionalInfo(user.id, data);
      setProfile(updatedProfile);
      toast.success("Professional information updated successfully");
      return true;
    } catch (err) {
      console.error("Error updating professional info:", err);
      toast.error("Failed to update professional information");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePracticeDetails = async (data: PracticeDetailsValues) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    setIsSubmitting(true);
    try {
      const updatedProfile = await providerProfileService.updatePracticeDetails(
        user.id,
        data,
      );
      setProfile(updatedProfile);
      toast.success("Practice details updated successfully");
      return true;
    } catch (err) {
      console.error("Error updating practice details:", err);
      toast.error("Failed to update practice details");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSpecialties = () => {
    return safeParseTyped<{ specialty?: string }>(profile?.specialties);
  };

  const getMedicalLicenses = () => {
    return safeParseTyped<{ licenseNumber?: string; state?: string }>(
      profile?.medical_licenses,
    );
  };

  const getBoardCertifications = () => {
    return safeParseTyped<{ certification?: string }>(
      profile?.board_certifications,
    );
  };

  const getEducationTraining = () => {
    return safeParseTyped<{ education?: string }>(profile?.education_training);
  };

  const getLanguagesSpoken = () => {
    return safeParseTyped<{ language?: string }>(profile?.languages_spoken);
  };

  const getProfessionalAssociations = () => {
    return safeParseTyped<{ association?: string }>(
      profile?.professional_associations,
    );
  };

  const getPracticeAddress = () => {
    return safeParseObjectTyped<{
      streetAddress1?: string;
      streetAddress2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    }>(profile?.practice_address);
  };

  const getServicesOffered = () => {
    return safeParseTyped<{ service?: string }>(profile?.services_offered);
  };

  const getInsurancePlansAccepted = () => {
    return safeParseTyped<{ insurancePlan?: string }>(
      profile?.insurance_plans_accepted,
    );
  };

  const getHospitalAffiliations = () => {
    return safeParseTyped<{ affiliation?: string }>(
      profile?.hospital_affiliations,
    );
  };

  return {
    // Data
    profile,
    isLoading,
    isSubmitting,
    error,

    // Actions
    loadProfile,
    resetProfile,
    refreshProfile,
    updatePersonalInfo,
    updateAvatarUrl,
    changePassword,
    updateProfessionalInfo,
    updatePracticeDetails,

    // Helpers for parsed JSON fields
    getSpecialties,
    getMedicalLicenses,
    getBoardCertifications,
    getEducationTraining,
    getLanguagesSpoken,
    getProfessionalAssociations,
    getPracticeAddress,
    getServicesOffered,
    getInsurancePlansAccepted,
    getHospitalAffiliations,
  };
}
