"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
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
import { ArrowLeft, ArrowRight, Search, Plus, Trash2 } from "lucide-react";

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

interface CatalogMedication {
  id: string;
  medication_name: string;
  vial_size: string | null;
  dosage_amount: string | null;
  dosage_unit: string | null;
  form: string | null;
  quantity: string | null;
  refills: string | null;
  sig: string | null;
  pharmacy_notes: string | null;
  patient_price: string | null;
  doctor_price: string | null;
}

interface MedicationItem {
  id: string;
  medication: string;
  vialSize: string;
  dosageAmount: string;
  dosageUnit: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  patientPrice: string;
  doctorPrice: string;
}

export default function PrescriptionStep2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");

  // Array of medications
  const [medications, setMedications] = useState<MedicationItem[]>([
    {
      id: crypto.randomUUID(),
      medication: "",
      vialSize: "",
      dosageAmount: "",
      dosageUnit: "mg",
      form: "",
      quantity: "",
      refills: "0",
      sig: "",
      patientPrice: "",
      doctorPrice: "",
    },
  ]);

  // Shared prescription data
  const [sharedData, setSharedData] = useState({
    dispenseAsWritten: false,
    pharmacyNotes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [catalogMedications, setCatalogMedications] = useState<
    CatalogMedication[]
  >([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(
    null,
  );
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved data from sessionStorage on mount
  useEffect(() => {
    const savedDraft = sessionStorage.getItem("prescriptionDraft");
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      if (parsed.medications && Array.isArray(parsed.medications)) {
        setMedications(parsed.medications);
        setSharedData({
          dispenseAsWritten: parsed.dispenseAsWritten || false,
          pharmacyNotes: parsed.pharmacyNotes || "",
        });
      }
    }
  }, []);

  // Clean up prescription state when unmounting
  useEffect(() => {
    return () => {
      const isStillInWizard = window.location.pathname.startsWith(
        "/prescriptions/new/",
      );
      if (!isStillInWizard) {
        sessionStorage.removeItem("prescriptionData");
        sessionStorage.removeItem("prescriptionDraft");
        sessionStorage.removeItem("selectedPatientId");
        sessionStorage.removeItem("encounterId");
        sessionStorage.removeItem("appointmentId");
      }
    };
  }, []);

  // Search catalog medications
  useEffect(() => {
    if (activeSearchIndex === null) return;

    const searchMedications = async () => {
      const medication = medications[activeSearchIndex];
      if (!medication || medication.medication.trim().length < 2) {
        setCatalogMedications([]);
        setShowCatalogDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/medication-catalog?search=${encodeURIComponent(medication.medication)}`,
        );
        const data = await response.json();
        setCatalogMedications(data.medications || []);
        setShowCatalogDropdown(data.medications?.length > 0);
      } catch (error) {
        console.error("Error searching medications:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchMedications, 300);
    return () => clearTimeout(debounceTimer);
  }, [activeSearchIndex, medications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowCatalogDropdown(false);
        setActiveSearchIndex(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!patientId) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              No patient selected
            </h2>
            <Button onClick={() => router.push("/prescriptions/new/step1")}>
              Go Back to Step 1
            </Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  const handleMedicationChange = (
    index: number,
    field: keyof MedicationItem,
    value: string,
  ) => {
    setMedications((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Clear error for this field
    const errorKey = `${index}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleAddMedication = () => {
    if (medications.length >= 8) {
      alert("Maximum 8 medications per prescription");
      return;
    }

    setMedications((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medication: "",
        vialSize: "",
        dosageAmount: "",
        dosageUnit: "mg",
        form: "",
        quantity: "",
        refills: "0",
        sig: "",
        patientPrice: "",
        doctorPrice: "",
      },
    ]);
  };

  const handleRemoveMedication = (index: number) => {
    if (medications.length === 1) {
      alert("At least one medication is required");
      return;
    }

    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectCatalogMedication = (
    catalogMed: CatalogMedication,
    index: number,
  ) => {
    setMedications((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        medication: catalogMed.medication_name,
        vialSize: catalogMed.vial_size || "",
        dosageAmount: catalogMed.dosage_amount || "",
        dosageUnit: catalogMed.dosage_unit || "mg",
        form: catalogMed.form || "",
        quantity: catalogMed.quantity || "",
        refills: catalogMed.refills || "0",
        sig: catalogMed.sig || "",
        patientPrice: catalogMed.patient_price || "",
        doctorPrice: catalogMed.doctor_price || "",
      };
      return updated;
    });
    setShowCatalogDropdown(false);
    setActiveSearchIndex(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    medications.forEach((med, index) => {
      if (!med.medication.trim()) {
        newErrors[`${index}-medication`] = "Medication name is required";
      }
      if (!med.dosageAmount || parseFloat(med.dosageAmount) <= 0) {
        newErrors[`${index}-dosageAmount`] = "Dosage amount is required";
      }
      if (!med.dosageUnit) {
        newErrors[`${index}-dosageUnit`] = "Dosage unit is required";
      }
      if (!med.form) {
        newErrors[`${index}-form`] = "Medication form is required";
      }
      if (!med.quantity || parseInt(med.quantity) <= 0) {
        newErrors[`${index}-quantity`] = "Quantity must be greater than 0";
      }
      if (!med.sig.trim()) {
        newErrors[`${index}-sig`] = "Directions (SIG) are required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      const dataToSave = {
        medications: medications.map((med) => ({
          ...med,
          strength: `${med.dosageAmount}${med.dosageUnit}`,
        })),
        dispenseAsWritten: sharedData.dispenseAsWritten,
        pharmacyNotes: sharedData.pharmacyNotes,
      };

      sessionStorage.setItem("prescriptionData", JSON.stringify(dataToSave));
      sessionStorage.setItem("prescriptionDraft", JSON.stringify(dataToSave));
      sessionStorage.setItem("selectedPatientId", patientId);
      router.push(`/prescriptions/new/step3?patientId=${patientId}`);
    }
  };

  const handleBack = () => {
    const dataToSave = {
      medications,
      dispenseAsWritten: sharedData.dispenseAsWritten,
      pharmacyNotes: sharedData.pharmacyNotes,
    };
    sessionStorage.setItem("prescriptionDraft", JSON.stringify(dataToSave));
    router.push("/prescriptions/new/step1");
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto max-w-4xl py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                New Prescription
              </h1>
              <p className="text-muted-foreground mt-2">
                Step 2 of 3: Prescription Details
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/")}>
              Cancel
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-6">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Select Patient
              </span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                2
              </div>
              <span className="ml-2 font-medium">Prescription Details</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Review & Submit
              </span>
            </div>
          </div>
        </div>

        {/* Medications List */}
        <div className="space-y-6">
          {medications.map((med, index) => (
            <div
              key={med.id}
              className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-[#1E3A8A] p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-[#1E3A8A]">
                  Medication {index + 1}
                </h2>
                {medications.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveMedication(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              {/* Medication Name with Autocomplete */}
              <div
                className="space-y-2 relative"
                ref={activeSearchIndex === index ? dropdownRef : null}
              >
                <Label htmlFor={`medication-${index}`} className="required">
                  Medication Name
                </Label>
                <div className="relative">
                  <Input
                    id={`medication-${index}`}
                    placeholder="Start typing to search catalog or enter manually..."
                    value={med.medication}
                    onChange={(e) => {
                      handleMedicationChange(
                        index,
                        "medication",
                        e.target.value,
                      );
                      setActiveSearchIndex(index);
                    }}
                    onFocus={() => {
                      setActiveSearchIndex(index);
                      if (catalogMedications.length > 0) {
                        setShowCatalogDropdown(true);
                      }
                    }}
                    className={`h-[50px] pr-10 ${errors[`${index}-medication`] ? "border-red-500" : ""}`}
                    autoComplete="off"
                  />
                  {isSearching && activeSearchIndex === index && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Search className="h-4 w-4 text-gray-400 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Dropdown with catalog medications */}
                {showCatalogDropdown &&
                  activeSearchIndex === index &&
                  catalogMedications.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {catalogMedications.map((catalogMed) => (
                        <button
                          key={catalogMed.id}
                          type="button"
                          onClick={() =>
                            handleSelectCatalogMedication(catalogMed, index)
                          }
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">
                            {catalogMed.medication_name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 flex items-center gap-4">
                            {catalogMed.vial_size && (
                              <span>Vial: {catalogMed.vial_size}</span>
                            )}
                            {catalogMed.dosage_amount &&
                              catalogMed.dosage_unit && (
                                <span>
                                  Dosage: {catalogMed.dosage_amount}
                                  {catalogMed.dosage_unit}
                                </span>
                              )}
                            {catalogMed.form && (
                              <span>Form: {catalogMed.form}</span>
                            )}
                          </div>
                          {(catalogMed.patient_price ||
                            catalogMed.doctor_price) && (
                            <div className="text-sm text-gray-500 mt-1">
                              {catalogMed.patient_price && (
                                <span className="mr-3">
                                  Patient: $
                                  {parseFloat(catalogMed.patient_price).toFixed(
                                    2,
                                  )}
                                </span>
                              )}
                              {catalogMed.doctor_price && (
                                <span>
                                  Doctor: $
                                  {parseFloat(catalogMed.doctor_price).toFixed(
                                    2,
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                {errors[`${index}-medication`] && (
                  <p className="text-sm text-red-600">
                    {errors[`${index}-medication`]}
                  </p>
                )}
              </div>

              {/* Vial Size */}
              <div className="space-y-2">
                <Label htmlFor={`vialSize-${index}`}>Vial Size</Label>
                <Input
                  id={`vialSize-${index}`}
                  placeholder="e.g., 2.5mg/0.5ml"
                  value={med.vialSize}
                  onChange={(e) =>
                    handleMedicationChange(index, "vialSize", e.target.value)
                  }
                  className="h-[50px]"
                />
              </div>

              {/* Dosage Amount and Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`dosageAmount-${index}`} className="required">
                    Dosage Amount
                  </Label>
                  <Input
                    id={`dosageAmount-${index}`}
                    type="number"
                    min="0"
                    placeholder="e.g., 10"
                    value={med.dosageAmount}
                    onChange={(e) =>
                      handleMedicationChange(
                        index,
                        "dosageAmount",
                        e.target.value,
                      )
                    }
                    className={`h-[50px] ${errors[`${index}-dosageAmount`] ? "border-red-500" : ""}`}
                  />
                  {errors[`${index}-dosageAmount`] && (
                    <p className="text-sm text-red-600">
                      {errors[`${index}-dosageAmount`]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`dosageUnit-${index}`} className="required">
                    Dosage Unit
                  </Label>
                  <Select
                    value={med.dosageUnit}
                    onValueChange={(value) =>
                      handleMedicationChange(index, "dosageUnit", value)
                    }
                  >
                    <SelectTrigger
                      className={`h-[50px] ${errors[`${index}-dosageUnit`] ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOSAGE_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`${index}-dosageUnit`] && (
                    <p className="text-sm text-red-600">
                      {errors[`${index}-dosageUnit`]}
                    </p>
                  )}
                </div>
              </div>

              {/* Form */}
              <div className="space-y-2">
                <Label htmlFor={`form-${index}`} className="required">
                  Form
                </Label>
                <Select
                  value={med.form}
                  onValueChange={(value) =>
                    handleMedicationChange(index, "form", value)
                  }
                >
                  <SelectTrigger
                    className={`h-[50px] ${errors[`${index}-form`] ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select form" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICATION_FORMS.map((form) => (
                      <SelectItem key={form} value={form}>
                        {form}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors[`${index}-form`] && (
                  <p className="text-sm text-red-600">
                    {errors[`${index}-form`]}
                  </p>
                )}
              </div>

              {/* Quantity and Refills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${index}`} className="required">
                    Quantity
                  </Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    value={med.quantity}
                    onChange={(e) =>
                      handleMedicationChange(index, "quantity", e.target.value)
                    }
                    className={`h-[50px] ${errors[`${index}-quantity`] ? "border-red-500" : ""}`}
                  />
                  {errors[`${index}-quantity`] && (
                    <p className="text-sm text-red-600">
                      {errors[`${index}-quantity`]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`refills-${index}`}>Refills</Label>
                  <Input
                    id={`refills-${index}`}
                    type="number"
                    min="0"
                    max="12"
                    placeholder="0"
                    value={med.refills}
                    onChange={(e) =>
                      handleMedicationChange(index, "refills", e.target.value)
                    }
                    className="h-[50px]"
                  />
                </div>
              </div>

              {/* SIG */}
              <div className="space-y-2">
                <Label htmlFor={`sig-${index}`} className="required">
                  SIG (Directions for Patient)
                </Label>
                <Textarea
                  id={`sig-${index}`}
                  placeholder="e.g., Take 1 tablet by mouth once daily in the morning with food"
                  value={med.sig}
                  onChange={(e) =>
                    handleMedicationChange(index, "sig", e.target.value)
                  }
                  rows={3}
                  className={errors[`${index}-sig`] ? "border-red-500" : ""}
                />
                {errors[`${index}-sig`] && (
                  <p className="text-sm text-red-600">
                    {errors[`${index}-sig`]}
                  </p>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`patientPrice-${index}`}>Patient Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id={`patientPrice-${index}`}
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={med.patientPrice}
                      onChange={(e) =>
                        handleMedicationChange(
                          index,
                          "patientPrice",
                          e.target.value,
                        )
                      }
                      className="h-[50px] pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`doctorPrice-${index}`}>Doctor Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id={`doctorPrice-${index}`}
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={med.doctorPrice}
                      onChange={(e) =>
                        handleMedicationChange(
                          index,
                          "doctorPrice",
                          e.target.value,
                        )
                      }
                      className="h-[50px] pl-7"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Medication Button */}
          {medications.length < 8 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddMedication}
              className="w-full h-16 border-2 border-dashed border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A]/5"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Another Medication ({medications.length}/8)
            </Button>
          )}

          {/* Shared Options */}
          <div className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-[#1E3A8A] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#1E3A8A]">
              Prescription Options
            </h2>

            {/* Dispense as Written */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="daw"
                checked={sharedData.dispenseAsWritten}
                onCheckedChange={(checked) =>
                  setSharedData((prev) => ({
                    ...prev,
                    dispenseAsWritten: checked as boolean,
                  }))
                }
              />
              <Label
                htmlFor="daw"
                className="text-sm font-normal cursor-pointer"
              >
                Dispense as Written (DAW) - No substitutions allowed
              </Label>
            </div>

            {/* Pharmacy Notes */}
            <div className="space-y-2">
              <Label htmlFor="pharmacyNotes">
                Notes to Pharmacy (Optional)
              </Label>
              <Textarea
                id="pharmacyNotes"
                placeholder="Any special instructions for the pharmacist..."
                value={sharedData.pharmacyNotes}
                onChange={(e) =>
                  setSharedData((prev) => ({
                    ...prev,
                    pharmacyNotes: e.target.value,
                  }))
                }
                rows={3}
                className="bg-[#F8FAFC] border-[#1E3A8A] rounded-[4px]"
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="bg-white border border-gray-200 rounded-[4px] p-6">
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Patient Selection
              </Button>
              <Button onClick={handleNext} size="lg">
                Continue to Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
