"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { MapPin, Eye, Trash2, UserPlus, Search, RefreshCw, CheckCircle2, XCircle, FolderTree, UserCog, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseTableManagement } from "./BaseTableManagement";
import { getOptimizedAvatarUrl } from "@core/services/storage/avatarStorage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Provider } from "../types";
import { ProviderDetailView } from "./ProviderDetailView";
import { ProviderFormDialog } from "./ProviderFormDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { createClient } from "@core/supabase";
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

export const ProvidersManagement: React.FC = () => {
  const { guardAction } = useDemoGuard();
  const { user } = useUser();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [assigningProvider, setAssigningProvider] = useState<Provider | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);

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
      const supabase = createClient();

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleRow?.role === "super_admin") {
        setIsSuperAdmin(true);
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
        Tier Level
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
        {provider.tier_level && provider.tier_level !== "Not set" ? (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border border-border text-xs"
          >
            {provider.tier_level}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">Not set</span>
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
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedProvider(provider)}
            className="border border-border"
            data-testid={`button-view-provider-${provider.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeletingProvider(provider)}
            className="border border-border"
            data-testid={`button-deactivate-provider-${provider.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </>
  );

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

  const handleDelete = async () => {
    if (!deletingProvider) return;
    guardAction(async () => {
    try {
      const response = await fetch(
        `/api/admin/providers/${deletingProvider.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_active: false }),
        },
      );

      if (response.ok) {
        toast.success("Provider deactivated successfully");
        setDeletingProvider(null);
        fetchProviders();
      } else {
        toast.error("Failed to deactivate provider");
      }
    } catch (error) {
      console.error("Error deactivating provider:", error);
      toast.error("Failed to deactivate provider");
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

      {/* Provider Detail View */}
      <Dialog
        open={!!selectedProvider}
        onOpenChange={() => setSelectedProvider(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-transparent border-none">
          {selectedProvider && (
            <ProviderDetailView
              provider={selectedProvider as Provider}
              onClose={() => setSelectedProvider(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProvider}
        onOpenChange={() => setDeletingProvider(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &ldquo;
              {deletingProvider?.first_name} {deletingProvider?.last_name}
              &rdquo;? This will set their status to inactive but won&apos;t
              delete their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
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
      />
    </>
  );
};
