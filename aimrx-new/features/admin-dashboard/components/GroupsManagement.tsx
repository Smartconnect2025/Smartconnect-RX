"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight, Users, UserMinus, UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GroupFormDialog } from "./GroupFormDialog";
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
import { useUser } from "@core/auth";
import { createClient } from "@/core/supabase/client";

interface GroupProvider {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  tier_level: string;
}

interface Group {
  id: string;
  name: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  platform_manager_id: string | null;
  platform_manager_name: string | null;
  provider_count: number;
  providers: GroupProvider[];
  created_at: string;
  updated_at: string;
}

interface UnassignedProvider {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const GroupsManagement: React.FC = () => {
  const { guardAction } = useDemoGuard();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [assignDialogGroupId, setAssignDialogGroupId] = useState<string | null>(null);
  const [unassignedProviders, setUnassignedProviders] = useState<UnassignedProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string }[]>([]);

  const fetchPharmacies = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPharmacies(data || []);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        params.set("pharmacyId", pharmacyFilter);
      }
      const groupsUrl = `/api/admin/groups${params.toString() ? `?${params.toString()}` : ""}`;

      const [groupsRes, providersRes] = await Promise.all([
        fetch(groupsUrl),
        fetch("/api/admin/providers"),
      ]);

      if (groupsRes.ok && providersRes.ok) {
        const groupsData = await groupsRes.json();
        const providersData = await providersRes.json();
        const allProviders = providersData.providers || [];

        const enrichedGroups = (groupsData.groups || []).map((group: Group) => {
          const groupProviders = allProviders.filter(
            (p: GroupProvider & { group_id?: string }) => p.group_id === group.id
          );
          return {
            ...group,
            provider_count: groupProviders.length,
            providers: groupProviders.map((p: GroupProvider & { group_id?: string; tier_level?: string }) => ({
              id: p.id,
              first_name: p.first_name,
              last_name: p.last_name,
              email: p.email,
              status: p.status,
              tier_level: p.tier_level || "Not set",
            })),
          };
        });

        setGroups(enrichedGroups);

        const unassigned = allProviders
          .filter((p: GroupProvider & { group_id?: string }) => !p.group_id)
          .map((p: GroupProvider & { group_id?: string }) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
          }));
        setUnassignedProviders(unassigned);
      } else {
        toast.error("Failed to fetch groups");
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Failed to fetch groups");
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
      fetchPharmacies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked, isSuperAdmin]);

  useEffect(() => {
    if (!scopeChecked) return;
    fetchGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecked]);

  useEffect(() => {
    if (!scopeChecked) return;
    fetchGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyFilter]);

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    guardAction(async () => {
    try {
      const response = await fetch(`/api/admin/groups/${deletingGroup.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Group deleted successfully");
        setDeletingGroup(null);
        fetchGroups();
      } else {
        toast.error(result.error || "Failed to delete group");
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    }
    });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingGroup(null);
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  const handleAssignProvider = async () => {
    if (!assignDialogGroupId || !selectedProviderId) return;
    guardAction(async () => {
    setIsAssigning(true);
    try {
      const provider = unassignedProviders.find((p) => p.id === selectedProviderId);
      const response = await fetch(`/api/admin/providers/${selectedProviderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: assignDialogGroupId }),
      });

      if (response.ok) {
        toast.success(`${provider?.first_name} ${provider?.last_name} assigned to group`);
        setAssignDialogGroupId(null);
        setSelectedProviderId("");
        fetchGroups();
      } else {
        toast.error("Failed to assign provider");
      }
    } catch (error) {
      console.error("Error assigning provider:", error);
      toast.error("Failed to assign provider");
    } finally {
      setIsAssigning(false);
    }
    });
  };

  const handleRemoveProvider = async (providerId: string, providerName: string) => {
    guardAction(async () => {
    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: null }),
      });

      if (response.ok) {
        toast.success(`${providerName} removed from group`);
        fetchGroups();
      } else {
        toast.error("Failed to remove provider from group");
      }
    } catch (error) {
      console.error("Error removing provider:", error);
      toast.error("Failed to remove provider from group");
    }
    });
  };

  const colSpan = isSuperAdmin ? 7 : 6;

  return (
    <>
      <div className="container max-w-5xl mx-auto py-6 space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Group Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage provider groups, platform managers, and team assignments
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => fetchGroups()}
              variant="outline"
              className="border border-border"
              data-testid="button-refresh-groups"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => guardAction(() => {
                setEditingGroup(null);
                setIsFormOpen(true);
              })}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-create-group"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="mb-1">
            <div className="space-y-1.5">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger id="pharmacy-filter" className="w-[280px] h-10 bg-white border-gray-200">
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
          </div>
        )}

        <div className="bg-white rounded-lg border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                {isSuperAdmin && <TableHead>Pharmacy</TableHead>}
                <TableHead>Platform Manager</TableHead>
                <TableHead>Providers</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No groups found. Create your first group to get started.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <React.Fragment key={group.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleExpand(group.id)}
                      data-testid={`row-group-${group.id}`}
                    >
                      <TableCell className="w-10">
                        {expandedGroupId === group.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{group.name}</div>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          {group.pharmacy_name ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {group.pharmacy_name}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {group.platform_manager_name || "Not assigned"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                          data-testid={`badge-provider-count-${group.id}`}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {group.provider_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(group.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssignDialogGroupId(group.id);
                              setSelectedProviderId("");
                            }}
                            className="border border-border text-xs"
                            data-testid={`button-assign-to-group-${group.id}`}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(group)}
                            className="border border-border"
                            data-testid={`button-edit-group-${group.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingGroup(group)}
                            className="border border-border text-destructive hover:text-destructive"
                            data-testid={`button-delete-group-${group.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedGroupId === group.id && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="bg-gray-50/50 p-0">
                          <div className="px-8 py-4">
                            {group.providers.length === 0 ? (
                              <div className="text-center py-4 text-sm text-muted-foreground">
                                No providers assigned to this group yet.
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="ml-1 text-primary"
                                  onClick={() => {
                                    setAssignDialogGroupId(group.id);
                                    setSelectedProviderId("");
                                  }}
                                >
                                  Add one
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                  Assigned Providers
                                </div>
                                <div className="grid gap-2">
                                  {group.providers.map((provider) => (
                                    <div
                                      key={provider.id}
                                      className="flex items-center justify-between bg-white rounded-lg border border-border px-4 py-2.5"
                                      data-testid={`group-provider-${provider.id}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                                            {provider.first_name?.[0]}{provider.last_name?.[0]}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="text-sm font-medium">
                                            {provider.first_name} {provider.last_name}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {provider.email}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${
                                            provider.status === "active"
                                              ? "bg-green-50 text-green-700 border-green-200"
                                              : "bg-gray-50 text-gray-600 border-gray-200"
                                          }`}
                                        >
                                          {provider.status}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                          onClick={() =>
                                            handleRemoveProvider(
                                              provider.id,
                                              `${provider.first_name} ${provider.last_name}`
                                            )
                                          }
                                          data-testid={`button-remove-provider-${provider.id}`}
                                        >
                                          <UserMinus className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <GroupFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          fetchGroups();
        }}
        editingGroup={editingGroup}
        isSuperAdmin={isSuperAdmin}
        pharmacies={pharmacies}
      />

      <Dialog
        open={!!assignDialogGroupId}
        onOpenChange={() => {
          setAssignDialogGroupId(null);
          setSelectedProviderId("");
        }}
      >
        <DialogContent className="max-w-sm bg-white border border-border">
          <DialogHeader>
            <DialogTitle>Assign Provider to Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {unassignedProviders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All providers are already assigned to groups.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select a provider to add to{" "}
                  <span className="font-medium text-foreground">
                    {groups.find((g) => g.id === assignDialogGroupId)?.name}
                  </span>
                </p>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                  <SelectTrigger data-testid="select-unassigned-provider">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.first_name} {provider.last_name} — {provider.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAssignDialogGroupId(null);
                      setSelectedProviderId("");
                    }}
                    className="border border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignProvider}
                    disabled={!selectedProviderId || isAssigning}
                    data-testid="button-confirm-assign-to-group"
                  >
                    {isAssigning ? "Adding..." : "Add to Group"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingGroup}
        onOpenChange={() => setDeletingGroup(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingGroup?.name}
              &rdquo;? This action cannot be undone. Providers assigned to this
              group will have their group assignment removed.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
