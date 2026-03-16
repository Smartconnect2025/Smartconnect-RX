"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@core/supabase/client";
import { toast } from "sonner";

interface Appointment {
  id: string;
  datetime: string;
  duration: number;
  type: string;
  reason: string;
  provider_id: string;
  patient_id: string;
  provider?: {
    id: string;
    name: string;
    specialty?: string;
    avatar_url?: string;
  };
}

interface UseAppointmentReturn {
  appointment: Appointment | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateAppointment: (updates: Partial<Appointment>) => Promise<boolean>;
  cancelAppointment: () => Promise<boolean>;
  rescheduleAppointment: (newDateTime: string) => Promise<boolean>;
}

export function useAppointment(appointmentId?: string): UseAppointmentReturn {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) {
      setAppointment(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("appointments")
        .select(
          `
          *,
          provider:providers(
            id,
            name,
            specialty,
            avatar_url
          )
        `,
        )
        .eq("id", appointmentId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setAppointment(data as Appointment);
    } catch (err) {
      console.error("Error fetching appointment:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch appointment",
      );
      toast.error("Failed to load appointment details");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, supabase]);

  const updateAppointment = useCallback(
    async (updates: Partial<Appointment>): Promise<boolean> => {
      if (!appointmentId) return false;

      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("appointments")
          .update(updates)
          .eq("id", appointmentId);

        if (updateError) {
          throw updateError;
        }

        // Refresh the appointment data
        await fetchAppointment();
        toast.success("Appointment updated successfully");
        return true;
      } catch (err) {
        console.error("Error updating appointment:", err);
        setError(
          err instanceof Error ? err.message : "Failed to update appointment",
        );
        toast.error("Failed to update appointment");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [appointmentId, supabase, fetchAppointment],
  );

  const cancelAppointment = useCallback(async (): Promise<boolean> => {
    if (!appointmentId) return false;

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

      if (deleteError) {
        throw deleteError;
      }

      setAppointment(null);
      toast.success("Appointment cancelled successfully");
      return true;
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      setError(
        err instanceof Error ? err.message : "Failed to cancel appointment",
      );
      toast.error("Failed to cancel appointment");
      return false;
    } finally {
      setLoading(false);
    }
  }, [appointmentId, supabase]);

  const rescheduleAppointment = useCallback(
    async (newDateTime: string): Promise<boolean> => {
      if (!appointmentId) return false;

      return updateAppointment({ datetime: newDateTime });
    },
    [appointmentId, updateAppointment],
  );

  const refetch = useCallback(async () => {
    await fetchAppointment();
  }, [fetchAppointment]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  return {
    appointment,
    loading,
    error,
    refetch,
    updateAppointment,
    cancelAppointment,
    rescheduleAppointment,
  };
}
