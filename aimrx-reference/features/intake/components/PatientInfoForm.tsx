"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { PatientInfoFormData } from "../types";
import { INTAKE_STORAGE_KEYS } from "../utils/intakeStorage";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  phone: z
    .string()
    .refine(
      (val) => val.replace(/\D/g, "").length === 10,
      "Phone number must be exactly 10 digits",
    ),
  email: z.string().email("Valid email is required"),
  gender: z.string().min(1, "Gender is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "ZIP code is required"),
});

interface PatientInfoFormProps {
  defaultValues?: Partial<PatientInfoFormData>;
  onSubmit: (data: PatientInfoFormData) => Promise<void>;
  isSubmitting: boolean;
  userId?: string;
}

const US_STATES = [
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
];

export function PatientInfoForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  userId,
}: PatientInfoFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientInfoFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: defaultValues?.first_name || "",
      last_name: defaultValues?.last_name || "",
      date_of_birth: defaultValues?.date_of_birth || "",
      phone: defaultValues?.phone || "",
      email: defaultValues?.email || "",
      gender: defaultValues?.gender || "",
      street: defaultValues?.street || "",
      city: defaultValues?.city || "",
      state: defaultValues?.state || "",
      zipCode: defaultValues?.zipCode || "",
    },
  });

  const genderValue = watch("gender");
  const stateValue = watch("state");

  // Persist form data to localStorage (user-specific)
  useFormPersistence({
    storageKey: INTAKE_STORAGE_KEYS.patientInfo(userId || "anonymous"),
    watch,
    setValue,
    disabled: !userId,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
          Personal Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              {...register("first_name")}
              placeholder="John"
            />
            {errors.first_name && (
              <p className="text-sm text-red-500">
                {errors.first_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              {...register("last_name")}
              placeholder="Doe"
            />
            {errors.last_name && (
              <p className="text-sm text-red-500">{errors.last_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth *</Label>
            <Input
              id="date_of_birth"
              type="date"
              {...register("date_of_birth")}
            />
            {errors.date_of_birth && (
              <p className="text-sm text-red-500">
                {errors.date_of_birth.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Select
              value={genderValue}
              onValueChange={(value) => setValue("gender", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && (
              <p className="text-sm text-red-500">{errors.gender.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone")}
              placeholder="(555) 123-4567"
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">Address</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Street Address *</Label>
            <Input
              id="street"
              {...register("street")}
              placeholder="123 Main St"
            />
            {errors.street && (
              <p className="text-sm text-red-500">{errors.street.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" {...register("city")} placeholder="Austin" />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select
                value={stateValue}
                onValueChange={(value) => setValue("state", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input
                id="zipCode"
                {...register("zipCode")}
                placeholder="78701"
              />
              {errors.zipCode && (
                <p className="text-sm text-red-500">{errors.zipCode.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
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
