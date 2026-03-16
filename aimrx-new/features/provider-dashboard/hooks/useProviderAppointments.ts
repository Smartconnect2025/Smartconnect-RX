"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@core/supabase/client";
import { useUser } from "@core/auth";

// Local type definition for appointments with patient data
export interface ProviderAppointment {
  id: string;
  datetime: string;
  provider_id: string;
  patient_id: string;
  duration?: number;
  type?: string;
  reason?: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function useProviderAppointments() {
  const { user } = useUser();
  const [appointments, setAppointments] = useState<ProviderAppointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<
    ProviderAppointment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [pastLoading, setPastLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const fetchedForProviderIdRef = useRef<string | null>(null);
  const initializedForUserRef = useRef<string | null>(null);

  // Get provider ID from user ID
  const fetchProviderId = useCallback(async () => {
    if (!user?.id) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows

    if (error) {
      console.error("Error fetching provider:", error);
      return null;
    }

    // If no provider record exists, create one
    if (!data) {
      const emailPrefix = user.email?.split("@")[0] || "Provider";
      const { data: newProvider, error: createError } = await supabase
        .from("providers")
        .insert({
          user_id: user.id,
          first_name: emailPrefix,
          last_name: "",
          is_active: true,
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating provider record:", createError);
        return null;
      }

      return newProvider?.id || null;
    }

    return data.id;
  }, [user?.id, user?.email]);

  // Fetch past appointments for the provider (last 24 hours)
  const fetchPastAppointments = useCallback(async () => {
    if (!providerId) {
      setPastAppointments([]);
      setPastLoading(false);
      return;
    }

    setPastLoading(true);
    setPastError(null);
    const supabase = createClient();

    try {
      // Calculate 24 hours ago
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // Step 1: Fetch past appointments
      const { data: appointmentsData, error: appointmentsError } =
        await supabase
          .from("appointments")
          .select("*")
          .eq("provider_id", providerId)
          .gte("datetime", twentyFourHoursAgo.toISOString())
          .lt("datetime", new Date().toISOString())
          .order("datetime", { ascending: false });

      if (appointmentsError) {
        console.error("Error fetching past appointments:", appointmentsError);
        setPastError(appointmentsError.message);
        setPastAppointments([]);
        return;
      }

      if (!appointmentsData || appointmentsData.length === 0) {
        setPastAppointments([]);
        return;
      }

      // Step 2: Get unique patient IDs from appointments
      const patientIds = [
        ...new Set(appointmentsData.map((a) => a.patient_id)),
      ].filter(Boolean);

      if (patientIds.length === 0) {
        // No patient IDs found, return appointments with placeholder data
        const appointmentsWithPlaceholder = appointmentsData.map(
          (appointment) => ({
            ...appointment,
            patient: {
              id: appointment.patient_id || "unknown",
              first_name: "Unknown",
              last_name: "Patient",
              email: "unknown@email.com",
            },
          }),
        );
        setPastAppointments(
          appointmentsWithPlaceholder as ProviderAppointment[],
        );
        return;
      }

      // Step 3: Fetch all patients for these IDs
      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .in("id", patientIds)
        .eq("is_active", true);

      if (patientsError) {
        console.error(
          "Error fetching patients for past appointments:",
          patientsError,
        );
        setPastError(patientsError.message);
        setPastAppointments([]);
        return;
      }

      // Step 4: Create a map of patients by ID for quick lookup
      const patientsMap = new Map(
        (patientsData || []).map((patient) => [patient.id, patient]),
      );

      // Step 5: Combine appointments with patient data
      const appointmentsWithPatients = appointmentsData.map((appointment) => {
        const patient = patientsMap.get(appointment.patient_id);

        return {
          ...appointment,
          patient: patient || {
            id: appointment.patient_id || "unknown",
            first_name: "Unknown",
            last_name: "Patient",
            email: "unknown@email.com",
          },
        };
      });

      setPastAppointments(appointmentsWithPatients as ProviderAppointment[]);
    } catch (err) {
      console.error("Error fetching past appointments:", err);
      setPastError(
        err instanceof Error
          ? err.message
          : "Failed to fetch past appointments",
      );
      setPastAppointments([]);
    } finally {
      setPastLoading(false);
    }
  }, [providerId]);

  // Fetch appointments for the provider
  const fetchAppointments = useCallback(async () => {
    if (!providerId) {
      setAppointments([]);
      setLoading(false);
      fetchedForProviderIdRef.current = null;
      return;
    }

    if (fetchedForProviderIdRef.current === providerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // Step 1: Fetch appointments
      const { data: appointmentsData, error: appointmentsError } =
        await supabase
          .from("appointments")
          .select("*")
          .eq("provider_id", providerId)
          .gte("datetime", new Date().toISOString())
          .order("datetime", { ascending: true });

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
        setError(appointmentsError.message);
        setAppointments([]);
        fetchedForProviderIdRef.current = null;
        return;
      }

      if (!appointmentsData || appointmentsData.length === 0) {
        setAppointments([]);
        fetchedForProviderIdRef.current = providerId;
        return;
      }

      // Step 2: Get unique patient IDs from appointments
      const patientIds = [
        ...new Set(appointmentsData.map((a) => a.patient_id)),
      ].filter(Boolean);

      if (patientIds.length === 0) {
        // No patient IDs found, return appointments with placeholder data
        const appointmentsWithPlaceholder = appointmentsData.map(
          (appointment) => ({
            ...appointment,
            patient: {
              id: appointment.patient_id || "unknown",
              first_name: "Unknown",
              last_name: "Patient",
              email: "unknown@email.com",
            },
          }),
        );
        setAppointments(appointmentsWithPlaceholder as ProviderAppointment[]);
        fetchedForProviderIdRef.current = providerId;
        return;
      }

      // Step 3: Fetch all patients for these IDs
      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, first_name, last_name, email")
        .in("id", patientIds)
        .eq("is_active", true);

      if (patientsError) {
        console.error("Error fetching patients:", patientsError);
        setError(patientsError.message);
        setAppointments([]);
        fetchedForProviderIdRef.current = null;
        return;
      }

      // Step 4: Create a map of patients by ID for quick lookup
      const patientsMap = new Map(
        (patientsData || []).map((patient) => [patient.id, patient]),
      );

      // Step 5: Combine appointments with patient data
      const appointmentsWithPatients = appointmentsData.map((appointment) => {
        const patient = patientsMap.get(appointment.patient_id);

        return {
          ...appointment,
          patient: patient || {
            id: appointment.patient_id || "unknown",
            first_name: "Unknown",
            last_name: "Patient",
            email: "unknown@email.com",
          },
        };
      });

      setAppointments(appointmentsWithPatients as ProviderAppointment[]);
      fetchedForProviderIdRef.current = providerId;
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch appointments",
      );
      setAppointments([]);
      fetchedForProviderIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // Initialize provider ID
  useEffect(() => {
    const initializeData = async () => {
      if (!user?.id) {
        setProviderId(null);
        setAppointments([]);
        fetchedForProviderIdRef.current = null;
        initializedForUserRef.current = null;
        setLoading(false);
        return;
      }

      // Only initialize if we haven't done so for this user
      if (initializedForUserRef.current === user.id) {
        return;
      }

      setLoading(true);
      const fetchedProviderIdValue = await fetchProviderId();
      if (fetchedProviderIdValue) {
        setProviderId(fetchedProviderIdValue);
        initializedForUserRef.current = user.id;
      } else {
        setError("Provider not found for current user");
        setProviderId(null);
        setAppointments([]);
        fetchedForProviderIdRef.current = null;
        initializedForUserRef.current = null;
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id, fetchProviderId]);

  // Fetch appointments when provider ID is available or changes
  useEffect(() => {
    if (providerId) {
      fetchAppointments();
      fetchPastAppointments();
    }
    // ESLint disable: These functions should only run when providerId changes, not when functions are recreated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const cancelAppointment = useCallback(async (appointmentId: string) => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

      if (error) {
        setError(error.message);
        return false;
      } else {
        // Remove from local state
        setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
        return true;
      }
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      setError(
        err instanceof Error ? err.message : "Failed to cancel appointment",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    appointments,
    pastAppointments,
    loading,
    pastLoading,
    error,
    pastError,
    providerId,
    fetchAppointments,
    fetchPastAppointments,
    cancelAppointment,
  };
}
