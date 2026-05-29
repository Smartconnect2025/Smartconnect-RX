/**
 * Pricing Calculation Service
 *
 * Centralized pricing logic for prescription medications.
 * All pricing calculations should go through this service to ensure consistency
 * and prevent client-side manipulation.
 */

export interface PricingCalculation {
  pharmacyCost: number;
  patientPrice: number;
}

/**
 * Calculate final patient price from acquisition cost
 *
 * @param acquisitionCost - The medication price (aimrx_site_pricing) in dollars
 * @returns Pricing calculation
 */
export function calculateFinalPrice(
  acquisitionCost: number,
): PricingCalculation {
  if (acquisitionCost < 0) {
    throw new Error("Acquisition cost cannot be negative");
  }

  return {
    pharmacyCost: Number(acquisitionCost.toFixed(2)),
    patientPrice: Number(acquisitionCost.toFixed(2)),
  };
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format price as currency string
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Calculate provider profit from a prescription
 *
 * @param patientPrice - What patient pays
 * @param acquisitionCost - What pharmacy charges provider
 * @returns Provider's profit in dollars
 */
export function calculateProviderProfit(
  patientPrice: number,
  acquisitionCost: number
): number {
  const profit = patientPrice - acquisitionCost;
  return Number(profit.toFixed(2));
}
