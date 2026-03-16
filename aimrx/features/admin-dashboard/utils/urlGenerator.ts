/**
 * Product URL Generation Utilities
 *
 * Provides functionality to generate shareable product URLs
 * and validate URL formats for the admin dashboard.
 */

/**
 * Generate a shareable product URL from a product slug
 * @param slug - The product slug
 * @returns The complete product URL
 */
export function generateProductUrl(slug: string): string {
  if (!slug) {
    return "";
  }

  // Get the base URL from environment or use localhost for development
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Remove any leading/trailing slashes and ensure proper format
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

  return `${baseUrl}/catalog/product/${cleanSlug}`;
}

/**
 * Generate a product URL for a specific environment
 * @param slug - The product slug
 * @param environment - The environment (development, staging, production)
 * @returns The complete product URL for the specified environment
 */
export function generateProductUrlForEnvironment(
  slug: string,
  environment: "development" | "staging" | "production" = "development",
): string {
  if (!slug) {
    return "";
  }

  const baseUrls = {
    development: "http://localhost:3000",
    staging:
      process.env.NEXT_PUBLIC_STAGING_URL || "https://staging.example.com",
    production: process.env.NEXT_PUBLIC_SITE_URL || "https://example.com",
  };

  const baseUrl = baseUrls[environment];
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

  return `${baseUrl}/catalog/product/${cleanSlug}`;
}

/**
 * Validate if a URL is a valid product URL format
 * @param url - The URL to validate
 * @returns True if the URL is a valid product URL format
 */
export function isValidProductUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Should have exactly 3 parts: "catalog", "product", and the slug
    return (
      pathParts.length === 3 &&
      pathParts[0] === "catalog" &&
      pathParts[1] === "product"
    );
  } catch {
    return false;
  }
}

/**
 * Extract the product slug from a product URL
 * @param url - The product URL
 * @returns The product slug or null if invalid
 */
export function extractSlugFromUrl(url: string): string | null {
  if (!isValidProductUrl(url)) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    return pathParts[2] || null;
  } catch {
    return null;
  }
}

/**
 * Generate a preview URL for testing (opens in new tab)
 * @param slug - The product slug
 * @returns A data URL that can be used for preview
 */
export function generatePreviewUrl(slug: string): string {
  const productUrl = generateProductUrl(slug);
  return `data:text/html,<html><body><script>window.open('${productUrl}', '_blank');</script></body></html>`;
}
