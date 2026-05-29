"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { usePharmacy } from "@/contexts/PharmacyContext";
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
import { ArrowLeft, ArrowRight, Search, Plus, Info, ShoppingCart, Trash2, Star } from "lucide-react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import {
  clearPrescriptionSession,
  getCart,
  addToCart,
  removeFromCart,
  getCartShippingFee,
  setCartShippingFee,
  getCartOversightFees,
  setCartOversightFees,
  type CartItem,
} from "../prescriptionSessionUtils";

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

interface PharmacyMedication {
  id: string;
  pharmacy_id: string;
  name: string;
  strength: string;
  form: string;
  vial_size?: string;
  retail_price_cents: number;
  aimrx_site_pricing_cents: number;
  category?: string;
  dosage_instructions?: string;
  detailed_description?: string;
  image_url?: string;
  ndc?: string;
  in_stock?: boolean;
  preparation_time_days?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  pharmacy: {
    id: string;
    name: string;
    slug: string;
    primary_color: string;
    tagline: string;
  };
}

export default function PrescriptionStep2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const { pharmacy } = usePharmacy();
  const supabase = useMemo(() => createClient(), []);
  const { user } = useUser();

  const [formData, setFormData] = useState({
    medication: "",
    vialSize: "",
    dosageAmount: "",
    dosageUnit: "mg",
    form: "",
    quantity: "",
    refills: "0",
    sig: "",
    dispenseAsWritten: false,
    pharmacyNotes: "",
    patientPrice: "",
    strength: "",
    selectedPharmacyId: "",
    selectedPharmacyName: "",
    selectedPharmacyColor: "",
    selectedMedicationId: "",
    refillFrequencyDays: "",
  });

  const [oversightFees, setOversightFees] = useState<
    Array<{ fee: string; reason: string }>
  >([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pharmacyMedications, setPharmacyMedications] = useState<
    PharmacyMedication[]
  >([]);
  const [allPharmacies, setAllPharmacies] = useState<
    Array<{ id: string; name: string; primary_color: string }>
  >([]);
  const [filterByPharmacyId, setFilterByPharmacyId] = useState<string>("");
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);
  // Effective tier discount % returned by /api/provider/pharmacy. For an
  // assistant placing the order this resolves via getEffectiveTierDiscountForUser:
  // her own per-assistant tier override (set by super_admin or her supervising
  // provider) wins; otherwise we fall back to the supervising provider's tier.
  // Prices in `medications[].aimrx_site_pricing_cents` are ALREADY discounted
  // server-side — this value is only used to render the visible "% off" labels
  // and the banner so the user can see the discount is being applied.
  const [tierDiscount, setTierDiscount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [expandedMedicationInfo, setExpandedMedicationInfo] = useState<
    string | null
  >(null);
  const [viewMode, setViewMode] = useState<"categories" | "medications">(
    "categories",
  );
  const [selectedMedicationDetails, setSelectedMedicationDetails] =
    useState<PharmacyMedication | null>(null);
  const [shippingFee, setShippingFee] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setCart(getCart());
    const savedShipping = getCartShippingFee();
    if (savedShipping && savedShipping !== "0") setShippingFee(savedShipping);
    const savedOversight = getCartOversightFees();
    if (savedOversight.length > 0) setOversightFees(savedOversight);
  }, []);

  // Fetch the shipping fee from the selected PHARMACY profile (admin-controlled).
  // Providers do not control shipping. Each pharmacy carries its own fee, so the
  // value updates whenever a different pharmacy is selected.
  useEffect(() => {
    const pharmacyId = formData.selectedPharmacyId;
    if (!pharmacyId) {
      setShippingFee("");
      return;
    }
    const fetchPharmacyShippingFee = async () => {
      const { data } = await supabase
        .from("pharmacies")
        .select("shipping_fee_cents")
        .eq("id", pharmacyId)
        .maybeSingle();
      const cents =
        data?.shipping_fee_cents != null
          ? Number(data.shipping_fee_cents)
          : 2500;
      const dollars = (Number.isFinite(cents) ? cents : 2500) / 100;
      setShippingFee(String(dollars));
    };
    fetchPharmacyShippingFee();
  }, [formData.selectedPharmacyId]);

  // Get unique pharmacies from loaded medications
  useEffect(() => {
    const pharmaciesMap = new Map<
      string,
      { id: string; name: string; primary_color: string }
    >();
    pharmacyMedications.forEach((med) => {
      if (med.pharmacy && !pharmaciesMap.has(med.pharmacy.id)) {
        pharmaciesMap.set(med.pharmacy.id, {
          id: med.pharmacy.id,
          name: med.pharmacy.name,
          primary_color: med.pharmacy.primary_color,
        });
      }
    });
    setAllPharmacies(
      Array.from(pharmaciesMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }, [pharmacyMedications]);

  // Filter medications by selected pharmacy
  const filteredByPharmacy = useMemo(() => {
    if (!filterByPharmacyId || isPharmacyAdmin) {
      return pharmacyMedications;
    }
    return pharmacyMedications.filter(
      (med) => med.pharmacy_id === filterByPharmacyId,
    );
  }, [pharmacyMedications, filterByPharmacyId, isPharmacyAdmin]);

  // Get unique categories from filtered medications
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    filteredByPharmacy.forEach((med) => {
      cats.add(med.category || "Standard Formulations");
    });
    return Array.from(cats).sort();
  }, [filteredByPharmacy]);

  // Load saved data from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("prescriptionFormData");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setFormData((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data).filter(([, v]) => typeof v === "string" || typeof v === "boolean" || typeof v === "number")
            ),
          }));
          if (Array.isArray(data.oversightFees)) setOversightFees(data.oversightFees);
          if (typeof data.shippingFee === "string") setShippingFee(data.shippingFee);
          if (typeof data.selectedPharmacyId === "string")
            setFilterByPharmacyId(data.selectedPharmacyId);
        }
      } catch {
        sessionStorage.removeItem("prescriptionFormData");
      }
    }
  }, []);

  // Clean up prescription state when unmounting (navigating away)
  useEffect(() => {
    return () => {
      if (!window.location.pathname.startsWith("/prescriptions/new/")) {
        clearPrescriptionSession();
      }
    };
  }, []);

  // Load medications (global for doctors, filtered for pharmacy admins)
  useEffect(() => {
    const loadMedications = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/provider/pharmacy");
        const data = await response.json();

        if (data.success) {
          // Store medications and admin status
          setPharmacyMedications(data.medications || []);
          setIsPharmacyAdmin(data.isPharmacyAdmin || false);
          setTierDiscount(data.tierDiscount || 0);
        } else {
          console.error("Failed to load medications:", data.error);
        }
      } catch (error) {
        console.error("Error loading medications:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMedications();
  }, []);

  // Restore selected medication details from loaded medications
  useEffect(() => {
    if (
      pharmacyMedications.length > 0 &&
      formData.selectedMedicationId &&
      !selectedMedicationDetails
    ) {
      const match = pharmacyMedications.find(
        (med) => med.id === formData.selectedMedicationId,
      );
      if (match) {
        setSelectedMedicationDetails(match);
      }
    }
  }, [pharmacyMedications, formData.selectedMedicationId, selectedMedicationDetails]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowMedicationDropdown(false);
        // Reset to category selection view
        setViewMode("categories");
        setSelectedCategory("");
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

  const handleInputChange = (
    field: string,
    value: string | boolean | number,
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "refills") {
        const refillCount = parseInt(String(value)) || 0;
        if (refillCount > 0 && !prev.refillFrequencyDays) {
          updated.refillFrequencyDays = "30";
        }
        if (refillCount === 0) {
          updated.refillFrequencyDays = "";
        }
      }
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSelectPharmacyMedication = (medication: PharmacyMedication) => {
    // Use aimrx_site_pricing_cents as the patient price (convert cents to dollars)
    const patientPrice = medication.aimrx_site_pricing_cents / 100;

    const newFormData = {
      ...formData,
      medication: medication.name,
      vialSize: medication.vial_size || medication.strength || "",
      dosageAmount: medication.strength?.match(/\d+/)?.[0] || "",
      dosageUnit: medication.strength?.match(/[a-zA-Z]+/)?.[0] || "mg",
      form: medication.form || "",
      quantity: "1",
      refills: "0",
      sig: medication.dosage_instructions || "",
      dispenseAsWritten: false,
      pharmacyNotes: medication.notes || "",
      patientPrice: patientPrice.toFixed(2),
      strength: medication.strength || "",
      // Capture selected pharmacy details
      selectedPharmacyId: medication.pharmacy_id,
      selectedPharmacyName: medication.pharmacy.name,
      selectedPharmacyColor: medication.pharmacy.primary_color,
      // Capture medication ID for linking
      selectedMedicationId: medication.id,
    };

    setFormData(newFormData);

    // Store selected medication details for reference
    setSelectedMedicationDetails(medication);

    // Close dropdown and reset view
    setShowMedicationDropdown(false);
    setViewMode("categories");
    setSelectedCategory("");
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.medication.trim()) {
      newErrors.medication = "Medication name is required";
    }
    if (!formData.dosageAmount || parseFloat(formData.dosageAmount) <= 0) {
      newErrors.dosageAmount =
        "Dosage amount is required and must be greater than 0";
    }
    if (!formData.dosageUnit) {
      newErrors.dosageUnit = "Dosage unit is required";
    }
    if (!formData.form) {
      newErrors.form = "Medication form is required";
    }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) {
      newErrors.quantity = "Quantity must be greater than 0";
    }
    if (!formData.sig.trim()) {
      newErrors.sig = "Directions (SIG) are required";
    }
    const refillCount = parseInt(formData.refills) || 0;
    if (refillCount > 0 && (!formData.refillFrequencyDays || parseInt(formData.refillFrequencyDays) <= 0)) {
      newErrors.refillFrequencyDays = "Refill frequency is required when refills are set";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveFormToSession = () => {
    const dataToSave = {
      ...formData,
      strength: `${formData.dosageAmount}${formData.dosageUnit}`,
      oversightFees: oversightFees,
      shippingFee: shippingFee,
      _timestamp: Date.now(),
    };
    sessionStorage.setItem(
      "prescriptionFormData",
      JSON.stringify(dataToSave),
    );
  };

  const resetFormForNextItem = () => {
    setFormData({
      medication: "",
      vialSize: "",
      dosageAmount: "",
      dosageUnit: "mg",
      form: "",
      quantity: "",
      refills: "0",
      sig: "",
      dispenseAsWritten: false,
      pharmacyNotes: "",
      patientPrice: "",
      strength: "",
      selectedPharmacyId: "",
      selectedPharmacyName: "",
      selectedPharmacyColor: "",
      selectedMedicationId: "",
      refillFrequencyDays: "",
    });
    setSelectedMedicationDetails(null);
    setErrors({});
    sessionStorage.removeItem("prescriptionFormData");
  };

  const handleAddToCart = () => {
    if (!validateForm()) return;

    setCartShippingFee(shippingFee || "0");
    setCartOversightFees(oversightFees);

    const cartItem: CartItem = {
      id: crypto.randomUUID(),
      medication: formData.medication,
      strength: formData.strength || `${formData.dosageAmount}${formData.dosageUnit}`,
      dosageAmount: formData.dosageAmount,
      dosageUnit: formData.dosageUnit,
      vialSize: formData.vialSize,
      form: formData.form,
      quantity: formData.quantity,
      refills: formData.refills,
      sig: formData.sig,
      dispenseAsWritten: formData.dispenseAsWritten,
      pharmacyNotes: formData.pharmacyNotes,
      patientPrice: formData.patientPrice,
      selectedPharmacyId: formData.selectedPharmacyId,
      selectedPharmacyName: formData.selectedPharmacyName,
      selectedPharmacyColor: formData.selectedPharmacyColor,
      selectedMedicationId: formData.selectedMedicationId,
      refillFrequencyDays: formData.refillFrequencyDays,
    };

    const updatedCart = addToCart(cartItem);
    setCart(updatedCart);
    resetFormForNextItem();
  };

  const handleRemoveFromCart = (itemId: string) => {
    const updatedCart = removeFromCart(itemId);
    setCart(updatedCart);
  };

  const handleProceedToReview = () => {
    // BUGFIX: After "Add to Cart" the form auto-resets — including the pharmacy
    // selection — which causes the pharmacy-shipping useEffect to clear
    // `shippingFee` back to "". Previously this handler unconditionally
    // overwrote the cart's saved fee with that empty value, silently turning
    // every shipped order into $0 shipping. Only persist a NEW fee here if the
    // form actually has one; otherwise keep whatever was saved at Add-to-cart
    // time. Server-side enforcement is the second line of defense.
    if (shippingFee && shippingFee !== "0") {
      setCartShippingFee(shippingFee);
    }
    setCartOversightFees(oversightFees);
    sessionStorage.setItem("selectedPatientId", patientId);
    router.push(`/prescriptions/new/step3?patientId=${patientId}`);
  };

  const handleBack = () => {
    saveFormToSession();
    router.push("/prescriptions/new/step1");
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.patientPrice || "0") * (parseInt(item.quantity) || 1), 0);
  const oversightTotal = oversightFees.reduce((sum, f) => sum + parseFloat(f.fee || "0"), 0);

  // BUGFIX: After "Add to Cart" the form auto-resets — including the pharmacy
  // selection — which clears the local `shippingFee` state. The cart's saved
  // shipping fee is still in session storage; fall back to it for display and
  // the grand-total calculation so the visible total doesn't silently drop to
  // $0 between adds. The disabled input always reflects the same value.
  const effectiveShippingFee =
    shippingFee && shippingFee !== ""
      ? shippingFee
      : cart.length > 0
        ? getCartShippingFee()
        : "";
  const grandTotal = cartTotal + parseFloat(effectiveShippingFee || "0") + oversightTotal;

  return (
    <DefaultLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  New Prescription
                </h1>
                {isPharmacyAdmin && pharmacy ? (
                  <div
                    className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                    style={{
                      backgroundColor: pharmacy.primary_color || "#1E3A8A",
                    }}
                  >
                    {pharmacy.name}
                  </div>
                ) : formData.selectedPharmacyName ? (
                  <div
                    className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                    style={{
                      backgroundColor:
                        formData.selectedPharmacyColor || "#1E3A8A",
                    }}
                  >
                    → {formData.selectedPharmacyName}
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-200 text-gray-600">
                    Select medication to choose pharmacy
                  </div>
                )}
              </div>
              <p className="text-muted-foreground mt-2">
                Step 2 of 4: Prescription Details
              </p>
              {isPharmacyAdmin && pharmacy?.tagline && (
                <p className="text-sm text-gray-500 italic mt-1">
                  {pharmacy.tagline}
                </p>
              )}
              {!isPharmacyAdmin && formData.selectedPharmacyName && (
                <p
                  className="text-sm font-medium"
                  style={{ color: formData.selectedPharmacyColor }}
                >
                  ✓ Prescription will be sent to {formData.selectedPharmacyName}
                </p>
              )}
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
                Patient
              </span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                2
              </div>
              <span className="ml-2 font-medium">Medication</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Review
              </span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                4
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Collect Payment
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Medication Information Card */}
          <div className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-[#1E3A8A] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#1E3A8A]">
                Medication Information
              </h2>
              {tierDiscount > 0 && (
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/90 backdrop-blur-sm rounded-full shadow-sm"
                  data-testid="badge-tier-discount-step2"
                >
                  <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                  <span className="text-sm font-semibold text-white">
                    {tierDiscount}% Tier Discount Applied
                  </span>
                </div>
              )}
            </div>

            {/* Pharmacy Selector - Only show for non-pharmacy-admins */}
            {!isPharmacyAdmin && allPharmacies.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="pharmacy-filter">Select Pharmacy First</Label>
                <Select
                  value={filterByPharmacyId}
                  onValueChange={(value) => {
                    setFilterByPharmacyId(value);
                    // Reset medication selection when pharmacy changes
                    setFormData((prev) => ({
                      ...prev,
                      medication: "",
                      selectedPharmacyId: "",
                      selectedPharmacyName: "",
                      selectedPharmacyColor: "",
                      selectedMedicationId: "",
                    }));
                    setSelectedMedicationDetails(null);
                    setSelectedCategory("");
                    setViewMode("categories");
                  }}
                >
                  <SelectTrigger id="pharmacy-filter" className="w-full">
                    <SelectValue placeholder="Choose a pharmacy to see their medications..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allPharmacies.map((pharm) => (
                      <SelectItem key={pharm.id} value={pharm.id}>
                        <span
                          style={{ color: pharm.primary_color }}
                          className="font-medium"
                        >
                          {pharm.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Medication Catalog - Role-based (Global for doctors, Filtered for admins) */}
            <div className="space-y-2 relative" ref={dropdownRef}>
              <Label htmlFor="medication" className="required">
                {isPharmacyAdmin
                  ? "Select Medication"
                  : filterByPharmacyId
                    ? "Select Medication"
                    : "Select Medication (Choose pharmacy first)"}
              </Label>

              <div className="relative">
                <Input
                  id="medication"
                  placeholder={
                    isLoading
                      ? "Loading medications..."
                      : !isPharmacyAdmin && !filterByPharmacyId
                        ? "Select a pharmacy first..."
                        : isPharmacyAdmin
                          ? "Click to select medication..."
                          : "Click to browse medications..."
                  }
                  value={formData.medication}
                  onChange={(e) => {
                    handleInputChange("medication", e.target.value);
                    setShowMedicationDropdown(true);
                  }}
                  onFocus={() => {
                    setShowMedicationDropdown(true);
                    // Always start with category selection
                    setViewMode("categories");
                  }}
                  className={`h-[50px] pr-10 ${errors.medication ? "border-red-500" : ""}`}
                  autoComplete="off"
                  disabled={
                    isLoading || (!isPharmacyAdmin && !filterByPharmacyId)
                  }
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Dropdown - Auto-search with Category Fallback */}
              {showMedicationDropdown &&
                !isLoading &&
                pharmacyMedications.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-md shadow-2xl max-h-[600px] overflow-y-auto">
                    {/* Show direct medication search if user is typing, otherwise show categories */}
                    {formData.medication && formData.medication.length > 0 ? (
                      /* DIRECT SEARCH: Show all medications that start with typed text */
                      <div>
                        <div className="px-4 py-3 border-b bg-blue-50 sticky top-0 z-10">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Search Results for &quot;{formData.medication}&quot;
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            Showing medications that start with your search
                          </p>
                        </div>
                        {(() => {
                          // Filter medications that START WITH the search term
                          const searchTerm = formData.medication.toLowerCase();
                          const searchResults = filteredByPharmacy.filter(
                            (med) =>
                              med.name.toLowerCase().startsWith(searchTerm) ||
                              (med?.category &&
                                med.category
                                  .toLowerCase()
                                  .startsWith(searchTerm)),
                          );

                          // Sort alphabetically
                          searchResults.sort((a, b) =>
                            a.name.localeCompare(b.name),
                          );

                          if (searchResults.length === 0) {
                            return (
                              <div className="p-8 text-center text-gray-500">
                                <p className="font-medium">
                                  No medications found starting with &quot;
                                  {formData.medication}&quot;
                                </p>
                                <p className="text-sm mt-2">
                                  Try a different search term or browse by
                                  category below
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInputChange("medication", "")
                                  }
                                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  Clear search and browse categories
                                </button>
                              </div>
                            );
                          }

                          return searchResults.map((med) => (
                            <div
                              key={med.id}
                              className="border-b border-gray-100 last:border-b-0 hover:bg-blue-50/30 transition-colors"
                            >
                              <div className="w-full px-4 py-3 flex items-center justify-between gap-4">
                                {/* Left: Medication Info */}
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() =>
                                    handleSelectPharmacyMedication(med)
                                  }
                                >
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-gray-900 text-base">
                                      {med.name}
                                    </span>
                                    {!med.in_stock && (
                                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                        Out of Stock
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                      {med.pharmacy.name}
                                    </span>
                                    {med.category && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                        {med.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {med.strength} • {med.form}
                                    {med.vial_size ? ` • ${med.vial_size}` : ""}
                                  </div>
                                </div>

                                {/* Right: Price */}
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="font-bold text-lg text-gray-900">
                                      $
                                      {(
                                        med.aimrx_site_pricing_cents / 100
                                      ).toFixed(2)}
                                    </div>
                                    {tierDiscount > 0 && (
                                      <div
                                        className="text-xs text-emerald-600 font-medium"
                                        data-testid={`text-tier-discount-search-${med.id}`}
                                      >
                                        {tierDiscount}% off
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    ) : viewMode === "categories" ? (
                      /* STEP 1: Category Selector (shown when no search text) */
                      <div>
                        <div className="px-4 py-3 border-b bg-blue-50 sticky top-0 z-10">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Browse by Category or Start Typing
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            Type a medication name above or choose a category to
                            browse
                          </p>
                        </div>
                        <div className="p-2 space-y-1">
                          {availableCategories.map((category) => {
                            const medCount = filteredByPharmacy.filter(
                              (med) =>
                                (med.category || "Standard Formulations") ===
                                category,
                            ).length;
                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(category);
                                  setViewMode("medications");
                                }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                                    {category}
                                  </span>
                                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700">
                                    {medCount}{" "}
                                    {medCount === 1
                                      ? "medication"
                                      : "medications"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* STEP 2: Medications List */
                      <div>
                        {/* Breadcrumb Header */}
                        <div className="px-4 py-3 border-b bg-blue-50 sticky top-0 z-10">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode("categories");
                                setSelectedCategory("");
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
                            >
                              ← Back to Categories
                            </button>
                            <span className="text-gray-400">/</span>
                            <span className="font-semibold text-gray-900 text-sm">
                              {selectedCategory}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            Select a medication from {selectedCategory}
                          </p>
                        </div>

                        {/* Medications List */}
                        {(() => {
                          const filteredMeds = filteredByPharmacy.filter(
                            (med) => {
                              const matchesSearch =
                                !formData.medication ||
                                med.name
                                  .toLowerCase()
                                  .includes(formData.medication.toLowerCase());
                              const matchesCategory =
                                (med.category || "Standard Formulations") ===
                                selectedCategory;
                              return matchesSearch && matchesCategory;
                            },
                          );

                          // Sort medications alphabetically by name
                          filteredMeds.sort((a, b) =>
                            a.name.localeCompare(b.name),
                          );

                          if (filteredMeds.length === 0) {
                            return (
                              <div className="p-8 text-center text-gray-500">
                                No medications found matching your criteria
                              </div>
                            );
                          }

                          return filteredMeds.map((med) => (
                            <div
                              key={med.id}
                              className="border-b border-gray-100 last:border-b-0 hover:bg-blue-50/30 transition-colors"
                            >
                              <div className="w-full px-4 py-3 flex items-center justify-between gap-4">
                                {/* Left: Medication Info */}
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() =>
                                    handleSelectPharmacyMedication(med)
                                  }
                                >
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-gray-900 text-base">
                                      {med.name}
                                    </span>
                                    {!med.in_stock && (
                                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                                        Out of Stock
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                      {med.pharmacy.name}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {med.strength} • {med.form}
                                    {med.vial_size ? ` • ${med.vial_size}` : ""}
                                  </div>
                                </div>

                                {/* Right: Price and Actions */}
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="font-bold text-lg text-gray-900">
                                      $
                                      {(
                                        med.aimrx_site_pricing_cents / 100
                                      ).toFixed(2)}
                                    </div>
                                    {tierDiscount > 0 && (
                                      <div
                                        className="text-xs text-emerald-600 font-medium"
                                        data-testid={`text-tier-discount-list-${med.id}`}
                                      >
                                        {tierDiscount}% off
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedMedicationInfo(
                                        expandedMedicationInfo === med.id
                                          ? null
                                          : med.id,
                                      );
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                                    title="View details"
                                  >
                                    <Info
                                      className={`h-4 w-4 ${expandedMedicationInfo === med.id ? "text-blue-600" : "text-gray-400"}`}
                                    />
                                  </button>

                                  <Button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectPharmacyMedication(med);
                                    }}
                                    size="sm"
                                    className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Select
                                  </Button>
                                </div>
                              </div>

                              {/* Simplified Medication Details */}
                              {expandedMedicationInfo === med.id && (
                                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                                  <div className="p-6 bg-white rounded-lg space-y-4 max-w-2xl mx-auto">
                                    {/* Header */}
                                    <div className="pb-4 border-b">
                                      <h3 className="text-xl font-bold text-gray-900">
                                        {med.name}
                                      </h3>
                                      <p className="text-gray-600 mt-1">
                                        {med.strength} • {med.form}
                                      </p>
                                    </div>

                                    {/* Product Details Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                      {med.strength && (
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium mb-1">
                                            Strength
                                          </p>
                                          <p className="text-sm text-gray-900 font-semibold">
                                            {med.strength}
                                          </p>
                                        </div>
                                      )}
                                      {med.form && (
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium mb-1">
                                            Form
                                          </p>
                                          <p className="text-sm text-gray-900 font-semibold">
                                            {med.form}
                                          </p>
                                        </div>
                                      )}
                                      {med.category && (
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium mb-1">
                                            Category
                                          </p>
                                          <p className="text-sm text-gray-900 font-semibold">
                                            {med.category}
                                          </p>
                                        </div>
                                      )}
                                      {med.vial_size && (
                                        <div>
                                          <p className="text-xs text-gray-500 font-medium mb-1">
                                            Vial Size / Quantity
                                          </p>
                                          <p className="text-sm text-gray-900 font-semibold">
                                            {med.vial_size}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Price - Prominent */}
                                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                      <span className="text-gray-700 font-semibold">
                                        Price
                                      </span>
                                      <div className="text-right">
                                        <div className="text-3xl font-bold text-blue-600">
                                          $
                                          {(
                                            med.aimrx_site_pricing_cents / 100
                                          ).toFixed(2)}
                                        </div>
                                        {tierDiscount > 0 && (
                                          <div
                                            className="text-xs text-emerald-700 font-semibold mt-0.5"
                                            data-testid={`text-tier-discount-detail-${med.id}`}
                                          >
                                            {tierDiscount}% tier discount applied
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stock Status */}
                                    <div className="flex items-center gap-2">
                                      {med.in_stock !== false ? (
                                        <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                                          ✓ In Stock
                                        </span>
                                      ) : (
                                        <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-semibold text-sm">
                                          Out of Stock
                                        </span>
                                      )}
                                      {med.preparation_time_days &&
                                        med.preparation_time_days > 0 && (
                                          <span className="text-sm text-gray-600">
                                            • {med.preparation_time_days}{" "}
                                            {med.preparation_time_days === 1
                                              ? "day"
                                              : "days"}{" "}
                                            prep time
                                          </span>
                                        )}
                                    </div>

                                    {/* Detailed Description */}
                                    {med.detailed_description && (
                                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                          📋 Detailed Description
                                        </h4>
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                          {med.detailed_description}
                                        </p>
                                      </div>
                                    )}

                                    {/* Dosage Instructions - Key Info */}
                                    {med.dosage_instructions && (
                                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                        <h4 className="text-sm font-semibold text-blue-900 mb-2">
                                          💊 Dosage Instructions
                                        </h4>
                                        <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                                          {med.dosage_instructions}
                                        </p>
                                      </div>
                                    )}

                                    {/* Special Notes */}
                                    {med.notes && (
                                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                        <h4 className="text-sm font-semibold text-amber-900 mb-2">
                                          ⚠️ Important Notes
                                        </h4>
                                        <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">
                                          {med.notes}
                                        </p>
                                      </div>
                                    )}

                                    {/* Select Button in Modal */}
                                    <div className="pt-4">
                                      <Button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectPharmacyMedication(med);
                                        }}
                                        className="w-full h-12 text-base bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                                      >
                                        Select This Medication
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}

              {!isLoading && pharmacyMedications.length === 0 && (
                <p className="text-sm text-amber-600">
                  No medications available yet.
                </p>
              )}

              {errors.medication && (
                <p className="text-sm text-red-600">{errors.medication}</p>
              )}
            </div>

            {/* Vial Size */}
            <div className="space-y-2">
              <Label htmlFor="vialSize">Vial Size</Label>
              <Input
                id="vialSize"
                placeholder="e.g., 2.5mg/0.5ml"
                value={formData.vialSize}
                onChange={(e) => handleInputChange("vialSize", e.target.value)}
                className="h-[50px]"
              />
            </div>

            {/* Selected Medication Info Card - Always Visible After Selection */}
            {selectedMedicationDetails && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-900">
                    Selected Medication Information
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMedicationDropdown(true);
                      setViewMode("categories");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Change Medication
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">
                      Medication Name
                    </p>
                    <p className="text-gray-900 font-semibold">
                      {selectedMedicationDetails.name}
                    </p>
                  </div>
                  {selectedMedicationDetails.category && (
                    <div>
                      <p className="text-xs text-gray-600 font-medium">
                        Category
                      </p>
                      <p className="text-gray-900 font-semibold">
                        {selectedMedicationDetails.category}
                      </p>
                    </div>
                  )}
                  {selectedMedicationDetails.strength && (
                    <div>
                      <p className="text-xs text-gray-600 font-medium">
                        Strength
                      </p>
                      <p className="text-gray-900 font-semibold">
                        {selectedMedicationDetails.strength}
                      </p>
                    </div>
                  )}
                  {selectedMedicationDetails.form && (
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Form</p>
                      <p className="text-gray-900 font-semibold">
                        {selectedMedicationDetails.form}
                      </p>
                    </div>
                  )}
                  {selectedMedicationDetails.vial_size && (
                    <div>
                      <p className="text-xs text-gray-600 font-medium">
                        Vial Size
                      </p>
                      <p className="text-gray-900 font-semibold">
                        {selectedMedicationDetails.vial_size}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-600 font-medium">
                      Pharmacy
                    </p>
                    <p className="text-gray-900 font-semibold">
                      {selectedMedicationDetails.pharmacy.name}
                    </p>
                  </div>
                </div>

                {selectedMedicationDetails.detailed_description && (
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Description
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedMedicationDetails.detailed_description}
                    </p>
                  </div>
                )}

                {selectedMedicationDetails.dosage_instructions && (
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Dosage Instructions
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedMedicationDetails.dosage_instructions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Dosage Amount and Unit - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosageAmount" className="required">
                  Dosage Amount
                </Label>
                <Input
                  id="dosageAmount"
                  type="number"
                  min="0"
                  placeholder="e.g., 10"
                  value={formData.dosageAmount}
                  onChange={(e) =>
                    handleInputChange("dosageAmount", e.target.value)
                  }
                  className={`h-[50px] ${errors.dosageAmount ? "border-red-500" : ""}`}
                />
                {errors.dosageAmount && (
                  <p className="text-sm text-red-600">{errors.dosageAmount}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dosageUnit" className="required">
                  Dosage Unit
                </Label>
                <Select
                  value={formData.dosageUnit}
                  onValueChange={(value) =>
                    handleInputChange("dosageUnit", value)
                  }
                >
                  <SelectTrigger
                    className={`h-[50px] ${errors.dosageUnit ? "border-red-500" : ""}`}
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
                {errors.dosageUnit && (
                  <p className="text-sm text-red-600">{errors.dosageUnit}</p>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="space-y-2">
              <Label htmlFor="form" className="required">
                Form
              </Label>
              <Select
                value={formData.form}
                onValueChange={(value) => handleInputChange("form", value)}
              >
                <SelectTrigger
                  className={`h-[50px] ${errors.form ? "border-red-500" : ""}`}
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
              {errors.form && (
                <p className="text-sm text-red-600">{errors.form}</p>
              )}
            </div>

            {/* Quantity and Refills - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="required">
                  Quantity
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="e.g., 30"
                  value={formData.quantity}
                  onChange={(e) =>
                    handleInputChange("quantity", e.target.value)
                  }
                  className={`h-[50px] ${errors.quantity ? "border-red-500" : ""}`}
                />
                {errors.quantity && (
                  <p className="text-sm text-red-600">{errors.quantity}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="refills">Refills</Label>
                <Input
                  id="refills"
                  type="number"
                  min="0"
                  max="12"
                  placeholder="0"
                  value={formData.refills}
                  onChange={(e) => handleInputChange("refills", e.target.value)}
                  className="h-[50px]"
                />
              </div>
            </div>

            {/* Refill Frequency — shown and required when refills > 0 */}
            {parseInt(formData.refills) > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refillFrequencyDays" className="required">
                    Refill Frequency (days)
                  </Label>
                  <Input
                    id="refillFrequencyDays"
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    value={formData.refillFrequencyDays}
                    onChange={(e) =>
                      handleInputChange("refillFrequencyDays", e.target.value)
                    }
                    className={`h-[50px] ${errors.refillFrequencyDays ? "border-red-500" : ""}`}
                  />
                  {errors.refillFrequencyDays && (
                    <p className="text-sm text-red-500">{errors.refillFrequencyDays}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Directions / Sig Card */}
          <div className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-[#1E3A8A] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#1E3A8A]">
              Directions / Sig
            </h2>

            {/* SIG / Directions */}
            <div className="space-y-2">
              <Label htmlFor="sig" className="required">
                SIG (Directions for Patient)
              </Label>
              <Textarea
                id="sig"
                placeholder="e.g., Take 1 tablet by mouth once daily in the morning with food"
                value={formData.sig}
                onChange={(e) => handleInputChange("sig", e.target.value)}
                rows={3}
                className={errors.sig ? "border-red-500" : ""}
              />
              {errors.sig && (
                <p className="text-sm text-red-600">{errors.sig}</p>
              )}
            </div>

            {/* Dispense as Written */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="daw"
                checked={formData.dispenseAsWritten}
                onCheckedChange={(checked) =>
                  handleInputChange("dispenseAsWritten", checked as boolean)
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
                value={formData.pharmacyNotes}
                onChange={(e) =>
                  handleInputChange("pharmacyNotes", e.target.value)
                }
                rows={3}
                className="bg-[#F8FAFC] border-[#1E3A8A] rounded-[4px]"
              />
            </div>
          </div>

          {/* Price of Medication Card */}
          <div className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-[#1E3A8A] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#1E3A8A]">
              Price of Medication
            </h2>

            {/* Price of Medication - Single field */}
            <div className="space-y-2">
              <Label htmlFor="patientPrice">Price of Medication</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  id="patientPrice"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={formData.patientPrice}
                  readOnly
                  disabled
                  className="h-[50px] pl-7 bg-gray-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500">
                Set automatically from the medication catalog.
                {tierDiscount > 0 && (
                  <span
                    className="ml-1 text-emerald-700 font-medium"
                    data-testid="text-tier-discount-price-hint"
                  >
                    Includes {tierDiscount}% tier discount.
                  </span>
                )}
              </p>
            </div>

            {/* Shipping and Handling */}
            <div className="pt-4 border-t border-gray-200">
              <div className="space-y-2">
                <Label htmlFor="shippingFee">Shipping and Handling</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="shippingFee"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={effectiveShippingFee}
                    readOnly
                    disabled
                    className="h-[50px] pl-7 bg-gray-50 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Set by the pharmacy profile. Cannot be changed by providers.
                </p>
              </div>
            </div>

            {/* Medication Oversight & Monitoring Fee */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-gray-900">
                  Medication Oversight & Monitoring Fee
                </h3>
                <Button
                  type="button"
                  onClick={() =>
                    setOversightFees([
                      ...oversightFees,
                      { fee: "", reason: "" },
                    ])
                  }
                  variant="outline"
                  size="sm"
                >
                  + Add Fee
                </Button>
              </div>

              {oversightFees.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No oversight fees added. Click &quot;+ Add Fee&quot; to add
                  one.
                </p>
              ) : (
                <div className="space-y-4">
                  {oversightFees.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 items-end p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`oversightFee-${index}`}>
                          Fee Amount
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            id={`oversightFee-${index}`}
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={item.fee}
                            onChange={(e) => {
                              const newFees = [...oversightFees];
                              newFees[index].fee = e.target.value;
                              setOversightFees(newFees);
                            }}
                            className="h-[50px] pl-7"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`oversightReason-${index}`}>
                          Reason for Fee
                        </Label>
                        <select
                          id={`oversightReason-${index}`}
                          value={item.reason}
                          onChange={(e) => {
                            const newFees = [...oversightFees];
                            newFees[index].reason = e.target.value;
                            if (e.target.value && !newFees[index].fee) {
                              newFees[index].fee = "0";
                            }
                            setOversightFees(newFees);
                          }}
                          className="h-[50px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select reason...</option>
                          <option value="dose_titration">
                            Dose Titration & Adjustment
                          </option>
                          <option value="side_effect_monitoring">
                            Side Effect & Safety Monitoring
                          </option>
                          <option value="therapeutic_response">
                            Therapeutic Response Review
                          </option>
                          <option value="adherence_tracking">
                            Medication Adherence Tracking
                          </option>
                          <option value="contraindication_screening">
                            Contraindication Screening
                          </option>
                        </select>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          const newFees = oversightFees.filter(
                            (_, i) => i !== index,
                          );
                          setOversightFees(newFees);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-[50px] text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          {cart.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-[4px] shadow-sm border-l-4 border-l-green-600 p-6 space-y-4" data-testid="cart-panel">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Prescription Cart ({cart.length} {cart.length === 1 ? "item" : "items"})
                </h2>
              </div>

              <div className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3" data-testid={`cart-item-${item.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.medication}</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: item.selectedPharmacyColor || "#1E3A8A" }}
                        >
                          {item.selectedPharmacyName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {item.strength} · {item.form} · Qty: {item.quantity} · {item.sig}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">${(parseFloat(item.patientPrice || "0") * (parseInt(item.quantity) || 1)).toFixed(2)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                        data-testid={`remove-cart-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Medications subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                {parseFloat(effectiveShippingFee || "0") > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping & handling</span>
                    <span>${parseFloat(effectiveShippingFee).toFixed(2)}</span>
                  </div>
                )}
                {oversightTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Oversight & monitoring fees</span>
                    <span>${oversightTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-1">
                  <span>Grand Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="bg-white border border-gray-200 rounded-[4px] p-6">
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Patient Selection
              </Button>
              <div className="flex gap-3">
                <Button onClick={handleAddToCart} size="lg" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" data-testid="button-add-to-cart">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
                {cart.length > 0 && (
                  <Button onClick={handleProceedToReview} size="lg" data-testid="button-proceed-review">
                    Proceed to Review ({cart.length})
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
