"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tag } from "../types";

const tagFormSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name must be 50 characters or less"),
});

export type TagFormData = z.infer<typeof tagFormSchema>;

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  onSubmit: (data: TagFormData) => void;
}

export function TagFormDialog({
  open,
  onOpenChange,
  tag,
  onSubmit,
}: TagFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
    },
    mode: "onChange",
  });

  // Reset form when dialog opens/closes or tag changes
  useEffect(() => {
    if (open) {
      if (tag) {
        // Editing existing tag
        form.reset({
          name: tag.name || "",
        });
      } else {
        // Creating new tag
        form.reset({
          name: "",
        });
      }
    }
  }, [open, tag, form]);

  const handleSubmit = async (data: TagFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      toast.success(
        tag ? "Tag updated successfully" : "Tag created successfully",
      );
    } catch (error) {
      console.error("Error saving tag:", error);
      toast.error("Failed to save tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border">
        <DialogHeader>
          <DialogTitle>{tag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
          <DialogDescription>
            {tag
              ? "Update the tag information below"
              : "Enter the tag name to create a new tag"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Tag Name */}
          <div>
            <label className="text-sm font-medium">Tag Name *</label>
            <Input
              {...form.register("name")}
              placeholder="Enter tag name"
              className="mt-1"
              maxLength={50}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {form.watch("name")?.length || 0}/50 characters
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? "Saving..." : tag ? "Update Tag" : "Create Tag"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
