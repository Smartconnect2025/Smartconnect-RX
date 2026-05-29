"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";

import { HospitalAffiliationsSection } from "../practice-details/HospitalAffiliationsSection";
import { InsurancePlansSection } from "../practice-details/InsurancePlansSection";
import { ServicesSection } from "../practice-details/ServicesSection";
import {
  practiceDetailsSchema,
  PracticeDetailsValues,
} from "../practice-details/types";
import { useProviderProfile } from "../../hooks/use-provider-profile";
import { safeParseTyped } from "../../utils/json-parsers";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useDemoGuard } from "@/hooks/use-demo-guard";

export function PracticeDetailsForm() {
  const { profile, updatePracticeDetails, isSubmitting } = useProviderProfile();
  const { guardAction } = useDemoGuard();

  const form = useForm<PracticeDetailsValues>({
    resolver: zodResolver(practiceDetailsSchema),
    defaultValues: {
      services: [{ service: undefined }],
      insurancePlans: [{ insurancePlan: undefined }],
      hospitalAffiliations: [{ affiliation: "" }],
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (profile) {
      const services = safeParseTyped<{ service?: string }>(
        profile.services_offered,
      );
      const insurancePlans = safeParseTyped<{ insurancePlan?: string }>(
        profile.insurance_plans_accepted,
      );
      const affiliations = safeParseTyped<{ affiliation?: string }>(
        profile.hospital_affiliations,
      );

      form.reset({
        services: services.length > 0 ? services : [{ service: undefined }],
        insurancePlans:
          insurancePlans.length > 0
            ? insurancePlans
            : [{ insurancePlan: undefined }],
        hospitalAffiliations:
          affiliations.length > 0 ? affiliations : [{ affiliation: "" }],
      });
    }
  }, [profile, form]);

  async function onSubmit(data: PracticeDetailsValues) {
    const success = await updatePracticeDetails(data);
    if (success) {
      // Form data is already updated via the hook's setProfile call
      // The form will re-render with the latest data from the database
      form.reset(form.getValues()); // Reset form state to clear validation
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Practice Details
        </h2>
      </div>

      <Form {...form}>
        <form
          id="practice-details-form"
          onSubmit={form.handleSubmit((data) => guardAction(() => onSubmit(data)))}
          className="p-6 space-y-6"
        >
          <ServicesSection form={form} />

          <Separator className="bg-gray-200" />

          <InsurancePlansSection form={form} />

          <Separator className="bg-gray-200" />

          <HospitalAffiliationsSection form={form} />

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
