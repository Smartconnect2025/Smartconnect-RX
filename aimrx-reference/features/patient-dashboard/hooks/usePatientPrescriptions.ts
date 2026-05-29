"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import type { PatientPrescription } from "../types";

interface UsePatientPrescriptionsReturn {
  prescriptions: PatientPrescription[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePatientPrescriptions(): UsePatientPrescriptionsReturn {
  const supabase = createClient();
  const { user } = useUser();
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First get the patient record to get patient_id
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (patientError || !patientData) {
        setPrescriptions([]);
        setIsLoading(false);
        return;
      }

      // Fetch prescriptions for this patient
      const { data: prescriptionData, error: prescriptionError } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          queue_id,
          medication,
          dosage,
          quantity,
          refills,
          status,
          submitted_at,
          tracking_number,
          patient_price,
          pharmacy:pharmacies(name, primary_color)
        `
        )
        .eq("patient_id", patientData.id)
        .order("submitted_at", { ascending: false })
        .limit(5);

      if (prescriptionError) {
        throw prescriptionError;
      }

      const formatted: PatientPrescription[] = (prescriptionData || []).map((rx) => {
        const pharmacy = Array.isArray(rx.pharmacy) ? rx.pharmacy[0] : rx.pharmacy;
        return {
          id: rx.id,
          queue_id: rx.queue_id,
          medication: rx.medication,
          dosage: rx.dosage,
          quantity: rx.quantity,
          refills: rx.refills,
          status: rx.status || "submitted",
          submitted_at: rx.submitted_at,
          tracking_number: rx.tracking_number,
          patient_price: rx.patient_price,
          pharmacy_name: pharmacy?.name,
          pharmacy_color: pharmacy?.primary_color,
        };
      });

      setPrescriptions(formatted);
    } catch (err) {
      console.error("Error fetching prescriptions:", err);
      setError("Failed to load prescriptions");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  return {
    prescriptions,
    isLoading,
    error,
    refetch: fetchPrescriptions,
  };
}
