"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const MEDICATION_FORMS = [
  "Tablet",
  "Capsule",
  "Liquid",
  "Cream",
  "Ointment",
  "Gel",
  "Patch",
  "Injection",
  "Inhaler",
  "Drops",
  "Spray",
  "Suppository",
];

const DOSAGE_UNITS = ["mg", "mL", "mcg", "g", "units", "%"];

const CONSULTATION_REASONS = [
  { value: "dose_titration", label: "Dose Titration & Adjustment" },
  { value: "side_effect_monitoring", label: "Side Effect & Safety Monitoring" },
  { value: "therapeutic_response", label: "Therapeutic Response Review" },
  { value: "adherence_tracking", label: "Medication Adherence Tracking" },
  {
    value: "contraindication_screening",
    label: "Contraindication Screening",
  },
];

interface Prescription {
  id: string;
  patientName: string;
  medication: string;
  strength: string;
  vialSize?: string;
  dosageAmount?: string;
  dosageUnit?: string;
  form: string;
  quantity: number;
  refills: number;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes?: string;
  patientPrice?: string;
  shippingFeeCents?: number;
  profitCents?: number;
  consultationReason?: string;
}

interface EditPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription;
  onSaved: (updatedFields: {
    vialSize: string;
    dosageAmount: string;
    dosageUnit: string;
    form: string;
    quantity: number;
    refills: number;
    sig: string;
    dispenseAsWritten: boolean;
    pharmacyNotes: string;
    patientPrice: string;
    shippingFeeCents: number;
    profitCents: number;
    consultationReason: string;
  }) => void;
}

function buildFormData(prescription: Prescription) {
  return {
    vialSize: prescription.vialSize || "",
    dosageAmount: prescription.dosageAmount || prescription.strength || "",
    dosageUnit: prescription.dosageUnit || "mg",
    form: prescription.form !== "N/A" ? prescription.form : "",
    quantity: String(prescription.quantity),
    refills: String(prescription.refills),
    sig: prescription.sig || "",
    dispenseAsWritten: prescription.dispenseAsWritten,
    pharmacyNotes: prescription.pharmacyNotes || "",
    patientPrice: prescription.patientPrice || "",
    shippingFee: prescription.shippingFeeCents
      ? String(prescription.shippingFeeCents / 100)
      : "",
    profitFee: prescription.profitCents
      ? String(prescription.profitCents / 100)
      : "",
    consultationReason: prescription.consultationReason || "",
  };
}

export function EditPrescriptionModal({
  isOpen,
  onClose,
  prescription,
  onSaved,
}: EditPrescriptionModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(() => buildFormData(prescription));

  // Reset form data when prescription changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(buildFormData(prescription));
    }
  }, [isOpen, prescription]);

  const handleSave = async () => {
    // Basic validation
    if (!formData.dosageAmount || parseFloat(formData.dosageAmount) <= 0) {
      toast.error("Dosage amount is required");
      return;
    }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      toast.error("Quantity is required");
      return;
    }
    if (!formData.sig.trim()) {
      toast.error("SIG (directions) is required");
      return;
    }

    const profitCents = formData.profitFee
      ? Math.round(parseFloat(formData.profitFee) * 100)
      : 0;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/prescriptions/${prescription.id}/update`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vialSize: formData.vialSize,
            dosageAmount: formData.dosageAmount,
            dosageUnit: formData.dosageUnit,
            form: formData.form,
            quantity: parseInt(formData.quantity),
            refills: parseInt(formData.refills) || 0,
            sig: formData.sig,
            dispenseAsWritten: formData.dispenseAsWritten,
            pharmacyNotes: formData.pharmacyNotes,
            patientPrice: formData.patientPrice,
            shippingFeeCents: formData.shippingFee
              ? Math.round(parseFloat(formData.shippingFee) * 100)
              : 0,
            profitCents,
            consultationReason: formData.consultationReason,
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Prescription updated successfully");
        onSaved({
          vialSize: formData.vialSize,
          dosageAmount: formData.dosageAmount,
          dosageUnit: formData.dosageUnit,
          form: formData.form,
          quantity: parseInt(formData.quantity),
          refills: parseInt(formData.refills) || 0,
          sig: formData.sig,
          dispenseAsWritten: formData.dispenseAsWritten,
          pharmacyNotes: formData.pharmacyNotes,
          patientPrice: formData.patientPrice,
          shippingFeeCents: formData.shippingFee
            ? Math.round(parseFloat(formData.shippingFee) * 100)
            : 0,
          profitCents,
          consultationReason: formData.consultationReason,
        });
      } else {
        toast.error(data.error || "Failed to update prescription");
      }
    } catch {
      toast.error("Failed to update prescription");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Prescription</DialogTitle>
          <DialogDescription>
            Update prescription details for {prescription.patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Medication (read-only) */}
          <div>
            <Label className="text-sm font-medium text-gray-600">
              Medication
            </Label>
            <p className="text-base font-semibold text-gray-900 mt-1">
              {prescription.medication}
            </p>
          </div>

          {/* Vial Size */}
          <div>
            <Label htmlFor="vialSize">Vial Size</Label>
            <Input
              id="vialSize"
              value={formData.vialSize}
              onChange={(e) =>
                setFormData({ ...formData, vialSize: e.target.value })
              }
              placeholder="e.g., 5mL"
            />
          </div>

          {/* Dosage Amount + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dosageAmount">Dosage Amount *</Label>
              <Input
                id="dosageAmount"
                type="number"
                value={formData.dosageAmount}
                onChange={(e) =>
                  setFormData({ ...formData, dosageAmount: e.target.value })
                }
                min="0"
                step="any"
              />
            </div>
            <div>
              <Label htmlFor="dosageUnit">Unit</Label>
              <Select
                value={formData.dosageUnit}
                onValueChange={(value) =>
                  setFormData({ ...formData, dosageUnit: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOSAGE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Form */}
          <div>
            <Label htmlFor="form">Form</Label>
            <Select
              value={formData.form}
              onValueChange={(value) =>
                setFormData({ ...formData, form: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {MEDICATION_FORMS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity + Refills */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="refills">Refills</Label>
              <Input
                id="refills"
                type="number"
                value={formData.refills}
                onChange={(e) =>
                  setFormData({ ...formData, refills: e.target.value })
                }
                min="0"
                max="12"
              />
            </div>
          </div>

          {/* SIG */}
          <div>
            <Label htmlFor="sig">SIG (Directions for Patient) *</Label>
            <Textarea
              id="sig"
              value={formData.sig}
              onChange={(e) =>
                setFormData({ ...formData, sig: e.target.value })
              }
              rows={3}
            />
          </div>

          {/* Dispense as Written */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="daw"
              checked={formData.dispenseAsWritten}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  dispenseAsWritten: checked === true,
                })
              }
            />
            <Label htmlFor="daw" className="cursor-pointer">
              Dispense as Written (DAW)
            </Label>
          </div>

          {/* Pharmacy Notes */}
          <div>
            <Label htmlFor="pharmacyNotes">Notes to Pharmacy</Label>
            <Textarea
              id="pharmacyNotes"
              value={formData.pharmacyNotes}
              onChange={(e) =>
                setFormData({ ...formData, pharmacyNotes: e.target.value })
              }
              rows={2}
            />
          </div>

          {/* Pricing */}
          <div className="border-t pt-4 space-y-3">
            <p className="font-semibold text-sm text-gray-700">Pricing</p>
            <div>
              <Label htmlFor="patientPrice">Medication Price ($)</Label>
              <Input
                id="patientPrice"
                type="number"
                value={formData.patientPrice}
                onChange={(e) =>
                  setFormData({ ...formData, patientPrice: e.target.value })
                }
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label htmlFor="shippingFee">Shipping & Handling ($)</Label>
              <Input
                id="shippingFee"
                type="number"
                value={formData.shippingFee}
                onChange={(e) =>
                  setFormData({ ...formData, shippingFee: e.target.value })
                }
                min="0"
                step="0.01"
              />
            </div>

            {/* Consultation Fee + Reason */}
            <div className="pt-3 border-t border-gray-200 space-y-3">
              <Label className="text-sm font-semibold text-gray-700">
                Consultation Fee
              </Label>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div>
                  <Label className="text-xs">Fee ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.profitFee}
                    onChange={(e) =>
                      setFormData({ ...formData, profitFee: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <select
                    value={formData.consultationReason}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        consultationReason: e.target.value,
                      })
                    }
                    className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select reason...</option>
                    {CONSULTATION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
