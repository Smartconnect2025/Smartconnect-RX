"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Trash2 } from "lucide-react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { severityOptions } from "../schemas";

interface AllergyFieldProps<T extends FieldValues = FieldValues> {
  form: UseFormReturn<T>;
  index: number;
  onRemove: () => void;
  fieldPrefix?: string; // e.g., "allergies" or "medicalHistory.allergies"
}

export function AllergyField({
  form,
  index,
  onRemove,
  fieldPrefix = "allergies",
}: AllergyFieldProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Allergy {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4">
        <FormField
          control={form.control}
          name={`${fieldPrefix}.${index}.allergen`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>What are you allergic to?</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Penicillin, Peanuts, Shellfish"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`${fieldPrefix}.${index}.reaction`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>What happens when you&apos;re exposed?</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Rash, difficulty breathing, swelling"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`${fieldPrefix}.${index}.severity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>How severe is the reaction?</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {severityOptions.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
