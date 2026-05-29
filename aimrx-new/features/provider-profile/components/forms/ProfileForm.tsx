"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useFormPersistence } from "@/hooks/useFormPersistence";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";

import { ContactInfoSection } from "../profile/ContactInfoSection";
import { PersonalInfoSection } from "../profile/PersonalInfoSection";
import { MedicalLicenseSection, type NpiVerificationStatus } from "../profile/MedicalLicenseSection";
import { SignatureSection } from "../profile/SignatureSection";
import { AchSection } from "../profile/AchSection";
import {
  profileFormValidationSchema,
  ProfileFormValues,
} from "../profile/types";
import { useProviderProfile } from "../../hooks/use-provider-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [tierLevel, setTierLevel] = useState<string>("Not set");
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    platform_manager_name: string | null;
  } | null>(null);
  const hasResetFromDbRef = useRef(false);
  const [billingSameAsPhysical, setBillingSameAsPhysical] = useState(true);
  const [npiStatus, setNpiStatus] = useState<NpiVerificationStatus>("idle");
  const [npiMessage, setNpiMessage] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormValidationSchema),
    defaultValues: {
      prefix: "Dr.",
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

  // Fetch tier level from API for the current provider
  useEffect(() => {
    async function fetchTierLevel() {
      if (!profile?.id) return;
      try {
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
        prefix: profile.prefix || "Dr.",
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
        billingAddress: (() => {
          const addr = profile.billing_address as { street?: string; city?: string; state?: string; zipCode?: string; zip_code?: string; country?: string } | null;
          return {
            street: addr?.street || "",
            city: addr?.city || "",
            state: addr?.state || "",
            zipCode: addr?.zipCode || addr?.zip_code || "",
            country: addr?.country || "USA",
          };
        })(),
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

  async function verifyNpiForSubmit(npi: string): Promise<boolean> {
    setNpiStatus("checking");
    setNpiMessage("Verifying NPI...");
    try {
      const res = await fetch(`/api/provider/verify-npi?npi=${encodeURIComponent(npi)}`);
      if (!res.ok) {
        setNpiStatus("failed");
        setNpiMessage("Unable to verify NPI at this time. Please try again later.");
        return false;
      }
      const result = await res.json();
      if (result.valid) {
        setNpiStatus("verified");
        setNpiMessage(result.message);
        return true;
      } else {
        setNpiStatus("failed");
        setNpiMessage(result.message);
        return false;
      }
    } catch {
      setNpiStatus("failed");
      setNpiMessage("Unable to verify NPI at this time. Please try again later.");
      return false;
    }
  }

  async function onSubmit(data: ProfileFormValues) {
    const trimmedNpi = data.npiNumber?.trim() || "";

    if (trimmedNpi && trimmedNpi !== profile?.npi_number) {
      const npiValid = await verifyNpiForSubmit(trimmedNpi);
      if (!npiValid) return;
    }

    const success = await updatePersonalInfo({ ...data, npiNumber: trimmedNpi });
    if (success) {
      clearPersistedData();
      form.reset(form.getValues());

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

  const delegateMeta = profile as unknown as {
    is_delegate_view?: boolean;
    authorizing_provider_prefix?: string;
    authorizing_provider_first_name?: string;
    authorizing_provider_last_name?: string;
    delegate_title?: string;
    npi_number?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone_number?: string;
  } | null;
  const isDelegateView = Boolean(delegateMeta?.is_delegate_view);
  const authorizingProviderName = (() => {
    if (!delegateMeta) return "";
    return [
      delegateMeta.authorizing_provider_first_name,
      delegateMeta.authorizing_provider_last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  })();
  const assistantFullName = [delegateMeta?.first_name, delegateMeta?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="space-y-8">
      {isDelegateView && (
        <div
          className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 space-y-3"
          data-testid="banner-delegate-profile"
        >
          <div className="font-semibold text-base">
            Provider Assistant
            {assistantFullName ? `: ${assistantFullName}` : ""}
            {delegateMeta?.delegate_title ? ` (${delegateMeta.delegate_title})` : ""}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-700">Authorizing Provider</div>
              <div className="font-medium" data-testid="text-authorizing-provider">
                {authorizingProviderName ? `${delegateMeta?.authorizing_provider_prefix || "Dr."} ${authorizingProviderName}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-700">Provider NPI (used on every Rx)</div>
              <div className="font-medium" data-testid="text-authorizing-npi">
                {delegateMeta?.npi_number || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-700">Your email</div>
              <div className="font-medium">{delegateMeta?.email || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-blue-700">Your phone</div>
              <div className="font-medium">{delegateMeta?.phone_number || "—"}</div>
            </div>
          </div>
          <div className="text-xs text-blue-800/80">
            Every prescription you submit is legally written under the
            authorizing provider&apos;s NPI. The clinical fields below
            (addresses, billing, payment) belong to the provider and are
            read-only here.
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isDelegateView ? "Provider Profile (Read-only)" : "Profile"}
          </h2>
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

            <MedicalLicenseSection
              form={form}
              npiStatus={npiStatus}
              onNpiStatusChange={setNpiStatus}
              npiMessage={npiMessage}
              onNpiMessageChange={setNpiMessage}
              savedNpi={profile?.npi_number || ""}
            />

            <Separator className="bg-gray-200" />

            <SignatureSection form={form} />

            <Separator className="bg-gray-200" />

            <Card>
              <CardHeader>
                <CardTitle data-testid="heading-physical-address">Physical Address</CardTitle>
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
                        <Input {...field} value={field.value || ""} placeholder="123 Main St" data-testid="input-physical-street" />
                      </FormControl>
                      <FormMessage />
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
                          <Input {...field} value={field.value || ""} placeholder="New York" data-testid="input-physical-city" />
                        </FormControl>
                        <FormMessage />
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
                          <Input {...field} value={field.value || ""} placeholder="NY" data-testid="input-physical-state" />
                        </FormControl>
                        <FormMessage />
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
                          <Input {...field} value={field.value || ""} placeholder="10001" data-testid="input-physical-zip" />
                        </FormControl>
                        <FormMessage />
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
                          <Input {...field} value={field.value || ""} placeholder="USA" data-testid="input-physical-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle data-testid="heading-billing-address">Billing Address</CardTitle>
                <CardDescription>Where you would like to receive payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="sameAsPhysical"
                    checked={billingSameAsPhysical}
                    onCheckedChange={(checked) => handleBillingSameAsPhysical(checked === true)}
                    data-testid="checkbox-same-as-physical"
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
                          data-testid="input-billing-street"
                        />
                      </FormControl>
                      <FormMessage />
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
                            data-testid="input-billing-city"
                          />
                        </FormControl>
                        <FormMessage />
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
                            data-testid="input-billing-state"
                          />
                        </FormControl>
                        <FormMessage />
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
                            data-testid="input-billing-zip"
                          />
                        </FormControl>
                        <FormMessage />
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
                            data-testid="input-billing-country"
                          />
                        </FormControl>
                        <FormMessage />
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
                        <Input {...field} value={field.value || ""} placeholder="XX-XXXXXXX" data-testid="input-tax-id" />
                      </FormControl>
                      <FormMessage />
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
                disabled={isSubmitting || isDelegateView || npiStatus === "checking"}
                data-testid="button-save-profile"
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

      {!isDelegateView && <AchSection />}

      <NotificationPreferences />

      <PasswordChangeForm />
    </div>
  );
}
