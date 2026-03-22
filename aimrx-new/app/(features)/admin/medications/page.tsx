"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { useUser } from "@core/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit,
  PackageX,
  Trash2,
} from "lucide-react";

// Categories are loaded from medications database

interface Medication {
  id: string;
  pharmacy_id: string;
  name: string;
  strength: string | null;
  vial_size: string | null;
  form: string | null;
  ndc: string | null;
  retail_price_cents: number;

  category: string | null;
  dosage_instructions: string | null;
  detailed_description: string | null;
  image_url: string | null;
  is_active: boolean;
  in_stock: boolean | null;
  preparation_time_days: number | null;
  notes: string | null;
  created_at: string;
}

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export default function MedicationManagementPage() {
  const { guardAction } = useDemoGuard();
  const { userRole } = useUser();
  const isSuperAdmin = userRole === "super_admin";
  const [medications, setMedications] = useState<Medication[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const pharmacyFilterRef = useRef(pharmacyFilter);

  // Medication form state
  const [medicationForm, setMedicationForm] = useState({
    pharmacy_id: "",
    name: "",
    strength: "",
    vial_size: "", // NEW: Vial size field
    form: "Injection",
    ndc: "",
    retail_price: "", // Pharmacy's cost - what pharmacy charges
    category: "",
    dosage_instructions: "",
    detailed_description: "", // NEW: Detailed description
    image_url: "",
    in_stock: true,
    preparation_time_days: "",
    notes: "",
  });
  const [isCreatingMedication, setIsCreatingMedication] = useState(false);
  const [medicationResult, setMedicationResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Edit mode state
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  // Custom category state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  // Delete category state
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] =
    useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Categories derived from customCategories (loaded from DB + medications)
  const categories = useMemo(() => {
    return customCategories;
  }, [customCategories]);

  // Forms
  const forms = [
    "Injection",
    "Tablet",
    "Capsule",
    "Troche",
    "Nasal Spray",
    "Inhaler",
    "Topical",
    "Bundle",
  ];

  // Load pharmacies and check user role
  const loadPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      const data = await response.json();
      if (data.success) {
        const activePharmacies = data.pharmacies.filter(
          (p: Pharmacy) => p.is_active,
        );
        setPharmacies(activePharmacies);

        // Check if user is pharmacy admin (only one pharmacy available means they're restricted)
        if (activePharmacies.length === 1) {
          setIsPharmacyAdmin(true);
          setMedicationForm((prev) => ({
            ...prev,
            pharmacy_id: activePharmacies[0].id,
          }));
        }
      }
    } catch (error) {
      console.error("Error loading pharmacies:", error);
    }
  };

  const requestIdRef = useRef(0);

  const loadMedications = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    const currentFilter = pharmacyFilterRef.current;
    try {
      const medsParams = new URLSearchParams();
      if (isSuperAdmin && currentFilter && currentFilter !== "all") {
        medsParams.append("pharmacyId", currentFilter);
      }
      const categoriesParams = new URLSearchParams();
      if (isSuperAdmin && currentFilter && currentFilter !== "all") {
        categoriesParams.append("pharmacyId", currentFilter);
      }
      const [medsResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/admin/medications?${medsParams.toString()}`),
        fetch(`/api/admin/categories?${categoriesParams.toString()}`),
      ]);

      if (currentRequestId !== requestIdRef.current) return;

      const medsData = await medsResponse.json();
      const categoriesData = await categoriesResponse.json();

      if (currentRequestId !== requestIdRef.current) return;

      if (medsData.success) {
        const meds = medsData.medications || [];
        setMedications(meds);

        const allCategories = new Set<string>();

        meds.forEach((med: Medication) => {
          if (med.category) {
            allCategories.add(med.category);
          }
        });

        if (categoriesData.categories) {
          categoriesData.categories.forEach(
            (cat: { name: string; is_active: boolean }) => {
              if (cat.is_active) {
                allCategories.add(cat.name);
              }
            },
          );
        }

        setCustomCategories(Array.from(allCategories));
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Error loading medications:", error);
    }
  }, [pharmacyFilter, isSuperAdmin]);

  useEffect(() => {
    loadPharmacies();
  }, []);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const handlePharmacyFilterChange = useCallback((value: string) => {
    pharmacyFilterRef.current = value;
    setPharmacyFilter(value);
    if (isSuperAdmin) {
      setMedicationForm((prev) => ({
        ...prev,
        pharmacy_id: value !== "all" ? value : "",
      }));
    }
  }, [isSuperAdmin]);

  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    guardAction(async () => {
    setIsCreatingMedication(true);
    setMedicationResult(null);

    try {
      // Convert retail price from dollars to cents
      const retail_price_cents = Math.round(
        parseFloat(medicationForm.retail_price) * 100,
      );

      const response = await fetch("/api/admin/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...medicationForm,
          retail_price_cents,
        }),
      });

      const data = await response.json();
      setMedicationResult(data);

      if (data.success) {
        const resetPharmacyId =
          isPharmacyAdmin && pharmacies.length === 1
            ? pharmacies[0].id
            : isSuperAdmin && pharmacyFilterRef.current !== "all"
              ? pharmacyFilterRef.current
              : "";
        setMedicationForm({
          pharmacy_id: resetPharmacyId,
          name: "",
          strength: "",
          vial_size: "",
          form: "Injection",
          ndc: "",
          retail_price: "",
          category: categories.length > 0 ? categories[0] : "",
          dosage_instructions: "",
          detailed_description: "",
          image_url: "",
          in_stock: true,
          preparation_time_days: "",
          notes: "",
        });
        // Reload medications
        await loadMedications();
      }
    } catch {
      setMedicationResult({ error: "Failed to create medication" });
    } finally {
      setIsCreatingMedication(false);
    }
    });
  };

  // Edit medication - populate form
  // const handleEditMedication = (med: Medication) => {
  //   setEditingMedicationId(med.id);
  //   setMedicationForm({
  //     name: med.name,
  //     strength: med.strength || "",
  //     vial_size: med.strength || "",
  //     form: med.form || "Injection",
  //     ndc: med.ndc || "",
  //     retail_price: (med.retail_price_cents / 100).toString(),
  //     category: med.category || "Weight Loss (GLP-1)",
  //     dosage_instructions: "",
  //     detailed_description: med.dosage_instructions || "",
  //     image_url: med.image_url || "",
  //     in_stock: med.in_stock !== false,
  //     preparation_time_days: med.preparation_time_days?.toString() || "",
  //     notes: med.notes || "",
  //   });
  //   // Scroll to form
  //   window.scrollTo({ top: 0, behavior: "smooth" });
  // };

  // Update medication
  const handleUpdateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedicationId) return;
    guardAction(async () => {
    setIsUpdating(true);
    setMedicationResult(null);

    try {
      const retail_price_cents = Math.round(
        parseFloat(medicationForm.retail_price) * 100,
      );

      const response = await fetch(
        `/api/admin/medications/${editingMedicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...medicationForm,
            retail_price_cents,
          }),
        },
      );

      const data = await response.json();
      setMedicationResult(data);

      if (data.success) {
        const resetPharmacyId =
          isPharmacyAdmin && pharmacies.length === 1
            ? pharmacies[0].id
            : isSuperAdmin && pharmacyFilterRef.current !== "all"
              ? pharmacyFilterRef.current
              : "";
        setEditingMedicationId(null);
        setMedicationForm({
          pharmacy_id: resetPharmacyId,
          name: "",
          strength: "",
          vial_size: "",
          form: "Injection",
          ndc: "",
          retail_price: "",
          category: categories.length > 0 ? categories[0] : "",
          dosage_instructions: "",
          detailed_description: "",
          image_url: "",
          in_stock: true,
          preparation_time_days: "",
          notes: "",
        });
        loadMedications();
      }
    } catch {
      setMedicationResult({ error: "Failed to update medication" });
    } finally {
      setIsUpdating(false);
    }
    });
  };

  // Add custom category
  const handleAddCategory = async () => {
    guardAction(async () => {
    if (newCategory && !categories.includes(newCategory)) {
      const updatedCategories = [...customCategories, newCategory];
      setCustomCategories(updatedCategories);
      setMedicationForm({ ...medicationForm, category: newCategory });

      // Generate slug from category name
      const slug = newCategory
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Save to database
      try {
        const response = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategory, slug }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.error("Error creating category in database:", data.error);
        }
      } catch (error) {
        console.error("Error creating category in database:", error);
      }

      setNewCategory("");
      setIsAddingCategory(false);
      setMedicationResult({
        success: true,
        message: `Category "${newCategory}" added successfully`,
      });
    }
    });
  };

  // Delete category handler
  const handleDeleteCategoryConfirm = async () => {
    if (!categoryToDelete) return;
    guardAction(async () => {
    setIsDeletingCategory(true);
    try {
      // Delete all medications in this category
      const medicationsToDelete = medications.filter(
        (med) => med.category === categoryToDelete,
      );

      // Delete each medication
      for (const med of medicationsToDelete) {
        await fetch(`/api/admin/medications/${med.id}`, {
          method: "DELETE",
        });
      }

      // Delete category from the database categories table
      try {
        const categoriesResponse = await fetch("/api/admin/categories");
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.categories) {
          const dbCategory = categoriesData.categories.find(
            (cat: { id: number; name: string }) =>
              cat.name === categoryToDelete,
          );
          if (dbCategory) {
            await fetch(`/api/admin/categories/${dbCategory.id}`, {
              method: "DELETE",
            });
          }
        }
      } catch (error) {
        console.error("Error deleting category from database:", error);
      }

      // Remove category from local state
      const updatedCustomCategories = customCategories.filter(
        (cat) => cat !== categoryToDelete,
      );
      setCustomCategories(updatedCustomCategories);

      // If current form has this category, reset to first available category
      if (medicationForm.category === categoryToDelete) {
        const remainingCategories = categories.filter(
          (cat) => cat !== categoryToDelete,
        );
        setMedicationForm({
          ...medicationForm,
          category:
            remainingCategories.length > 0 ? remainingCategories[0] : "",
        });
      }

      // Reload medications
      await loadMedications();

      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
      setMedicationResult({
        success: true,
        message: `Category "${categoryToDelete}" and all its medications deleted successfully`,
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      setMedicationResult({
        success: false,
        error: "Failed to delete category and medications",
      });
    } finally {
      setIsDeletingCategory(false);
    }
    });
  };

  // Get count of medications in a category
  const getMedicationCountInCategory = (category: string) => {
    return medications.filter((med) => med.category === category).length;
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {isSuperAdmin && pharmacies.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="pharmacy-filter" className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              Filter by Pharmacy
            </Label>
            <select
              id="pharmacy-filter"
              value={pharmacyFilter}
              onChange={(e) => handlePharmacyFilterChange(e.target.value)}
              className="flex-1 h-10 px-4 rounded-md border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm"
            >
              <option value="all">All Pharmacies</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-lg ${editingMedicationId ? "bg-amber-100" : "bg-blue-100"}`}
            >
              {editingMedicationId ? (
                <Edit className="h-6 w-6 text-amber-600" />
              ) : (
                <Plus className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingMedicationId ? "Edit Medication" : "Add New Medication"}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingMedicationId
                  ? "Update medication details"
                  : "Fill in the medication details below"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => (window.location.href = "/admin/medication-catalog")}
          >
            {editingMedicationId ? "Cancel" : "Back to Catalog"}
          </Button>
        </div>

        <form
          onSubmit={
            editingMedicationId
              ? handleUpdateMedication
              : handleCreateMedication
          }
          className="space-y-8"
        >
          {/* SECTION: Basic Information */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Basic Information
              </h3>
            </div>

            <div className="space-y-6">
              {/* Pharmacy Selector - Show dropdown for platform admins, display name for pharmacy admins */}
              {pharmacies.length > 0 && (
                <div>
                  <Label
                    htmlFor="med-pharmacy"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Pharmacy
                  </Label>
                  {isPharmacyAdmin ? (
                    <div className="mt-2 w-full h-11 px-4 rounded-md border border-gray-300 bg-gray-50 flex items-center text-gray-700">
                      {pharmacies[0]?.name || "Your Pharmacy"}
                    </div>
                  ) : (
                    <>
                      <select
                        id="med-pharmacy"
                        value={medicationForm.pharmacy_id}
                        onChange={(e) =>
                          setMedicationForm({
                            ...medicationForm,
                            pharmacy_id: e.target.value,
                          })
                        }
                        required
                        className="mt-2 w-full h-11 px-4 rounded-md border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      >
                        <option value="">Select a pharmacy...</option>
                        {pharmacies.map((pharmacy) => (
                          <option key={pharmacy.id} value={pharmacy.id}>
                            {pharmacy.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        Select which pharmacy will provide this medication
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <Label
                  htmlFor="med-name"
                  className="text-sm font-semibold text-gray-700"
                >
                  Medication Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="med-name"
                  placeholder="e.g., Semaglutide + B12 Injection 10mg/0.5mg/mL"
                  value={medicationForm.name}
                  onChange={(e) =>
                    setMedicationForm({
                      ...medicationForm,
                      name: e.target.value,
                    })
                  }
                  required
                  className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label
                    htmlFor="med-strength"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Strength
                  </Label>
                  <Input
                    id="med-strength"
                    placeholder="e.g., 10mg/0.5mg/mL"
                    value={medicationForm.strength}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        strength: e.target.value,
                      })
                    }
                    className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="med-vial"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Vial Size / Quantity
                  </Label>
                  <Input
                    id="med-vial"
                    placeholder="e.g., 2mL, 5mL, or 30 tablets"
                    value={medicationForm.vial_size}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        vial_size: e.target.value,
                      })
                    }
                    className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label
                    htmlFor="med-form"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Form
                  </Label>
                  <select
                    id="med-form"
                    value={medicationForm.form}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        form: e.target.value,
                      })
                    }
                    className="mt-2 w-full h-11 px-4 rounded-md border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  >
                    {forms.map((form) => (
                      <option key={form} value={form}>
                        {form}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label
                    htmlFor="med-ndc"
                    className="text-sm font-semibold text-gray-700"
                  >
                    NDC Number
                  </Label>
                  <Input
                    id="med-ndc"
                    placeholder="e.g., 12345-678-90"
                    value={medicationForm.ndc}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        ndc: e.target.value,
                      })
                    }
                    className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: Classification & Pricing */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Classification & Pricing
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="med-category"
                  className="text-sm font-semibold text-gray-700"
                >
                  Category
                </Label>
                <div className="flex gap-2 mt-2">
                  <select
                    id="med-category"
                    value={
                      isAddingCategory
                        ? "__create_new__"
                        : medicationForm.category
                    }
                    onChange={(e) => {
                      if (e.target.value === "__create_new__") {
                        setIsAddingCategory(true);
                        setNewCategory("");
                      } else {
                        setIsAddingCategory(false);
                        setMedicationForm({
                          ...medicationForm,
                          category: e.target.value,
                        });
                      }
                    }}
                    className="flex-1 h-11 px-4 rounded-md border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__create_new__">
                      + Create new category
                    </option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCategoryToDelete(medicationForm.category);
                      setIsDeleteCategoryModalOpen(true);
                    }}
                    size="sm"
                    className="h-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete category and all medications"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
                {isAddingCategory && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="New category name"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), handleAddCategory())
                      }
                      className="h-11"
                    />
                    <Button
                      type="button"
                      onClick={handleAddCategory}
                      size="sm"
                      className="h-11"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategory("");
                        setMedicationForm({
                          ...medicationForm,
                          category: categories[0],
                        });
                      }}
                      size="sm"
                      className="h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label
                  htmlFor="med-retail"
                  className="text-sm font-semibold text-gray-700"
                >
                  Price <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="med-retail"
                  type="number"
                  placeholder="e.g., 70.00"
                  value={medicationForm.retail_price}
                  onChange={(e) =>
                    setMedicationForm({
                      ...medicationForm,
                      retail_price: e.target.value,
                    })
                  }
                  required
                  className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* SECTION: Usage & Instructions */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Usage & Instructions
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="med-dosage"
                  className="text-sm font-semibold text-gray-700"
                >
                  Dosage Instructions (SIG)
                </Label>
                <Textarea
                  id="med-dosage"
                  placeholder="e.g., Inject 25 units under the skin once weekly"
                  value={medicationForm.dosage_instructions}
                  onChange={(e) =>
                    setMedicationForm({
                      ...medicationForm,
                      dosage_instructions: e.target.value,
                    })
                  }
                  rows={2}
                  className="mt-2 px-4 py-3 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <Label
                  htmlFor="med-description"
                  className="text-sm font-semibold text-gray-700"
                >
                  Detailed Description
                </Label>
                <Textarea
                  id="med-description"
                  placeholder="e.g., This medication helps with weight loss by suppressing appetite and improving insulin sensitivity. Suitable for patients with BMI over 27."
                  value={medicationForm.detailed_description}
                  onChange={(e) =>
                    setMedicationForm({
                      ...medicationForm,
                      detailed_description: e.target.value,
                    })
                  }
                  rows={3}
                  className="mt-2 px-4 py-3 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Detailed information about the medication, benefits, and usage
                </p>
              </div>
            </div>
          </div>

          {/* SECTION: Stock & Availability */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <PackageX className="h-5 w-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">
                Stock & Availability
              </h3>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="med-in-stock"
                    checked={medicationForm.in_stock}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        in_stock: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-gray-300 mt-0.5"
                  />
                  <Label
                    htmlFor="med-in-stock"
                    className="cursor-pointer flex-1"
                  >
                    <span className="font-semibold text-gray-900">
                      In Stock
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      Uncheck if medication is out of stock
                    </p>
                  </Label>
                </div>

                <div>
                  <Label
                    htmlFor="med-prep-time"
                    className="text-sm font-semibold text-gray-700 flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Preparation Time (Days)
                  </Label>
                  <Input
                    id="med-prep-time"
                    type="number"
                    min="0"
                    placeholder="e.g., 3"
                    value={medicationForm.preparation_time_days}
                    onChange={(e) =>
                      setMedicationForm({
                        ...medicationForm,
                        preparation_time_days: e.target.value,
                      })
                    }
                    className="mt-2 h-11 px-4 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Days needed to prepare compounded medication (0 if ready)
                  </p>
                </div>
              </div>

              <div>
                <Label
                  htmlFor="med-notes"
                  className="text-sm font-semibold text-gray-700"
                >
                  Notes
                </Label>
                <Textarea
                  id="med-notes"
                  placeholder="e.g., Requires refrigeration, Out of stock until next week, Special preparation instructions..."
                  value={medicationForm.notes}
                  onChange={(e) =>
                    setMedicationForm({
                      ...medicationForm,
                      notes: e.target.value,
                    })
                  }
                  rows={2}
                  className="mt-2 px-4 py-3 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Out of stock reasons, special instructions, or preparation
                  details
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <Button
              type="submit"
              disabled={isCreatingMedication || isUpdating}
              className="w-full h-12 text-base font-semibold shadow-sm"
              size="lg"
            >
              {editingMedicationId
                ? isUpdating
                  ? "Updating..."
                  : "Update Medication"
                : isCreatingMedication
                  ? "Adding..."
                  : "Add Medication"}
            </Button>

            {medicationResult && (
              <div
                className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${medicationResult.success ? "bg-green-50 border border-green-200 text-green-900" : "bg-red-50 border border-red-200 text-red-900"}`}
              >
                {medicationResult.success ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm font-medium">
                  {medicationResult.message || medicationResult.error}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Delete Category Confirmation Modal */}
      <Dialog
        open={isDeleteCategoryModalOpen}
        onOpenChange={setIsDeleteCategoryModalOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              This will permanently delete the category and all medications
              within it.
            </DialogDescription>
          </DialogHeader>

          {categoryToDelete && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900">
                  Category: {categoryToDelete}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  {getMedicationCountInCategory(categoryToDelete)} medication(s)
                  will be deleted
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteCategoryModalOpen(false);
                    setCategoryToDelete(null);
                  }}
                  disabled={isDeletingCategory}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteCategoryConfirm}
                  disabled={isDeletingCategory}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeletingCategory
                    ? "Deleting..."
                    : "Delete Category & Medications"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
