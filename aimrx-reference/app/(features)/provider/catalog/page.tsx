"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@core/auth";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Pill,
  Beaker,
  Syringe,
  Heart,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Tag,
  Building2,
  Eye,
  X,
  ShoppingBag,
  FlaskConical,
} from "lucide-react";

function MedicationDescription({ text, medId }: { text: string; medId: string }) {
  const lines = text.split("\n");
  const ingredientHeaderIdx = lines.findIndex((l) =>
    /^active ingredients/i.test(l.trim())
  );

  if (ingredientHeaderIdx === -1) {
    return (
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100" data-testid={`description-${medId}`}>
        <p className="text-xs font-semibold text-gray-700 mb-1">Description</p>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  const preHeaderLines: string[] = [];
  for (let i = 0; i < ingredientHeaderIdx; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) preHeaderLines.push(trimmed);
  }

  const ingredientLines: string[] = [];
  const postLines: string[] = [];
  let pastIngredients = false;
  const bulletPattern = /^[•\-·\*\d+\.]\s*/;

  for (let i = ingredientHeaderIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!pastIngredients && bulletPattern.test(trimmed)) {
      ingredientLines.push(trimmed.replace(bulletPattern, ""));
    } else if (trimmed === "" && !pastIngredients && ingredientLines.length > 0) {
      pastIngredients = true;
    } else if (trimmed !== "") {
      pastIngredients = true;
      postLines.push(trimmed);
    }
  }

  const descriptionParts = [...preHeaderLines, ...postLines];

  if (ingredientLines.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100" data-testid={`description-${medId}`}>
        <p className="text-xs font-semibold text-gray-700 mb-1">Description</p>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid={`description-${medId}`}>
      {ingredientLines.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">
              {lines[ingredientHeaderIdx].trim()}
            </p>
          </div>
          <div className="space-y-1">
            {ingredientLines.map((ing, idx) => {
              const separatorMatch = ing.match(/\s[—\-:]\s/);
              const name = separatorMatch ? ing.substring(0, separatorMatch.index).trim() : ing;
              const dosage = separatorMatch ? ing.substring((separatorMatch.index || 0) + separatorMatch[0].length).trim() : null;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm bg-white/60 rounded-lg px-2.5 py-1.5"
                  data-testid={`ingredient-${medId}-${idx}`}
                >
                  <span className="text-emerald-900 font-medium">{name}</span>
                  {dosage && (
                    <span className="text-emerald-600 text-xs font-mono bg-emerald-100/80 px-1.5 py-0.5 rounded">
                      {dosage}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {descriptionParts.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">
            {descriptionParts.join(" ")}
          </p>
        </div>
      )}
    </div>
  );
}

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
  pharmacy: {
    id: string;
    name: string;
    slug: string;
    primary_color: string;
    tagline: string;
  };
}

import { getMedicationParentCategory } from "@/lib/category-mapping";

const PARENT_CATEGORY_ICONS: Record<string, typeof Pill> = {
  "Weight Loss & Metabolism": Sparkles,
  "Cognitive & Neuron Health": Beaker,
  "Cell & Mitochondrial Health": Beaker,
  "Anti-Inflammatory & Healing": Heart,
  "Fertility & Reproductive Health": Heart,
  "Longevity & Anti-Aging": Sparkles,
  "Performance & Fitness": Syringe,
  "Nootropics & Stress Management": Beaker,
  "NAD+ & Biohacking": Beaker,
  "Peptides": Beaker,
};

const PARENT_CATEGORY_GRADIENTS: Record<string, string> = {
  "Weight Loss & Metabolism": "from-emerald-500 to-teal-600",
  "Cognitive & Neuron Health": "from-blue-500 to-indigo-600",
  "Cell & Mitochondrial Health": "from-cyan-500 to-teal-600",
  "Anti-Inflammatory & Healing": "from-amber-500 to-yellow-600",
  "Fertility & Reproductive Health": "from-pink-500 to-rose-600",
  "Longevity & Anti-Aging": "from-violet-500 to-purple-600",
  "Performance & Fitness": "from-red-500 to-rose-600",
  "Nootropics & Stress Management": "from-indigo-500 to-purple-600",
  "NAD+ & Biohacking": "from-teal-500 to-cyan-600",
  "Peptides": "from-violet-500 to-purple-600",
};

const PARENT_CATEGORY_BG: Record<string, string> = {
  "Weight Loss & Metabolism": "bg-emerald-50 border-emerald-200 text-emerald-700",
  "Cognitive & Neuron Health": "bg-blue-50 border-blue-200 text-blue-700",
  "Cell & Mitochondrial Health": "bg-cyan-50 border-cyan-200 text-cyan-700",
  "Anti-Inflammatory & Healing": "bg-amber-50 border-amber-200 text-amber-700",
  "Fertility & Reproductive Health": "bg-pink-50 border-pink-200 text-pink-700",
  "Longevity & Anti-Aging": "bg-violet-50 border-violet-200 text-violet-700",
  "Performance & Fitness": "bg-red-50 border-red-200 text-red-700",
  "Nootropics & Stress Management": "bg-indigo-50 border-indigo-200 text-indigo-700",
  "NAD+ & Biohacking": "bg-teal-50 border-teal-200 text-teal-700",
  "Peptides": "bg-violet-50 border-violet-200 text-violet-700",
};

function getCategoryIcon(category: string): typeof Pill {
  const parent = getMedicationParentCategory(category);
  return PARENT_CATEGORY_ICONS[parent] || PARENT_CATEGORY_ICONS[category] || Pill;
}

function getCategoryGradient(category: string): string {
  const parent = getMedicationParentCategory(category);
  return PARENT_CATEGORY_GRADIENTS[parent] || PARENT_CATEGORY_GRADIENTS[category] || "from-slate-500 to-gray-600";
}

function getCategoryBg(category: string): string {
  const parent = getMedicationParentCategory(category);
  return PARENT_CATEGORY_BG[parent] || PARENT_CATEGORY_BG[category] || "bg-slate-50 border-slate-200 text-slate-700";
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
  "Injectables": "/catalog/category-peptides.png",
};

const FORM_PLACEHOLDER_COLORS: Record<string, string> = {
  "Injection": "from-sky-400 to-blue-500",
  "Tablet": "from-green-400 to-emerald-500",
  "Capsule": "from-amber-400 to-orange-500",
  "Cream": "from-pink-400 to-rose-500",
  "Liquid": "from-cyan-400 to-teal-500",
  "Spray": "from-violet-400 to-purple-500",
};

function CategoryCarousel({
  categories,
  onSelectCategory,
  getCategoryIcon: getIcon,
  getCategoryGradient: getGradient,
  getCategoryImageUrl: getImage,
}: {
  categories: { name: string; count: number; image_url: string | null }[];
  onSelectCategory: (name: string) => void;
  getCategoryIcon: (name: string) => typeof Pill;
  getCategoryGradient: (name: string) => string;
  getCategoryImageUrl: (name: string) => string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [updateScrollButtons, categories]);

  useEffect(() => {
    if (isPaused || categories.length <= 5) return;
    const el = scrollRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 2) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: 220, behavior: "smooth" });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused, categories.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -440 : 440;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900" data-testid="text-categories-heading">
          Browse by Category
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-all"
            data-testid="button-scroll-categories-left"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-all"
            data-testid="button-scroll-categories-right"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setTimeout(() => setIsPaused(false), 5000)}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {categories.map(({ name, count, image_url }) => {
          const Icon = getIcon(name);
          const gradient = getGradient(name);
          const categoryImage = image_url || getImage(name);
          return (
            <button
              key={name}
              onClick={() => onSelectCategory(name)}
              className="group relative overflow-hidden rounded-2xl text-left transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] snap-start flex-shrink-0"
              style={{ width: "200px" }}
              data-testid={`button-category-${name}`}
            >
              {categoryImage ? (
                <div className="relative w-full h-32 overflow-hidden">
                  <img src={categoryImage} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
              ) : (
                <div className={`relative w-full h-32 bg-gradient-to-br ${gradient}`} />
              )}
              <div className={`relative z-10 p-3 bg-gradient-to-br ${gradient}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className="h-3.5 w-3.5 text-white flex-shrink-0" />
                  <h3 className="text-xs font-bold text-white leading-tight truncate">{name}</h3>
                </div>
                <p className="text-[10px] text-white/80 font-medium">{count} {count === 1 ? "product" : "products"}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ProviderCatalogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [medications, setMedications] = useState<PharmacyMedication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCategory = searchParams.get("category") || "all";
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "price-low" | "price-high">("name");
  const [tierDiscount, setTierDiscount] = useState(0);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dbCategoryImages, setDbCategoryImages] = useState<Record<string, string>>({});

  const setSelectedCategory = useCallback((category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") {
      params.delete("category");
    } else {
      params.set("category", category);
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const loadCatalog = async () => {
      setIsLoading(true);
      try {
        const [medsResponse, catsResponse] = await Promise.all([
          fetch("/api/provider/pharmacy"),
          fetch("/api/admin/categories").catch(() => null),
        ]);
        const data = await medsResponse.json();
        if (data.success) {
          setMedications(data.medications || []);
          setTierDiscount(data.tierDiscount || 0);
        }
        if (catsResponse?.ok) {
          const catsData = await catsResponse.json();
          if (catsData.categories) {
            const imgMap: Record<string, string> = {};
            catsData.categories.forEach((cat: { name: string; image_url: string | null }) => {
              if (cat.image_url) imgMap[cat.name] = cat.image_url;
            });
            setDbCategoryImages(imgMap);
          }
        }
      } catch (error) {
        console.error("Error loading catalog:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCatalog();
  }, []);

  const getCategoryImageUrl = (category: string): string | null => {
    return dbCategoryImages[category] || CATEGORY_IMAGES[category] || null;
  };

  const allPharmacies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; primary_color: string }>();
    medications.forEach((med) => {
      if (med.pharmacy && !map.has(med.pharmacy.id)) {
        map.set(med.pharmacy.id, {
          id: med.pharmacy.id,
          name: med.pharmacy.name,
          primary_color: med.pharmacy.primary_color,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [medications]);

  const availableCategories = useMemo(() => {
    const cats = new Map<string, number>();
    medications.forEach((med) => {
      const cat = med.category || "Standard Formulations";
      cats.set(cat, (cats.get(cat) || 0) + 1);
    });
    return Array.from(cats.entries())
      .map(([name, count]) => ({
        name,
        count,
        image_url: dbCategoryImages[name] || CATEGORY_IMAGES[name] || null,
        description: null as string | null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [medications, dbCategoryImages]);

  const filteredMedications = useMemo(() => {
    let filtered = medications;

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (med) => (med.category || "Standard Formulations") === selectedCategory
      );
    }

    if (selectedPharmacy !== "all") {
      filtered = filtered.filter((med) => med.pharmacy_id === selectedPharmacy);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (med) =>
          med.name.toLowerCase().includes(query) ||
          (med.category && med.category.toLowerCase().includes(query)) ||
          (med.strength && med.strength.toLowerCase().includes(query)) ||
          (med.form && med.form.toLowerCase().includes(query))
      );
    }

    switch (sortBy) {
      case "price-low":
        filtered = [...filtered].sort(
          (a, b) => a.aimrx_site_pricing_cents - b.aimrx_site_pricing_cents
        );
        break;
      case "price-high":
        filtered = [...filtered].sort(
          (a, b) => b.aimrx_site_pricing_cents - a.aimrx_site_pricing_cents
        );
        break;
      default:
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [medications, selectedCategory, selectedPharmacy, searchQuery, sortBy]);

  const handlePrescribe = useCallback(
    (med: PharmacyMedication) => {
      const prescriptionData = {
        medication: med.name,
        vialSize: med.vial_size || med.strength || "",
        dosageAmount: med.strength?.match(/\d+/)?.[0] || "",
        dosageUnit: med.strength?.match(/[a-zA-Z]+/)?.[0] || "mg",
        form: med.form || "",
        quantity: "1",
        refills: "0",
        sig: med.dosage_instructions || "",
        dispenseAsWritten: false,
        pharmacyNotes: "",
        patientPrice: (med.aimrx_site_pricing_cents / 100).toFixed(2),
        strength: med.strength || "",
        selectedPharmacyId: med.pharmacy_id,
        selectedPharmacyName: med.pharmacy.name,
        selectedPharmacyColor: med.pharmacy.primary_color,
        selectedMedicationId: med.id,
        refillFrequencyDays: "",
      };
      sessionStorage.setItem("prescriptionFormData", JSON.stringify(prescriptionData));
      router.push("/prescriptions/new/step1");
    },
    [router]
  );

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const inStockCount = filteredMedications.filter((m) => m.in_stock !== false).length;
  const totalProducts = filteredMedications.length;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#3B82F6]">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
            <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="relative container max-w-7xl mx-auto px-4 py-10 sm:py-14">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <ShoppingBag className="h-7 w-7 text-white" />
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
                    data-testid="text-catalog-title"
                  >
                    Product Catalog
                  </h1>
                </div>
                <p className="text-blue-100 text-base sm:text-lg mt-1 max-w-xl">
                  Browse products, compare pricing, and check availability across all pharmacies.
                </p>
                {tierDiscount > 0 && (
                  <div
                    className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-emerald-500/90 backdrop-blur-sm rounded-full"
                    data-testid="badge-tier-discount"
                  >
                    <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                    <span className="text-sm font-semibold text-white">
                      {tierDiscount}% Tier Discount Applied
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-3xl font-bold text-white" data-testid="text-total-products">
                    {totalProducts}
                  </div>
                  <div className="text-blue-200 text-sm">Products Available</div>
                </div>
                <div className="w-px h-12 bg-white/20 hidden sm:block" />
                <div className="text-right hidden sm:block">
                  <div className="text-3xl font-bold text-emerald-300" data-testid="text-in-stock-count">
                    {inStockCount}
                  </div>
                  <div className="text-blue-200 text-sm">In Stock</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search medications by name, category, strength, or form..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 text-base border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500"
                  data-testid="input-search-catalog"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-12 px-4 rounded-xl gap-2 ${showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(selectedCategory !== "all" || selectedPharmacy !== "all") && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                      {(selectedCategory !== "all" ? 1 : 0) + (selectedPharmacy !== "all" ? 1 : 0)}
                    </span>
                  )}
                </Button>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="h-12 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  data-testid="select-sort"
                >
                  <option value="name">Sort: A-Z</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>

                <div className="hidden sm:flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-3 transition-colors ${viewMode === "grid" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
                    data-testid="button-view-grid"
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-3 transition-colors ${viewMode === "list" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
                    data-testid="button-view-list"
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {allPharmacies.length > 1 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      <Building2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                      Pharmacy
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedPharmacy("all")}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedPharmacy === "all"
                            ? "bg-[#1E3A8A] text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        data-testid="button-pharmacy-all"
                      >
                        All Pharmacies
                      </button>
                      {allPharmacies.map((pharm) => (
                        <button
                          key={pharm.id}
                          onClick={() => setSelectedPharmacy(pharm.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            selectedPharmacy === pharm.id
                              ? "text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          style={
                            selectedPharmacy === pharm.id
                              ? { backgroundColor: pharm.primary_color }
                              : undefined
                          }
                          data-testid={`button-pharmacy-${pharm.id}`}
                        >
                          {pharm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedCategory !== "all" || selectedPharmacy !== "all") && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Active filters:</span>
                    {selectedCategory !== "all" && (
                      <button
                        onClick={() => setSelectedCategory("all")}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 transition-colors"
                        data-testid="button-clear-category"
                      >
                        {selectedCategory}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {selectedPharmacy !== "all" && (
                      <button
                        onClick={() => setSelectedPharmacy("all")}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 transition-colors"
                        data-testid="button-clear-pharmacy"
                      >
                        {allPharmacies.find((p) => p.id === selectedPharmacy)?.name}
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedCategory("all");
                        setSelectedPharmacy("all");
                      }}
                      className="text-sm text-gray-400 hover:text-gray-600 underline ml-2"
                      data-testid="button-clear-all-filters"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 mt-8">
          {selectedCategory === "all" && !searchQuery && (
            <CategoryCarousel
              categories={availableCategories}
              onSelectCategory={setSelectedCategory}
              getCategoryIcon={getCategoryIcon}
              getCategoryGradient={getCategoryGradient}
              getCategoryImageUrl={getCategoryImageUrl}
            />
          )}

          {selectedCategory !== "all" && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  data-testid="button-back-to-categories"
                >
                  All Categories
                </button>
                <ChevronDown className="h-4 w-4 text-gray-300 -rotate-90" />
                <span className="text-sm font-bold text-gray-900">{selectedCategory}</span>
                <span className="text-sm text-gray-400">
                  ({filteredMedications.length} {filteredMedications.length === 1 ? "product" : "products"})
                </span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-100" />
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="h-5 bg-gray-200 rounded w-3/4" />
                        <div className="h-4 bg-gray-100 rounded w-1/2" />
                      </div>
                      <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-gray-100 rounded-full" />
                      <div className="h-6 w-20 bg-gray-100 rounded-full" />
                    </div>
                    <div className="h-10 bg-gray-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMedications.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="text-no-results">
                No products found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? `No medications match "${searchQuery}"`
                  : "No medications available with the selected filters"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedPharmacy("all");
                }}
                data-testid="button-reset-filters"
              >
                Reset Filters
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMedications.map((med) => {
                const catBg = getCategoryBg(med.category || "Standard Formulations");
                const gradient = getCategoryGradient(med.category || "Standard Formulations");
                const formPlaceholder = FORM_PLACEHOLDER_COLORS[med.form] || "from-slate-400 to-gray-500";
                const isExpanded = expandedProduct === med.id;
                const MedIcon = getCategoryIcon(med.category || "Standard Formulations");

                return (
                  <div
                    key={med.id}
                    className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:border-gray-200 flex flex-col"
                    data-testid={`card-product-${med.id}`}
                  >
                    <div className="relative h-40 overflow-hidden">
                      {med.image_url ? (
                        <img src={med.image_url} alt={med.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${formPlaceholder} flex items-center justify-center`}>
                          <MedIcon className="h-16 w-16 text-white/40" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <div className="bg-white/95 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm">
                          <span className="text-lg font-bold text-gray-900" data-testid={`text-price-${med.id}`}>${formatPrice(med.aimrx_site_pricing_cents)}</span>
                          {tierDiscount > 0 && (
                            <span className="text-xs text-emerald-600 font-medium ml-1">{tierDiscount}% off</span>
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent h-16" />
                      {med.in_stock !== false ? (
                        <div className="absolute top-3 left-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white shadow-sm"><CheckCircle2 className="h-3 w-3" />In Stock</span></div>
                      ) : (
                        <div className="absolute top-3 left-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white shadow-sm"><XCircle className="h-3 w-3" />Out of Stock</span></div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-bold text-gray-900 text-base leading-snug group-hover:text-[#1E3A8A] transition-colors truncate"
                            title={med.name}
                            data-testid={`text-product-name-${med.id}`}
                          >
                            {med.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {med.strength}
                            {med.form ? ` \u2022 ${med.form}` : ""}
                            {med.vial_size ? ` \u2022 ${med.vial_size}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${catBg}`}>
                          {med.category || "Standard"}
                        </span>
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: med.pharmacy.primary_color }}
                          data-testid={`badge-pharmacy-${med.id}`}
                        >
                          {med.pharmacy.name}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          {med.ndc && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">NDC</span>
                              <span className="font-medium text-gray-900">{med.ndc}</span>
                            </div>
                          )}
                          {med.preparation_time_days && med.preparation_time_days > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Prep Time
                              </span>
                              <span className="font-medium text-gray-900">
                                {med.preparation_time_days} {med.preparation_time_days === 1 ? "day" : "days"}
                              </span>
                            </div>
                          )}
                          {med.detailed_description && (
                            <MedicationDescription text={med.detailed_description} medId={med.id} />
                          )}
                          {med.dosage_instructions && (
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                              <p className="text-xs font-semibold text-blue-800 mb-1">Dosage Instructions</p>
                              <p className="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">
                                {med.dosage_instructions}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-auto pt-3 flex items-center gap-2">
                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : med.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                          data-testid={`button-details-${med.id}`}
                        >
                          <Eye className="h-4 w-4" />
                          {isExpanded ? "Less" : "Details"}
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <Button
                          onClick={() => handlePrescribe(med)}
                          disabled={med.in_stock === false}
                          variant="outline"
                          className="flex-1 h-10 rounded-xl text-sm gap-1.5 border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white"
                          data-testid={`button-prescribe-${med.id}`}
                        >
                          Prescribe
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMedications.map((med) => {
                const catBg = getCategoryBg(med.category || "Standard Formulations");
                const isExpanded = expandedProduct === med.id;

                return (
                  <div
                    key={med.id}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    data-testid={`row-product-${med.id}`}
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {med.image_url ? (
                            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                              <img src={med.image_url} alt={med.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${med.pharmacy.primary_color}20, ${med.pharmacy.primary_color}40)`,
                              }}
                            >
                              <Pill className="h-6 w-6" style={{ color: med.pharmacy.primary_color }} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-gray-900 truncate" data-testid={`text-list-name-${med.id}`}>
                                {med.name}
                              </h3>
                              {med.in_stock !== false ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                  <CheckCircle2 className="h-3 w-3" />
                                  In Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                                  <XCircle className="h-3 w-3" />
                                  Out of Stock
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {med.strength} \u2022 {med.form}
                              {med.vial_size ? ` \u2022 ${med.vial_size}` : ""}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${catBg}`}>
                                {med.category || "Standard"}
                              </span>
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                style={{ backgroundColor: med.pharmacy.primary_color }}
                              >
                                {med.pharmacy.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">
                              ${formatPrice(med.aimrx_site_pricing_cents)}
                            </div>
                            {tierDiscount > 0 && (
                              <div className="text-xs text-emerald-600 font-medium">
                                {tierDiscount}% off
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setExpandedProduct(isExpanded ? null : med.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            data-testid={`button-list-details-${med.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>

                          <Button
                            onClick={() => handlePrescribe(med)}
                            disabled={med.in_stock === false}
                            size="sm"
                            className="rounded-xl bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 gap-1.5"
                            data-testid={`button-list-prescribe-${med.id}`}
                          >
                            Prescribe
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            {med.ndc && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">NDC</span>
                                <span className="font-medium">{med.ndc}</span>
                              </div>
                            )}
                            {med.preparation_time_days && med.preparation_time_days > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Prep Time</span>
                                <span className="font-medium">
                                  {med.preparation_time_days} {med.preparation_time_days === 1 ? "day" : "days"}
                                </span>
                              </div>
                            )}
                          </div>
                          {med.detailed_description && (
                            <MedicationDescription text={med.detailed_description} medId={`list-${med.id}`} />
                          )}
                          {med.dosage_instructions && (
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                              <p className="text-xs font-semibold text-blue-800 mb-1">Dosage Instructions</p>
                              <p className="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">
                                {med.dosage_instructions}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && filteredMedications.length > 0 && (
            <div className="mt-8 mb-12 text-center">
              <p className="text-sm text-gray-400">
                Showing {filteredMedications.length} of {medications.length} products
                {tierDiscount > 0 && ` \u2022 ${tierDiscount}% tier discount applied to all prices`}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
