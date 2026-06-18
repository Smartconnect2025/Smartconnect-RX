import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-pharmacy patient fee controls.
 *
 * Three admin toggles on the pharmacies table decide whether each patient fee
 * is charged and shown:
 *   - showDeliveryFee   -> the shipping / delivery fee
 *   - showTechnologyFee -> the flat Technology Platform Access Fee
 *   - showProviderFee   -> provider oversight / extra charges (profit_cents)
 *
 * Only an explicit `false` disables a fee. null / missing / error all
 * "fail open" to charging, so a glitch never silently drops a fee.
 */

/** Flat Technology Platform Access Fee, in cents ($25). */
export const PLATFORM_FEE_CENTS = 2500;

export interface PharmacyFeeFlags {
  showDeliveryFee: boolean;
  showTechnologyFee: boolean;
  showProviderFee: boolean;
}

export const DEFAULT_PHARMACY_FEE_FLAGS: PharmacyFeeFlags = {
  showDeliveryFee: true,
  showTechnologyFee: true,
  showProviderFee: true,
};

export async function getPharmacyFeeFlags(
  supabase: SupabaseClient,
  pharmacyId: string | null | undefined,
): Promise<PharmacyFeeFlags> {
  if (!pharmacyId) return { ...DEFAULT_PHARMACY_FEE_FLAGS };
  try {
    const { data } = await supabase
      .from("pharmacies")
      .select("show_delivery_fee, show_technology_fee, show_provider_fee")
      .eq("id", pharmacyId)
      .maybeSingle();
    if (!data) return { ...DEFAULT_PHARMACY_FEE_FLAGS };
    return {
      showDeliveryFee: data.show_delivery_fee !== false,
      showTechnologyFee: data.show_technology_fee !== false,
      showProviderFee: data.show_provider_fee !== false,
    };
  } catch {
    return { ...DEFAULT_PHARMACY_FEE_FLAGS };
  }
}
