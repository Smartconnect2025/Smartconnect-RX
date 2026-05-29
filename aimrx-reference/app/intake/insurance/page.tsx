"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@core/auth";
import {
  IntakeLayout,
  InsuranceForm,
  useIntakeProgress,
  getStepNumber,
} from "@/features/intake";
import type { InsuranceFormData } from "@/features/intake";
import { Skeleton } from "@/components/ui/skeleton";

export default function InsurancePage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { patient, isLoading, isSaving, saveStepData } = useIntakeProgress();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth/login");
    }
  }, [isUserLoading, user, router]);

  // Redirect based on intake status
  useEffect(() => {
    if (!isLoading) {
      // If no patient record, go back to step 1
      if (!patient) {
        router.push("/intake/patient-information");
        return;
      }

      const step = getStepNumber(patient.data?.intake_step);
      // If not yet completed step 2, go back
      if (step < 3) {
        if (step < 2) router.push("/intake/patient-information");
        else router.push("/intake/medical-history");
      }
      // If already past this step, go forward
      else if (step > 3) {
        if (step === 4) router.push("/intake/consent");
        else if (step >= 5) router.push("/");
      }
    }
  }, [isLoading, patient, router]);

  const handleSubmit = async (data: InsuranceFormData) => {
    await saveStepData(
      {
        insurance_provider: data.insurance_provider,
        insurance_policy_number: data.insurance_policy_number,
        insurance_group_number: data.insurance_group_number,
      },
      "insurance_completed"
    );
  };

  if (isLoading || isUserLoading) {
    return (
      <IntakeLayout currentStep={3}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </IntakeLayout>
    );
  }

  // Get default values from existing patient data
  const defaultValues: Partial<InsuranceFormData> = {
    insurance_provider: patient?.data?.insurance_provider || "",
    insurance_policy_number: patient?.data?.insurance_policy_number || "",
    insurance_group_number: patient?.data?.insurance_group_number || "",
  };

  return (
    <IntakeLayout currentStep={3}>
      <InsuranceForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        userId={user?.id}
      />
    </IntakeLayout>
  );
}
