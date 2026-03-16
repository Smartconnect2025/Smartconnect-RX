"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useFormPersistence } from "@/hooks/useFormPersistence";

import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";

import { ContactInfoSection } from "../profile/ContactInfoSection";
import { PersonalInfoSection } from "../profile/PersonalInfoSection";
import { MedicalLicenseSection } from "../profile/MedicalLicenseSection";
import { SignatureSection } from "../profile/SignatureSection";
import {
  profileFormValidationSchema,
  ProfileFormValues,
} from "../profile/types";
import { useProviderProfile } from "../../hooks/use-provider-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { NotificationPreferences } from "../NotificationPreferences";
import { Loader2 } from "lucide-react";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { createClient } from "@core/supabase";

export function ProfileForm() {
  const { user } = useUser();
  const { guardAction } = useDemoGuard();
  const { profile, updatePersonalInfo, isSubmitting } = useProviderProfile();
  const [tierLevel, setTierLevel] = useState<string>("Not set");
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    platform_manager_name: string | null;
  } | null>(null);
  const hasResetFromDbRef = useRef(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormValidationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      companyName: "",
      avatarUrl: "",
      signatureUrl: "",
      npiNumber: "",
      medicalLicenses: [],
      physicalAddress: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      },
      billingAddress: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
      },
      taxId: "",
      paymentMethod: "bank_transfer",
      paymentSchedule: "monthly",
      paymentDetails: {
        bankName: "",
        accountHolderName: "",
        accountNumber: "",
        routingNumber: "",
        accountType: "checking",
        swiftCode: "",
      },
      defaultShippingFee: 40,
    },
    mode: "onChange",
  });

  // Persist form data to localStorage (excluding sensitive payment details and addresses)
  // Addresses are excluded because they're managed in a separate tab and we don't want
  // stale localStorage values to overwrite the DB values on form reload
  const { clearPersistedData } = useFormPersistence({
    storageKey: `provider-profile-${user?.id || "draft"}`,
    watch: form.watch,
    setValue: form.setValue,
    excludeFields: ["paymentDetails", "physicalAddress", "billingAddress"] as (keyof ProfileFormValues)[],
    disabled: !user?.id,
  });

  // Fetch tier level from API for the current provider
  useEffect(() => {
    async function fetchTierLevel() {
      if (!profile?.id) return;

      try {
        // Use the provider-specific endpoint (doesn't require admin access)
        const response = await fetch("/api/provider/tier");
        if (response.ok) {
          const data = await response.json();
          if (data.tier_level) {
            setTierLevel(data.tier_level);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tier level:", error);
      }
    }

    fetchTierLevel();
  }, [profile?.id]);

  // Fetch group info when profile loads
  useEffect(() => {
    async function fetchGroup() {
      if (!profile?.group_id) {
        setGroupInfo(null);
        return;
      }

      const supabase = createClient();
      const { data: group } = await supabase
        .from("groups")
        .select("name, platform_manager_id")
        .eq("id", profile.group_id)
        .single();

      if (group) {
        let pmName: string | null = null;
        if (group.platform_manager_id) {
          const { data: pm } = await supabase
            .from("platform_managers")
            .select("name")
            .eq("id", group.platform_manager_id)
            .single();
          pmName = pm?.name || null;
        }
        setGroupInfo({ name: group.name, platform_manager_name: pmName });
      }
    }

    fetchGroup();
  }, [profile?.group_id]);

  useEffect(() => {
    if (profile && !hasResetFromDbRef.current) {
      hasResetFromDbRef.current = true;

      // Check for persisted localStorage data
      const storageKey = `provider-profile-${user?.id || "draft"}`;
      let persistedData: Partial<ProfileFormValues> = {};
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          persistedData = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to parse persisted data:", e);
      }

      // Parse medical licenses from database
      let medicalLicenses: Array<{ licenseNumber: string; state: string }> = [];
      if (profile.medical_licenses) {
        try {
          if (typeof profile.medical_licenses === "string") {
            medicalLicenses = JSON.parse(profile.medical_licenses);
          } else if (Array.isArray(profile.medical_licenses)) {
            medicalLicenses = profile.medical_licenses;
          }
        } catch (e) {
          console.error("Failed to parse medical licenses:", e);
        }
      }

      // Build DB values
      const dbValues: ProfileFormValues = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        email: profile.email || "",
        phoneNumber: profile.phone_number || "",
        companyName: profile.company_name || "",
        avatarUrl: profile.avatar_url || "",
        signatureUrl: profile.signature_url || "",
        npiNumber: profile.npi_number || "",
        medicalLicenses: medicalLicenses,
        physicalAddress: (() => {
          const addr = profile.physical_address as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
          return {
            street: addr?.street || "",
            city: addr?.city || "",
            state: addr?.state || "",
            zipCode: addr?.zipCode || "",
            country: addr?.country || "USA",
          };
        })(),
        billingAddress: (profile.billing_address as unknown as Record<
          string,
          string
        > | null) || {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "USA",
        },
        taxId: profile.tax_id || "",
        paymentMethod: profile.payment_method || "bank_transfer",
        paymentSchedule: profile.payment_schedule || "monthly",
        defaultShippingFee: profile.default_shipping_fee ?? 40,
        paymentDetails: (() => {
          const details = profile.payment_details as unknown as Record<
            string,
            string
          > | null;
          if (details) {
            return {
              bankName: details.bank_name || "",
              accountHolderName: details.account_holder_name || "",
              accountNumber: details.account_number || "",
              routingNumber: details.routing_number || "",
              accountType: details.account_type || "checking",
              swiftCode: details.swift_code || "",
            };
          }
          return {
            bankName: "",
            accountHolderName: "",
            accountNumber: "",
            routingNumber: "",
            accountType: "checking",
            swiftCode: "",
          };
        })(),
      };

      // Merge: localStorage values take priority over DB values (for draft data)
      // EXCEPT for addresses and payment details which always come from DB
      const mergedValues: ProfileFormValues = {
        ...dbValues,
        ...persistedData,
        // Always use DB values for addresses (they're managed in Payment & Billing tab)
        physicalAddress: dbValues.physicalAddress,
        billingAddress: dbValues.billingAddress,
        // Always use DB for sensitive payment data
        paymentDetails: dbValues.paymentDetails,
      };

      form.reset(mergedValues);
    }
  }, [profile, form, user?.id]);

  async function onSubmit(data: ProfileFormValues) {
    const success = await updatePersonalInfo(data);
    if (success) {
      clearPersistedData();
      form.reset(form.getValues());

      // Refetch tier level after successful save
      try {
        const response = await fetch("/api/provider/tier");
        if (response.ok) {
          const tierData = await response.json();
          if (tierData.tier_level) {
            setTierLevel(tierData.tier_level);
          }
        }
      } catch (error) {
        console.error("Failed to refresh tier level:", error);
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
        </div>

        <Form {...form}>
          <form
            id="profile-form"
            onSubmit={form.handleSubmit((data) => guardAction(() => onSubmit(data)))}
            className="p-6 space-y-6"
          >
            <PersonalInfoSection form={form} tierLevel={tierLevel} />

            <Separator className="bg-gray-200" />

            {groupInfo && (
              <>
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Group Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="groupName">Group</Label>
                      <Input
                        id="groupName"
                        value={groupInfo.name}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="platformManager">Platform Manager</Label>
                      <Input
                        id="platformManager"
                        value={groupInfo.platform_manager_name || "Not assigned"}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-gray-200" />
              </>
            )}

            <ContactInfoSection form={form} />

            <Separator className="bg-gray-200" />

            <MedicalLicenseSection form={form} />

            <Separator className="bg-gray-200" />

            <SignatureSection form={form} />

            <Separator className="bg-gray-200" />

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                variant="default"
                className="px-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <NotificationPreferences />

      <PasswordChangeForm />
    </div>
  );
}
