import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDiagnosis: (diagnosis: { name: string; code: string }) => void;
  isFinalized: boolean;
}

export function AddDiagnosisModal({
  isOpen,
  onClose,
  onAddDiagnosis,
  isFinalized,
}: AddDiagnosisModalProps) {
  const [newDiagnosis, setNewDiagnosis] = useState({
    name: "",
    code: "",
  });

  const handleAddDiagnosis = () => {
    if (newDiagnosis.name && newDiagnosis.code) {
      onAddDiagnosis(newDiagnosis);
      setNewDiagnosis({ name: "", code: "" });
    }
  };

  const handleCancel = () => {
    setNewDiagnosis({ name: "", code: "" });
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Add Diagnosis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div>
            <Label
              htmlFor="diagnosis-name"
              className="text-sm font-medium text-gray-700 mb-2 block"
            >
              Diagnosis Name
            </Label>
            <Input
              id="diagnosis-name"
              value={newDiagnosis.name}
              onChange={(e) =>
                setNewDiagnosis((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Hypertension"
              className="w-full"
              disabled={isFinalized}
            />
          </div>

          <div>
            <Label
              htmlFor="diagnosis-code"
              className="text-sm font-medium text-gray-700 mb-2 block"
            >
              Diagnosis Code
            </Label>
            <Input
              id="diagnosis-code"
              value={newDiagnosis.code}
              onChange={(e) =>
                setNewDiagnosis((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder="e.g., I10"
              className="w-full"
              disabled={isFinalized}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleAddDiagnosis}
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={!newDiagnosis.name || !newDiagnosis.code || isFinalized}
          >
            Add Diagnosis
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
