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
import { Textarea } from "@/components/ui/textarea";

import { ProfessionalInfoValues } from "./types";

interface ProfessionalBioSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const ProfessionalBioSection: React.FC<ProfessionalBioSectionProps> = ({
  form,
}) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="professionalBio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Professional Bio or Statement</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Write something about your professional background, specialties, or approach"
                className="min-h-[150px] resize-y mt-1"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
