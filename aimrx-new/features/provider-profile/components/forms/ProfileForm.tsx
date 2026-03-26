"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useFormPersistence } from "@/hooks/useFormPersistence";

import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { NotificationPreferences } from "../NotificationPreferences";
import { Loader2 } from "lucide-react";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { createClient } from "@core/supabase";
import { toast } from "sonner";

export function ProfileForm() {
  const { user } = useUser();
  const { guardAction } = useDemoGuard();
  const { profile, updatePersonalInfo, isSubmitting } = useProviderProfile();
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    platform_manager_name: string | null;
  } | null>(null);
  const hasResetFromDbRef = useRef(false);
  const [billingSameAsPhysical, setBillingSameAsPhysical] = useState(true);

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

  const { clearPersistedData } = useFormPersistence({
    storageKey: `provider-profile-${user?.id || "draft"}`,
    watch: form.watch,
    setValue: form.setValue,
    excludeFields: ["paymentDetails"] as (keyof ProfileFormValues)[],
    disabled: !user?.id,
  });

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

      const mergedValues: ProfileFormValues = {
        ...dbValues,
        ...persistedData,
        paymentDetails: dbValues.paymentDetails,
      };

      form.reset(mergedValues);

      const phys = mergedValues.physicalAddress;
      const bill = mergedValues.billingAddress;
      if (phys && bill &&
        phys.street === bill.street &&
        phys.city === bill.city &&
        phys.state === bill.state &&
        phys.zipCode === bill.zipCode &&
        (phys.country || "USA") === (bill.country || "USA")) {
        setBillingSameAsPhysical(true);
      } else if (bill && (bill.street || bill.city || bill.state || bill.zipCode)) {
        setBillingSameAsPhysical(false);
      }
    }
  }, [profile, form, user?.id]);

  const handleBillingSameAsPhysical = (checked: boolean) => {
    setBillingSameAsPhysical(checked);
    if (checked) {
      const phys = form.getValues("physicalAddress");
      if (phys) {
        form.setValue("billingAddress", { ...phys });
      }
    }
  };

  const physicalAddress = form.watch("physicalAddress");
  useEffect(() => {
    if (billingSameAsPhysical && physicalAddress) {
      const currentBilling = form.getValues("billingAddress");
      if (!currentBilling ||
        currentBilling.street !== physicalAddress.street ||
        currentBilling.city !== physicalAddress.city ||
        currentBilling.state !== physicalAddress.state ||
        currentBilling.zipCode !== physicalAddress.zipCode ||
        currentBilling.country !== physicalAddress.country) {
        form.setValue("billingAddress", { ...physicalAddress });
      }
    }
  }, [billingSameAsPhysical, physicalAddress, form]);

  async function onSubmit(data: ProfileFormValues) {
    const success = await updatePersonalInfo(data);
    if (success) {
      clearPersistedData();
      form.reset(form.getValues());
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
            onSubmit={form.handleSubmit(
              (data) => guardAction(() => onSubmit(data)),
              (errors) => {
                const fieldNames = Object.keys(errors);
                toast.error(`Please fix the following fields: ${fieldNames.join(", ")}`);
              }
            )}
            className="p-6 space-y-6"
          >
            <PersonalInfoSection form={form} />

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

            <Card>
              <CardHeader>
                <CardTitle>Physical Address</CardTitle>
                <CardDescription>Your primary practice or office location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="physicalAddress.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="123 Main St" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="physicalAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="New York" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="physicalAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="NY" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="physicalAddress.zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="10001" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="physicalAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="USA" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
                <CardDescription>Where you would like to receive payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 pb-2">
                  <input
                    type="checkbox"
                    id="sameAsPhysical"
                    checked={billingSameAsPhysical}
                    onChange={(e) => handleBillingSameAsPhysical(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="sameAsPhysical" className="text-sm font-normal cursor-pointer">
                    Same as Physical Address
                  </Label>
                </div>
                <FormField
                  control={form.control}
                  name="billingAddress.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="123 Main St"
                          disabled={billingSameAsPhysical}
                          className={billingSameAsPhysical ? "bg-gray-100 cursor-not-allowed" : ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="billingAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="New York"
                            disabled={billingSameAsPhysical}
                            className={billingSameAsPhysical ? "bg-gray-100 cursor-not-allowed" : ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="NY"
                            disabled={billingSameAsPhysical}
                            className={billingSameAsPhysical ? "bg-gray-100 cursor-not-allowed" : ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="10001"
                            disabled={billingSameAsPhysical}
                            className={billingSameAsPhysical ? "bg-gray-100 cursor-not-allowed" : ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="USA"
                            disabled={billingSameAsPhysical}
                            className={billingSameAsPhysical ? "bg-gray-100 cursor-not-allowed" : ""}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID / EIN</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="XX-XXXXXXX" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

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
