"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Tag, CreateTagData, UpdateTagData } from "../types";
import {
  calculatePageAfterDeletion,
  createOptimisticDeletion,
} from "../utils/paginationUtils";

export function useAdminTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const fetchTags = useCallback(
    async (page: number = 1, filters?: { search?: string }) => {
      try {
        setLoading(true);
        setError(null);
        setCurrentPage(page);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
        });

        if (filters?.search) params.append("search", filters.search);

        const response = await fetch(`/api/admin/tags?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch tags");

        const data = await response.json();
        setTags(data.tags || []);
        setTotalCount(data.total || 0);
      } catch (err) {
        console.error("Error fetching tags:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch tags");
        toast.error("Failed to fetch tags");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  const createTag = useCallback(async (data: CreateTagData) => {
    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create tag");
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Error creating tag:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create tag");
      throw err;
    }
  }, []);

  const updateTag = useCallback(async (id: string, data: UpdateTagData) => {
    try {
      const response = await fetch(`/api/admin/tags/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update tag");
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Error updating tag:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update tag");
      throw err;
    }
  }, []);

  const deleteTag = useCallback(
    async (id: string, currentFilters?: { search?: string }) => {
      // Prevent multiple simultaneous deletions of the same item
      if (deletingIds.has(id)) {
        return;
      }

      // Store original state for potential rollback
      const originalTotalCount = totalCount;
      const originalCurrentPage = currentPage;

      // Mark as deleting to prevent race conditions
      setDeletingIds((prev) => new Set(prev).add(id));

      // Optimistic UI: Remove tag from current list immediately
      const { updatedItems: updatedTags, revert } = createOptimisticDeletion(
        tags,
        id,
        (tag) => tag.id,
      );

      setTags(updatedTags);
      setTotalCount(Math.max(0, totalCount - 1));

      try {
        const response = await fetch(`/api/admin/tags/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete tag");
        }

        // Show success message with cleanup info from API response
        const responseData = await response.json();
        const successMessage =
          responseData.resourcesUpdated > 0
            ? `Tag deleted successfully and removed from ${responseData.resourcesUpdated} resource${responseData.resourcesUpdated === 1 ? "" : "s"}`
            : "Tag deleted successfully";
        toast.success(successMessage);

        // Calculate pagination logic using utility function
        const paginationResult = calculatePageAfterDeletion(
          {
            currentPage: originalCurrentPage,
            totalCount: originalTotalCount,
            pageSize,
          },
          updatedTags.length,
        );

        // Apply pagination logic
        if (paginationResult.isEmpty) {
          // No tags left, stay on page 1 with empty state
          setCurrentPage(1);
          setTags([]);
        } else if (paginationResult.shouldFetch) {
          // Navigate to the calculated page and fetch data
          setCurrentPage(paginationResult.newPage);
          await fetchTags(paginationResult.newPage, currentFilters);
        } else {
          // Just refresh current page
          await fetchTags(originalCurrentPage, currentFilters);
        }
      } catch (err) {
        // Revert optimistic updates on error
        setTags(revert());
        setTotalCount(originalTotalCount);
        setCurrentPage(originalCurrentPage);

        console.error("Error deleting tag:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to delete tag",
        );
        throw err;
      } finally {
        // Always remove from deleting set
        setDeletingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    },
    [currentPage, totalCount, pageSize, fetchTags, tags, deletingIds],
  );

  const refreshTags = useCallback(() => {
    fetchTags(currentPage);
  }, [fetchTags, currentPage]);

  const handlePageChange = useCallback(
    (page: number, filters?: { search?: string }) => {
      setCurrentPage(page);
      fetchTags(page, filters);
    },
    [fetchTags],
  );

  // Initial fetch
  useEffect(() => {
    fetchTags(1); // Always start with page 1
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    currentPage,
    totalCount,
    pageSize,
    deletingIds,
    createTag,
    updateTag,
    deleteTag,
    refreshTags,
    handlePageChange,
    fetchTags,
  };
}
