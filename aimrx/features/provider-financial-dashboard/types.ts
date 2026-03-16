export interface FinancialPrescription {
  id: string;
  medication: string;
  patient: { first_name: string; last_name: string } | null;
  profit_cents: number | null;
  payment_status: string | null;
  submitted_at: string;
  medication_data: { aimrx_site_pricing_cents: number | null } | null;
}

export interface MonthFilter {
  year: number;
  month: number;
}

export interface TierInfo {
  discountPercentage: number;
  tierName: string | null;
}
