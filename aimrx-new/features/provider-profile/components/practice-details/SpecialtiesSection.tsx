"use client";

import { Trash2 } from "lucide-react";
import React from "react";
import { useFieldArray, UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProfessionalInfoValues } from "../professional-info/types";
import { MEDICAL_SPECIALTIES } from "@/core/constants/provider-enums";

interface SpecialtiesSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const SpecialtiesSection: React.FC<SpecialtiesSectionProps> = ({
  form,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "specialties",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Specialties</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`specialties.${index}.specialty`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialty</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MEDICAL_SPECIALTIES.map((specialty) => (
                        <SelectItem
                          key={specialty.value}
                          value={specialty.value}
                        >
                          {specialty.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="pt-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fields.length > 1 && remove(index)}
              className="h-9 w-9"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="link"
        className="p-0 h-auto text-[#66cdcc]"
        onClick={() => append({ specialty: undefined })}
      >
        + Add Specialty
      </Button>
    </div>
  );
};
