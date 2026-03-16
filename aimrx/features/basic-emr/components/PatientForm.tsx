"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useFormPersistence } from "@/hooks/useFormPersistence";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";

import { US_STATES } from "../constants";
import {
  patientFormSchema,
  PatientFormValues,
  formatPhoneNumber,
  genderOptions,
  languageOptions,
} from "../schemas";
import { CreatePatientData } from "../services/patientService";
import { useEmrStore } from "../store/emr-store";
import { GenderEnum, Patient } from "../types";

interface PatientFormProps {
  patient?: Patient;
  isEditing?: boolean;
}

export function PatientForm({ patient, isEditing = false }: PatientFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const { guardAction } = useDemoGuard();
  const createPatient = useEmrStore((state) => state.createPatient);
  const updatePatientAsync = useEmrStore((state) => state.updatePatientAsync);
  const loading = useEmrStore((state) => state.loading);
  const error = useEmrStore((state) => state.error);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingSameAsAddress, setBillingSameAsAddress] = useState(true);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: patient?.firstName || "",
      lastName: patient?.lastName || "",
      email: patient?.email || "",
      phone: patient?.phone || "",
      dateOfBirth: patient?.dateOfBirth || "",
      gender: patient?.gender || GenderEnum.Male,
      address: {
        street: patient?.address?.street || "",
        city: patient?.address?.city || "",
        state: patient?.address?.state || "",
        zipCode: patient?.address?.zipCode || "",
        country: patient?.address?.country || "USA",
      },
      physicalAddress: {
        street: patient?.physical_address?.street || "",
        city: patient?.physical_address?.city || "",
        state: patient?.physical_address?.state || "",
        zipCode: patient?.physical_address?.zipCode || "",
        country: patient?.physical_address?.country || "USA",
      },
      billingAddress: {
        street: patient?.billing_address?.street || "",
        city: patient?.billing_address?.city || "",
        state: patient?.billing_address?.state || "",
        zipCode: patient?.billing_address?.zipCode || "",
        country: patient?.billing_address?.country || "USA",
      },
      emergencyContact: patient?.emergencyContact,
      insurance: patient?.insurance,
      preferredLanguage:
        (patient?.preferredLanguage as
          | "English"
          | "Spanish"
          | "French"
          | "Portuguese"
          | "Mandarin") || "English",
    },
  });

  // Persist form data to localStorage (disabled when editing existing patient)
  const { clearPersistedData } = useFormPersistence({
    storageKey: `patient-form-${user?.id || "draft"}`,
    watch: form.watch,
    setValue: form.setValue,
    disabled: isEditing, // Don't persist when editing existing patient
  });

  useEffect(() => {
    if (!user) {
      toast.error("Please log in to access patient forms");
      router.push("/auth");
    }
  }, [user, router]);

  // Handle billing address same as primary address checkbox
  const handleBillingSameAsAddress = (checked: boolean) => {
    setBillingSameAsAddress(checked);
    if (checked) {
      // Copy primary address to billing address
      const address = form.getValues("address");
      form.setValue("billingAddress.street", address?.street || "");
      form.setValue("billingAddress.city", address?.city || "");
      form.setValue("billingAddress.state", address?.state || "");
      form.setValue("billingAddress.zipCode", address?.zipCode || "");
      form.setValue("billingAddress.country", address?.country || "USA");
    }
  };

  // Watch primary address for real-time sync
  const watchedAddress = form.watch("address");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);

  // Real-time sync with debounce: Update billing address when primary address changes
  useEffect(() => {
    if (!billingSameAsAddress || isUpdatingRef.current) return;

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the update
    debounceRef.current = setTimeout(() => {
      isUpdatingRef.current = true;
      form.setValue("billingAddress.street", watchedAddress?.street || "", {
        shouldValidate: false,
      });
      form.setValue("billingAddress.city", watchedAddress?.city || "", {
        shouldValidate: false,
      });
      form.setValue("billingAddress.state", watchedAddress?.state || "", {
        shouldValidate: false,
      });
      form.setValue("billingAddress.zipCode", watchedAddress?.zipCode || "", {
        shouldValidate: false,
      });
      form.setValue(
        "billingAddress.country",
        watchedAddress?.country || "USA",
        { shouldValidate: false },
      );

      // Reset flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    }, 100);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    billingSameAsAddress,
    watchedAddress?.street,
    watchedAddress?.city,
    watchedAddress?.state,
    watchedAddress?.zipCode,
    watchedAddress?.country,
  ]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Please log in to access patient forms
          </h2>
          <Button onClick={() => router.push("/auth")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: PatientFormValues) => {
    if (!user?.id) {
      toast.error("Please log in to save patient data");
      return;
    }

    setIsSubmitting(true);

    const patientData: CreatePatientData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      // Send as address (API will store in physical_address column)
      address: data.address
        ? {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            zipCode: data.address.zipCode,
          }
        : undefined,
      billingAddress: data.billingAddress
        ? {
            street: data.billingAddress.street,
            city: data.billingAddress.city,
            state: data.billingAddress.state,
            zipCode: data.billingAddress.zipCode,
          }
        : undefined,
      emergencyContact: data.emergencyContact,
      insurance: data.insurance
        ? {
            ...data.insurance,
            groupNumber: data.insurance.groupNumber || "",
          }
        : undefined,
      preferredLanguage: data.preferredLanguage,
    };

    try {
      let result;
      if (isEditing && patient?.id) {
        result = await updatePatientAsync(patient.id, user.id, patientData);
      } else {
        result = await createPatient(user.id, patientData);
      }

      if (result) {
        // Clear persisted form data on successful submission
        clearPersistedData();

        // Show appropriate success message
        if (isEditing) {
          toast.success("Patient information updated successfully");
          router.push(`/basic-emr/patients/${patient?.id}`);
        } else {
          toast.success("Patient account created successfully!");
          router.push(`/basic-emr/patients/${result.id}`);
        }
      }
    } catch (error) {
      console.error("Error saving patient:", error);
      toast.error("Failed to save patient data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const isFormDisabled = loading || isSubmitting;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">
          {isEditing ? "Edit Patient" : "Create New Patient"}
        </h1>

        {loading && !isSubmitting && (
          <div className="text-center py-4">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <Card className="rounded-sm border border-gray-200 p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => guardAction(() => onSubmit(data)))} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        First Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
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
                      <FormLabel className="text-gray-700 font-medium">
                        Last Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter last name"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        Date of Birth{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        Gender <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex space-x-6 mt-3"
                          disabled={isFormDisabled}
                        >
                          {genderOptions.map((genderOption) => (
                            <div
                              key={genderOption}
                              className="flex items-center space-x-2"
                            >
                              <RadioGroupItem
                                value={genderOption}
                                id={genderOption.toLowerCase()}
                                className="text-primary"
                              />
                              <Label
                                htmlFor={genderOption.toLowerCase()}
                                className="text-gray-700 cursor-pointer"
                              >
                                {genderOption}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        Phone Number <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(555) 555-5555"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                          onChange={(e) => {
                            field.onChange(formatPhoneNumber(e.target.value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        Email <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">
                      Street Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main St"
                        className="w-full border-gray-300 rounded-lg"
                        disabled={isFormDisabled}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        City
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="City name"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                          onChange={(e) => {
                            // remove numbers in realtime
                            const value = e.target.value.replace(/[0-9]/g, "");
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        State
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isFormDisabled}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full border-gray-300 rounded-lg">
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

                <FormField
                  control={form.control}
                  name="address.zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        ZIP Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12345"
                          className="w-full border-gray-300 rounded-lg"
                          disabled={isFormDisabled}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Billing Address Section */}
              <div className="col-span-1 md:col-span-2 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Billing Address
                  </h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="billingSameAsAddress"
                      checked={billingSameAsAddress}
                      onChange={(e) =>
                        handleBillingSameAsAddress(e.target.checked)
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={isFormDisabled}
                    />
                    <label
                      htmlFor="billingSameAsAddress"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Same as primary address
                    </label>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="billingAddress.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">
                      Street Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main St"
                        className={`w-full border-gray-300 rounded-lg ${billingSameAsAddress ? "bg-gray-50" : ""}`}
                        disabled={isFormDisabled || billingSameAsAddress}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="billingAddress.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        City
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="City name"
                          className={`w-full border-gray-300 rounded-lg ${billingSameAsAddress ? "bg-gray-50" : ""}`}
                          disabled={isFormDisabled || billingSameAsAddress}
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[0-9]/g, "");
                            field.onChange(value);
                          }}
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
                      <FormLabel className="text-gray-700 font-medium">
                        State
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isFormDisabled || billingSameAsAddress}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={`w-full border-gray-300 rounded-lg ${billingSameAsAddress ? "bg-gray-50" : ""}`}
                          >
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

                <FormField
                  control={form.control}
                  name="billingAddress.zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        ZIP Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="12345"
                          className={`w-full border-gray-300 rounded-lg ${billingSameAsAddress ? "bg-gray-50" : ""}`}
                          disabled={isFormDisabled || billingSameAsAddress}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">
                      Preferred Language
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isFormDisabled}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full border-gray-300 rounded-lg">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languageOptions.map((language) => (
                          <SelectItem key={language} value={language}>
                            {language}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="col-span-1 md:col-span-2 flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isFormDisabled}
                  className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isFormDisabled}
                  variant="default"
                  className="px-6 py-2 rounded-lg"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                      ? "Update Patient"
                      : "Create & View Chart"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
