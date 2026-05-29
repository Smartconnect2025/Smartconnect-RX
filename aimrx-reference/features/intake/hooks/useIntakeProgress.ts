"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { toast } from "sonner";
import type { IntakeData, IntakeStep } from "../types";
import { getStepNumber, getNextStepPath } from "../types";

interface UseIntakeProgressReturn {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    phone?: string;
    email?: string;
    physical_address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
    data?: IntakeData;
  } | null;
  currentStep: number;
  isLoading: boolean;
  isSaving: boolean;
  saveStepData: (
    stepData: Partial<IntakeData>,
    nextStep: IntakeStep,
  ) => Promise<boolean>;
  savePatientInfo: (patientData: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    phone: string;
    email: string;
    physical_address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    data: Partial<IntakeData>;
  }) => Promise<boolean>;
}

export function useIntakeProgress(): UseIntakeProgressReturn {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useUser();
  const [patient, setPatient] =
    useState<UseIntakeProgressReturn["patient"]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch patient data on mount
  useEffect(() => {
    async function fetchPatient() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, first_name, last_name, date_of_birth, phone, email, physical_address, data",
        )
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching patient:", error);
      }

      setPatient(data || null);
      setIsLoading(false);
    }

    fetchPatient();
  }, [supabase, user?.id]);

  const currentStep = getStepNumber(patient?.data?.intake_step);

  // Save patient info (step 1) - creates or updates patient record
  const savePatientInfo = useCallback(
    async (patientData: {
      first_name: string;
      last_name: string;
      date_of_birth: string;
      phone: string;
      email: string;
      physical_address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
      };
      data: Partial<IntakeData>;
    }): Promise<boolean> => {
      if (!user?.id) return false;

      setIsSaving(true);
      try {
        const intakeData: IntakeData = {
          ...patient?.data,
          ...patientData.data,
          intake_step: "patient_information_completed",
        };

        if (patient?.id) {
          // Update existing patient
          const { error } = await supabase
            .from("patients")
            .update({
              first_name: patientData.first_name,
              last_name: patientData.last_name,
              date_of_birth: patientData.date_of_birth,
              phone: patientData.phone,
              email: patientData.email,
              physical_address: patientData.physical_address,
              data: intakeData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", patient.id);

          if (error) throw error;
        } else {
          // Create new patient
          const { error } = await supabase.from("patients").insert({
            user_id: user.id,
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            date_of_birth: patientData.date_of_birth,
            phone: patientData.phone,
            email: patientData.email,
            physical_address: patientData.physical_address,
            data: intakeData,
          });

          if (error) throw error;
        }

        toast.success("Information saved!");
        router.push(getNextStepPath(1));
        return true;
      } catch (error) {
        console.error("Error saving patient info:", error);
        toast.error("Failed to save information. Please try again.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [supabase, user?.id, patient, router],
  );

  // Save step data (steps 2-4)
  const saveStepData = useCallback(
    async (
      stepData: Partial<IntakeData>,
      nextStep: IntakeStep,
    ): Promise<boolean> => {
      if (!patient?.id) {
        toast.error("Patient record not found. Please complete step 1 first.");
        router.push("/intake/patient-information");
        return false;
      }

      setIsSaving(true);
      try {
        const updatedData: IntakeData = {
          ...patient.data,
          ...stepData,
          intake_step: nextStep,
          ...(nextStep === "completed" && {
            intake_completed_at: new Date().toISOString(),
          }),
        };

        const { error } = await supabase
          .from("patients")
          .update({
            data: updatedData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", patient.id);

        if (error) throw error;

        toast.success("Information saved!");

        const currentStepNum = getStepNumber(patient.data?.intake_step);
        router.push(getNextStepPath(currentStepNum + 1));
        return true;
      } catch (error) {
        console.error("Error saving step data:", error);
        toast.error("Failed to save information. Please try again.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [supabase, patient, router],
  );

  return {
    patient,
    currentStep,
    isLoading,
    isSaving,
    saveStepData,
    savePatientInfo,
  };
}
