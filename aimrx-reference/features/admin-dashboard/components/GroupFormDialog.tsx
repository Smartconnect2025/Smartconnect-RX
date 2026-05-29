"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Group {
  id: string;
  name: string;
  platform_manager_id: string | null;
}

interface PlatformManagerOption {
  id: string;
  name: string;
}

interface GroupFormData {
  name: string;
  platformManagerId: string;
}

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingGroup?: Group | null;
}

export function GroupFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editingGroup,
}: GroupFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [platformManagers, setPlatformManagers] = useState<
    PlatformManagerOption[]
  >([]);
  const [formData, setFormData] = useState<GroupFormData>({
    name: "",
    platformManagerId: "",
  });

  // Fetch platform managers when dialog opens
  useEffect(() => {
    if (open) {
      fetchPlatformManagers();
    }
  }, [open]);

  useEffect(() => {
    if (editingGroup) {
      setFormData({
        name: editingGroup.name,
        platformManagerId: editingGroup.platform_manager_id || "",
      });
    } else {
      setFormData({
        name: "",
        platformManagerId: "",
      });
    }
  }, [editingGroup, open]);

  const fetchPlatformManagers = async () => {
    try {
      const response = await fetch("/api/admin/platform-managers");
      if (response.ok) {
        const data = await response.json();
        setPlatformManagers(data.platformManagers || []);
      }
    } catch (error) {
      console.error("Error fetching platform managers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingGroup
        ? `/api/admin/groups/${editingGroup.id}`
        : "/api/admin/groups";

      const method = editingGroup ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          editingGroup
            ? "Group updated successfully"
            : "Group created successfully",
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to save group");
      }
    } catch (error) {
      console.error("Error saving group:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-border">
        <DialogHeader>
          <DialogTitle>
            {editingGroup ? "Edit Group" : "Create New Group"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              placeholder="Enter group name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platformManagerId">Platform Manager</Label>
            <Select
              value={formData.platformManagerId || "none"}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  platformManagerId: value === "none" ? "" : value,
                }))
              }
            >
              <SelectTrigger id="platformManagerId">
                <SelectValue placeholder="Select a platform manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {platformManagers.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border border-border"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editingGroup
                  ? "Updating..."
                  : "Creating..."
                : editingGroup
                  ? "Update Group"
                  : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
