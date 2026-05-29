"use client";

import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { validatePassword } from "@/core/utils/password-validation";
import { PasswordRequirements } from "@/components/ui/password-requirements";

import {
  passwordChangeSchema,
  PasswordChangeFormValues,
} from "../profile/types";
import { useProviderProfile } from "../../hooks/use-provider-profile";
import { useDemoGuard } from "@/hooks/use-demo-guard";

export function PasswordChangeForm() {
  const { changePassword, isSubmitting } = useProviderProfile();
  const { guardAction } = useDemoGuard();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  // Get password validation state for new password
  const newPasswordValue = form.watch("newPassword");
  const passwordValidation = validatePassword(newPasswordValue || "");

  async function onSubmit(data: PasswordChangeFormValues) {
    const success = await changePassword(
      data.currentPassword,
      data.newPassword,
    );
    if (success) {
      form.reset();
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => guardAction(() => onSubmit(data)))} className="p-6 space-y-6">
          {/* Current Password */}
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Password</FormLabel>
                <div className="relative mt-1">
                  <FormControl>
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter current password"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOffIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* New Password */}
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <div className="relative mt-1">
                  <FormControl>
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOffIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {newPasswordValue && (
                  <PasswordRequirements
                    requirements={passwordValidation.requirements}
                    className="mt-3"
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="px-6">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
