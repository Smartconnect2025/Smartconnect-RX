"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUser } from "@core/auth";

import { allergyService } from "../services/allergyService";
import { Allergy, AllergySeverityEnum } from "../types";

interface AllergyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  allergy?: Allergy | null;
  onSuccess: () => void;
}

export function AllergyModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  allergy,
  onSuccess,
}: AllergyModalProps) {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(allergy?.name || "");
  const [reactionType, setReactionType] = useState(allergy?.reactionType || "");
  const [severity, setSeverity] = useState(
    allergy?.severity || AllergySeverityEnum.Mild,
  );

  const isEditing = !!allergy;

  // Update form state when allergy prop changes
  useEffect(() => {
    if (allergy) {
      setName(allergy.name || "");
      setReactionType(allergy.reactionType || "");
      setSeverity(allergy.severity || AllergySeverityEnum.Mild);
    } else {
      // Reset form for new allergy
      setName("");
      setReactionType("");
      setSeverity(AllergySeverityEnum.Mild);
    }
  }, [allergy]);

  const handleSaveAllergy = async () => {
    if (!user?.id) {
      toast.error("Please log in to save allergy");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter allergy name");
      return;
    }

    if (!reactionType.trim()) {
      toast.error("Please enter reaction type");
      return;
    }

    setLoading(true);

    try {
      const allergyData = {
        patientId,
        name: name.trim(),
        reactionType: reactionType.trim(),
        severity,
      };

      let result;
      if (isEditing && allergy) {
        result = await allergyService.updateAllergy(
          allergy.id,
          user.id,
          allergyData,
        );
      } else {
        result = await allergyService.createAllergy(user.id, allergyData);
      }

      if (result.success) {
        toast.success(
          isEditing
            ? "Allergy updated successfully"
            : "Allergy added successfully",
        );
        onSuccess();
        handleClose();
      } else {
        toast.error(result.error || "Failed to save allergy");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save allergy";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // Reset form when closing
      setName(allergy?.name || "");
      setReactionType(allergy?.reactionType || "");
      setSeverity(allergy?.severity || AllergySeverityEnum.Mild);
      onClose();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="w-[400px] sm:w-[400px] bg-white px-6 z-50">
        <SheetHeader className="pb-6">
          <div>
            <SheetTitle className="text-lg font-semibold">
              {isEditing ? "Edit Allergy" : "Add Allergy"}
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-600 mt-1">
              {isEditing ? "Update allergy for" : "Add new allergy for"}{" "}
              {patientName}.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Allergy Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Allergy Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Penicillin"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Reaction Type */}
          <div className="space-y-2">
            <Label htmlFor="reactionType" className="text-sm font-medium">
              Reaction Type
            </Label>
            <Input
              id="reactionType"
              value={reactionType}
              onChange={(e) => setReactionType(e.target.value)}
              placeholder="e.g., Rash, Anaphylaxis"
              className="w-full"
              disabled={loading}
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Severity</Label>
            <Select
              value={severity}
              onValueChange={(value) =>
                setSeverity(value as AllergySeverityEnum)
              }
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AllergySeverityEnum.Mild}>Mild</SelectItem>
                <SelectItem value={AllergySeverityEnum.Moderate}>
                  Moderate
                </SelectItem>
                <SelectItem value={AllergySeverityEnum.Severe}>
                  Severe
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAllergy}
            disabled={loading}
            variant="default"
          >
            {loading
              ? "Saving..."
              : isEditing
                ? "Update Allergy"
                : "Add Allergy"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
