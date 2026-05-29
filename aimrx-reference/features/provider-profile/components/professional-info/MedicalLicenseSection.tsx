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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProfessionalInfoValues } from "./types";
import { US_STATES } from "@/core/constants/provider-enums";

interface MedicalLicenseSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const MedicalLicenseSection: React.FC<MedicalLicenseSectionProps> = ({
  form,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "licenses",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Medical Licenses</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`licenses.${index}.licenseNumber`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Medical License Number</FormLabel>
                <FormControl>
                  <Input
                    className="mt-1"
                    {...field}
                    placeholder="Enter license number"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`licenses.${index}.state`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-2 flex justify-end">
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
        onClick={() => append({ licenseNumber: "", state: undefined })}
      >
        + Add License
      </Button>
    </div>
  );
};
