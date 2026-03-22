"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TierFormDialog } from "./TierFormDialog";
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

interface Tier {
  id: string;
  tier_name: string;
  tier_code: string;
  discount_percentage: string;
  description?: string;
  pharmacy_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const TiersManagement: React.FC = () => {
  const { userRole } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const isSuperAdmin = userRole === "super_admin";

  const { guardAction } = useDemoGuard();
  const [isLoading, setIsLoading] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [deletingTier, setDeletingTier] = useState<Tier | null>(null);

  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string }[]>([]);

  const fetchPharmacies = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPharmacies(data || []);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  }, [supabase]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPharmacies();
    }
  }, [isSuperAdmin, fetchPharmacies]);

  const fetchTiers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        params.append("pharmacyId", pharmacyFilter);
      }
      const response = await fetch(`/api/admin/tiers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTiers(data.tiers || []);
      } else {
        toast.error("Failed to fetch tiers");
      }
    } catch (error) {
      console.error("Error fetching tiers:", error);
      toast.error("Failed to fetch tiers");
    } finally {
      setIsLoading(false);
    }
  }, [pharmacyFilter]);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const handleEdit = (tier: Tier) => {
    setEditingTier(tier);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTier) return;
    guardAction(async () => {
      try {
        const response = await fetch(`/api/admin/tiers/${deletingTier.id}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (response.ok) {
          toast.success("Tier deleted successfully");
          setDeletingTier(null);
          fetchTiers();
        } else {
          toast.error(result.error || "Failed to delete tier");
        }
      } catch (error) {
        console.error("Error deleting tier:", error);
        toast.error("Failed to delete tier");
      }
    });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTier(null);
  };

  return (
    <>
      <div className="container max-w-5xl mx-auto py-6 space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Tier Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage discount tiers and percentages for providers
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchTiers}
              variant="outline"
              className="border border-border"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => guardAction(() => {
                setEditingTier(null);
                setIsFormOpen(true);
              })}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tier
            </Button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-end gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger id="pharmacy-filter" className="w-[280px] h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All Pharmacies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</SelectItem>
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
                <TableHead>Tier Name</TableHead>
                <TableHead>Tier Code</TableHead>
                <TableHead>Discount Percentage</TableHead>
                <TableHead>Description</TableHead>
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
              ) : tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No tiers found. Create your first tier to get started.
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <div className="font-medium">{tier.tier_name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border border-border">
                        {tier.tier_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-lg text-green-600">
                        {tier.discount_percentage}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {tier.description || "No description"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(tier)}
                          className="border border-border"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingTier(tier)}
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

      <TierFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          fetchTiers();
        }}
        editingTier={editingTier}
        isSuperAdmin={isSuperAdmin}
        pharmacies={pharmacies}
      />

      <AlertDialog
        open={!!deletingTier}
        onOpenChange={() => setDeletingTier(null)}
      >
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingTier?.tier_name}&rdquo;?
              This action cannot be undone. Make sure no providers are assigned to this tier before deleting.
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
