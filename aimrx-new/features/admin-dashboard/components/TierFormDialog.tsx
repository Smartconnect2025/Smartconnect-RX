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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Tier {
  id: string;
  tier_name: string;
  tier_code: string;
  discount_percentage: string;
  description?: string;
}

interface TierFormData {
  tierName: string;
  tierCode: string;
  discountPercentage: string;
  description: string;
}

interface TierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingTier?: Tier | null;
  isSuperAdmin?: boolean;
  pharmacies?: { id: string; name: string }[];
}

export function TierFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editingTier,
  isSuperAdmin = false,
  pharmacies = [],
}: TierFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [formData, setFormData] = useState<TierFormData>({
    tierName: "",
    tierCode: "",
    discountPercentage: "",
    description: "",
  });

  useEffect(() => {
    if (editingTier) {
      setFormData({
        tierName: editingTier.tier_name,
        tierCode: editingTier.tier_code,
        discountPercentage: editingTier.discount_percentage,
        description: editingTier.description || "",
      });
    } else {
      setFormData({
        tierName: "",
        tierCode: "",
        discountPercentage: "",
        description: "",
      });
      setSelectedPharmacyId("");
    }
  }, [editingTier, open]);

  const handleInputChange = (field: keyof TierFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSuperAdmin && !editingTier && !selectedPharmacyId) {
      toast.error("Please select a pharmacy");
      return;
    }

    setIsSubmitting(true);

    try {
      const discount = parseFloat(formData.discountPercentage);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        toast.error("Discount percentage must be between 0 and 100");
        setIsSubmitting(false);
        return;
      }

      const url = editingTier
        ? `/api/admin/tiers/${editingTier.id}`
        : "/api/admin/tiers";

      const method = editingTier ? "PATCH" : "POST";

      const bodyData: Record<string, unknown> = { ...formData };
      if (isSuperAdmin && !editingTier && selectedPharmacyId) {
        bodyData.pharmacy_id = selectedPharmacyId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          editingTier
            ? "Tier updated successfully"
            : "Tier created successfully",
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to save tier");
      }
    } catch (error) {
      console.error("Error saving tier:", error);
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
            {editingTier ? "Edit Tier" : "Create New Tier"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSuperAdmin && !editingTier && (
            <div className="space-y-2">
              <Label>Pharmacy *</Label>
              <Select value={selectedPharmacyId} onValueChange={setSelectedPharmacyId}>
                <SelectTrigger className="bg-white border-gray-200">
                  <SelectValue placeholder="Select a pharmacy..." />
                </SelectTrigger>
                <SelectContent>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tierName">Tier Name *</Label>
            <Input
              id="tierName"
              value={formData.tierName}
              onChange={(e) => handleInputChange("tierName", e.target.value)}
              required
              placeholder="e.g., Tier 1, Gold Tier"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierCode">Tier Code *</Label>
            <Input
              id="tierCode"
              value={formData.tierCode}
              onChange={(e) => handleInputChange("tierCode", e.target.value)}
              required
              placeholder="e.g., tier1, gold"
              disabled={!!editingTier}
            />
            {editingTier && (
              <p className="text-xs text-muted-foreground">
                Tier code cannot be changed after creation
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountPercentage">
              Discount Percentage * (%)
            </Label>
            <Input
              id="discountPercentage"
              type="number"
              min="0"
              max="100"
              value={formData.discountPercentage}
              onChange={(e) =>
                handleInputChange("discountPercentage", e.target.value)
              }
              required
              placeholder="e.g., 10.00, 15.50"
            />
            <p className="text-xs text-muted-foreground">
              Enter the discount percentage for this tier (0-100)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Optional description of this tier"
              rows={3}
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
                ? editingTier
                  ? "Updating..."
                  : "Creating..."
                : editingTier
                  ? "Update Tier"
                  : "Create Tier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
