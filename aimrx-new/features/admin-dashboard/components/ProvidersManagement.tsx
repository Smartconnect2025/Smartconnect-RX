"use client";

import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import {
  Eye, EyeOff, Trash2, Search, RefreshCw, CheckCircle2, XCircle,
  UserCog, Building2, Edit, Key, Power, Loader2, CheckCircle, AlertTriangle,
  MoreHorizontal, Copy, UserPlus, Calendar, Mail, Phone, Shield,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOptimizedAvatarUrl } from "@core/services/storage/avatarStorage";
import { formatPhoneNumber } from "@/core/utils/phone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>(initialPharmacyFilter || "all");
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assigningCompanyProvider, setAssigningCompanyProvider] = useState<Provider | null>(null);
  const [companyInputMode, setCompanyInputMode] = useState<"select" | "new">("select");
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>("");
  const [newCompanyName, setNewCompanyName] = useState<string>("");
  const [isAssigningCompany, setIsAssigningCompany] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("providers");

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

  const existingCompanies = [...new Set(providers.map((p) => p.company_name).filter(Boolean))] as string[];

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
      provider.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const activeProviders = filteredProviders.filter((p) => p.status === "active");
  const pendingProviders = filteredProviders.filter((p) => p.status === "inactive");

  const displayedProviders = activeTab === "providers" ? activeProviders : pendingProviders;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "—";
    }
  };

  const handleAssignCompany = async () => {
    if (!assigningCompanyProvider) return;
    guardAction(async () => {
    setIsAssigningCompany(true);
    try {
      const companyValue = companyInputMode === "new"
        ? (newCompanyName.trim() || null)
        : (selectedCompanyName === "none" ? null : selectedCompanyName || null);
      const response = await fetch(`/api/admin/providers/${assigningCompanyProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyValue }),
      });

      if (response.ok) {
        toast.success(
          !companyValue
            ? "Company removed from provider"
            : `Provider assigned to ${companyValue}`
        );
        setAssigningCompanyProvider(null);
        setSelectedCompanyName("");
        setNewCompanyName("");
        setCompanyInputMode("select");
        fetchProviders();
      } else {
        toast.error("Failed to update company assignment");
      }
    } catch (error) {
      console.error("Error assigning company:", error);
      toast.error("Failed to update company assignment");
    } finally {
      setIsAssigningCompany(false);
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
    setActivationNpiStatus({ isVerifying: false, result: null });
    setIsActivationModalOpen(true);
    setActivatingProvider(provider);
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

  const handleToggleDemo = (provider: Provider) => {
    guardAction(async () => {
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
    });
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

  const handleCopyInviteLink = (provider: Provider) => {
    const link = `${window.location.origin}/auth/login`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success(`Login link copied for ${provider.first_name} ${provider.last_name}`);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const renderProviderTable = (data: Provider[]) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor Name</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Added</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">Loading providers...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <UserPlus className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No providers found</h3>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? "Try adjusting your search" : "Invite a new provider to get started"}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((provider) => (
              <TableRow key={provider.id} className="hover:bg-gray-50/50 border-b border-gray-100">
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-gray-200">
                      <AvatarImage
                        src={provider.avatar_url ? getOptimizedAvatarUrl(provider.avatar_url, 36) : ""}
                        alt={`${provider.first_name || ""} ${provider.last_name || ""}`}
                      />
                      <AvatarFallback className="text-xs font-medium bg-blue-50 text-blue-700">
                        {provider.first_name && provider.last_name
                          ? `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase()
                          : "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                        {provider.first_name && provider.last_name
                          ? `Dr. ${provider.first_name} ${provider.last_name}`
                          : "—"}
                        {provider.is_demo && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 font-medium">
                            DEMO
                          </Badge>
                        )}
                      </div>
                      {provider.npi_number && (
                        <span className="text-xs text-gray-400 font-mono">NPI: {provider.npi_number}</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="text-sm text-gray-600">{provider.email || "—"}</span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="text-sm text-gray-600">{provider.phone_number || "—"}</span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {provider.company_name ? (
                    <Badge
                      variant="outline"
                      className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs cursor-pointer hover:bg-indigo-100"
                      onClick={() => {
                        setAssigningCompanyProvider(provider);
                        setSelectedCompanyName(provider.company_name || "none");
                        setCompanyInputMode("select");
                      }}
                    >
                      {provider.company_name}
                    </Badge>
                  ) : (
                    <button
                      className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                      onClick={() => {
                        setAssigningCompanyProvider(provider);
                        setSelectedCompanyName("none");
                        setCompanyInputMode("select");
                      }}
                    >
                      + Assign
                    </button>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="text-sm text-gray-600">{formatDate(provider.created_at)}</span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {provider.status === "active" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-medium text-xs px-2.5 py-0.5">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-100 font-medium text-xs px-2.5 py-0.5">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white">
                      <DropdownMenuItem onClick={() => openEditModal(provider)} className="cursor-pointer">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openResetPasswordDialog(provider)} className="cursor-pointer">
                        <Key className="h-4 w-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyInviteLink(provider)} className="cursor-pointer">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openActivationModal(provider)} className="cursor-pointer">
                        <Power className="h-4 w-4 mr-2" />
                        {provider.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      {isSuperAdmin && (
                        <DropdownMenuItem onClick={() => handleToggleDemo(provider)} className="cursor-pointer">
                          <UserCog className="h-4 w-4 mr-2" />
                          {provider.is_demo ? "Remove Demo" : "Make Demo"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingProvider(provider)}
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <div className="container max-w-7xl mx-auto py-8 space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Provider Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and monitor all providers in the system</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => guardAction(() => setIsFormOpen(true))}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite New Provider
            </Button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-3">
            <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
              <SelectTrigger className="w-[220px] h-9 bg-white border-gray-200 text-sm">
                <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="All Pharmacies" />
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
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="bg-gray-100/80 p-1 rounded-lg">
              <TabsTrigger
                value="providers"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-1.5 rounded-md text-sm font-medium"
              >
                Providers ({activeProviders.length})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-1.5 rounded-md text-sm font-medium"
              >
                Pending Approval ({pendingProviders.length})
              </TabsTrigger>
            </TabsList>

            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search providers..."
                className="pl-10 h-9 bg-white border-gray-200 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="providers" className="mt-4">
            {renderProviderTable(activeProviders)}
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            {renderProviderTable(pendingProviders)}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <span>Showing {displayedProviders.length} of {filteredProviders.length} providers</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Active: {activeProviders.length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-gray-400"></span>
              Inactive: {pendingProviders.length}
            </span>
          </div>
        </div>
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
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  variant={!editFormData.companyName || existingCompanies.includes(editFormData.companyName) ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const match = existingCompanies.find((c) => c === editFormData.companyName);
                    setEditFormData({ ...editFormData, companyName: match || "" });
                  }}
                  className="text-xs h-7"
                >
                  Select
                </Button>
                <Button
                  type="button"
                  variant={editFormData.companyName && !existingCompanies.includes(editFormData.companyName) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditFormData({ ...editFormData, companyName: "" })}
                  className="text-xs h-7"
                >
                  New
                </Button>
              </div>
              {existingCompanies.includes(editFormData.companyName) || !editFormData.companyName ? (
                <Select
                  value={editFormData.companyName || "none"}
                  onValueChange={(val) => setEditFormData({ ...editFormData, companyName: val === "none" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company</SelectItem>
                    {existingCompanies.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="editCompanyName"
                  value={editFormData.companyName}
                  onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                  placeholder="Enter new company name"
                />
              )}
              <p className="text-xs text-gray-500 mt-1">Providers in the same company share patient access</p>
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
        <AlertDialogContent className="sm:max-w-[450px] bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">
              {activatingProvider?.is_active ? "Deactivate Provider" : "Activate Provider"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              {activatingProvider?.is_active ? (
                <>Are you sure you want to deactivate Dr. {activatingProvider?.first_name} {activatingProvider?.last_name}? They will not be able to create prescriptions while inactive.</>
              ) : (
                <>Are you sure you want to activate Dr. {activatingProvider?.first_name} {activatingProvider?.last_name}? They will be able to create and submit prescriptions.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setActivatingProvider(null); setActivationNpiStatus({ isVerifying: false, result: null }); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              disabled={isSubmitting}
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
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
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

      {/* Company Assignment Dialog */}
      <Dialog
        open={!!assigningCompanyProvider}
        onOpenChange={() => {
          setAssigningCompanyProvider(null);
          setSelectedCompanyName("");
          setNewCompanyName("");
          setCompanyInputMode("select");
        }}
      >
        <DialogContent className="max-w-sm bg-white border border-border">
          <DialogHeader>
            <DialogTitle>Assign Company</DialogTitle>
            <DialogDescription>
              Assign <span className="font-medium text-foreground">{assigningCompanyProvider?.first_name} {assigningCompanyProvider?.last_name}</span> to a company. Providers in the same company share patient access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={companyInputMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setCompanyInputMode("select")}
                className="text-xs h-7"
              >
                Select Existing
              </Button>
              <Button
                type="button"
                variant={companyInputMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setCompanyInputMode("new")}
                className="text-xs h-7"
              >
                New Company
              </Button>
            </div>

            {companyInputMode === "select" ? (
              <Select value={selectedCompanyName} onValueChange={setSelectedCompanyName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Company (Unassigned)</SelectItem>
                  {existingCompanies.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Enter new company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAssigningCompanyProvider(null);
                  setSelectedCompanyName("");
                  setNewCompanyName("");
                  setCompanyInputMode("select");
                }}
                className="border border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignCompany}
                disabled={isAssigningCompany}
              >
                {isAssigningCompany ? "Saving..." : "Save"}
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
