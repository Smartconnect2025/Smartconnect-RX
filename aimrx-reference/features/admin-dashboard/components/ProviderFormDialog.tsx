"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { formatPhoneNumber } from "@/core/utils/phone";
import { validatePassword } from "@/core/utils/password-validation";
import { PasswordRequirements } from "@/components/ui/password-requirements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateProviderFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  tierLevel?: string;
  companyName?: string;
  // ACH / direct-deposit fields (all optional)
  bankName: string;
  accountHolder: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  fmvDisclosureAccepted: boolean;
}

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProviderFormDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tiers, setTiers] = useState<Array<{ id: string; tier_name: string; tier_code: string; discount_percentage: string }>>([]);
  const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
  const [companyInputMode, setCompanyInputMode] = useState<"select" | "new">("select");
  const [formData, setFormData] = useState<CreateProviderFormData>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    tierLevel: "",
    companyName: "",
    bankName: "",
    accountHolder: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
    fmvDisclosureAccepted: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tiersRes, providersRes] = await Promise.all([
          fetch("/api/admin/tiers"),
          fetch("/api/admin/providers"),
        ]);

        if (tiersRes.ok) {
          const data = await tiersRes.json();
          setTiers(data.tiers || []);
        } else {
          console.error("Failed to fetch tiers:", tiersRes.status);
          toast.error("Failed to load tiers");
        }

        if (providersRes.ok) {
          const data = await providersRes.json();
          const companies = new Set<string>();
          (data.providers || []).forEach((p: { company_name?: string | null }) => {
            if (p.company_name && p.company_name.trim()) {
              companies.add(p.company_name.trim());
            }
          });
          setExistingCompanies(Array.from(companies).sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        console.error("Error fetching form data:", error);
        toast.error("Failed to load form data");
      }
    };

    if (open) {
      fetchData();
      setCompanyInputMode("select");
    }
  }, [open]);

  const handleInputChange = (
    field: keyof CreateProviderFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  function hasAnyAchInput(data: CreateProviderFormData): boolean {
    return Boolean(
      data.bankName.trim() ||
        data.accountHolder.trim() ||
        data.routingNumber.replace(/\D/g, "") ||
        data.accountNumber.replace(/\D/g, "")
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const validation = validatePassword(formData.password);
      if (!validation.isValid) {
        toast.error("Password does not meet all requirements");
        setIsCreating(false);
        return;
      }

      const includeAch = hasAnyAchInput(formData);
      if (includeAch && !formData.fmvDisclosureAccepted) {
        toast.error("Please accept the disclosure before saving banking info");
        setIsCreating(false);
        return;
      }

      const payload = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        role: "provider",
        tierLevel: formData.tierLevel || undefined,
        companyName: formData.companyName || undefined,
        ...(includeAch || formData.fmvDisclosureAccepted
          ? {
              ach: {
                bank_name: formData.bankName || null,
                account_holder: formData.accountHolder || null,
                routing_number: formData.routingNumber || null,
                account_number: formData.accountNumber || null,
                account_type: formData.accountType || null,
                fmv_disclosure_accepted: formData.fmvDisclosureAccepted,
              },
            }
          : {}),
      };
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          formData.tierLevel
            ? `Successfully created provider with ${formData.tierLevel} tier`
            : "Successfully created provider account"
        );
        if (result.achWarning) {
          toast.warning(
            `Provider created, but banking info could not be saved: ${result.achWarning}. The provider can add it from their profile.`
          );
        }
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          phone: "",
          tierLevel: "",
          companyName: "",
          bankName: "",
          accountHolder: "",
          routingNumber: "",
          accountNumber: "",
          accountType: "checking",
          fmvDisclosureAccepted: false,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        console.error("Provider creation failed:", result);
        toast.error(result.error || "Failed to create provider");
      }
    } catch (error) {
      console.error("Error creating provider:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const passwordValidation = validatePassword(formData.password);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-border">
        <DialogHeader>
          <DialogTitle>Create New Provider</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              required
              placeholder="provider@example.com"
              data-testid="input-provider-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
                placeholder="Create a strong password"
                className="pr-10"
                data-testid="input-provider-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {formData.password && (
              <PasswordRequirements
                requirements={passwordValidation.requirements}
                className="mt-3"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="First name"
                data-testid="input-provider-firstname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Last name"
                data-testid="input-provider-lastname"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                handleInputChange("phone", formatted);
              }}
              placeholder="(555) 123-4567"
              data-testid="input-provider-phone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierLevel">Tier Level</Label>
            <Select
              value={formData.tierLevel}
              onValueChange={(value) => handleInputChange("tierLevel", value)}
            >
              <SelectTrigger id="tierLevel" data-testid="select-provider-tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {tiers.length > 0 ? (
                  tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.tier_code}>
                      {tier.tier_name} ({tier.discount_percentage}%)
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No tiers available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="companyName">Company Name</Label>
              <button
                type="button"
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={() => {
                  setCompanyInputMode(companyInputMode === "select" ? "new" : "select");
                  handleInputChange("companyName", "");
                }}
              >
                {companyInputMode === "select" ? "Type new" : "Select existing"}
              </button>
            </div>
            {companyInputMode === "select" ? (
              <Select
                value={formData.companyName}
                onValueChange={(value) => handleInputChange("companyName", value)}
              >
                <SelectTrigger id="companyName" data-testid="select-provider-company">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {existingCompanies.length > 0 ? (
                    existingCompanies.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No companies yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder="Enter company name"
                data-testid="input-provider-company"
              />
            )}
          </div>

          {/* === Banking / FMV Disclosure section ===
              Doug Rainey ask (May 13 2026 email). All fields are OPTIONAL.
              If any banking field is filled, the disclosure checkbox must be ticked. */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h3 className="text-base font-semibold">Banking Information (Optional)</h3>

            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2"
              data-testid="disclosure-fmv"
            >
              <p>
                AIMRx is a SaaS platform that provides unique workflow and
                access benefits to Prescribers. The assessed Fair Market Value
                of this service has been determined to be <strong>$25 per
                interaction</strong>, and this is assessed in the checkout cart
                of each transaction.
              </p>
              <p>
                There is an optional feature available in the prescription
                process allowing Prescribers to charge their consult fee
                (Medication Oversight/Management) using our payment processing
                service. This dollar amount will add up throughout the month and
                will be visible in your Account Profile Home Page. If you choose
                to use this service, these funds will be paid back to you in
                full via ACH every month. Please complete the ACH information
                below if you plan to use this service.
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="fmvDisclosureAccepted"
                checked={formData.fmvDisclosureAccepted}
                onCheckedChange={(checked) =>
                  handleInputChange("fmvDisclosureAccepted", checked === true)
                }
                data-testid="checkbox-fmv-disclosure"
              />
              <Label
                htmlFor="fmvDisclosureAccepted"
                className="text-sm font-normal cursor-pointer leading-snug"
              >
                I have read and acknowledge the disclosure above
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange("bankName", e.target.value)}
                  placeholder="e.g. Chase"
                  data-testid="input-provider-bank-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolder">Account Holder Name</Label>
                <Input
                  id="accountHolder"
                  value={formData.accountHolder}
                  onChange={(e) => handleInputChange("accountHolder", e.target.value)}
                  placeholder="As shown on the account"
                  data-testid="input-provider-account-holder"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="routingNumber">Routing Number</Label>
                <Input
                  id="routingNumber"
                  value={formData.routingNumber}
                  onChange={(e) =>
                    handleInputChange("routingNumber", e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9 digits"
                  data-testid="input-provider-routing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    handleInputChange("accountNumber", e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="Account number"
                  data-testid="input-provider-account-number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) => handleInputChange("accountType", value)}
              >
                <SelectTrigger id="accountType" data-testid="select-provider-account-type">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border border-border"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} data-testid="button-create-provider">
              {isCreating ? "Creating..." : "Create Provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
