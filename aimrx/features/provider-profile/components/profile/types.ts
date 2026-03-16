import { z } from "zod";
import { PASSWORD_REGEX } from "@/core/auth/constants";

export const profileFormValidationSchema = z.object({
  firstName: z.string().optional(), // Read-only field
  lastName: z.string().optional(), // Read-only field
  email: z.string().min(1, "Email is required").email("Invalid email"),
  phoneNumber: z.string().optional(), // Read-only field
  companyName: z.string().optional(), // Read-only field
  avatarUrl: z.string().optional(),
  signatureUrl: z.string().optional(), // Signature image as base64 data URL
  npiNumber: z.string().optional(),
  medicalLicenses: z.array(z.object({
    licenseNumber: z.string().min(1, "License number is required"),
    state: z.string().min(1, "State is required"),
  })).optional(),
  physicalAddress: z.object({
    street: z.string().min(1, "Street is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(5, "ZIP code is required"),
    country: z.string().optional(),
  }),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  taxId: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentSchedule: z.string().optional(),
  paymentDetails: z.object({
    bankName: z.string().optional(),
    accountHolderName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    accountType: z.string().optional(),
    swiftCode: z.string().optional(),
  }).optional(),
  defaultShippingFee: z.coerce.number().min(0, "Shipping fee must be 0 or greater").optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormValidationSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number, and special character",
    ),
});

export type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;
