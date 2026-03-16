"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@core/auth";
import {
  IntakeLayout,
  PatientInfoForm,
  useIntakeProgress,
  getStepNumber,
} from "@/features/intake";
import type { PatientInfoFormData } from "@/features/intake";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientInformationPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { patient, isLoading, isSaving, savePatientInfo } = useIntakeProgress();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth/login");
    }
  }, [isUserLoading, user, router]);

  // Redirect if already past this step
  useEffect(() => {
    if (!isLoading && patient?.data?.intake_step) {
      const step = getStepNumber(patient.data.intake_step);
      if (step > 1) {
        // Redirect to the appropriate step
        if (step === 2) router.push("/intake/medical-history");
        else if (step === 3) router.push("/intake/insurance");
        else if (step === 4) router.push("/intake/consent");
        else if (step >= 5) router.push("/");
      }
    }
  }, [isLoading, patient, router]);

  const handleSubmit = async (data: PatientInfoFormData) => {
    await savePatientInfo({
      first_name: data.first_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
      phone: data.phone,
      email: data.email,
      physical_address: {
        street: data.street,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      },
      data: {
        gender: data.gender,
      },
    });
  };

  if (isLoading || isUserLoading) {
    return (
      <IntakeLayout currentStep={1}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </IntakeLayout>
    );
  }

  // Get default values from existing patient or user
  // Support both zipCode (new) and zip (legacy) for reading existing data
  const physicalAddress = patient?.physical_address as
    | {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        zip?: string;
      }
    | undefined;
  const defaultValues: Partial<PatientInfoFormData> = {
    first_name: patient?.first_name || "",
    last_name: patient?.last_name || "",
    date_of_birth: patient?.date_of_birth || "",
    phone: patient?.phone || "",
    email: patient?.email || user?.email || "",
    gender: patient?.data?.gender || "",
    street: physicalAddress?.street || "",
    city: physicalAddress?.city || "",
    state: physicalAddress?.state || "",
    zipCode: physicalAddress?.zipCode || physicalAddress?.zip || "",
  };

  return (
    <IntakeLayout currentStep={1}>
      <PatientInfoForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        userId={user?.id}
      />
    </IntakeLayout>
  );
}
