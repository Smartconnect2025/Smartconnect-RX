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

import { ProfessionalInfoValues } from "./types";

interface BoardCertificationSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const BoardCertificationSection: React.FC<
  BoardCertificationSectionProps
> = ({ form }) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "certifications",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Board Certifications</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`certifications.${index}.certification`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board Certification</FormLabel>
                  <FormControl>
                    <Input
                      className="mt-1"
                      {...field}
                      placeholder="Enter board certification"
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
        onClick={() => append({ certification: "" })}
      >
        + Add Certification
      </Button>
    </div>
  );
};
