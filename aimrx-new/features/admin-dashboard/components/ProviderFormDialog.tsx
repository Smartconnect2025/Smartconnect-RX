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

interface CreateProviderFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  tierLevel?: string;
  groupId?: string;
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
  const [groups, setGroups] = useState<Array<{ id: string; name: string; platform_manager_name: string | null }>>([]);
  const [formData, setFormData] = useState<CreateProviderFormData>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    tierLevel: "",
    groupId: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tiersRes, groupsRes] = await Promise.all([
          fetch("/api/admin/tiers"),
          fetch("/api/admin/groups"),
        ]);

        if (tiersRes.ok) {
          const data = await tiersRes.json();
          setTiers(data.tiers || []);
        } else {
          console.error("Failed to fetch tiers:", tiersRes.status);
          toast.error("Failed to load tiers");
        }

        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setGroups(data.groups || []);
        }
      } catch (error) {
        console.error("Error fetching form data:", error);
        toast.error("Failed to load form data");
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  const handleInputChange = (
    field: keyof CreateProviderFormData,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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

      const payload = {
        ...formData,
        role: "provider",
        groupId: formData.groupId || undefined,
        tierLevel: formData.tierLevel || undefined,
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
          `Provider account created! Welcome email sent to ${formData.email} with login credentials.`
        );
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          phone: "",
          tierLevel: "",
          groupId: "",
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
      <DialogContent className="max-w-md bg-white border border-border">
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
          <div className="grid grid-cols-2 gap-3">
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
              <Label htmlFor="groupId">Group</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => handleInputChange("groupId", value)}
              >
                <SelectTrigger id="groupId" data-testid="select-provider-group">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No groups available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
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
