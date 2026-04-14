import { createAdminClient } from "@core/database/client";
import type { PharmacyBranding } from "./emailTemplates";

const brandingCache = new Map<string, { branding: PharmacyBranding; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPharmacyBranding(pharmacyId: string): Promise<PharmacyBranding | undefined> {
  if (!pharmacyId) return undefined;

  const cached = brandingCache.get(pharmacyId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.branding;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pharmacies")
    .select("name, logo_url, primary_color, phone, address, tagline")
    .eq("id", pharmacyId)
    .single();

  if (error || !data) return undefined;

  const branding: PharmacyBranding = {
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    phone: data.phone,
    address: data.address,
    tagline: data.tagline,
  };

  brandingCache.set(pharmacyId, { branding, ts: Date.now() });
  return branding;
}

export function getFromName(branding?: PharmacyBranding): string {
  return branding?.name || "SmartConnect RX";
}
