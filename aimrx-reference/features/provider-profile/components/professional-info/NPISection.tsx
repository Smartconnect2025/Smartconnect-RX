"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { ProfessionalInfoValues } from "./types";

export type NpiVerificationStatus = "idle" | "checking" | "verified" | "failed";

interface NPISectionProps {
  form: UseFormReturn<ProfessionalInfoValues>;
  npiStatus?: NpiVerificationStatus;
  onNpiStatusChange?: (status: NpiVerificationStatus) => void;
  npiMessage?: string;
  onNpiMessageChange?: (message: string) => void;
  savedNpi?: string;
}

async function verifyNpi(npi: string): Promise<{ valid: boolean; message: string }> {
  const res = await fetch(`/api/provider/verify-npi?npi=${encodeURIComponent(npi)}`);
  if (!res.ok) {
    return { valid: false, message: "Unable to verify NPI at this time. Please try again later." };
  }
  const data = await res.json();
  return { valid: !!data.valid, message: data.message || "Verification failed" };
}

export const NPISection: React.FC<NPISectionProps> = ({
  form,
  npiStatus = "idle",
  onNpiStatusChange,
  npiMessage = "",
  onNpiMessageChange,
  savedNpi = "",
}) => {
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
    (value: string, fieldOnChange: (v: string) => void) => {
      fieldOnChange(value);
      if (lastVerifiedRef.current && value.trim() !== lastVerifiedRef.current) {
        onNpiStatusChange?.("idle");
        onNpiMessageChange?.("");
        lastVerifiedRef.current = "";
      }
    },
    [onNpiStatusChange, onNpiMessageChange],
  );

  const borderClass =
    npiStatus === "verified"
      ? "border-green-500 focus:ring-green-500"
      : npiStatus === "failed"
        ? "border-red-500 focus:ring-red-500"
        : "";

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
                <div className="relative">
                  <Input
                    className={`mt-1 pr-10 ${borderClass}`}
                    {...field}
                    placeholder="1234567890"
                    maxLength={10}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    data-testid="input-npi-number"
                    onChange={(e) =>
                      handleNpiChange(e.target.value, field.onChange)
                    }
                    onBlur={() => {
                      field.onBlur();
                      handleNpiBlur(field.value || "");
                    }}
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
              </FormControl>
              {npiStatus === "idle" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your 10-digit National Provider Identifier (NPI) number
                </p>
              )}
              {npiStatus === "checking" && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verifying NPI...
                </p>
              )}
              {npiStatus === "verified" && (
                <p
                  className="text-xs text-green-600 mt-1 flex items-center gap-1"
                  data-testid="npi-verified-message"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {npiMessage}
                </p>
              )}
              {npiStatus === "failed" && (
                <p
                  className="text-xs text-red-500 mt-1 flex items-center gap-1"
                  data-testid="npi-failed-message"
                >
                  <XCircle className="h-3 w-3" />
                  {npiMessage}
                </p>
              )}
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
              <p className="text-xs text-muted-foreground mt-1">
                Required for prescribing controlled substances (2 letters + 7 digits)
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
