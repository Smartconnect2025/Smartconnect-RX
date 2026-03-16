"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@core/auth";
import {
  IntakeLayout,
  MedicalHistoryForm,
  useIntakeProgress,
  getStepNumber,
} from "@/features/intake";
import type { MedicalHistoryFormData } from "@/features/intake";
import { Skeleton } from "@/components/ui/skeleton";

export default function MedicalHistoryPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { patient, isLoading, isSaving, saveStepData } =
    useIntakeProgress();

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
      // If not yet completed step 1, go back
      if (step < 2) {
        router.push("/intake/patient-information");
      }
      // If already past this step, go forward
      else if (step > 2) {
        if (step === 3) router.push("/intake/insurance");
        else if (step === 4) router.push("/intake/consent");
        else if (step >= 5) router.push("/");
      }
    }
  }, [isLoading, patient, router]);

  const handleSubmit = async (data: MedicalHistoryFormData) => {
    // Parse comma-separated strings into arrays
    const allergies = data.allergies
      ? data.allergies.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const medications = data.medications
      ? data.medications.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const medicalConditions = data.medical_conditions
      ? data.medical_conditions.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    await saveStepData(
      {
        height: data.height,
        weight: data.weight,
        blood_type: data.blood_type,
        allergies,
        medications,
        medical_conditions: medicalConditions,
      },
      "medical_history_completed"
    );
  };

  if (isLoading || isUserLoading) {
    return (
      <IntakeLayout currentStep={2}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </IntakeLayout>
    );
  }

  // Get default values from existing patient data
  const defaultValues: Partial<MedicalHistoryFormData> = {
    height: patient?.data?.height || "",
    weight: patient?.data?.weight || "",
    blood_type: patient?.data?.blood_type || "",
    allergies: patient?.data?.allergies?.join(", ") || "",
    medications: patient?.data?.medications?.join(", ") || "",
    medical_conditions: patient?.data?.medical_conditions?.join(", ") || "",
  };

  return (
    <IntakeLayout currentStep={2}>
      <MedicalHistoryForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        userId={user?.id}
      />
    </IntakeLayout>
  );
}
