"use client";

import React from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProfileFormValues } from "./types";

interface MedicalLicenseSectionProps {
  form: UseFormReturn<ProfileFormValues>;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export const MedicalLicenseSection: React.FC<MedicalLicenseSectionProps> = ({
  form,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "medicalLicenses",
  });

  const npiValue = form.watch("npiNumber");

  return (
    <div className="space-y-6">
      {/* NPI Number Field */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-900">National Provider Identifier (NPI)</h3>
        <p className="text-sm text-gray-500">Your 10-digit National Provider Identifier</p>
        <Input
          id="npiNumber"
          type="text"
          maxLength={10}
          placeholder="1234567890"
          value={npiValue || ""}
          onChange={(e) => form.setValue("npiNumber", e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Medical Licenses Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Medical Licenses</h3>
          <p className="text-sm text-gray-500 mt-1">
            Add your medical license information for each state you&apos;re licensed in
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ licenseNumber: "", state: "" })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add License
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500 text-sm">
            No medical licenses added yet. Click &quot;Add License&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="p-4 border border-gray-200 rounded-lg space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">
                  License {index + 1}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`medicalLicenses.${index}.licenseNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        License Number <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter license number"
                          className="mt-1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`medicalLicenses.${index}.state`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        State <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
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
          ))}
        </div>
      )}
    </div>
  );
};
