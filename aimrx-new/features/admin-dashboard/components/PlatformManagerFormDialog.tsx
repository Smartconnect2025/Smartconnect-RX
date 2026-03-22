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

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
}

interface PlatformManager {
  id: string;
  name: string;
  email?: string;
  pharmacies?: Pharmacy[];
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
  const [selectedPharmacyIds, setSelectedPharmacyIds] = useState<string[]>([]);
  const [availablePharmacies, setAvailablePharmacies] = useState<Pharmacy[]>([]);

  useEffect(() => {
    if (open) {
      loadPharmacies();
    }
  }, [open]);

  useEffect(() => {
    if (editingPlatformManager) {
      setName(editingPlatformManager.name);
      setEmail(editingPlatformManager.email || "");
      setSelectedPharmacyIds(
        editingPlatformManager.pharmacies?.map((p) => p.id) || [],
      );
    } else {
      setName("");
      setEmail("");
      setSelectedPharmacyIds([]);
    }
  }, [editingPlatformManager, open]);

  const loadPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      if (response.ok) {
        const data = await response.json();
        const active = (data.pharmacies || []).filter(
          (p: Pharmacy & { is_active: boolean }) => p.is_active,
        );
        setAvailablePharmacies(active);
      }
    } catch (error) {
      console.error("Error loading pharmacies:", error);
    }
  };

  const togglePharmacy = (pharmacyId: string) => {
    setSelectedPharmacyIds((prev) =>
      prev.includes(pharmacyId)
        ? prev.filter((id) => id !== pharmacyId)
        : [...prev, pharmacyId],
    );
  };

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
        body: JSON.stringify({
          name,
          email: email || null,
          pharmacy_ids: selectedPharmacyIds,
        }),
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

          <div className="space-y-2">
            <Label>Pharmacy Association</Label>
            <p className="text-xs text-muted-foreground">
              Select which pharmacies this manager is associated with
            </p>
            {availablePharmacies.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No pharmacies available
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {availablePharmacies.map((pharmacy) => (
                  <label
                    key={pharmacy.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPharmacyIds.includes(pharmacy.id)}
                      onChange={() => togglePharmacy(pharmacy.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm">{pharmacy.name}</span>
                  </label>
                ))}
              </div>
            )}
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
