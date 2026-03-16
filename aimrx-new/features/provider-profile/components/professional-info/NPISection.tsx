"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { ProfessionalInfoValues } from "./types";

interface NPISectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
}

export const NPISection: React.FC<NPISectionProps> = ({ form }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Provider Identifiers</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="npiNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NPI Number</FormLabel>
              <FormControl>
                <Input
                  className="mt-1"
                  {...field}
                  placeholder="1234567890"
                  maxLength={10}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-testid="input-npi-number"
                />
              </FormControl>
              <FormDescription className="text-xs text-muted-foreground">
                Your 10-digit National Provider Identifier (NPI) number
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="deaNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DEA Number</FormLabel>
              <FormControl>
                <Input
                  className="mt-1"
                  {...field}
                  placeholder="AB1234567"
                  maxLength={9}
                  type="text"
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  data-testid="input-dea-number"
                />
              </FormControl>
              <FormDescription className="text-xs text-muted-foreground">
                Required for prescribing controlled substances (2 letters + 7 digits)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
