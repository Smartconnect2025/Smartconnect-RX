import { createClient } from "@/core/supabase/client";
import { ProfileFormValues } from "../components/profile/types";
import { ProfessionalInfoValues } from "../components/professional-info/types";
import { PracticeDetailsValues } from "../components/practice-details/types";
import { toast } from "sonner";

export class ProviderProfileService {
  private supabase = createClient();

  async getProviderProfile(userId: string) {
    const response = await fetch("/api/provider/profile");
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Failed to fetch provider profile:", err);
      toast.error("Failed to fetch provider profile");
      return null;
    }
    const data = await response.json();
    return data.provider || null;
  }

  async changePassword(
    email: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("Current password is incorrect");
    }

    const { error: updatePasswordError } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updatePasswordError) {
      throw updatePasswordError;
    }
  }

  async updatePersonalInfo(userId: string, data: ProfileFormValues) {
    const medicalLicenses = (data.medicalLicenses || [])
      .filter(license => license.licenseNumber && license.state)
      .map(license => ({
        licenseNumber: license.licenseNumber,
        state: license.state,
      }));

    const licensedStates = medicalLicenses.map(l => l.state);

    const paymentDetails = data.paymentDetails ? {
      bank_name: data.paymentDetails.bankName || null,
      account_holder_name: data.paymentDetails.accountHolderName || null,
      account_number: data.paymentDetails.accountNumber || null,
      routing_number: data.paymentDetails.routingNumber || null,
      account_type: data.paymentDetails.accountType || null,
      swift_code: data.paymentDetails.swiftCode || null,
    } : null;

    const updateData: Record<string, unknown> = {
      _section: "personal",
      avatar_url: data.avatarUrl,
      signature_url: data.signatureUrl || null,
      npi_number: data.npiNumber || null,
      company_name: data.companyName || null,
      medical_licenses: medicalLicenses,
      licensed_states: licensedStates,
      tax_id: data.taxId || null,
      payment_method: data.paymentMethod || null,
      payment_schedule: data.paymentSchedule || null,
      payment_details: paymentDetails,
      default_shipping_fee: data.defaultShippingFee ?? null,
    };

    if (data.physicalAddress) {
      updateData.physical_address = data.physicalAddress;
    }
    if (data.billingAddress) {
      updateData.billing_address = data.billingAddress;
    }

    const response = await fetch("/api/provider/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err?.details || err?.error || "Failed to save profile";
      console.error("Error saving profile:", err);
      toast.error(`Failed to save profile: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return result.provider;
  }

  async updateAchInfo(input: {
    bank_name?: string | null;
    account_holder?: string | null;
    routing_number?: string | null;
    account_number?: string | null;
    account_type?: string | null;
    fmv_disclosure_accepted?: boolean;
  }) {
    const response = await fetch("/api/provider/ach", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = result?.error || "Failed to save banking info";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
    return result;
  }

  async verifyNpi(npi: string): Promise<{ valid: boolean; message: string }> {
    try {
      const res = await fetch(
        `/api/provider/verify-npi?npi=${encodeURIComponent(npi)}`,
      );
      if (!res.ok) {
        return {
          valid: false,
          message: "Unable to verify NPI at this time. Please try again later.",
        };
      }
      const data = await res.json();
      return {
        valid: !!data.valid,
        message: data.message || "Verification failed",
      };
    } catch {
      return {
        valid: false,
        message: "Unable to verify NPI at this time. Please try again later.",
      };
    }
  }

  async updateAvatarUrl(userId: string, avatarUrl: string) {
    const response = await fetch("/api/provider/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _section: "avatar", avatar_url: avatarUrl }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast.error("Failed to update avatar");
      throw new Error(err?.error || "Failed to update avatar");
    }

    const result = await response.json();
    return result.provider;
  }

  async updateProfessionalInfo(userId: string, data: ProfessionalInfoValues) {
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
      _section: "professional",
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
      specialty: specialties.length > 0 ? specialties[0].specialty : null,
      licensed_states: licenses.map((l) => l.state).filter(Boolean),
    };

    const response = await fetch("/api/provider/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err?.details || err?.error || "Failed to update professional information";
      console.error("Error updating professional info:", err);
      toast.error(`Failed to update professional information: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return result.provider;
  }

  async updatePracticeDetails(userId: string, data: PracticeDetailsValues) {
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
      _section: "practice",
      services_offered: services,
      insurance_plans_accepted: insurancePlans,
      hospital_affiliations: affiliations,
      service_types: services.map((s) => s.service),
      insurance_plans: insurancePlans.map((p) => p.insurancePlan),
    };

    const response = await fetch("/api/provider/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMsg = err?.details || err?.error || "Failed to update practice details";
      console.error("Error updating practice details:", err);
      toast.error(`Failed to update practice details: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const result = await response.json();
    return result.provider;
  }

  async createProviderProfile(userId: string) {
    const response = await fetch("/api/provider/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _section: "create" }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast.error("Failed to create provider profile");
      throw new Error(err?.error || "Failed to create provider profile");
    }

    const result = await response.json();
    return result.provider;
  }

  async profileExists(userId: string): Promise<boolean> {
    const response = await fetch("/api/provider/profile");
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.provider;
  }

  async getOrCreateProfile(userId: string) {
    const response = await fetch("/api/provider/profile");
    if (!response.ok) {
      return await this.createProviderProfile(userId);
    }
    const data = await response.json();
    if (data.provider) {
      return data.provider;
    }
    return await this.createProviderProfile(userId);
  }
}

export const providerProfileService = new ProviderProfileService();
