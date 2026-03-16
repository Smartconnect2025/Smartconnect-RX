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
import { toast } from "sonner";

interface PlatformManager {
  id: string;
  name: string;
  email?: string;
}

interface PlatformManagerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingPlatformManager?: PlatformManager | null;
}

export function PlatformManagerFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editingPlatformManager,
}: PlatformManagerFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (editingPlatformManager) {
      setName(editingPlatformManager.name);
      setEmail(editingPlatformManager.email || "");
    } else {
      setName("");
      setEmail("");
    }
  }, [editingPlatformManager, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingPlatformManager
        ? `/api/admin/platform-managers/${editingPlatformManager.id}`
        : "/api/admin/platform-managers";

      const method = editingPlatformManager ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email: email || null }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          editingPlatformManager
            ? "Platform manager updated successfully"
            : "Platform manager created successfully",
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to save platform manager");
      }
    } catch (error) {
      console.error("Error saving platform manager:", error);
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
            {editingPlatformManager
              ? "Edit Platform Manager"
              : "Create New Platform Manager"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pmName">Name *</Label>
            <Input
              id="pmName"
              data-testid="input-pm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter platform manager name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pmEmail">Email Address</Label>
            <Input
              id="pmEmail"
              data-testid="input-pm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
            />
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
                ? editingPlatformManager
                  ? "Updating..."
                  : "Creating..."
                : editingPlatformManager
                  ? "Update"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
