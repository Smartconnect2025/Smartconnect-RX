"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import type { PatientProfile, ProviderInfo } from "../types";

interface UsePatientProfileReturn {
  patient: PatientProfile | null;
  provider: ProviderInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePatientProfile(): UsePatientProfileReturn {
  const supabase = createClient();
  const { user } = useUser();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatientProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch patient data
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (patientError) {
        if (patientError.code === "PGRST116") {
          // No patient record found - this is okay for new users
          setPatient(null);
        } else {
          throw patientError;
        }
      } else {
        setPatient(patientData as PatientProfile);

        // If patient has a provider, fetch provider info
        if (patientData?.provider_id) {
          const { data: providerData, error: providerError } = await supabase
            .from("providers")
            .select(
              "id, first_name, last_name, email, phone_number, specialty, specialties, professional_bio, avatar_url"
            )
            .eq("id", patientData.provider_id)
            .single();

          if (!providerError && providerData) {
            setProvider(providerData as ProviderInfo);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching patient profile:", err);
      setError("Failed to load profile data");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    fetchPatientProfile();
  }, [fetchPatientProfile]);

  return {
    patient,
    provider,
    isLoading,
    error,
    refetch: fetchPatientProfile,
  };
}
