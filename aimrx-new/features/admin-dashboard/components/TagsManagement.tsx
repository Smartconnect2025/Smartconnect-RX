"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { AdminTagsTable } from "./AdminTagsTable";
import { TagFormDialog } from "./TagFormDialog";
import { useAdminTags } from "../hooks/useAdminTags";
import type { Tag } from "../types";
import type { TagFormData } from "./TagFormDialog";

export function TagsManagement() {
  const { userRole } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const isSuperAdmin = userRole === "super_admin";

  const { guardAction } = useDemoGuard();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string }[]>([]);

  const {
    tags,
    loading,
    currentPage,
    totalCount,
    pageSize,
    deletingIds,
    createTag,
    updateTag,
    deleteTag,
    handlePageChange,
    fetchTags,
  } = useAdminTags();

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const getFilters = useCallback(() => {
    return {
      search: searchTerm,
      pharmacyId: pharmacyFilter,
    };
  }, [searchTerm, pharmacyFilter]);

  const handleDeleteTag = async (tagId: string) => {
    guardAction(async () => {
      try {
        await deleteTag(tagId, getFilters());
      } catch (error) {
        console.error("Error deleting tag:", error);
        throw error;
      }
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (currentPage !== 1) {
      handlePageChange(1);
    }
  };

  const handleCreateTag = () => {
    setEditingTag(null);
    setIsFormOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: TagFormData) => {
    guardAction(async () => {
      try {
        if (editingTag) {
          await updateTag(editingTag.id, data);
          toast.success("Tag updated successfully");
        } else {
          await createTag(data);
          toast.success("Tag created successfully");
        }
        setIsFormOpen(false);
        setEditingTag(null);
        fetchTags(currentPage, getFilters());
      } catch (error) {
        console.error("Error saving tag:", error);
      }
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filters = getFilters();
      fetchTags(1, filters);
      handlePageChange(1, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchTags, handlePageChange, getFilters]);

  useEffect(() => {
    fetchTags(currentPage, getFilters());
  }, [currentPage, fetchTags, getFilters]);

  useEffect(() => {
    fetchTags(1, getFilters());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyFilter]);

  const handlePageChangeWithSearch = useCallback(
    (page: number) => {
      handlePageChange(page, getFilters());
    },
    [handlePageChange, getFilters],
  );

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tags Management</h2>
          <p className="text-muted-foreground">
            Manage resource tags for better organization and categorization
          </p>
        </div>
        <Button
          onClick={handleCreateTag}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 " />
          New Tag
        </Button>
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">{totalCount}</div>
          <div className="text-sm text-muted-foreground">Total Tags</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">
            {tags.filter((t) => t.usage_count > 0).length}
          </div>
          <div className="text-sm text-muted-foreground">Active Tags</div>
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <div className="text-2xl font-bold">
            {tags.reduce((sum, tag) => sum + tag.usage_count, 0)}
          </div>
          <div className="text-sm text-muted-foreground">Total Usage</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={18}
          />
          <Input
            placeholder="Search tags..."
            className="pl-12 h-11 rounded-lg border-gray-200 bg-white"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      <AdminTagsTable
        tags={tags}
        loading={loading}
        currentPage={currentPage}
        totalTags={totalCount}
        pageSize={pageSize}
        deletingIds={deletingIds}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
        onPageChange={handlePageChangeWithSearch}
      />

      <TagFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        tag={editingTag}
        onSubmit={handleFormSubmit}
        isSuperAdmin={isSuperAdmin}
        pharmacies={pharmacies}
      />
    </div>
  );
}
