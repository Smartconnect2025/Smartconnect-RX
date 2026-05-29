"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import type { InsuranceFormData } from "../types";
import { INTAKE_STORAGE_KEYS } from "../utils/intakeStorage";

const schema = z.object({
  insurance_provider: z.string().default(""),
  insurance_policy_number: z.string().default(""),
  insurance_group_number: z.string().default(""),
});

interface InsuranceFormProps {
  defaultValues?: Partial<InsuranceFormData>;
  onSubmit: (data: InsuranceFormData) => Promise<void>;
  isSubmitting: boolean;
  userId?: string;
}

export function InsuranceForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  userId,
}: InsuranceFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<InsuranceFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      insurance_provider: defaultValues?.insurance_provider || "",
      insurance_policy_number: defaultValues?.insurance_policy_number || "",
      insurance_group_number: defaultValues?.insurance_group_number || "",
    },
  });

  // Persist form data to localStorage (user-specific)
  useFormPersistence({
    storageKey: INTAKE_STORAGE_KEYS.insurance(userId || 'anonymous'),
    watch,
    setValue,
    disabled: !userId,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
          Insurance Information
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Insurance information is optional. You can skip this step if you prefer
          to pay out-of-pocket or add this information later.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="insurance_provider">Insurance Provider</Label>
            <Input
              id="insurance_provider"
              {...register("insurance_provider")}
              placeholder="Blue Cross Blue Shield, Aetna, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insurance_policy_number">Policy Number</Label>
              <Input
                id="insurance_policy_number"
                {...register("insurance_policy_number")}
                placeholder="ABC123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_group_number">Group Number</Label>
              <Input
                id="insurance_group_number"
                {...register("insurance_group_number")}
                placeholder="GRP001"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Most of our services are self-pay. Insurance
          information is collected for administrative purposes only and does not
          guarantee coverage.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/intake/medical-history")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 min-w-[140px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </form>
  );
}
