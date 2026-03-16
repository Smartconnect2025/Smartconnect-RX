import { z } from "zod";
import {
  INSURANCE_PLANS,
  MEDICAL_SERVICES,
} from "@/core/constants/provider-enums";

export const practiceDetailsSchema = z.object({
  services: z
    .array(
      z.object({
        service: z
          .enum(MEDICAL_SERVICES.map((s) => s.value) as [string, ...string[]])
          .optional(),
      }),
    )
    .superRefine((services, ctx) => {
      // Validate that at least one service is selected
      const hasValidService = services.some(
        (service) => service.service && service.service.trim() !== "",
      );
      if (!hasValidService) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one service is required",
          path: ["services"],
        });
      }
    }),

  insurancePlans: z
    .array(
      z.object({
        insurancePlan: z
          .enum(INSURANCE_PLANS.map((p) => p.value) as [string, ...string[]])
          .optional(),
      }),
    )
    .superRefine((insurancePlans, ctx) => {
      // Validate that at least one insurance plan is selected
      const hasValidPlan = insurancePlans.some(
        (plan) => plan.insurancePlan && plan.insurancePlan.trim() !== "",
      );
      if (!hasValidPlan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one insurance plan is required",
          path: ["insurancePlans"],
        });
      }
    }),

  hospitalAffiliations: z.array(
    z.object({
      affiliation: z.string().optional(),
    }),
  ),
});

export type PracticeDetailsValues = z.infer<typeof practiceDetailsSchema>;

// Using centralized SPECIALTIES and SUBSPECIALTIES from @/core/constants/provider-enums

// Re-export centralized constants for backward compatibility
export {
  MEDICAL_SPECIALTIES as SPECIALTIES,
  INSURANCE_PLANS,
  MEDICAL_SUBSPECIALTIES as SUBSPECIALTIES,
} from "@/core/constants/provider-enums";
