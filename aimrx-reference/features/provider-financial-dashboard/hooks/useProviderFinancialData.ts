import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
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

  // Fetch the EFFECTIVE tier discount (same helper used by catalog, wizard
  // step 3, and checkout) so the dashboard's displayed rate matches what
  // patients are actually charged. For a delegate without an own tier, this
  // falls back to the supervising provider's tier; if she has a per-assistant
  // override on her own providers row, that wins. We hit the API route
  // (rather than calling the service directly) because the fallback path
  // requires the admin client which isn't available in the browser.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchTier = async () => {
      try {
        const res = await fetch("/api/provider/effective-tier-discount", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const result = (await res.json()) as {
          discountPercentage: number;
          tierName: string | null;
        };
        if (cancelled) return;
        setTierInfo({
          discountPercentage: result.discountPercentage,
          tierName: result.tierName,
        });
      } catch {
        /* non-fatal — leaves tierInfo at the 0% default */
      }
    };
    fetchTier();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
