"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAvatarUpload } from "@/hooks";
import { useUser } from "@core/auth";
import { useProviderProfile } from "../../hooks/use-provider-profile";

import { ProfileFormValues } from "./types";

interface PersonalInfoSectionProps {
  form: UseFormReturn<ProfileFormValues>;
  tierLevel?: string;
}

export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  form,
  tierLevel = "Not set",
}) => {
  const { user } = useUser();
  const { updateAvatarUrl, refreshProfile } = useProviderProfile();

  // Avatar upload functionality
  const {
    isUploading: isAvatarUploading,
    previewUrl,
    handleFileSelect,
    handleAvatarClick,
    fileInputRef: avatarFileInputRef,
    getOptimizedUrl,
  } = useAvatarUpload({
    userId: user?.id || "",
    currentAvatarUrl: form.watch("avatarUrl"),
    onAvatarUpdate: async (newAvatarUrl) => {
      form.setValue("avatarUrl", newAvatarUrl);
      // Also update the database immediately
      const success = await updateAvatarUrl(newAvatarUrl);
      if (success) {
        // Refresh the profile to update the header
        await refreshProfile();
        // Dispatch event to update header immediately
        window.dispatchEvent(new CustomEvent("avatar-updated"));
      }
    },
  });

  // Get initials from first and last name for avatar fallback
  const getInitials = () => {
    const firstName = form.watch("firstName") || "";
    const lastName = form.watch("lastName") || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Profile Picture and Basic Info */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <Avatar
            className="w-16 h-16 bg-blue-100 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleAvatarClick}
          >
            <AvatarImage
              src={previewUrl || getOptimizedUrl(64)}
              alt="Profile Picture"
            />
            <AvatarFallback className="text-blue-600 font-semibold text-lg">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {isAvatarUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-gray-900">
            {form.watch("firstName") || ""} {form.watch("lastName") || ""}
          </h3>
        </div>
        <input
          ref={avatarFileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
      </div>

      {/* Name Fields and Tier - Read-only */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Tier Level</FormLabel>
          <FormControl>
            <Input
              value={tierLevel}
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
          </FormControl>
        </FormItem>
      </div>

      {/* Company Name - Read-only */}
      <div className="grid grid-cols-1 gap-6">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                  placeholder="Not set"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
