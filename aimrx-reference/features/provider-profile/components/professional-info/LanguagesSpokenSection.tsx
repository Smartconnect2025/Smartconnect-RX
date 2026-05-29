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
import { COMMON_LANGUAGES } from "@/core/constants/provider-enums";

import { ProfessionalInfoValues } from "./types";

interface LanguagesSpokenSectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const LanguagesSpokenSection: React.FC<LanguagesSpokenSectionProps> = ({
  form,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "languages",
  });

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Languages Spoken</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name={`languages.${index}.language`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_LANGUAGES.map((language) => (
                        <SelectItem key={language.value} value={language.value}>
                          {language.label}
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
        onClick={() => append({ language: undefined })}
      >
        + Add Language
      </Button>
    </div>
  );
};
