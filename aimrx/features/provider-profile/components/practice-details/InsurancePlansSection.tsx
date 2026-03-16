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

import { PracticeDetailsValues } from "./types";
import { INSURANCE_PLANS } from "@/core/constants/provider-enums";

interface InsurancePlansSectionProps {
  form: UseFormReturn<PracticeDetailsValues>;
}

export const InsurancePlansSection: React.FC<InsurancePlansSectionProps> = ({
  form,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "insurancePlans",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Insurance Plans Accepted</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`insurancePlans.${index}.insurancePlan`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Insurance Plan</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select insurance plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INSURANCE_PLANS.map((plan) => (
                        <SelectItem key={plan.value} value={plan.value}>
                          {plan.label}
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
        onClick={() => append({ insurancePlan: undefined })}
      >
        + Add Insurance Plan
      </Button>
      {form.formState.errors.insurancePlans && (
        <p className="text-sm text-red-500 mt-1">
          {form.formState.errors.insurancePlans.message}
        </p>
      )}
    </div>
  );
};
