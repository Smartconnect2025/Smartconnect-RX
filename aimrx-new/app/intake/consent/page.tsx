"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@core/auth";
import {
  IntakeLayout,
  ConsentForm,
  useIntakeProgress,
  getStepNumber,
} from "@/features/intake";
import { clearAllIntakeData } from "@/features/intake/utils/intakeStorage";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConsentPage() {
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
      // If not yet completed step 3, go back
      if (step < 4) {
        if (step < 2) router.push("/intake/patient-information");
        else if (step < 3) router.push("/intake/medical-history");
        else router.push("/intake/insurance");
      }
      // If already completed, go to dashboard
      else if (step >= 5) {
        router.push("/");
      }
    }
  }, [isLoading, patient, router]);

  const handleSubmit = async () => {
    await saveStepData(
      {
        consent_accepted: true,
        consent_accepted_at: new Date().toISOString(),
      },
      "completed"
    );

    // Clear all intake form drafts from localStorage after successful completion
    if (user?.id) {
      clearAllIntakeData(user.id);
    }
  };

  if (isLoading || isUserLoading) {
    return (
      <IntakeLayout currentStep={4}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </IntakeLayout>
    );
  }

  return (
    <IntakeLayout currentStep={4}>
      <ConsentForm onSubmit={handleSubmit} isSubmitting={isSaving} />
    </IntakeLayout>
  );
}
