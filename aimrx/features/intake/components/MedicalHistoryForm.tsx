"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import type { MedicalHistoryFormData } from "../types";
import { INTAKE_STORAGE_KEYS } from "../utils/intakeStorage";

const schema = z.object({
  height: z.string().default(""),
  weight: z.string().default(""),
  blood_type: z.string().default(""),
  allergies: z.string().default(""),
  medications: z.string().default(""),
  medical_conditions: z.string().default(""),
});

interface MedicalHistoryFormProps {
  defaultValues?: Partial<MedicalHistoryFormData>;
  onSubmit: (data: MedicalHistoryFormData) => Promise<void>;
  isSubmitting: boolean;
  userId?: string;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export function MedicalHistoryForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  userId,
}: MedicalHistoryFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<MedicalHistoryFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      height: defaultValues?.height || "",
      weight: defaultValues?.weight || "",
      blood_type: defaultValues?.blood_type || "",
      allergies: defaultValues?.allergies || "",
      medications: defaultValues?.medications || "",
      medical_conditions: defaultValues?.medical_conditions || "",
    },
  });

  // Persist form data to localStorage (user-specific)
  useFormPersistence({
    storageKey: INTAKE_STORAGE_KEYS.medicalHistory(userId || 'anonymous'),
    watch,
    setValue,
    disabled: !userId,
  });

  const bloodTypeValue = watch("blood_type");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
          Medical History
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          This information helps your healthcare provider deliver personalized care.
          All fields are optional.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="height">Height</Label>
            <Input
              id="height"
              {...register("height")}
              placeholder="5'10&quot; or 178cm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight</Label>
            <Input
              id="weight"
              {...register("weight")}
              placeholder="170 lbs or 77 kg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blood_type">Blood Type</Label>
            <Select
              value={bloodTypeValue}
              onValueChange={(value) => setValue("blood_type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies</Label>
          <Textarea
            id="allergies"
            {...register("allergies")}
            placeholder="List any allergies (medications, food, environmental), separated by commas"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Example: Penicillin, Peanuts, Latex
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="medications">Current Medications</Label>
          <Textarea
            id="medications"
            {...register("medications")}
            placeholder="List any medications you are currently taking, separated by commas"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Example: Lisinopril 10mg daily, Metformin 500mg twice daily
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="medical_conditions">Medical Conditions</Label>
          <Textarea
            id="medical_conditions"
            {...register("medical_conditions")}
            placeholder="List any chronic conditions or past diagnoses, separated by commas"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Example: Type 2 Diabetes, Hypertension, Asthma
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/intake/patient-information")}
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
