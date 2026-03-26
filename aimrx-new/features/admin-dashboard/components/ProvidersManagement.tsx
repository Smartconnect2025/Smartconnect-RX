"use client";

import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { Eye, EyeOff, Trash2, UserPlus, Search, RefreshCw, CheckCircle2, XCircle, FolderTree, UserCog, Building2, Edit, Key, Power, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseTableManagement } from "./BaseTableManagement";
import { getOptimizedAvatarUrl } from "@core/services/storage/avatarStorage";
import { formatPhoneNumber } from "@/core/utils/phone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Provider } from "../types";
import { ProviderFormDialog } from "./ProviderFormDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useUser } from "@core/auth";

interface GroupOption {
  id: string;
  name: string;
  platform_manager_name: string | null;
}

interface PharmacyOption {
  id: string;
  name: string;
}

interface NpiStatus {
  isVerifying: boolean;
  result: "valid" | "invalid" | null;
  providerName?: string;
  message?: string;
}

interface ProvidersManagementProps {
  initialPharmacyFilter?: string;
}

export const ProvidersManagement: React.FC<ProvidersManagementProps> = ({ initialPharmacyFilter }) => {
  const { guardAction } = useDemoGuard();
  const { user } = useUser();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>(initialPharmacyFilter || "all");
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [assigningProvider, setAssigningProvider] = useState<Provider | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<NpiStatus>({ isVerifying: false, result: null });

  const [resetPasswordProvider, setResetPasswordProvider] = useState<Provider | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [activatingProvider, setActivatingProvider] = useState<Provider | null>(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [activationNpiStatus, setActivationNpiStatus] = useState<NpiStatus>({ isVerifying: false, result: null });
  const npiVerifyRef = useRef<string | null>(null);
  const activationNpiVerifyRef = useRef<string | null>(null);

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/admin/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      if (response.ok) {
        const data = await response.json();
        setPharmacies(data.pharmacies || []);
      }
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        params.set("pharmacyId", pharmacyFilter);
      }
      const url = `/api/admin/providers${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      } else {
        toast.error("Failed to fetch providers");
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
      toast.error("Failed to fetch providers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkScope = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch("/api/admin/scope");
        if (res.ok) {
          const data = await res.json();
          if (data.isSuperAdmin) {
            setIsSuperAdmin(true);
          } else if (data.isPharmacyAdmin && data.pharmacyId) {
            setPharmacyId(data.pharmacyId);
          }
        }
      } catch (error) {
        console.error("Error checking admin scope:", error);
      }
      setScopeChecked(true);
    };
    checkScope();
  }, [user?.id]);

  useEffect(() => {
    if (!scopeChecked) return;
    if (isSuperAdmin) {
      fetchGroups();
      fetchPharmacies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked, isSuperAdmin]);

  useEffect(() => {
    if (!scopeChecked) return;
    fetchProviders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked, pharmacyFilter]);

  const filteredProviders = providers.filter((provider) => {
    const fullName =
      `${provider.first_name || ""} ${provider.last_name || ""}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      provider.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.group_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || provider.status === statusFilter;
    const matchesGroup =
      groupFilter === "all" ||
      (groupFilter === "unassigned" ? !provider.group_id : provider.group_id === groupFilter);
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 border border-border"
            data-testid="badge-status-active"
          >
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-800 border border-border"
            data-testid="badge-status-inactive"
          >
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAssignGroup = async () => {
    if (!assigningProvider) return;
    guardAction(async () => {
    setIsAssigning(true);
    try {
      const groupValue = (!selectedGroupId || selectedGroupId === "none") ? null : selectedGroupId;
      const response = await fetch(`/api/admin/providers/${assigningProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupValue }),
      });

      if (response.ok) {
        toast.success(
          selectedGroupId === "none"
            ? "Provider removed from group"
            : "Provider assigned to group"
        );
        setAssigningProvider(null);
        setSelectedGroupId("");
        fetchProviders();
      } else {
        toast.error("Failed to update group assignment");
      }
    } catch (error) {
      console.error("Error assigning group:", error);
      toast.error("Failed to update group assignment");
    } finally {
      setIsAssigning(false);
    }
    });
  };

  const openEditModal = (provider: Provider) => {
    setEditingProvider(provider);
    setEditFormData({
      firstName: provider.first_name || "",
      lastName: provider.last_name || "",
      email: provider.email || "",
      phone: provider.phone_number || "",
      companyName: provider.company_name || "",
    });
    setNpiVerificationStatus({ isVerifying: false, result: null });
    setIsEditModalOpen(true);
  };

  const handleEditProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    guardAction(async () => {
    if (editFormData.phone) {
      const digitsOnly = editFormData.phone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        toast.error("Phone number must be exactly 10 digits");
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/providers/${editingProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editFormData.firstName,
          last_name: editFormData.lastName,
          phone_number: editFormData.phone || null,
          company_name: editFormData.companyName || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update provider");
      }
      toast.success("Provider updated successfully");
      fetchProviders();
      setIsEditModalOpen(false);
      setEditingProvider(null);
    } catch (error) {
      console.error("Error updating provider:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update provider");
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  const handleVerifyNPI = async (npiNumber: string) => {
    if (!npiNumber || npiNumber.length !== 10) {
      setNpiVerificationStatus({ isVerifying: false, result: "invalid", message: "NPI must be exactly 10 digits" });
      return;
    }
    const requestId = `${npiNumber}-${Date.now()}`;
    npiVerifyRef.current = requestId;
    setNpiVerificationStatus({ isVerifying: true, result: null });
    try {
      const response = await fetch(`/api/admin/verify-npi?npi=${npiNumber}`);
      const data = await response.json();
      if (npiVerifyRef.current !== requestId) return;
      if (!response.ok) throw new Error(data.error || "Failed to verify NPI");
      if (data.valid) {
        setNpiVerificationStatus({ isVerifying: false, result: "valid", providerName: data.providerName, message: data.message });
        toast.success(`NPI verified: ${data.providerName}`);
      } else {
        setNpiVerificationStatus({ isVerifying: false, result: "invalid", message: data.message || "NPI not found in CMS registry" });
      }
    } catch (error) {
      if (npiVerifyRef.current !== requestId) return;
      console.error("Error verifying NPI:", error);
      setNpiVerificationStatus({ isVerifying: false, result: "invalid", message: "Failed to verify NPI" });
    }
  };

  const openResetPasswordDialog = (provider: Provider) => {
    setResetPasswordProvider(provider);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetPasswordOpen(true);
  };

  const generateResetPassword = () => {
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
    setNewPassword(password);
    setShowNewPassword(true);
    toast.success("Secure password generated!");
  };

  const handleResetPassword = async () => {
    if (!resetPasswordProvider || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    guardAction(async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/reset-provider-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetPasswordProvider.email, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reset password");
      toast.success(data.message || "Password reset successfully");
      setIsResetPasswordOpen(false);
      setResetPasswordProvider(null);
      setNewPassword("");
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  const openActivationModal = (provider: Provider) => {
    setActivatingProvider(provider);
    setActivationNpiStatus({ isVerifying: false, result: null });
    setIsActivationModalOpen(true);
    if (!provider.is_active && provider.npi_number) {
      verifyNpiForActivation(provider.npi_number);
    }
  };

  const verifyNpiForActivation = async (npiNumber: string) => {
    if (!npiNumber || npiNumber.length !== 10) {
      setActivationNpiStatus({ isVerifying: false, result: "invalid", message: "NPI must be exactly 10 digits" });
      return;
    }
    const requestId = `${npiNumber}-${Date.now()}`;
    activationNpiVerifyRef.current = requestId;
    setActivationNpiStatus({ isVerifying: true, result: null });
    try {
      const response = await fetch(`/api/admin/verify-npi?npi=${npiNumber}`);
      const data = await response.json();
      if (activationNpiVerifyRef.current !== requestId) return;
      if (!response.ok) throw new Error(data.error || "Failed to verify NPI");
      setActivationNpiStatus({
        isVerifying: false,
        result: data.valid ? "valid" : "invalid",
        providerName: data.providerName,
        message: data.message,
      });
    } catch (error) {
      if (activationNpiVerifyRef.current !== requestId) return;
      console.error("Error verifying NPI for activation:", error);
      setActivationNpiStatus({ isVerifying: false, result: "invalid", message: "Failed to verify NPI" });
    }
  };

  const confirmToggleActive = async () => {
    if (!activatingProvider) return;
    guardAction(async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/providers/${activatingProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !activatingProvider.is_active }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update provider status");
      }
      toast.success(`Provider ${!activatingProvider.is_active ? "activated" : "deactivated"} successfully`);
      setIsActivationModalOpen(false);
      setActivatingProvider(null);
      setActivationNpiStatus({ isVerifying: false, result: null });
      fetchProviders();
    } catch (error) {
      console.error("Error toggling provider status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update provider status");
    } finally {
      setIsSubmitting(false);
    }
    });
  };

  const handleToggleDemo = async (provider: Provider) => {
    const newDemoStatus = !provider.is_demo;
    try {
      const response = await fetch(`/api/admin/users/${provider.user_id}/demo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_demo: newDemoStatus }),
      });
      const data = await response.json();
      if (data.success) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === provider.id ? { ...p, is_demo: newDemoStatus } : p,
          ),
        );
        toast.success(
          newDemoStatus
            ? `${provider.first_name} ${provider.last_name} is now a demo account`
            : `Demo mode removed from ${provider.first_name} ${provider.last_name}`,
        );
      } else {
        toast.error("Failed to update demo status");
      }
    } catch {
      toast.error("Failed to update demo status");
    }
  };

  const handleDeleteProvider = async () => {
    if (!deletingProvider) return;
    guardAction(async () => {
    try {
      if (!deletingProvider.email) {
        throw new Error("Provider email is required for deletion");
      }
      const response = await fetch(
        `/api/admin/delete-provider?email=${encodeURIComponent(deletingProvider.email)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.details || data.error || "Failed to delete provider");
      }
      toast.success("Provider deleted successfully");
      setDeletingProvider(null);
      fetchProviders();
    } catch (error) {
      console.error("Error deleting provider:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete provider");
    }
    });
  };

  const handleRevalidate = async () => {
    guardAction(async () => {
    setIsRevalidating(true);
    try {
      const response = await fetch("/api/admin/providers/revalidate", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        fetchProviders();
      } else {
        toast.error("Failed to revalidate providers");
      }
    } catch (error) {
      console.error("Error revalidating providers:", error);
      toast.error("Failed to revalidate providers");
    } finally {
      setIsRevalidating(false);
    }
    });
  };

  const renderTableHeaders = () => (
    <>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Provider
      </th>
      {isSuperAdmin && (
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Pharmacy
      </th>
      )}
      {isSuperAdmin && (
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Group
      </th>
      )}
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Contact
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        NPI Number
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Verified
      </th>
      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
        Status
      </th>
      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
        Actions
      </th>
    </>
  );

  const renderTableRow = (provider: Provider) => (
    <>
      <td className="p-4 align-middle">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={
                provider.avatar_url
                  ? getOptimizedAvatarUrl(provider.avatar_url, 40)
                  : ""
              }
              alt={`${provider.first_name || ""} ${provider.last_name || ""}`}
            />
            <AvatarFallback className="text-sm">
              {provider.first_name && provider.last_name
                ? `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase()
                : "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="font-medium flex items-center gap-2">
              {provider.first_name && provider.last_name
                ? `${provider.first_name} ${provider.last_name}`
                : ""}
              {provider.is_demo && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0">
                  DEMO
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {provider.email || ""}
            </div>
          </div>
        </div>
      </td>
      {isSuperAdmin && (
      <td className="p-4 align-middle">
        {provider.pharmacy_names && provider.pharmacy_names.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {provider.pharmacy_names.map((name, i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 text-xs w-fit"
              >
                <Building2 className="h-3 w-3 mr-1" />
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">Not linked</span>
        )}
      </td>
      )}
      {isSuperAdmin && (
      <td className="p-4 align-middle">
        {provider.group_name ? (
          <div className="flex flex-col gap-0.5">
            <Badge
              variant="outline"
              className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs w-fit cursor-pointer hover:bg-indigo-100"
              data-testid={`badge-group-${provider.id}`}
              onClick={() => {
                setAssigningProvider(provider);
                setSelectedGroupId(provider.group_id || "none");
              }}
            >
              <FolderTree className="h-3 w-3 mr-1" />
              {provider.group_name}
            </Badge>
            {provider.platform_manager_name && (
              <span className="text-xs text-muted-foreground pl-0.5">
                {provider.platform_manager_name}
              </span>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-indigo-600 h-7 px-2"
            data-testid={`button-assign-group-${provider.id}`}
            onClick={() => {
              setAssigningProvider(provider);
              setSelectedGroupId("none");
            }}
          >
            + Assign Group
          </Button>
        )}
      </td>
      )}
      <td className="p-4 align-middle">
        {provider.phone_number ? (
          <span className="text-sm">{provider.phone_number}</span>
        ) : (
          <span className="text-muted-foreground">No phone</span>
        )}
      </td>
      <td className="p-4 align-middle">
        {provider.npi_number ? (
          <span className="text-sm font-mono">{provider.npi_number}</span>
        ) : (
          <span className="text-muted-foreground">Not provided</span>
        )}
      </td>
      <td className="p-4 align-middle">
        {provider.is_verified ? (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Not Verified</span>
          </div>
        )}
      </td>
      <td className="p-4 align-middle">{getStatusBadge(provider.status)}</td>
      <td className="p-4 align-middle text-right">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditModal(provider)}
            className="border border-border"
            title="Edit provider"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openResetPasswordDialog(provider)}
            className="border border-border"
            title="Reset password"
          >
            <Key className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openActivationModal(provider)}
            className="border border-border"
            title={provider.is_active ? "Deactivate provider" : "Activate provider"}
          >
            <Power className="h-4 w-4" />
          </Button>
          {isSuperAdmin && (
          <Button
            variant={provider.is_demo ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggleDemo(provider)}
            className={provider.is_demo ? "bg-amber-500 hover:bg-amber-600 text-white" : "border border-border"}
            title={provider.is_demo ? "Demo account — click to remove demo mode" : "Make this a demo account"}
            data-testid={`button-toggle-demo-${provider.id}`}
          >
            <UserCog className="h-4 w-4" />
          </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeletingProvider(provider)}
            className="border border-border text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete provider"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </>
  );

  return (
    <>
      <div className="container max-w-7xl mx-auto py-6 space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Provider Management
            </h2>
          </div>
          <div className="flex gap-2">
            {isSuperAdmin && (
            <Button
              onClick={handleRevalidate}
              disabled={isRevalidating}
              variant="outline"
              className="border border-border"
              data-testid="button-revalidate"
            >
              {isRevalidating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Revalidating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Revalidate All
                </>
              )}
            </Button>
            )}
            <Button
              onClick={() => guardAction(() => setIsFormOpen(true))}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-add-provider"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="mb-1">
            <div className="space-y-1.5">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger id="pharmacy-filter" className="w-[260px] bg-white" data-testid="select-pharmacy-filter">
                  <SelectValue placeholder="Select pharmacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <Input
                placeholder="Search by name, email, specialty, group..."
                className="pl-12 h-11 rounded-lg border-gray-200 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-providers"
              />
            </div>

            {isSuperAdmin && (
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[200px] h-11 border-gray-200 bg-white" data-testid="select-group-filter">
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchProviders()}
              className="h-11 w-11 border-gray-200 bg-white hover:bg-gray-50"
              data-testid="button-refresh-providers"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <BaseTableManagement
          data={filteredProviders}
          isLoading={isLoading}
          renderTableHeaders={renderTableHeaders}
          renderTableRow={renderTableRow}
          getItemKey={(provider) => provider.id}
          emptyStateMessage="No providers found"
        />
      </div>

      {/* Edit Provider Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col bg-white border border-border">
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update provider information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditProvider} className="space-y-4 overflow-y-auto pr-2 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name *</Label>
                <Input
                  id="editFirstName"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name *</Label>
                <Input
                  id="editLastName"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editEmail">Email *</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => {
                    const formatted = formatPhoneNumber(e.target.value);
                    setEditFormData({ ...editFormData, phone: formatted });
                  }}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                />
                <p className="text-xs text-gray-500 mt-1">Must be exactly 10 digits</p>
              </div>
            </div>
            <div>
              <Label htmlFor="editCompanyName">Company Name</Label>
              <Input
                id="editCompanyName"
                value={editFormData.companyName}
                onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                placeholder="Enter company name"
              />
            </div>

            {editingProvider && (
              <div className="space-y-4 mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-900">Professional Credentials (Read-Only)</h3>
                <p className="text-xs text-gray-600 mb-4">
                  This information is managed by the provider and can only be updated by them through their profile.
                </p>
                <div className={editingProvider.npi_number ? "bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3" : "bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3"}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={editingProvider.npi_number ? "text-xs text-orange-700 font-medium" : "text-xs text-gray-600 font-medium"}>
                      National Provider Identifier (NPI)
                    </p>
                    {editingProvider.npi_number && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifyNPI(editingProvider.npi_number!)}
                        disabled={npiVerificationStatus.isVerifying}
                        className="h-7 text-xs"
                      >
                        {npiVerificationStatus.isVerifying ? "Verifying..." : "Verify NPI"}
                      </Button>
                    )}
                  </div>
                  {editingProvider.npi_number ? (
                    <>
                      <p className="text-sm font-mono font-bold text-orange-900 mb-2">{editingProvider.npi_number}</p>
                      {npiVerificationStatus.result && (
                        <div className={`mt-2 p-2 rounded-md ${npiVerificationStatus.result === "valid" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          <div className="flex items-center gap-2">
                            {npiVerificationStatus.result === "valid" ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <div>
                                  <p className="text-xs font-semibold text-green-800">Valid NPI</p>
                                  {npiVerificationStatus.providerName && (
                                    <p className="text-xs text-green-700">Registry Name: {npiVerificationStatus.providerName}</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-600" />
                                <div>
                                  <p className="text-xs font-semibold text-red-800">Invalid NPI</p>
                                  <p className="text-xs text-red-700">{npiVerificationStatus.message}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Not provided yet</p>
                  )}
                </div>

                {editingProvider.medical_licenses && editingProvider.medical_licenses.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Medical Licenses</p>
                    <div className="space-y-3">
                      {editingProvider.medical_licenses.map((license, index) => (
                        <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                          <div>
                            <p className="text-xs text-gray-600">License Number</p>
                            <p className="text-sm font-medium text-gray-900">{license.licenseNumber}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">State</p>
                            <p className="text-sm font-medium text-gray-900">{license.state}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {editingProvider && ((editingProvider.physical_address && Object.values(editingProvider.physical_address).some((v) => v && v !== "")) || (editingProvider.billing_address && Object.values(editingProvider.billing_address).some((v) => v && v !== ""))) && (
              <div className="space-y-4 mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-gray-900">Address Information (Read-Only)</h3>
                <p className="text-xs text-gray-600 mb-4">
                  This information is managed by the provider and can only be updated by them through their profile.
                </p>
                {editingProvider.physical_address && Object.values(editingProvider.physical_address).some((v) => v && v !== "") && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Physical Address</h4>
                    <p className="text-sm text-gray-900">
                      {editingProvider.physical_address.street && <>{editingProvider.physical_address.street}<br /></>}
                      {(editingProvider.physical_address.city || editingProvider.physical_address.state || editingProvider.physical_address.zipCode) && (
                        <>
                          {editingProvider.physical_address.city}{editingProvider.physical_address.state && `, ${editingProvider.physical_address.state}`}{editingProvider.physical_address.zipCode && ` ${editingProvider.physical_address.zipCode}`}<br />
                        </>
                      )}
                      {editingProvider.physical_address.country && <>{editingProvider.physical_address.country}</>}
                    </p>
                  </div>
                )}
                {editingProvider.billing_address && Object.values(editingProvider.billing_address).some((v) => v && v !== "") && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Billing Address</h4>
                    <p className="text-sm text-gray-900">
                      {editingProvider.billing_address.street && <>{editingProvider.billing_address.street}<br /></>}
                      {(editingProvider.billing_address.city || editingProvider.billing_address.state || editingProvider.billing_address.zipCode) && (
                        <>
                          {editingProvider.billing_address.city}{editingProvider.billing_address.state && `, ${editingProvider.billing_address.state}`}{editingProvider.billing_address.zipCode && ` ${editingProvider.billing_address.zipCode}`}<br />
                        </>
                      )}
                      {editingProvider.billing_address.country && <>{editingProvider.billing_address.country}</>}
                    </p>
                    {editingProvider.tax_id && (
                      <p className="text-xs text-gray-600 mt-2"><strong>Tax ID/EIN:</strong> {editingProvider.tax_id}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting} className="h-9">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-9">{isSubmitting ? "Updating..." : "Update Provider"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border border-border">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for Dr. {resetPasswordProvider?.first_name} {resetPasswordProvider?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={generateResetPassword} className="px-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Password must be at least 6 characters long</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsResetPasswordOpen(false); setResetPasswordProvider(null); setNewPassword(""); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={!newPassword || newPassword.length < 6 || isSubmitting} className="bg-purple-600 hover:bg-purple-700">{isSubmitting ? "Resetting..." : "Reset Password"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activate/Deactivate Provider Modal */}
      <AlertDialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activatingProvider?.is_active ? "Deactivate Provider" : "Activate Provider"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {activatingProvider?.is_active ? (
                  <p>
                    Are you sure you want to deactivate Dr. {activatingProvider?.first_name} {activatingProvider?.last_name}?
                    They will not be able to create prescriptions while inactive.
                  </p>
                ) : (
                  <>
                    <p>Verify NPI before activating Dr. {activatingProvider?.first_name} {activatingProvider?.last_name}.</p>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">NPI Number:</span>
                        <span className="font-mono text-sm">{activatingProvider?.npi_number || "Not provided"}</span>
                      </div>
                      {!activatingProvider?.npi_number ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">No NPI number on file. Provider should complete their profile first.</span>
                        </div>
                      ) : activationNpiStatus.isVerifying ? (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Verifying NPI with CMS registry...</span>
                        </div>
                      ) : activationNpiStatus.result === "valid" ? (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Valid NPI - {activationNpiStatus.providerName}</span>
                        </div>
                      ) : activationNpiStatus.result === "invalid" ? (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">{activationNpiStatus.message}</span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setActivatingProvider(null); setActivationNpiStatus({ isVerifying: false, result: null }); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              disabled={
                isSubmitting ||
                (!activatingProvider?.is_active &&
                (!activatingProvider?.npi_number || activationNpiStatus.isVerifying || activationNpiStatus.result === "invalid"))
              }
              className={activatingProvider?.is_active ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isSubmitting ? "Processing..." : (activatingProvider?.is_active ? "Deactivate" : "Activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProvider}
        onOpenChange={() => setDeletingProvider(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Dr. {deletingProvider?.first_name}{" "}
              {deletingProvider?.last_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProvider}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Assignment Dialog */}
      <Dialog
        open={!!assigningProvider}
        onOpenChange={() => {
          setAssigningProvider(null);
          setSelectedGroupId("");
        }}
      >
        <DialogContent className="max-w-sm bg-white border border-border">
          <DialogHeader>
            <DialogTitle>Assign Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign <span className="font-medium text-foreground">{assigningProvider?.first_name} {assigningProvider?.last_name}</span> to a group.
            </p>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger data-testid="select-assign-group">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Group (Unassigned)</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                    {group.platform_manager_name ? ` — ${group.platform_manager_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAssigningProvider(null);
                  setSelectedGroupId("");
                }}
                className="border border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignGroup}
                disabled={isAssigning}
                data-testid="button-confirm-assign"
              >
                {isAssigning ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Provider Form */}
      <ProviderFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={fetchProviders}
        pharmacyId={isSuperAdmin && pharmacyFilter !== "all" ? pharmacyFilter : pharmacyId}
        isSuperAdmin={isSuperAdmin}
      />
    </>
  );
};
