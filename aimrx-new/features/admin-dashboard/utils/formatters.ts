/**
 * Admin Dashboard Utility Functions
 * Formatting and utility functions for admin dashboard components
 */

/**
 * Format a number with proper locale formatting
 * @param num - The number to format
 * @returns Formatted number string
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

/**
 * Format growth percentage with proper sign
 * @param growth - The growth percentage value
 * @returns Formatted growth string with + or - sign
 */
export const formatGrowth = (growth: number): string => {
  const sign = growth >= 0 ? "+" : "";
  return `${sign}${growth}%`;
};

/**
 * Get appropriate color class for growth indicator
 * @param growth - The growth percentage value
 * @returns Tailwind CSS color class
 */
export const getGrowthColor = (growth: number): string => {
  if (growth > 0) return "text-green-600";
  if (growth < 0) return "text-red-600";
  return "text-muted-foreground";
};
