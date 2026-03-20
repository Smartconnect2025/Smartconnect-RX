"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  RefreshCw,
  Search,
  Calendar as CalendarIcon,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
  Pill,
  BarChart3,
  TableIcon,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const AnalyticsCharts = dynamic(() => import("./AnalyticsCharts"), { ssr: false });

interface Order {
  id: string;
  queue_id: string;
  date: string;
  patient: string;
  medication: string;
  quantity: number;
  refills: number;
  sig: string;
  price: number;
  medicationPrice: number;
  providerFees: number;
  status: string;
}

interface Provider {
  provider: { id: string; name: string; email: string; group_id: string | null };
  orders: Order[];
  totalOrders: number;
  totalAmount: number;
  totalMedicationAmount: number;
  totalProviderFees: number;
}

interface PharmacyReport {
  pharmacy: { id: string; name: string };
  providers: Provider[];
  totalOrders: number;
  totalAmount: number;
}

interface PharmacyOption {
  id: string;
  name: string;
}

interface ProviderOption {
  id: string;
  name: string;
  email: string;
}

interface GroupOption {
  id: string;
  name: string;
  platform_manager_id: string | null;
  platform_manager_name: string | null;
}

function AnimatedNumber({ value, prefix = "", decimals = 0, duration = 800 }: { value: number; prefix?: string; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = value;
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  submitted: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  billing: { dot: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700" },
  pending_payment: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  payment_received: { dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
  approved: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  packed: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  shipped: { dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  delivered: { dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700" },
  completed: { dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700" },
  cancelled: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
};

function StatusBadge({ status }: { status: string }) {
  const safeStatus = status || "unknown";
  const config = STATUS_CONFIG[safeStatus] || { dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-700" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`} data-testid={`status-badge-${safeStatus}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).replace(/_/g, " ")}
    </span>
  );
}

const KPI_CONFIGS = [
  {
    key: "orders",
    label: "Total Orders",
    icon: ShoppingCart,
    gradient: "from-blue-600 to-blue-700",
    iconBg: "bg-blue-500/20",
    lightBg: "from-blue-50/80 to-white",
  },
  {
    key: "revenue",
    label: "Total Revenue",
    icon: DollarSign,
    gradient: "from-emerald-600 to-emerald-700",
    iconBg: "bg-emerald-500/20",
    lightBg: "from-emerald-50/80 to-white",
  },
  {
    key: "avg",
    label: "Avg Order Value",
    icon: TrendingUp,
    gradient: "from-violet-600 to-violet-700",
    iconBg: "bg-violet-500/20",
    lightBg: "from-violet-50/80 to-white",
  },
  {
    key: "providers",
    label: "Active Providers",
    icon: Users,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-500/20",
    lightBg: "from-amber-50/80 to-white",
  },
  {
    key: "topMed",
    label: "Top Medication",
    icon: Pill,
    gradient: "from-rose-500 to-pink-600",
    iconBg: "bg-rose-500/20",
    lightBg: "from-rose-50/80 to-white",
  },
];

export default function PharmacyReportsPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);

  const [reports, setReports] = useState<PharmacyReport[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "details">("overview");
  const [viewMode, setViewMode] = useState<"by-provider" | "pharmacy-only">("by-provider");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedPlatformManager, setSelectedPlatformManager] = useState<string>("all");

  useEffect(() => {
    const checkScope = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.pharmacy_id) {
        setIsPharmacyAdmin(true);
        setSelectedPharmacy(data.pharmacy_id);
      }
    };
    checkScope();
  }, [user?.id, supabase]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      const data = await response.json();
      if (response.ok) {
        setPharmacies(data.pharmacies || []);
      }
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch("/api/admin/providers");
      const data = await response.json();
      if (response.ok) {
        const providerList = data.providers?.map((provider: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
        }) => ({
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
        })) || [];
        setProviders(providerList);
      } else {
        console.error("Failed to fetch providers:", data);
        toast.error("Failed to load providers");
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
      toast.error("Failed to load providers");
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/admin/groups");
      const data = await response.json();
      if (response.ok) {
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (startDate) params.append("startDate", new Date(startDate).toISOString());
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        params.append("endDate", endDateTime.toISOString());
      }
      if (selectedPharmacy !== "all") params.append("pharmacyId", selectedPharmacy);

      const response = await fetch(`/api/admin/pharmacy-reports?${params.toString()}`);

      const data = await response.json();

      if (response.ok) {
        let filteredReports = data.report || [];

        if (selectedProvider !== "all") {
          filteredReports = filteredReports.map((report: PharmacyReport) => ({
            ...report,
            providers: report.providers.filter(
              (p) => p.provider.id === selectedProvider
            ),
          })).filter((report: PharmacyReport) => report.providers.length > 0);
        }

        setReports(filteredReports);
        setLastUpdated(new Date());
        if (filteredReports.length === 0) {
          toast.info("No orders found for the selected filters");
        }
      } else {
        console.error("API error:", data.error);
        toast.error(data.error || "Failed to fetch reports");
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error(`Failed to fetch reports: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPharmacy, selectedProvider, startDate, endDate]);

  useEffect(() => {
    fetchPharmacies();
    fetchProviders();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPharmacy, selectedProvider, startDate, endDate]);

  const matchingGroupIds = new Set<string>();
  if (selectedGroup !== "all" || selectedPlatformManager !== "all") {
    groups.forEach((group) => {
      const matchesGroup = selectedGroup === "all" || group.id === selectedGroup;
      const matchesPM = selectedPlatformManager === "all" || group.platform_manager_id === selectedPlatformManager;
      if (matchesGroup && matchesPM) {
        matchingGroupIds.add(group.id);
      }
    });
  }

  const filteredReports = reports
    .map((report) => {
      let providers = report.providers;

      if (selectedGroup !== "all" || selectedPlatformManager !== "all") {
        providers = providers.filter(
          (p) => p.provider.group_id && matchingGroupIds.has(p.provider.group_id)
        );
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const pharmacyMatches = report.pharmacy.name.toLowerCase().includes(searchLower);

        if (!pharmacyMatches) {
          providers = providers.map((p) => {
            const providerMatches =
              p.provider.name.toLowerCase().includes(searchLower) ||
              p.provider.email.toLowerCase().includes(searchLower);

            if (providerMatches) return p;

            const matchingOrders = p.orders.filter(
              (order) =>
                order.medication.toLowerCase().includes(searchLower) ||
                order.patient.toLowerCase().includes(searchLower)
            );
            if (matchingOrders.length === 0) return null;

            return {
              ...p,
              orders: matchingOrders,
              totalOrders: matchingOrders.length,
              totalAmount: matchingOrders.reduce((s, o) => s + o.price, 0),
              totalMedicationAmount: matchingOrders.reduce((s, o) => s + o.medicationPrice, 0),
              totalProviderFees: matchingOrders.reduce((s, o) => s + o.providerFees, 0),
            };
          }).filter((p): p is Provider => p !== null);
        }
      }

      const totalOrders = providers.reduce((s, p) => s + p.orders.length, 0);
      const totalAmount = providers.reduce((s, p) => s + p.orders.reduce((os, o) => os + o.price, 0), 0);

      return { ...report, providers, totalOrders, totalAmount };
    })
    .filter((report) => report.providers.length > 0);

  const exportToCSV = () => {
    const csvRows: string[] = [];
    csvRows.push("Pharmacy,Provider,Provider Email,Group,Platform Manager,Patient,Medication,Quantity,Refills,Date,Medication Price,Provider Fees,Total Price,Status");

    filteredReports.forEach((report) => {
      report.providers.forEach((providerData) => {
        const group = groups.find(g => g.id === providerData.provider.group_id);
        providerData.orders.forEach((order) => {
          csvRows.push(
            [
              report.pharmacy.name,
              providerData.provider.name,
              providerData.provider.email,
              `"${group?.name || ""}"`,
              `"${group?.platform_manager_name || ""}"`,
              order.patient,
              order.medication,
              order.quantity,
              order.refills,
              new Date(order.date).toLocaleDateString(),
              `$${order.medicationPrice.toFixed(2)}`,
              `$${order.providerFees.toFixed(2)}`,
              `$${order.price.toFixed(2)}`,
              order.status,
            ].join(",")
          );
        });
      });
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy-reports-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Report exported successfully");
  };

  const allFilteredOrders = filteredReports.flatMap((r) => r.providers.flatMap((p) => p.orders));
  const grandTotal = allFilteredOrders.reduce((sum, o) => sum + o.price, 0);
  const totalOrders = allFilteredOrders.length;
  const uniqueProviderIds = new Set<string>();
  const medicationCounts: Record<string, number> = {};
  filteredReports.forEach((report) => {
    report.providers.forEach((p) => {
      uniqueProviderIds.add(p.provider.id);
      p.orders.forEach((order) => {
        const medName = order.medication.split(" - ")[0].split(" (")[0].trim();
        medicationCounts[medName] = (medicationCounts[medName] || 0) + 1;
      });
    });
  });
  const activeProviderCount = uniqueProviderIds.size;
  const topMedication = Object.entries(medicationCounts).sort((a, b) => b[1] - a[1])[0];
  const hasActiveFilters = selectedPharmacy !== "all" || selectedProvider !== "all" || selectedGroup !== "all" || selectedPlatformManager !== "all" || startDate || endDate || searchTerm;

  const kpiValues: Record<string, { value: number; display?: string; sub?: string }> = {
    orders: { value: totalOrders },
    revenue: { value: grandTotal },
    avg: { value: totalOrders > 0 ? grandTotal / totalOrders : 0 },
    providers: { value: activeProviderCount },
    topMed: { value: topMedication ? topMedication[1] : 0, display: topMedication ? topMedication[0] : "---", sub: topMedication ? `${topMedication[1]} orders` : "" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30" data-testid="pharmacy-reports-page">
      <div className="container mx-auto p-6 space-y-6 max-w-[1400px]">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1E3A8A] to-[#3B82F6] bg-clip-text text-transparent" data-testid="text-page-title">
              Reporting & Analytics
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time prescription analytics and performance insights
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {lastUpdated && (
              <span className="text-xs text-gray-400 hidden md:inline-flex items-center gap-1.5 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200/50" data-testid="text-last-updated">
                <Clock className="h-3 w-3" />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button onClick={fetchReports} disabled={isLoading} variant="outline" className="border-gray-200 hover:bg-gray-50 shadow-sm" data-testid="button-refresh-header">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={exportToCSV} disabled={isLoading || filteredReports.length === 0} className="bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] hover:from-[#1E3A8A] hover:to-[#1D4ED8] shadow-md shadow-blue-200/50" data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {!isLoading && filteredReports.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="kpi-cards">
            {KPI_CONFIGS.map((kpi) => {
              const Icon = kpi.icon;
              const val = kpiValues[kpi.key];
              const isTopMed = kpi.key === "topMed";

              return (
                <Card
                  key={kpi.key}
                  className={`group relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br ${kpi.lightBg} ${isTopMed ? "col-span-2 md:col-span-1" : ""}`}
                  data-testid={`card-kpi-${kpi.key}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardContent className="relative pt-5 pb-4 px-5">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-xl ${kpi.iconBg} group-hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors duration-500`}>
                        <Icon className="h-5 w-5 text-gray-600 group-hover:text-white transition-colors duration-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 group-hover:text-white/70 uppercase tracking-wider transition-colors duration-500">
                          {kpi.label}
                        </p>
                        {isTopMed ? (
                          <>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-white truncate transition-colors duration-500" title={val.display}>
                              {val.display}
                            </p>
                            {val.sub && (
                              <p className="text-[11px] text-gray-400 group-hover:text-white/60 transition-colors duration-500">{val.sub}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-2xl font-bold text-gray-900 group-hover:text-white transition-colors duration-500">
                            <AnimatedNumber
                              value={val.value}
                              prefix={kpi.key === "revenue" || kpi.key === "avg" ? "$" : ""}
                              decimals={kpi.key === "revenue" || kpi.key === "avg" ? 2 : 0}
                            />
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-xl p-1 gap-1 shadow-sm border border-gray-100" data-testid="tabs-overview-details">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === "overview"
                    ? "bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white shadow-md shadow-blue-200/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                data-testid="button-tab-overview"
              >
                <BarChart3 className="h-4 w-4" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab("details")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === "details"
                    ? "bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white shadow-md shadow-blue-200/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                data-testid="button-tab-details"
              >
                <TableIcon className="h-4 w-4" />
                Details
              </button>
            </div>

            <div className="flex bg-white rounded-lg p-1 gap-1 shadow-sm border border-gray-100" data-testid="toggle-view-mode">
              <button
                onClick={() => setViewMode("by-provider")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "by-provider"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid="button-view-by-provider"
              >
                By Provider
              </button>
              <button
                onClick={() => {
                  setViewMode("pharmacy-only");
                  setSelectedProvider("all");
                  setSelectedGroup("all");
                  setSelectedPlatformManager("all");
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "pharmacy-only"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid="button-view-pharmacy-only"
              >
                Pharmacy Only
              </button>
            </div>
          </div>

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              hasActiveFilters
                ? "bg-blue-50 text-[#1E3A8A] border-blue-200 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50"
            }`}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-[#1E3A8A] animate-pulse" />
            )}
            {filtersOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </button>
        </div>

        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${filtersOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <Card className="border border-gray-200/80 shadow-sm bg-white/80 backdrop-blur-sm" data-testid="card-filters">
            <CardContent className="pt-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {!isPharmacyAdmin && (
                <div className="space-y-1.5">
                  <Label htmlFor="pharmacy" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
                  <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy}>
                    <SelectTrigger id="pharmacy" className="bg-white" data-testid="select-pharmacy">
                      <SelectValue placeholder="Select pharmacy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pharmacies</SelectItem>
                      {pharmacies.map((pharmacy) => (
                        <SelectItem key={pharmacy.id} value={pharmacy.id}>
                          {pharmacy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}

                {viewMode === "by-provider" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="provider" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger id="provider" className="bg-white" data-testid="select-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name} ({provider.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {viewMode === "by-provider" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="group" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Group</Label>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger id="group" className="bg-white" data-testid="select-group">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Groups</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {viewMode === "by-provider" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="platformManager" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform Manager</Label>
                    <Select value={selectedPlatformManager} onValueChange={setSelectedPlatformManager}>
                      <SelectTrigger id="platformManager" className="bg-white" data-testid="select-platform-manager">
                        <SelectValue placeholder="Select platform manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platform Managers</SelectItem>
                        {groups
                          .filter((g) => g.platform_manager_id && g.platform_manager_name)
                          .reduce((unique, g) => {
                            if (!unique.some((u) => u.platform_manager_id === g.platform_manager_id)) {
                              unique.push(g);
                            }
                            return unique;
                          }, [] as GroupOption[])
                          .map((g) => (
                            <SelectItem key={g.platform_manager_id!} value={g.platform_manager_id!}>
                              {g.platform_manager_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="search" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Patient, medication..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10 bg-white"
                      data-testid="input-start-date"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 bg-white"
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">&nbsp;</Label>
                  <Button
                    onClick={() => {
                      setSelectedPharmacy("all");
                      setSelectedProvider("all");
                      setSelectedGroup("all");
                      setSelectedPlatformManager("all");
                      setStartDate("");
                      setEndDate("");
                      setSearchTerm("");
                    }}
                    variant="outline"
                    className="w-full border-gray-200"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3.5 w-3.5 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="transition-all duration-300">
          {activeTab === "overview" && (
            <div data-testid="tab-overview-content">
              {isLoading ? (
                <div className="space-y-6">
                  <Card className="border-0 shadow-md">
                    <CardContent className="p-8">
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-[280px] bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl" />
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Card key={i} className="border-0 shadow-md">
                        <CardContent className="p-8">
                          <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-1/3" />
                            <div className="h-[250px] bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <AnalyticsCharts reports={filteredReports} />
              )}
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6" data-testid="tab-details-content">
              {isLoading ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-[#1E3A8A]" />
                    <p className="font-medium">Loading reports...</p>
                  </CardContent>
                </Card>
              ) : filteredReports.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200">
                  <CardContent className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">No orders found</h3>
                    <p className="text-sm text-gray-400">Try adjusting your filters to see results</p>
                  </CardContent>
                </Card>
              ) : viewMode === "pharmacy-only" ? (
                filteredReports.map((report) => {
                  const allOrders = report.providers.flatMap((p) => p.orders);

                  return (
                    <Card key={report.pharmacy.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-pharmacy-${report.pharmacy.id}`}>
                      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] flex items-center justify-center shadow-sm">
                              <span className="text-white font-bold text-sm">{report.pharmacy.name.charAt(0)}</span>
                            </div>
                            <div>
                              <CardTitle className="text-lg text-gray-900">{report.pharmacy.name}</CardTitle>
                              <p className="text-sm text-gray-400 mt-0.5">
                                <span className="font-semibold text-gray-600">{report.totalOrders}</span> orders
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="font-semibold text-emerald-600">${report.totalAmount.toFixed(2)}</span> total
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Queue ID</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Patient</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Medication</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Qty/Ref</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">SIG</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Med Price</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Provider Fees</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Total</TableHead>
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allOrders.map((order, idx) => (
                                <TableRow key={order.id} className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`} data-testid={`row-order-${order.id}`}>
                                  <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                    {new Date(order.date).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-gray-400">
                                    {order.queue_id || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium text-gray-700">{order.patient}</TableCell>
                                  <TableCell className="text-sm text-gray-600">{order.medication}</TableCell>
                                  <TableCell className="whitespace-nowrap text-sm text-gray-500">
                                    {order.quantity} / {order.refills}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate text-sm text-gray-500">
                                    {order.sig || "N/A"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-sm text-gray-600 text-right">${order.medicationPrice.toFixed(2)}</TableCell>
                                  <TableCell className="whitespace-nowrap text-sm text-gray-600 text-right">${order.providerFees.toFixed(2)}</TableCell>
                                  <TableCell className="whitespace-nowrap text-sm font-bold text-gray-900 text-right">${order.price.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <StatusBadge status={order.status} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                filteredReports.map((report) => (
                  <Card key={report.pharmacy.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-pharmacy-${report.pharmacy.id}`}>
                    <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-sm">{report.pharmacy.name.charAt(0)}</span>
                          </div>
                          <div>
                            <CardTitle className="text-lg text-gray-900">{report.pharmacy.name}</CardTitle>
                            <p className="text-sm text-gray-400 mt-0.5">
                              <span className="font-semibold text-gray-600">{report.totalOrders}</span> orders
                              <span className="mx-2 text-gray-300">|</span>
                              <span className="font-semibold text-emerald-600">${report.totalAmount.toFixed(2)}</span> total
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {report.providers.map((providerData) => (
                        <div key={providerData.provider.id} className="mb-8 last:mb-0" data-testid={`section-provider-${providerData.provider.id}`}>
                          <div className="bg-gradient-to-r from-blue-50/80 via-blue-50/40 to-transparent border border-blue-100/60 p-4 rounded-xl mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-[#1E3A8A]/10 flex items-center justify-center flex-shrink-0">
                                <Users className="h-4 w-4 text-[#1E3A8A]" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-base text-gray-900">{providerData.provider.name}</h3>
                                <p className="text-xs text-gray-400">{providerData.provider.email}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 mt-3 ml-11">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200/50">
                                <ShoppingCart className="h-3 w-3" />
                                {providerData.totalOrders} orders
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200/50">
                                <Pill className="h-3 w-3" />
                                ${providerData.totalMedicationAmount.toFixed(2)} meds
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200/50">
                                <DollarSign className="h-3 w-3" />
                                ${providerData.totalProviderFees.toFixed(2)} fees
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/50">
                                <TrendingUp className="h-3 w-3" />
                                ${providerData.totalAmount.toFixed(2)} total
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Queue ID</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Patient</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Medication</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Qty/Ref</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">SIG</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Med Price</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Provider Fees</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Total</TableHead>
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {providerData.orders.map((order, idx) => (
                                  <TableRow key={order.id} className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`} data-testid={`row-order-${order.id}`}>
                                    <TableCell className="whitespace-nowrap text-sm text-gray-600">
                                      {new Date(order.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-gray-400">
                                      {order.queue_id || "N/A"}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-gray-700">{order.patient}</TableCell>
                                    <TableCell className="text-sm text-gray-600">{order.medication}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-gray-500">
                                      {order.quantity} / {order.refills}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-sm text-gray-500">
                                      {order.sig || "N/A"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-gray-600 text-right">${order.medicationPrice.toFixed(2)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-gray-600 text-right">${order.providerFees.toFixed(2)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm font-bold text-gray-900 text-right">${order.price.toFixed(2)}</TableCell>
                                    <TableCell>
                                      <StatusBadge status={order.status} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
