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
import { toast } from "sonner";
import {
  Building2,
  Edit,
  Trash2,
  Users,
  Check,
  X,
  Loader2,
  Search,
  AlertTriangle,
} from "lucide-react";
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

interface CompanyInfo {
  name: string;
  providerCount: number;
  providers: { id: string; name: string }[];
}

interface CompanyManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompaniesChanged?: () => void;
  isSuperAdmin?: boolean;
  pharmacyName?: string | null;
}

export function CompanyManagementDialog({
  open,
  onOpenChange,
  onCompaniesChanged,
  isSuperAdmin = false,
  pharmacyName,
}: CompanyManagementDialogProps) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      } else {
        toast.error("Failed to load companies");
      }
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchCompanies();
      setSearchTerm("");
      setEditingCompany(null);
      setExpandedCompany(null);
    }
  }, [open]);

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("Company name cannot be empty");
      return;
    }
    if (trimmed === oldName) {
      setEditingCompany(null);
      return;
    }

    const existing = companies.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.name !== oldName
    );
    if (existing) {
      toast.error("A company with this name already exists");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName: trimmed }),
      });

      if (res.ok) {
        toast.success(`Company renamed to "${trimmed}"`);
        setEditingCompany(null);
        fetchCompanies();
        onCompaniesChanged?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to rename company");
      }
    } catch {
      toast.error("Failed to rename company");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: deleteTarget.name }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Company removed");
        setDeleteTarget(null);
        fetchCompanies();
        onCompaniesChanged?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete company");
      }
    } catch {
      toast.error("Failed to delete company");
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (company: CompanyInfo) => {
    setEditingCompany(company.name);
    setEditValue(company.name);
  };

  const cancelEditing = () => {
    setEditingCompany(null);
    setEditValue("");
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const title = isSuperAdmin
    ? "Manage Companies"
    : `Companies — ${pharmacyName || "Your Pharmacy"}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg bg-white border border-border max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {title}
            </DialogTitle>
            <DialogDescription>
              {isSuperAdmin
                ? "View, rename, or remove company groups across all pharmacies. Providers in the same company share patient access."
                : "View, rename, or remove company groups for your pharmacy. Providers in the same company share patient access."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-500">Loading companies...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 font-medium">
                  {searchTerm ? "No companies match your search" : "No companies created yet"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Companies are created when you assign one to a provider
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((company) => (
                  <div
                    key={company.name}
                    className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>

                      {editingCompany === company.name ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(company.name);
                              if (e.key === "Escape") cancelEditing();
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleRename(company.name)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                            onClick={cancelEditing}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {company.name}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCompany(
                                  expandedCompany === company.name ? null : company.name
                                )
                              }
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Users className="h-3 w-3" />
                              {company.providerCount} provider{company.providerCount !== 1 ? "s" : ""}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => startEditing(company)}
                              title="Rename company"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget(company)}
                              title="Delete company"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {expandedCompany === company.name && company.providers.length > 0 && (
                      <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/50">
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Providers in this company:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {company.providers.map((provider) => (
                            <span
                              key={provider.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs text-gray-700"
                            >
                              {provider.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {companies.length} compan{companies.length !== 1 ? "ies" : "y"} total
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Company
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Are you sure you want to delete <strong>&quot;{deleteTarget?.name}&quot;</strong>?
              </span>
              <span className="block text-red-600 font-medium">
                This will remove the company assignment from {deleteTarget?.providerCount} provider{deleteTarget?.providerCount !== 1 ? "s" : ""} and revoke their shared patient access.
              </span>
              <span className="block">
                The providers themselves will NOT be deleted — only their company grouping.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Company"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
