import { z } from "zod";
import {
  MEDICAL_SPECIALTIES,
  US_STATES,
  COMMON_LANGUAGES,
} from "@/core/constants/provider-enums";

export const professionalInfoSchema = z.object({
  npiNumber: z
    .string()
    .regex(/^\d{10}$/, "NPI number must be exactly 10 digits")
    .optional()
    .or(z.literal("")),

  deaNumber: z
    .string()
    .regex(/^[A-Z]{2}\d{7}$/, "DEA number must be 2 letters followed by 7 digits (e.g., AB1234567)")
    .optional()
    .or(z.literal("")),

  specialties: z.array(
    z.object({
      specialty: z
        .enum(
          MEDICAL_SPECIALTIES.map((s) => s.value) as [string, ...string[]],
          { required_error: "Please select a specialty" },
        )
        .optional(),
    }),
  ),

  licenses: z
    .array(
      z.object({
        licenseNumber: z
          .string()
          .min(1, "License number is required")
          .regex(
            /^[A-Z0-9-]+$/i,
            "License number can only contain letters, numbers, and hyphens"
          ),
        state: z
          .enum(US_STATES.map((s) => s.value) as [string, ...string[]], {
            required_error: "Please select a state",
          })
          .optional(),
      }),
    )
    .superRefine((licenses, ctx) => {
      // Validate each license: if licenseNumber is provided, state is required
      licenses.forEach((license, index) => {
        if (license.licenseNumber && !license.state) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "State is required when license number is provided",
            path: [`${index}.state`],
          });
        }
      });
    }),

  certifications: z.array(
    z.object({
      certification: z.string(),
    }),
  ),

  educationTraining: z.array(
    z.object({
      education: z.string(),
    }),
  ),

  languages: z.array(
    z.object({
      language: z
        .enum(COMMON_LANGUAGES.map((l) => l.value) as [string, ...string[]], {
          required_error: "Please select a language",
        })
        .optional(),
    }),
  ),

  associations: z.array(
    z.object({
      association: z.string(),
    }),
  ),

  yearsOfExperience: z.coerce.number().optional(),

  professionalBio: z.string().optional(),
});

export type ProfessionalInfoValues = z.infer<typeof professionalInfoSchema>;
