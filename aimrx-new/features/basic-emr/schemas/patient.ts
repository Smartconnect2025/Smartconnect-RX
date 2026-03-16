import * as z from "zod";

// US States for validation (abbreviated format)
export const usStates = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

// Gender options
export const genderOptions = ["Male", "Female", "Other"] as const;

// Language options
export const languageOptions = [
  "English",
  "Spanish",
  "French",
  "Portuguese",
  "Mandarin",
] as const;

// Address schema
export const addressSchema = z.object({
  street: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  zipCode: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      // Empty is valid for optional addresses
      if (!val || val.trim() === "") return true;
      // Must match US ZIP format: 12345 or 12345-6789
      return /^\d{5}(-\d{4})?$/.test(val);
    }, "Invalid ZIP code format"),
  country: z.string().optional().default("USA"),
});

// Required address schema (for primary address)
const requiredAddressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .refine((val) => {
      // Must match US ZIP format: 12345 or 12345-6789
      return /^\d{5}(-\d{4})?$/.test(val);
    }, "Invalid ZIP code format"),
  country: z.string().default("USA"),
});

// Emergency contact schema
const emergencyContactSchema = z.object({
  name: z.string().min(1, "Emergency contact name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z
    .string()
    .min(1, "Emergency contact phone is required")
    .refine(
      (val) => val.replace(/\D/g, "").length === 10,
      "Phone number must be exactly 10 digits",
    ),
});

// Insurance schema
const insuranceSchema = z.object({
  provider: z.string().min(1, "Insurance provider is required"),
  policyNumber: z.string().min(1, "Policy number is required"),
  groupNumber: z.string().min(1, "Group number is required"),
});

// Main patient form schema
export const patientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (val) => val.replace(/\D/g, "").length === 10,
      "Phone number must be exactly 10 digits",
    ),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const minDate = new Date("1900-01-01");
      return birthDate <= today && birthDate >= minDate;
    }, "Invalid date of birth"),
  gender: z.enum(genderOptions, {
    required_error: "Gender is required",
  }),
  address: requiredAddressSchema.optional(),
  physicalAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  insurance: insuranceSchema.optional(),
  preferredLanguage: z.enum(languageOptions).default("English"),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

// DEPRECATED: Use formatPhoneNumber from @core/utils/phone instead
// This is kept for backward compatibility but should not be used in new code
export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");

  // If empty, return empty string
  if (digits.length === 0) {
    return "";
  }

  // Take only the first 10 digits (US phone number - EXACTLY 10 digits)
  const truncated = digits.slice(0, 10);

  // Format: (555) 123-4567 (NO country code for US domestic)
  if (truncated.length <= 3) {
    return `(${truncated}`;
  } else if (truncated.length <= 6) {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
  } else {
    return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`;
  }
};

// Utility function to validate zip code format
export const isValidZipCode = (zipCode: string): boolean => {
  return /^\d{5}(-\d{4})?$/.test(zipCode);
};
