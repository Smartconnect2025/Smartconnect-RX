/**
 * Password validation rules and utilities
 */

export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  met?: boolean;
}

export const passwordRequirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (password: string) => password.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    label: "One number",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    label: "One special character (!@#$%^&*)",
    test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  },
];

/**
 * Validates a password against all requirements
 * @param password - The password to validate
 * @returns Object with isValid flag and array of requirements with met status
 */
export function validatePassword(password: string): {
  isValid: boolean;
  requirements: PasswordRequirement[];
} {
  const requirements = passwordRequirements.map((req) => ({
    ...req,
    met: req.test(password),
  }));

  const isValid = requirements.every((req) => req.met);

  return { isValid, requirements };
}

/**
 * Get a simple error message if password is invalid
 * @param password - The password to validate
 * @returns Error message string or null if valid
 */
export function getPasswordError(password: string): string | null {
  if (!password) return "Password is required";

  const { isValid } = validatePassword(password);

  if (!isValid) {
    return "Password does not meet all requirements";
  }

  return null;
}
