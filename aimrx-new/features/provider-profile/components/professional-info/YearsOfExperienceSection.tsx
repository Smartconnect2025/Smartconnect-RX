"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { ProfessionalInfoValues } from "./types";

interface YearsOfExperienceSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const YearsOfExperienceSection: React.FC<
  YearsOfExperienceSectionProps
> = ({ form }) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="yearsOfExperience"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Years of Experience</FormLabel>
            <FormControl>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={field.value ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(
                    value === "" ? undefined : parseInt(value, 10),
                  );
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="Enter years of experience"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
