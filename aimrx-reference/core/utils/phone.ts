/**
 * Formats a US phone number as the user types
 * Takes raw digits and formats them as (555) 123-4567
 * US domestic format - NO country code
 *
 * @param value - The input value (can include any characters)
 * @returns Formatted phone number string (10 digits only)
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // If empty, return empty string
  if (digits.length === 0) {
    return '';
  }

  // Take only the first 10 digits (US phone number - EXACTLY 10 digits)
  const truncated = digits.slice(0, 10);

  // Format based on how many digits we have
  if (truncated.length <= 3) {
    return `(${truncated}`;
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
  } else {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
  }
}

/**
 * Extracts just the digits from a formatted phone number
 * Useful for storing in database
 *
 * @param formatted - The formatted phone number
 * @returns Just the 10 digits
 */
export function extractPhoneDigits(formatted: string): string {
  return formatted.replace(/\D/g, '').slice(0, 10);
}

/**
 * Validates that a phone number has exactly 10 digits
 * US phone numbers must be exactly 10 digits (no more, no less)
 *
 * @param value - The phone number to validate (formatted or unformatted)
 * @returns true if exactly 10 digits, false otherwise
 */
export function isValidUSPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10;
}

/**
 * Gets validation error message for phone number
 *
 * @param value - The phone number to validate
 * @returns Error message or null if valid
 */
export function getPhoneValidationError(value: string): string | null {
  if (!value || value.trim() === '') {
    return null; // Empty is allowed (optional field)
  }

  const digits = value.replace(/\D/g, '');

  if (digits.length === 0) {
    return null; // Empty after cleaning is allowed
  }

  if (digits.length < 10) {
    return `Phone number must be exactly 10 digits (currently ${digits.length} digits)`;
  }

  if (digits.length > 10) {
    return `Phone number must be exactly 10 digits (currently ${digits.length} digits)`;
  }

  return null; // Valid
}

/**
 * Cleans and validates a phone number for storage
 * Returns just the 10 digits if valid, or null if invalid
 *
 * @param value - The phone number to clean
 * @returns 10 digits or null if invalid
 */
export function cleanPhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 10) {
    return null; // Invalid length
  }

  return digits;
}
