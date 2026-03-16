"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useFormPersistence } from "@/hooks/useFormPersistence";

import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";

import { SpecialtiesSection } from "../practice-details/SpecialtiesSection";
import { BoardCertificationSection } from "../professional-info/BoardCertificationSection";
import { EducationTrainingSection } from "../professional-info/EducationTrainingSection";
import { LanguagesSpokenSection } from "../professional-info/LanguagesSpokenSection";
import { MedicalLicenseSection } from "../professional-info/MedicalLicenseSection";
import { NPISection } from "../professional-info/NPISection";
import { ProfessionalAssociationsSection } from "../professional-info/ProfessionalAssociationsSection";
import { ProfessionalBioSection } from "../professional-info/ProfessionalBioSection";
import {
  professionalInfoSchema,
  ProfessionalInfoValues,
} from "../professional-info/types";
import { YearsOfExperienceSection } from "../professional-info/YearsOfExperienceSection";
import { useProviderProfile } from "../../hooks/use-provider-profile";
import { safeParseTyped } from "../../utils/json-parsers";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createClient } from "@core/supabase";
import { useDemoGuard } from "@/hooks/use-demo-guard";

interface GroupInfo {
  name: string;
  platform_manager_name: string | null;
}

export function ProfessionalInfoForm() {
  const { profile, updateProfessionalInfo, isSubmitting } =
    useProviderProfile();
  const { guardAction } = useDemoGuard();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);

  // Fetch group info when profile loads
  useEffect(() => {
    const fetchGroup = async () => {
      if (!profile?.group_id) {
        setGroupInfo(null);
        return;
      }

      const supabase = createClient();
      const { data: group } = await supabase
        .from("groups")
        .select("name, platform_manager_id")
        .eq("id", profile.group_id)
        .single();

      if (group) {
        let pmName: string | null = null;
        if (group.platform_manager_id) {
          const { data: pm } = await supabase
            .from("platform_managers")
            .select("name")
            .eq("id", group.platform_manager_id)
            .single();
          pmName = pm?.name || null;
        }
        setGroupInfo({ name: group.name, platform_manager_name: pmName });
      }
    };

    fetchGroup();
  }, [profile?.group_id]);

  const form = useForm<ProfessionalInfoValues>({
    resolver: zodResolver(professionalInfoSchema),
    defaultValues: {
      npiNumber: "",
      deaNumber: "",
      specialties: [{ specialty: undefined }],
      licenses: [{ licenseNumber: "", state: undefined }],
      certifications: [{ certification: "" }],
      educationTraining: [{ education: "" }],
      languages: [{ language: undefined }],
      associations: [{ association: "" }],
      yearsOfExperience: undefined,
      professionalBio: "",
    },
    mode: "onChange",
  });

  // Persist form data to localStorage
  // Note: Always enabled - allows draft saving for both new and existing profiles
  const { clearPersistedData } = useFormPersistence({
    storageKey: `provider-professional-info-${profile?.user_id || 'draft'}`,
    watch: form.watch,
    setValue: form.setValue,
    disabled: false,
  });

  useEffect(() => {
    if (profile) {
      const specialties = safeParseTyped<{ specialty?: string }>(
        profile.specialties,
      );
      const licenses = safeParseTyped<{
        licenseNumber?: string;
        state?: string;
      }>(profile.medical_licenses);
      const certifications = safeParseTyped<{ certification?: string }>(
        profile.board_certifications,
      );
      const education = safeParseTyped<{ education?: string }>(
        profile.education_training,
      );
      const languages = safeParseTyped<{ language?: string }>(
        profile.languages_spoken,
      );
      const associations = safeParseTyped<{ association?: string }>(
        profile.professional_associations,
      );

      form.reset({
        npiNumber: profile.npi_number || "",
        deaNumber: profile.dea_number || "",
        specialties:
          specialties.length > 0 ? specialties : [{ specialty: undefined }],
        licenses:
          licenses.length > 0
            ? licenses
            : [{ licenseNumber: "", state: undefined }],
        certifications:
          certifications.length > 0 ? certifications : [{ certification: "" }],
        educationTraining:
          education.length > 0 ? education : [{ education: "" }],
        languages: languages.length > 0 ? languages : [{ language: undefined }],
        associations:
          associations.length > 0 ? associations : [{ association: "" }],
        yearsOfExperience: profile.years_of_experience ?? undefined,
        professionalBio: profile.professional_bio || "",
      });
    }
  }, [profile, form]);

  async function onSubmit(data: ProfessionalInfoValues) {
    const success = await updateProfessionalInfo(data);
    if (success) {
      clearPersistedData();
      form.reset(form.getValues());
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Professional Information
        </h2>
      </div>

      <Form {...form}>
        <form
          id="professional-info-form"
          onSubmit={form.handleSubmit((data) => guardAction(() => onSubmit(data)))}
          className="p-6 space-y-6"
        >
          {groupInfo && (
            <>
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Group Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group</Label>
                    <Input
                      id="groupName"
                      value={groupInfo.name}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platformManager">Platform Manager</Label>
                    <Input
                      id="platformManager"
                      value={groupInfo.platform_manager_name || "Not assigned"}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200" />
            </>
          )}

          <NPISection form={form} />

          <Separator className="bg-gray-200" />

          <SpecialtiesSection form={form} />

          <Separator className="bg-gray-200" />

          <MedicalLicenseSection form={form} />

          <Separator className="bg-gray-200" />

          <BoardCertificationSection form={form} />

          <Separator className="bg-gray-200" />

          <EducationTrainingSection form={form} />

          <Separator className="bg-gray-200" />

          <LanguagesSpokenSection form={form} />

          <Separator className="bg-gray-200" />

          <ProfessionalAssociationsSection form={form} />

          <Separator className="bg-gray-200" />

          <YearsOfExperienceSection form={form} />

          <Separator className="bg-gray-200" />

          <ProfessionalBioSection form={form} />

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="default"
              className="px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
