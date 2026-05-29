"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { AdminTagsTable } from "./AdminTagsTable";
import { TagFormDialog } from "./TagFormDialog";
import { useAdminTags } from "../hooks/useAdminTags";
import type { Tag } from "../types";
import type { TagFormData } from "./TagFormDialog";

export function TagsManagement() {
  const { guardAction } = useDemoGuard();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

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

  const handleDeleteTag = async (tagId: string) => {
    guardAction(async () => {
    try {
      const filters = {
        search: searchTerm,
      };
      await deleteTag(tagId, filters);
    } catch (error) {
      console.error("Error deleting tag:", error);
      throw error;
    }
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // Reset to first page when search changes
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

      // Refresh with current filters
      const filters = {
        search: searchTerm,
      };
      fetchTags(currentPage, filters);
    } catch (error) {
      console.error("Error saving tag:", error);
    }
    });
  };

  // 🔍 Debounced search: only when searchTerm changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const filters = {
        search: searchTerm,
      };
      fetchTags(1, filters); // start at page 1 for a new search
      handlePageChange(1, filters); // keep state in sync
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchTags, handlePageChange]);

  // 📄 Page change: run with current filters, no debounce
  useEffect(() => {
    const filters = {
      search: searchTerm,
    };
    fetchTags(currentPage, filters);
  }, [currentPage, searchTerm, fetchTags]);

  // Handle page changes with current search
  const handlePageChangeWithSearch = useCallback(
    (page: number) => {
      const filters = {
        search: searchTerm,
      };
      handlePageChange(page, filters);
    },
    [searchTerm, handlePageChange],
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

      {/* Stats Cards */}
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

      {/* Search */}
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

      {/* Tags Table */}
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

      {/* Tag Form Dialog */}
      <TagFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        tag={editingTag}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}
