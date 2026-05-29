"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { ProfileFormValues } from "./types";

interface ContactInfoSectionProps {
  form: UseFormReturn<ProfileFormValues>;
}

export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  form,
}) => {
  return (
    <div className="space-y-6">
      {/* Company Name - Editable */}
      <FormField
        control={form.control}
        name="companyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Enter your company name"
              />
            </FormControl>
            <p className="text-sm text-gray-500 mt-1">
              This will appear in the provider platform header
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Default Shipping Fee field removed: shipping fee is now controlled
          per-pharmacy by admins (see Pharmacy Management → Shipping Fee
          column). Providers no longer set a personal shipping fee. */}

      {/* Email Address - Read-only */}
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email Address</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled
                className="bg-gray-50 cursor-not-allowed"
                placeholder=""
              />
            </FormControl>
            <p className="text-sm text-gray-500 mt-1">
              Email cannot be changed from this form
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Phone Number - Read-only */}
      <FormField
        control={form.control}
        name="phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input
                {...field}
                disabled
                className="bg-gray-50 cursor-not-allowed"
                placeholder=""
              />
            </FormControl>
            <p className="text-sm text-gray-500 mt-1">
              Phone number cannot be changed from this form
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
