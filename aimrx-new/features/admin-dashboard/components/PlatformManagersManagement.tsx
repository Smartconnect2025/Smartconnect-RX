"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { useUser } from "@core/auth";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformManagerFormDialog } from "./PlatformManagerFormDialog";
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

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
}

interface PlatformManager {
  id: string;
  name: string;
  email?: string;
  pharmacies?: Pharmacy[];
  created_at: string;
  updated_at: string;
}

export const PlatformManagersManagement: React.FC = () => {
  const { guardAction } = useDemoGuard();
  const { userRole } = useUser();
  const isSuperAdmin = userRole === "super_admin";
  const [isLoading, setIsLoading] = useState(false);
  const [platformManagers, setPlatformManagers] = useState<PlatformManager[]>(
    [],
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPM, setEditingPM] = useState<PlatformManager | null>(null);
  const [deletingPM, setDeletingPM] = useState<PlatformManager | null>(null);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const pharmacyFilterRef = useRef(pharmacyFilter);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const requestIdRef = useRef(0);

  const loadPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      if (response.ok) {
        const data = await response.json();
        const active = (data.pharmacies || []).filter(
          (p: Pharmacy & { is_active: boolean }) => p.is_active,
        );
        setPharmacies(active);
      }
    } catch (error) {
      console.error("Error loading pharmacies:", error);
    }
  };

  const fetchPlatformManagers = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const currentFilter = pharmacyFilterRef.current;
      const params = new URLSearchParams();
      if (isSuperAdmin && currentFilter && currentFilter !== "all") {
        params.append("pharmacyId", currentFilter);
      }
      const response = await fetch(
        `/api/admin/platform-managers?${params.toString()}`,
      );

      if (currentRequestId !== requestIdRef.current) return;

      if (response.ok) {
        const data = await response.json();
        setPlatformManagers(data.platformManagers || []);
      } else {
        toast.error("Failed to fetch platform managers");
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Error fetching platform managers:", error);
      toast.error("Failed to fetch platform managers");
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [pharmacyFilter, isSuperAdmin]);

  useEffect(() => {
    loadPharmacies();
  }, []);

  useEffect(() => {
    fetchPlatformManagers();
  }, [fetchPlatformManagers]);

  const handlePharmacyFilterChange = useCallback((value: string) => {
    pharmacyFilterRef.current = value;
    setPharmacyFilter(value);
  }, []);

  const handleEdit = (pm: PlatformManager) => {
    setEditingPM(pm);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingPM) return;
    guardAction(async () => {
    try {
      const response = await fetch(
        `/api/admin/platform-managers/${deletingPM.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (response.ok) {
        toast.success("Platform manager deleted successfully");
        setDeletingPM(null);
        fetchPlatformManagers();
      } else {
        toast.error(result.error || "Failed to delete platform manager");
      }
    } catch (error) {
      console.error("Error deleting platform manager:", error);
      toast.error("Failed to delete platform manager");
    }
    });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPM(null);
  };

  return (
    <>
      <div className="container max-w-5xl mx-auto py-6 space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Platform Managers
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage platform managers that can be assigned to groups
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchPlatformManagers}
              variant="outline"
              className="border border-border"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => guardAction(() => {
                setEditingPM(null);
                setIsFormOpen(true);
              })}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Platform Manager
            </Button>
          </div>
        </div>

        {isSuperAdmin && pharmacies.length > 0 && (
          <div className="bg-white rounded-lg border border-border shadow-sm p-4">
            <div className="flex items-center gap-4">
              <Label
                htmlFor="pm-pharmacy-filter"
                className="text-sm font-semibold text-gray-700 whitespace-nowrap"
              >
                Filter by Pharmacy
              </Label>
              <select
                id="pm-pharmacy-filter"
                value={pharmacyFilter}
                onChange={(e) => handlePharmacyFilterChange(e.target.value)}
                className="flex-1 h-10 px-4 rounded-md border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm"
              >
                <option value="all">All Pharmacies</option>
                {pharmacies.map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pharmacies</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : platformManagers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No platform managers found. Create your first one to get
                    started.
                  </TableCell>
                </TableRow>
              ) : (
                platformManagers.map((pm) => (
                  <TableRow key={pm.id}>
                    <TableCell>
                      <div className="font-medium">{pm.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {pm.email || "\u2014"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pm.pharmacies && pm.pharmacies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pm.pharmacies.map((pharmacy) => (
                            <span
                              key={pharmacy.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {pharmacy.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(pm.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(pm)}
                          className="border border-border"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingPM(pm)}
                          className="border border-border text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PlatformManagerFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          fetchPlatformManagers();
        }}
        editingPlatformManager={editingPM}
      />

      <AlertDialog
        open={!!deletingPM}
        onOpenChange={() => setDeletingPM(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Platform Manager</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingPM?.name}
              &rdquo;? Groups assigned to this platform manager will have their
              assignment removed.
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
