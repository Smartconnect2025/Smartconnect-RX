"use client";

import { useState } from "react";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { formatResourceDate } from "../utils/formatResourceDate";
import type { Tag } from "../types";

interface AdminTagsTableProps {
  tags: Tag[];
  loading?: boolean;
  currentPage: number;
  totalTags: number;
  pageSize: number;
  deletingIds?: Set<string>;
  onEdit: (tag: Tag) => void;
  onDelete: (tagId: string) => void;
  onPageChange: (page: number) => void;
}

export function AdminTagsTable({
  tags,
  loading = false,
  currentPage,
  totalTags,
  pageSize,
  deletingIds = new Set(),
  onEdit,
  onDelete,
  onPageChange,
}: AdminTagsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const handleDeleteClick = (tag: Tag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tagToDelete) {
      onDelete(tagToDelete.id);
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  <div className="text-muted-foreground">Loading tags...</div>
                </div>
              </div>
              {/* Skeleton rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                  <div className="h-6 bg-muted rounded animate-pulse w-20" />
                  <div className="h-4 bg-muted rounded animate-pulse w-16" />
                  <div className="h-8 bg-muted rounded animate-pulse w-8" />
                </div>
              ))}
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 text-muted-foreground/30 flex items-center justify-center">
                <span className="text-2xl">🏷️</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">No tags found</h3>
              <p className="text-muted-foreground">
                Create your first tag to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-500 p-4 whitespace-nowrap">
                      Tag Name
                    </TableHead>
                    <TableHead className="text-gray-500 p-4 whitespace-nowrap">
                      Usage Count
                    </TableHead>
                    <TableHead className="text-gray-500 p-4 whitespace-nowrap">
                      Created Date
                    </TableHead>
                    <TableHead className="text-gray-500 p-4 whitespace-nowrap">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => {
                    const createdDate = formatResourceDate(tag.created_at);
                    const isDeleting = deletingIds.has(tag.id);

                    return (
                      <TableRow
                        key={tag.id}
                        className={`hover:bg-gray-50 ${isDeleting ? "opacity-50" : ""}`}
                      >
                        <TableCell className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {tag.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {tag.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {tag.usage_count}{" "}
                            {tag.usage_count === 1 ? "resource" : "resources"}
                          </span>
                        </TableCell>
                        <TableCell className="p-4 whitespace-nowrap text-sm text-gray-500">
                          {createdDate}
                        </TableCell>
                        <TableCell className="p-4 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-gray-100 "
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 border border-border"
                            >
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => onEdit(tag)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-red-600 focus:text-red-600"
                                onClick={() => handleDeleteClick(tag)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {isDeleting ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalTags > pageSize && (
        <Pagination className="mt-6">
          <PaginationContent className="flex items-center space-x-1">
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                aria-disabled={currentPage === 1}
                onClick={() =>
                  currentPage !== 1 &&
                  onPageChange(Math.max(1, currentPage - 1))
                }
                className={`px-3 py-2 text-gray-700 border-border hover:bg-secondary cursor-pointer 
                  ${currentPage === 1 ? "opacity-50" : ""}`}
              >
                Previous
              </Button>
            </PaginationItem>

            {Array.from({
              length: Math.ceil(totalTags / pageSize),
            }).map((_, i) => (
              <PaginationItem key={i}>
                <Button
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(i + 1)}
                  className={`px-3 py-2 cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "text-gray-700 border-border hover:bg-secondary"
                  }`}
                >
                  {i + 1}
                </Button>
              </PaginationItem>
            ))}

            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                aria-disabled={currentPage === Math.ceil(totalTags / pageSize)}
                onClick={() => {
                  if (currentPage !== Math.ceil(totalTags / pageSize)) {
                    onPageChange(
                      Math.min(
                        Math.ceil(totalTags / pageSize),
                        currentPage + 1,
                      ),
                    );
                  }
                }}
                className={`px-3 py-2 text-gray-700 border-border hover:bg-secondary cursor-pointer 
                  ${currentPage === Math.ceil(totalTags / pageSize) ? "opacity-50" : ""}`}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{tagToDelete?.name}
              &quot;? This action cannot be undone.
              {tagToDelete?.usage_count && tagToDelete.usage_count > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ This tag is currently being used by{" "}
                  {tagToDelete.usage_count} resource
                  {tagToDelete.usage_count === 1 ? "" : "s"}. The tag will be
                  automatically removed from all resources.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
