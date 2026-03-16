"use client";

import React from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { PracticeDetailsValues } from "./types";

interface HospitalAffiliationsSectionProps {
  form: UseFormReturn<PracticeDetailsValues>;
}

export const HospitalAffiliationsSection: React.FC<
  HospitalAffiliationsSectionProps
> = ({ form }) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "hospitalAffiliations",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Hospital Affiliations</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`hospitalAffiliations.${index}.affiliation`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hospital Affiliation</FormLabel>
                  <FormControl>
                    <Input
                      className="mt-1"
                      {...field}
                      placeholder="Enter hospital affiliation"
                    />
                  </FormControl>
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
        onClick={() => append({ affiliation: "" })}
      >
        + Add Hospital Affiliation
      </Button>
    </div>
  );
};
