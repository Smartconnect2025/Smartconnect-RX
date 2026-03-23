import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import type { FinancialPrescription, MonthFilter } from "../types";

export function useProviderFinancialData(monthFilter: MonthFilter) {
  const [prescriptions, setPrescriptions] = useState<FinancialPrescription[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    const startOfMonth = new Date(
      monthFilter.year,
      monthFilter.month,
      1,
    ).toISOString();
    const startOfNextMonth = new Date(
      monthFilter.year,
      monthFilter.month + 1,
      1,
    ).toISOString();

    const { data, error: fetchError } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        medication,
        patient:patients(first_name, last_name),
        profit_cents,
        payment_status,
        submitted_at,
        medication_data:pharmacy_medications(aimrx_site_pricing_cents)
      `,
      )
      .eq("prescriber_id", user.id)
      .gte("submitted_at", startOfMonth)
      .lt("submitted_at", startOfNextMonth)
      .order("submitted_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setPrescriptions([]);
    } else {
      setPrescriptions(
        (data || []) as unknown as FinancialPrescription[],
      );
    }

    setIsLoading(false);
  }, [user?.id, monthFilter.year, monthFilter.month, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalProfitCents = useMemo(
    () => prescriptions.reduce((sum, rx) => sum + (rx.profit_cents || 0), 0),
    [prescriptions],
  );

  return {
    prescriptions,
    totalProfitCents,
    isLoading,
    error,
  };
}
