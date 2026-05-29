"use client";

import React, { useCallback, useRef } from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { Plus, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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

export type NpiVerificationStatus = "idle" | "checking" | "verified" | "failed";

interface MedicalLicenseSectionProps {
  form: UseFormReturn<ProfileFormValues>;
  npiStatus?: NpiVerificationStatus;
  onNpiStatusChange?: (status: NpiVerificationStatus) => void;
  npiMessage?: string;
  onNpiMessageChange?: (message: string) => void;
  savedNpi?: string;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

async function verifyNpi(npi: string): Promise<{ valid: boolean; message: string }> {
  const res = await fetch(`/api/provider/verify-npi?npi=${encodeURIComponent(npi)}`);
  if (!res.ok) {
    return { valid: false, message: "Unable to verify NPI at this time. Please try again later." };
  }
  const data = await res.json();
  return { valid: !!data.valid, message: data.message || "Verification failed" };
}

export const MedicalLicenseSection: React.FC<MedicalLicenseSectionProps> = ({
  form,
  npiStatus = "idle",
  onNpiStatusChange,
  npiMessage = "",
  onNpiMessageChange,
  savedNpi = "",
}) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "medicalLicenses",
  });

  const npiValue = form.watch("npiNumber");
  const lastVerifiedRef = useRef<string>("");

  const handleNpiBlur = useCallback(
    async (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        onNpiStatusChange?.("idle");
        onNpiMessageChange?.("");
        lastVerifiedRef.current = "";
        return;
      }

      if (trimmed === lastVerifiedRef.current) {
        return;
      }

      if (!/^\d{10}$/.test(trimmed)) {
        onNpiStatusChange?.("failed");
        onNpiMessageChange?.("NPI number must be exactly 10 digits");
        lastVerifiedRef.current = "";
        return;
      }

      if (trimmed === savedNpi) {
        onNpiStatusChange?.("verified");
        onNpiMessageChange?.("NPI verified — active and available");
        lastVerifiedRef.current = trimmed;
        return;
      }

      onNpiStatusChange?.("checking");
      onNpiMessageChange?.("Verifying NPI...");

      try {
        const result = await verifyNpi(trimmed);
        if (result.valid) {
          onNpiStatusChange?.("verified");
          onNpiMessageChange?.(result.message);
          lastVerifiedRef.current = trimmed;
        } else {
          onNpiStatusChange?.("failed");
          onNpiMessageChange?.(result.message);
          lastVerifiedRef.current = "";
        }
      } catch {
        onNpiStatusChange?.("failed");
        onNpiMessageChange?.("Unable to verify NPI at this time. Please try again later.");
        lastVerifiedRef.current = "";
      }
    },
    [savedNpi, onNpiStatusChange, onNpiMessageChange],
  );

  const handleNpiChange = useCallback(
    (value: string) => {
      form.setValue("npiNumber", value);
      if (lastVerifiedRef.current && value.trim() !== lastVerifiedRef.current) {
        onNpiStatusChange?.("idle");
        onNpiMessageChange?.("");
        lastVerifiedRef.current = "";
      }
    },
    [form, onNpiStatusChange, onNpiMessageChange],
  );

  const borderClass =
    npiStatus === "verified"
      ? "border-green-500 focus:ring-green-500"
      : npiStatus === "failed"
        ? "border-red-500 focus:ring-red-500"
        : "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-900">National Provider Identifier (NPI)</h3>
        <p className="text-sm text-gray-500">Your 10-digit National Provider Identifier</p>
        <div className="relative max-w-md">
          <Input
            id="npiNumber"
            type="text"
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="1234567890"
            value={npiValue || ""}
            onChange={(e) => handleNpiChange(e.target.value)}
            onBlur={() => handleNpiBlur(npiValue || "")}
            className={`pr-10 ${borderClass}`}
            data-testid="input-npi-number"
          />
          {npiStatus === "checking" && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
              data-testid="npi-checking-spinner"
            />
          )}
          {npiStatus === "verified" && (
            <CheckCircle2
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600"
              data-testid="npi-verified-icon"
            />
          )}
          {npiStatus === "failed" && (
            <XCircle
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500"
              data-testid="npi-failed-icon"
            />
          )}
        </div>
        {npiStatus === "idle" && (
          <p className="text-xs text-muted-foreground">
            Enter your NPI and click away to verify
          </p>
        )}
        {npiStatus === "checking" && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verifying NPI...
          </p>
        )}
        {npiStatus === "verified" && (
          <p
            className="text-xs text-green-600 flex items-center gap-1"
            data-testid="npi-verified-message"
          >
            <CheckCircle2 className="h-3 w-3" />
            {npiMessage}
          </p>
        )}
        {npiStatus === "failed" && (
          <p
            className="text-xs text-red-500 flex items-center gap-1"
            data-testid="npi-failed-message"
          >
            <XCircle className="h-3 w-3" />
            {npiMessage}
          </p>
        )}
      </div>

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
