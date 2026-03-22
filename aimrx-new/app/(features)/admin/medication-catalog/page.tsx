"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Clock,
  PackageX,
  Pill,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Pencil,
  Upload,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react";

interface Medication {
  id: string;
  pharmacy_id: string;
  name: string;
  strength: string | null;
  vial_size: string | null;
  form: string | null;
  ndc: string | null;
  retail_price_cents: number;
  aimrx_site_pricing_cents: number | null;

  category: string | null;
  dosage_instructions: string | null;
  detailed_description: string | null;
  image_url: string | null;
  is_active: boolean;
  in_stock: boolean | null;
  preparation_time_days: number | null;
  notes: string | null;
  created_at: string;
  pharmacies?: {
    name: string;
  };
}

interface CategoryData {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  product_count: number;
}

const CATEGORY_IMAGES: Record<string, string> = {
  "Weight Loss & Metabolism": "/catalog/category-weight-loss.png",
  "Weight Loss": "/catalog/category-weight-loss.png",
  "weight Loss": "/catalog/category-weight-loss.png",
  "Weight Loss (GLP-1)": "/catalog/category-weight-loss.png",
  "Weight Management": "/catalog/category-weight-loss.png",
  "Metabolic": "/catalog/category-metabolic.png",
  "Cognitive & Neuron Health": "/catalog/category-cognitive-health.png",
  "Neuroprotective": "/catalog/category-cognitive-health.png",
  "Cognitive": "/catalog/category-cognitive-health.png",
  "Neuron Health": "/catalog/category-cognitive-health.png",
  "Brain Health": "/catalog/category-cognitive-health.png",
  "ADHD": "/catalog/category-cognitive-health.png",
  "Cell & Mitochondrial Health": "/catalog/category-cell-health.png",
  "Regenerative": "/catalog/category-cell-health.png",
  "Antioxidant": "/catalog/category-cell-health.png",
  "Cell Health": "/catalog/category-cell-health.png",
  "Mitochondrial": "/catalog/category-cell-health.png",
  "Cellular": "/catalog/category-cell-health.png",
  "Anti-Inflammatory & Healing": "/catalog/category-anti-inflammatory.png",
  "Antiemetic": "/catalog/category-anti-inflammatory.png",
  "Antimicrobial": "/catalog/category-anti-inflammatory.png",
  "Immune": "/catalog/category-immune-health.png",
  "Immune Health": "/catalog/category-immune-health.png",
  "Anti-Inflammatory": "/catalog/category-anti-inflammatory.png",
  "Wound Care": "/catalog/category-anti-inflammatory.png",
  "Healing": "/catalog/category-anti-inflammatory.png",
  "Fertility & Reproductive Health": "/catalog/category-fertility.png",
  "Sexual Health": "/catalog/category-sexual-health.png",
  "Hormonal": "/catalog/category-hormonal.png",
  "Fertility": "/catalog/category-fertility.png",
  "Reproductive": "/catalog/category-fertility.png",
  "Longevity & Anti-Aging": "/catalog/category-longevity.png",
  "Anti-Aging": "/catalog/category-longevity.png",
  "Longevity": "/catalog/category-longevity.png",
  "Telomere": "/catalog/category-longevity.png",
  "Performance & Fitness": "/catalog/category-performance.png",
  "Growth Hormone": "/catalog/category-growth-hormone.png",
  "Growth Factor": "/catalog/category-growth-hormone.png",
  "Performance": "/catalog/category-performance.png",
  "Fitness": "/catalog/category-performance.png",
  "Muscle": "/catalog/category-performance.png",
  "Bodybuilding": "/catalog/category-performance.png",
  "Standard Formulations": "/catalog/category-standard-formulations.png",
  "Nootropics & Stress Management": "/catalog/category-nootropics.png",
  "Sleep & Recovery": "/catalog/category-sleep-recovery.png",
  "Sleep Aid": "/catalog/category-sleep-aid.png",
  "Nootropics": "/catalog/category-nootropics.png",
  "Stress": "/catalog/category-nootropics.png",
  "Mental Clarity": "/catalog/category-nootropics.png",
  "NAD+ & Biohacking": "/catalog/category-nad-biohacking.png",
  "Anti-Aging / NAD+": "/catalog/category-nad-biohacking.png",
  "NAD+": "/catalog/category-nad-biohacking.png",
  "NAD": "/catalog/category-nad-biohacking.png",
  "Biohacking": "/catalog/category-nad-biohacking.png",
  "Peptides": "/catalog/category-peptides.png",
  "Peptides & Growth Hormone": "/catalog/category-peptides.png",
  "Injectables": "/catalog/category-injectables.png",
};

function getCategoryImage(category: string, dbCats: CategoryData[]): string | null {
  const dbCat = dbCats.find((c) => c.name === category);
  if (dbCat?.image_url) return dbCat.image_url;
  return CATEGORY_IMAGES[category] || null;
}

export default function MedicationCatalogPage() {
  const router = useRouter();
  const { userRole } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const isSuperAdmin = userRole === "super_admin";
  const { isDemo, guardAction } = useDemoGuard();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMedicationId, setExpandedMedicationId] = useState<
    string | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingMedicationId, setDeletingMedicationId] = useState<
    string | null
  >(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedMedications, setSelectedMedications] = useState<Set<string>>(
    new Set(),
  );
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null,
  );
  const [editPrices, setEditPrices] = useState({
    retailPrice: "",
    aimrxSitePrice: "",
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [dbCategories, setDbCategories] = useState<CategoryData[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [pharmacies, setPharmacies] = useState<{ id: string; name: string }[]>([]);
  const itemsPerPage = 20;

  const fetchPharmacies = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPharmacies(data || []);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  }, [supabase]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPharmacies();
    }
  }, [isSuperAdmin, fetchPharmacies]);

  const handleImageUpload = async (
    file: File,
    type: "medication" | "category",
    entityId: string,
    entityName: string,
  ) => {
    if (isDemo) {
      guardAction(() => {});
      return null;
    }
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Please use JPG, PNG, or WebP images only.");
      return null;
    }
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 3MB.`);
      return null;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("entityId", entityId);
      formData.append("entityName", entityName);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        if (type === "medication" && editingMedication) {
          setEditingMedication({
            ...editingMedication,
            image_url: result.url,
          });
        }
        await loadMedications();
        return result.url;
      } else {
        alert(result.error || "Upload failed");
        return null;
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async (medicationId: string) => {
    try {
      const response = await fetch(`/api/admin/medications/${medicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: null }),
      });

      if (response.ok) {
        if (editingMedication && editingMedication.id === medicationId) {
          setEditingMedication({ ...editingMedication, image_url: null });
        }
        await loadMedications();
      }
    } catch (error) {
      console.error("Error removing image:", error);
    }
  };

  const requestIdRef = useRef(0);

  const loadMedications = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoadingData(true);
    try {
      const medsParams = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        medsParams.append("pharmacyId", pharmacyFilter);
      }
      const categoriesParams = new URLSearchParams();
      if (pharmacyFilter && pharmacyFilter !== "all") {
        categoriesParams.append("pharmacyId", pharmacyFilter);
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
          setDbCategories(categoriesData.categories);
          categoriesData.categories.forEach(
            (cat: { name: string; is_active: boolean }) => {
              if (cat.is_active) {
                allCategories.add(cat.name);
              }
            },
          );
        }

        setAvailableCategories(Array.from(allCategories).sort());
      } else {
        console.error("API error:", medsData.error);
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Error loading medications:", error);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoadingData(false);
      }
    }
  }, [pharmacyFilter]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  useEffect(() => {
    const handleFocus = () => {
      loadMedications();
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "customMedicationCategories" ||
        e.key === "deletedMedicationCategories"
      ) {
        loadMedications();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadMedications]);

  const handleDeleteMedication = async (medicationId: string) => {
    if (isDemo) {
      guardAction(() => {});
      return;
    }
    if (
      !confirm(
        "Are you sure you want to delete this medication? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingMedicationId(medicationId);
    try {
      const response = await fetch(`/api/admin/medications/${medicationId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Remove medication from local state
        setMedications(medications.filter((med) => med.id !== medicationId));
        // Close expanded view if this medication was expanded
        if (expandedMedicationId === medicationId) {
          setExpandedMedicationId(null);
        }
      } else {
        alert(`Failed to delete medication: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting medication:", error);
      alert("Failed to delete medication. Please try again.");
    } finally {
      setDeletingMedicationId(null);
    }
  };

  const handleToggleSelect = (medicationId: string) => {
    const newSelected = new Set(selectedMedications);
    if (newSelected.has(medicationId)) {
      newSelected.delete(medicationId);
    } else {
      newSelected.add(medicationId);
    }
    setSelectedMedications(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMedications.size === paginatedMedications.length) {
      setSelectedMedications(new Set());
    } else {
      setSelectedMedications(
        new Set(paginatedMedications.map((med) => med.id)),
      );
    }
  };

  const handleDeleteSelected = async () => {
    const count = selectedMedications.size;
    if (count === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${count} selected medication(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeletingAll(true);
    let deleted = 0;
    let failed = 0;

    try {
      for (const medId of Array.from(selectedMedications)) {
        try {
          const response = await fetch(`/api/admin/medications/${medId}`, {
            method: "DELETE",
          });
          const data = await response.json();
          if (data.success) {
            deleted++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      alert(
        `Deleted ${deleted} medications. ${failed > 0 ? `Failed to delete ${failed} medications.` : ""}`,
      );

      // Clear selections and reload
      setSelectedMedications(new Set());
      await loadMedications();
    } catch (error) {
      console.error("Error during bulk delete:", error);
      alert("Failed to complete bulk delete. Please try again.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Get unique categories from medications
  const categories = ["All", ...availableCategories];

  // Filter medications
  const filteredMedications = medications.filter((med) => {
    const matchesCategory =
      categoryFilter === "All" || med.category === categoryFilter;
    const matchesSearch =
      med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.strength?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.form?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredMedications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMedications = filteredMedications.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery]);

  const handleSaveMedication = async () => {
    if (isDemo) {
      guardAction(() => {});
      return;
    }
    if (!editingMedication) return;

    const payload = {
      ...editingMedication,
      retail_price_cents: Math.round(
        parseFloat(editPrices.retailPrice || "0") * 100,
      ),
      aimrx_site_pricing_cents: editPrices.aimrxSitePrice
        ? Math.round(parseFloat(editPrices.aimrxSitePrice) * 100)
        : null,
    };

    try {
      const response = await fetch(
        `/api/admin/medications/${editingMedication.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        await loadMedications();
        setEditingMedication(null);
        alert("Medication updated successfully!");
      } else {
        alert("Failed to update medication");
      }
    } catch (error) {
      console.error("Error updating medication:", error);
      alert("Error updating medication");
    }
  };

  return (
    <>
      <div className="container mx-auto max-w-7xl py-8 px-4 flex flex-col min-h-screen">
        {/* Pharmacy Filter for Super Admins */}
        {isSuperAdmin && (
          <div className="flex items-end gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger id="pharmacy-filter" className="w-[280px] h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All Pharmacies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map((pharmacy) => (
                    <SelectItem key={pharmacy.id} value={pharmacy.id}>{pharmacy.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, strength, or form..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="w-64 flex-shrink-0">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/admin/medications")}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Medication
            </Button>
            <Button
              onClick={() => router.push("/admin/medications/bulk-upload")}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Bulk Upload
            </Button>
            {selectedMedications.size > 0 && (
              <Button
                onClick={handleDeleteSelected}
                disabled={isDeletingAll}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingAll
                  ? "Deleting..."
                  : `Delete Selected (${selectedMedications.size})`}
              </Button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredMedications.length} of {medications.length}{" "}
            medications
          </p>
        </div>

        {/* Medications Table */}
        <div className="bg-white border border-border rounded-lg overflow-hidden flex-1 mb-6">
          <div className="overflow-x-auto">
            {isLoadingData ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading medications...</p>
              </div>
            ) : filteredMedications.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  No medications found
                </p>
                <p className="text-sm text-muted-foreground">
                  {categoryFilter !== "All" || searchQuery
                    ? "Try adjusting your filters"
                    : "No medications in the catalog"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold w-[50px]">
                      <input
                        type="checkbox"
                        checked={
                          selectedMedications.size ===
                            paginatedMedications.length &&
                          paginatedMedications.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="font-semibold w-[40%]">
                      Medication
                    </TableHead>
                    <TableHead className="font-semibold w-[25%]">
                      Pharmacy
                    </TableHead>
                    <TableHead className="font-semibold w-[15%]">
                      Stock Status
                    </TableHead>
                    <TableHead className="font-semibold w-[15%]">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold w-[5%] text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMedications.map((med) => {
                    const isExpanded = expandedMedicationId === med.id;

                    return (
                      <React.Fragment key={med.id}>
                        <TableRow className="hover:bg-gray-50">
                          <TableCell className="w-[50px]">
                            <input
                              type="checkbox"
                              checked={selectedMedications.has(med.id)}
                              onChange={() => handleToggleSelect(med.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="w-[40%]">
                            <div className="flex items-center gap-3">
                              {med.image_url ? (
                                <img
                                  src={med.image_url}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                  <ImageIcon className="h-4 w-4 text-gray-300" />
                                </div>
                              )}
                              <div className="font-medium">{med.name}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {med.strength && `${med.strength} • `}
                              {med.form}
                            </div>
                          </TableCell>
                          <TableCell className="w-[25%]">
                            <span className="text-sm font-medium">
                              {med.pharmacies?.name || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell className="w-[15%]">
                            <span
                              className={`text-xs px-2 py-1 rounded inline-block ${
                                med.in_stock !== false
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {med.in_stock !== false
                                ? "In Stock"
                                : "Out of Stock"}
                            </span>
                          </TableCell>
                          <TableCell className="w-[15%]">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                med.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {med.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="w-[5%] text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedMedicationId(
                                    isExpanded ? null : med.id,
                                  )
                                }
                                className="h-8 w-8 p-0"
                                title="View Details"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingMedication(med);
                                  setEditPrices({
                                    retailPrice: (
                                      med.retail_price_cents / 100
                                    ).toFixed(2),
                                    aimrxSitePrice: med.aimrx_site_pricing_cents
                                      ? (
                                          med.aimrx_site_pricing_cents / 100
                                        ).toFixed(2)
                                      : "",
                                  });
                                }}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Edit Medication"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMedication(med.id)}
                                disabled={deletingMedicationId === med.id}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete Medication"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <TableRow className="bg-blue-50">
                            <TableCell colSpan={7} className="py-6 px-8">
                              <div className="space-y-4">
                                {/* Basic Info */}
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                                    {med.name}
                                  </h3>
                                  <div className="space-y-1 text-sm">
                                    {med.strength && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          Strength:
                                        </span>{" "}
                                        {med.strength}
                                      </p>
                                    )}
                                    {med.vial_size && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          Vial Size:
                                        </span>{" "}
                                        {med.vial_size}
                                      </p>
                                    )}
                                    {med.form && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          Form:
                                        </span>{" "}
                                        {med.form}
                                      </p>
                                    )}
                                    {med.category && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          Category:
                                        </span>{" "}
                                        {med.category}
                                      </p>
                                    )}
                                    {med.ndc && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          NDC:
                                        </span>{" "}
                                        {med.ndc}
                                      </p>
                                    )}
                                    <p className="text-gray-700">
                                      <span className="font-semibold">
                                        Pharmacy Cost:
                                      </span>{" "}
                                      $
                                      {(med.retail_price_cents / 100).toFixed(
                                        2,
                                      )}
                                    </p>
                                    {med.aimrx_site_pricing_cents && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          Patient Price:
                                        </span>{" "}
                                        $
                                        {(med.aimrx_site_pricing_cents / 100).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {/* Dosage Instructions */}
                                  {med.dosage_instructions && (
                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                      <h4 className="font-semibold text-gray-900 mb-2">
                                        Dosage Instructions
                                      </h4>
                                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {med.dosage_instructions}
                                      </p>
                                    </div>
                                  )}

                                  {/* Detailed Description */}
                                  {med.detailed_description && (
                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                      <h4 className="font-semibold text-gray-900 mb-2">
                                        Detailed Description
                                      </h4>
                                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                        {med.detailed_description}
                                      </p>
                                    </div>
                                  )}

                                  {/* Stock & Availability */}
                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                      <PackageX className="h-4 w-4" />
                                      Stock & Availability
                                    </h4>
                                    <div className="space-y-1 text-sm">
                                      <p className="text-gray-700">
                                        <span className="font-semibold">
                                          In Stock:
                                        </span>{" "}
                                        <span
                                          className={
                                            med.in_stock !== false
                                              ? "text-green-600 font-bold"
                                              : "text-red-600 font-bold"
                                          }
                                        >
                                          {med.in_stock !== false
                                            ? "Yes"
                                            : "No"}
                                        </span>
                                      </p>
                                      {med.preparation_time_days &&
                                        med.preparation_time_days > 0 && (
                                          <p className="text-gray-700 flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            <span className="font-semibold">
                                              Preparation Time:
                                            </span>{" "}
                                            {med.preparation_time_days} days
                                          </p>
                                        )}
                                    </div>
                                  </div>

                                  {/* Product Image */}
                                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                      <ImageIcon className="h-4 w-4" />
                                      Product Image
                                    </h4>
                                    <div className="flex items-center gap-4">
                                      {med.image_url ? (
                                        <div className="relative group">
                                          <img
                                            src={med.image_url}
                                            alt={med.name}
                                            className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                                          />
                                          <button
                                            onClick={() => handleRemoveImage(med.id)}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            data-testid={`button-remove-image-${med.id}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                                          <ImageIcon className="h-6 w-6 text-gray-300" />
                                        </div>
                                      )}
                                      <div>
                                        <label
                                          htmlFor={`quick-upload-${med.id}`}
                                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                                            isUploadingImage
                                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                          }`}
                                        >
                                          {isUploadingImage ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                                          ) : (
                                            <><Upload className="h-4 w-4" /> {med.image_url ? "Change" : "Upload"}</>
                                          )}
                                        </label>
                                        <input
                                          id={`quick-upload-${med.id}`}
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          className="hidden"
                                          disabled={isUploadingImage}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file, "medication", med.id, med.name);
                                            e.target.value = "";
                                          }}
                                          data-testid={`input-quick-upload-${med.id}`}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          600x600px, JPG/PNG/WebP, max 3MB
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Pagination Controls - Fixed at bottom */}
        {!isLoadingData && filteredMedications.length > 0 && totalPages > 1 && (
          <div className="mt-auto py-4 flex justify-center items-center gap-6 border-t border-gray-200 bg-white">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`text-2xl ${currentPage === 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:text-gray-900 cursor-pointer"}`}
            >
              ←
            </button>

            <p className="text-sm text-gray-600">
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredMedications.length)} of{" "}
              {filteredMedications.length} medications
            </p>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className={`text-2xl ${currentPage === totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:text-gray-900 cursor-pointer"}`}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Edit Medication Dialog */}
      <Dialog
        open={!!editingMedication}
        onOpenChange={() => setEditingMedication(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Medication</DialogTitle>
          </DialogHeader>
          {editingMedication && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medication Name *</Label>
                  <Input
                    value={editingMedication.name}
                    onChange={(e) =>
                      setEditingMedication({
                        ...editingMedication,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Strength</Label>
                  <Input
                    value={editingMedication.strength || ""}
                    onChange={(e) =>
                      setEditingMedication({
                        ...editingMedication,
                        strength: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Form</Label>
                  <Input
                    value={editingMedication.form || ""}
                    onChange={(e) =>
                      setEditingMedication({
                        ...editingMedication,
                        form: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vial Size</Label>
                  <Input
                    value={editingMedication.vial_size || ""}
                    onChange={(e) =>
                      setEditingMedication({
                        ...editingMedication,
                        vial_size: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NDC</Label>
                  <Input
                    value={editingMedication.ndc || ""}
                    onChange={(e) =>
                      setEditingMedication({
                        ...editingMedication,
                        ndc: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editingMedication.category || ""}
                    onValueChange={(value) =>
                      setEditingMedication({
                        ...editingMedication,
                        category: value,
                      })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-category">
                      <SelectValue placeholder="Select a category">
                        {editingMedication.category && (
                          <div className="flex items-center gap-2">
                            {getCategoryImage(editingMedication.category, dbCategories) && (
                              <img
                                src={getCategoryImage(editingMedication.category, dbCategories)!}
                                alt=""
                                className="h-5 w-5 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <span className="truncate">{editingMedication.category}</span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]" data-testid="dropdown-edit-category">
                      {availableCategories.map((cat) => {
                        const img = getCategoryImage(cat, dbCategories);
                        return (
                          <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                            <div className="flex items-center gap-2">
                              {img ? (
                                <img src={img} alt="" className="h-5 w-5 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="h-5 w-5 rounded bg-gray-200 flex-shrink-0" />
                              )}
                              <span>{cat}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pharmacy Cost ($)</Label>
                  <Input
                    type="number"
                    value={editPrices.retailPrice}
                    onChange={(e) =>
                      setEditPrices({
                        ...editPrices,
                        retailPrice: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Patient Price ($)</Label>
                  <Input
                    type="number"
                    value={editPrices.aimrxSitePrice}
                    onChange={(e) =>
                      setEditPrices({
                        ...editPrices,
                        aimrxSitePrice: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>In Stock</Label>
                  <Select
                    value={
                      editingMedication.in_stock === false ? "false" : "true"
                    }
                    onValueChange={(value) =>
                      setEditingMedication({
                        ...editingMedication,
                        in_stock: value === "true",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">In Stock</SelectItem>
                      <SelectItem value="false">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Active Status</Label>
                  <Select
                    value={editingMedication.is_active ? "true" : "false"}
                    onValueChange={(value) =>
                      setEditingMedication({
                        ...editingMedication,
                        is_active: value === "true",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preparation Time (days)</Label>
                <Input
                  type="number"
                  value={editingMedication.preparation_time_days || 0}
                  onChange={(e) =>
                    setEditingMedication({
                      ...editingMedication,
                      preparation_time_days: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Dosage Instructions</Label>
                <Textarea
                  value={editingMedication.dosage_instructions || ""}
                  onChange={(e) =>
                    setEditingMedication({
                      ...editingMedication,
                      dosage_instructions: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Detailed Description</Label>
                <Textarea
                  value={editingMedication.detailed_description || ""}
                  onChange={(e) =>
                    setEditingMedication({
                      ...editingMedication,
                      detailed_description: e.target.value,
                    })
                  }
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Product Image</Label>
                <p className="text-xs text-muted-foreground">
                  Recommended: 600x600px, JPG/PNG/WebP, max 3MB
                </p>
                <div className="flex items-start gap-4">
                  {editingMedication.image_url ? (
                    <div className="relative group">
                      <img
                        src={editingMedication.image_url}
                        alt={editingMedication.name}
                        className="w-24 h-24 rounded-lg object-cover border border-gray-200"
                        data-testid="img-medication-preview"
                      />
                      <button
                        onClick={() => handleRemoveImage(editingMedication.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid="button-remove-medication-image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <ImageIcon className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label
                      htmlFor="medication-image-upload"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                        isUploadingImage
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      }`}
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {editingMedication.image_url
                            ? "Change Image"
                            : "Upload Image"}
                        </>
                      )}
                    </label>
                    <input
                      id="medication-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={isUploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(
                            file,
                            "medication",
                            editingMedication.id,
                            editingMedication.name,
                          );
                        }
                        e.target.value = "";
                      }}
                      data-testid="input-medication-image-upload"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingMedication(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMedication}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
