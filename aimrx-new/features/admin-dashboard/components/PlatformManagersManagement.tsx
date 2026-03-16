"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

interface PlatformManager {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export const PlatformManagersManagement: React.FC = () => {
  const { guardAction } = useDemoGuard();
  const [isLoading, setIsLoading] = useState(false);
  const [platformManagers, setPlatformManagers] = useState<PlatformManager[]>(
    [],
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPM, setEditingPM] = useState<PlatformManager | null>(null);
  const [deletingPM, setDeletingPM] = useState<PlatformManager | null>(null);

  const fetchPlatformManagers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/platform-managers");
      if (response.ok) {
        const data = await response.json();
        setPlatformManagers(data.platformManagers || []);
      } else {
        toast.error("Failed to fetch platform managers");
      }
    } catch (error) {
      console.error("Error fetching platform managers:", error);
      toast.error("Failed to fetch platform managers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformManagers();
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

        <div className="bg-white rounded-lg border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : platformManagers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
                        {pm.email || "—"}
                      </span>
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

      {/* Platform Manager Form Dialog */}
      <PlatformManagerFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          fetchPlatformManagers();
        }}
        editingPlatformManager={editingPM}
      />

      {/* Delete Confirmation */}
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
