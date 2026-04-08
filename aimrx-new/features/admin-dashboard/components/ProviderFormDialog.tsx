"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw, Building2, Plus, Trash2, Loader2 } from "lucide-react";
import { formatPhoneNumber } from "@/core/utils/phone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PharmacyOption {
  id: string;
  name: string;
}

interface CompanyOption {
  id: string;
  name: string;
  providerCount: number;
}

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  pharmacyId?: string | null;
  pharmacyName?: string | null;
  isSuperAdmin?: boolean;
}

export function ProviderFormDialog({
  open,
  onOpenChange,
  onSuccess,
  pharmacyId,
  pharmacyName,
  isSuperAdmin = false,
}: ProviderFormDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyInputMode, setCompanyInputMode] = useState<"select" | "new">("select");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyOption | null>(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    selectedPharmacyId: "",
  });

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/admin/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies((data.companies || []).map((c: { id: string; name: string; providerCount: number }) => ({
          id: c.id,
          name: c.name,
          providerCount: c.providerCount,
        })));
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pharmacyRes] = await Promise.all([
          isSuperAdmin ? fetch("/api/admin/pharmacies") : null,
        ]);

        if (pharmacyRes?.ok) {
          const data = await pharmacyRes.json();
          setPharmacies(data.pharmacies || []);
        }

        await fetchCompanies();
      } catch (error) {
        console.error("Error fetching form data:", error);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, isSuperAdmin]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generatePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    password = password.split("").sort(() => Math.random() - 0.5).join("");
    setFormData((prev) => ({ ...prev, password }));
    setShowPassword(true);
    toast.success("Secure password generated!");
  };

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    const existing = companies.find(c => c.name.toLowerCase() === newCompanyName.trim().toLowerCase());
    if (existing) {
      toast.error("This company already exists");
      return;
    }

    setIsAddingCompany(true);
    try {
      const resolvedPharmacyId = isSuperAdmin
        ? formData.selectedPharmacyId
        : (pharmacyId || undefined);

      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName.trim(), pharmacyId: resolvedPharmacyId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Company "${newCompanyName.trim()}" added`);
        setFormData(prev => ({ ...prev, companyName: newCompanyName.trim() }));
        setNewCompanyName("");
        setCompanyInputMode("select");
        await fetchCompanies();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add company");
      }
    } catch {
      toast.error("Failed to add company");
    } finally {
      setIsAddingCompany(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    setIsDeletingCompany(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: deleteTarget.name }),
      });

      if (res.ok) {
        toast.success(`Company "${deleteTarget.name}" deleted`);
        if (formData.companyName === deleteTarget.name) {
          setFormData(prev => ({ ...prev, companyName: "" }));
        }
        setDeleteTarget(null);
        await fetchCompanies();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete company");
      }
    } catch {
      toast.error("Failed to delete company");
    } finally {
      setIsDeletingCompany(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!formData.companyName) {
      toast.error("Company name is required");
      return;
    }

    if (isSuperAdmin && !formData.selectedPharmacyId) {
      toast.error("Please select a pharmacy to assign this provider to");
      return;
    }

    setIsCreating(true);

    try {
      const resolvedPharmacyId = isSuperAdmin
        ? formData.selectedPharmacyId
        : (pharmacyId || undefined);

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        companyName: formData.companyName,
        role: "provider",
        pharmacyId: resolvedPharmacyId,
      };

      const response = await fetch("/api/admin/invite-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          `Provider invited! Welcome email sent to ${formData.email} with login credentials.`
        );
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          phone: "",
          companyName: "",
          selectedPharmacyId: "",
        });
        setCompanyInputMode("select");
        setNewCompanyName("");
        onOpenChange(false);
        onSuccess?.();
      } else {
        console.error("Provider creation failed:", result);
        toast.error(result.error || "Failed to invite provider");
      }
    } catch (error) {
      console.error("Error creating provider:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-white border border-border">
          <DialogHeader>
            <DialogTitle>
              {isSuperAdmin ? "Invite New Provider" : `Invite Provider to ${pharmacyName || "Your Pharmacy"}`}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? "Add a new provider to the platform. They will receive login credentials via email."
                : `Invite a provider to join ${pharmacyName || "your pharmacy"}. They will receive login credentials via email.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  required
                  placeholder="John"
                  data-testid="input-provider-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                  placeholder="Doe"
                  data-testid="input-provider-lastname"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  placeholder="doctor@example.com"
                  data-testid="input-provider-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    handleInputChange("phone", formatted);
                  }}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  data-testid="input-provider-phone"
                />
                <p className="text-xs text-gray-500">Must be exactly 10 digits</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Company Name *</Label>
              <div className="flex items-center gap-1 mb-2">
                <Button
                  type="button"
                  variant={companyInputMode === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCompanyInputMode("select")}
                  className="text-xs h-7 px-3"
                >
                  Select Existing
                </Button>
                <Button
                  type="button"
                  variant={companyInputMode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCompanyInputMode("new");
                    setNewCompanyName("");
                  }}
                  className="text-xs h-7 px-3"
                >
                  New Company
                </Button>
              </div>
              {companyInputMode === "select" ? (
                <div className="space-y-2">
                  <Select
                    value={formData.companyName}
                    onValueChange={(val) => handleInputChange("companyName", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-- Select a company --" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.length > 0 ? (
                        companies.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{c.name}</span>
                              <span className="text-xs text-gray-400">({c.providerCount} providers)</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty__" disabled>No companies yet — add one</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.companyName && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const target = companies.find(c => c.name === formData.companyName);
                          if (target) setDeleteTarget(target);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete this company
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Enter new company name"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCompany();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddCompany}
                    disabled={isAddingCompany || !newCompanyName.trim()}
                    size="sm"
                    className="h-9 bg-blue-600 hover:bg-blue-700 text-white px-3"
                  >
                    {isAddingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              <p className="text-xs text-blue-600">Providers in the same company share patient access</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={generatePassword} className="px-3" title="Generate password">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isSuperAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="pharmacySelect">Assign to Pharmacy *</Label>
                <Select
                  value={formData.selectedPharmacyId}
                  onValueChange={(val) => handleInputChange("selectedPharmacyId", val === "none" ? "" : val)}
                >
                  <SelectTrigger id="pharmacySelect">
                    <SelectValue placeholder="-- Select a pharmacy --" />
                  </SelectTrigger>
                  <SelectContent>
                    {pharmacies.map((pharmacy) => (
                      <SelectItem key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Select which pharmacy this provider will be linked to</p>
              </div>
            ) : pharmacyName ? (
              <div className="space-y-2">
                <Label>Pharmacy</Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-800">{pharmacyName}</span>
                </div>
                <p className="text-xs text-gray-500">This provider will be linked to your pharmacy</p>
              </div>
            ) : null}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Note:</span> The provider will receive a welcome email with their login credentials. They can then log in and complete their profile by adding payment information, addresses, and other details.
              </p>
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
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-create-provider"
              >
                {isCreating ? "Inviting..." : "Invite Provider"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              {deleteTarget && deleteTarget.providerCount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  This will remove the company from {deleteTarget.providerCount} provider(s) and revoke shared patient access.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={isDeletingCompany}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingCompany ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
