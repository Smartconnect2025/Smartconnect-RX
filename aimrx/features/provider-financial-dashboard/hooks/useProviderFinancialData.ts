import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { getProviderTierDiscount } from "@core/services/pricing/tierDiscountService";
import type { FinancialPrescription, MonthFilter, TierInfo } from "../types";

export function useProviderFinancialData(monthFilter: MonthFilter) {
  const [prescriptions, setPrescriptions] = useState<FinancialPrescription[]>(
    [],
  );
  const [tierInfo, setTierInfo] = useState<TierInfo>({
    discountPercentage: 0,
    tierName: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const supabase = createClient();

  // Fetch tier discount once when user changes
  useEffect(() => {
    const fetchTier = async () => {
      if (!user?.id) return;
      const result = await getProviderTierDiscount(supabase, user.id);
      setTierInfo({
        discountPercentage: result.discountPercentage,
        tierName: result.tierName,
      });
    };
    fetchTier();
  }, [user?.id, supabase]);

  // Fetch prescriptions when month filter or user changes
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

  // Derive totals from prescriptions + tier info (no extra fetches)
  const totalProfitCents = useMemo(
    () => prescriptions.reduce((sum, rx) => sum + (rx.profit_cents || 0), 0),
    [prescriptions],
  );

  const totalDiscountCents = useMemo(() => {
    if (tierInfo.discountPercentage === 0) return 0;
    return prescriptions.reduce((sum, rx) => {
      const basePrice = rx.medication_data?.aimrx_site_pricing_cents ?? null;
      if (basePrice == null) return sum;
      return sum + Math.round(basePrice * (tierInfo.discountPercentage / 100));
    }, 0);
  }, [prescriptions, tierInfo.discountPercentage]);

  return {
    prescriptions,
    totalProfitCents,
    totalDiscountCents,
    tierInfo,
    isLoading,
    error,
  };
}
