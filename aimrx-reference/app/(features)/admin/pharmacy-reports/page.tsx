"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Mail,
  CheckCircle2,
  AlertCircle,
  Receipt,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

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
  // Accountant breakdown (May 21 2026). Populated by the reports API.
  // Always present (defaults to 0) so CSV/PDF/print exports tie out.
  listPriceCents?: number;
  tierName?: string | null;
  tierDiscountPct?: number;
  tierDiscountCents?: number;
  netMedCents?: number;
  providerFeeCents?: number;
  shippingCents?: number;
  totalChargedCents?: number;
  status: string;
  payOnTerms?: boolean;
  payOnTermsAmountCents?: number;
  payOnTermsSettledAt?: string | null;
  // When the order was submitted by a provider assistant (delegate)
  // rather than the supervising provider directly. `null` means the
  // supervising provider submitted it themselves.
  submittedBy?: {
    delegationId: string;
    name: string;
    email: string;
  } | null;
}

interface Provider {
  provider: { id: string; name: string; email: string; group_id: string | null; payOnTerms?: boolean };
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

// One entry per row in the "Provider" filter dropdown. Most entries are
// real providers; assistants (delegates) are appended when the API is
// called with `?includeDelegates=true` and are flagged with
// `isDelegate: true` plus the supervising provider's name so the UI can
// label them e.g. "Jane Smith (Assistant of Dr. Brown)".
interface ProviderOption {
  id: string;
  name: string;
  email: string;
  isDelegate: boolean;
  delegationId: string | null;
  supervisingProviderName: string | null;
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
  paused: { dot: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
  approved: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  packed: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  shipped: { dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  delivered: { dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700" },
  completed: { dot: "bg-green-600", bg: "bg-green-50", text: "text-green-700" },
  cancelled: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  rejected: { dot: "bg-red-600", bg: "bg-red-100", text: "text-red-800" },
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
  const [reports, setReports] = useState<PharmacyReport[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "details" | "payment-on-terms" | "refunds">("overview");
  const [showSettled, setShowSettled] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  // ---- Accounting & Refunds tab state ----
  type RefundOrder = {
    id: string;
    queue_id: string;
    date: string;
    patient: string;
    medication: string;
    quantity: number;
    refills: number;
    status: string;
    payment_status: string;
    refund: {
      id: string | null;
      status: "owed" | "issued" | "not_applicable";
      method: "card" | "pot_credit" | "none";
      amountCents: number;
      issuedAt: string | null;
      issuedBy: { name: string | null; email: string | null } | null;
      note: string | null;
    };
  };
  type RefundProviderGroup = {
    provider: { id: string; name: string; email: string; payOnTerms: boolean };
    orders: RefundOrder[];
    owedCents: number;
    owedCount: number;
    issuedCents: number;
    issuedCount: number;
  };
  type RefundPharmacyGroup = {
    pharmacy: { id: string; name: string };
    owedCents: number;
    issuedCents: number;
    providers: RefundProviderGroup[];
  };
  type RefundSummary = {
    totalRejectedCents: number;
    totalCancelledCents: number;
    totalOwedCents: number;
    totalIssuedCents: number;
    totalNotApplicable: number;
    cardOwedCents: number;
    potOwedCents: number;
  };
  type MarkIssuedItem = { prescriptionId: string; defaultAmountCents: number };
  const [refundReports, setRefundReports] = useState<RefundPharmacyGroup[]>([]);
  const [refundSummary, setRefundSummary] = useState<RefundSummary>({
    totalRejectedCents: 0,
    totalCancelledCents: 0,
    totalOwedCents: 0,
    totalIssuedCents: 0,
    totalNotApplicable: 0,
    cardOwedCents: 0,
    potOwedCents: 0,
  });
  const [refundsLoading, setRefundsLoading] = useState(false);
  // Day-one default surfaces every rejected/cancelled order so accounting
  // sees the full hidden backlog on first load. Filters narrow as needed.
  const [refundStatusFilter, setRefundStatusFilter] = useState<"all" | "owed" | "issued" | "not_applicable">("all");
  const [showResolvedRefunds, setShowResolvedRefunds] = useState(true);
  const [markIssuedDialogOpen, setMarkIssuedDialogOpen] = useState(false);
  const [markIssuedTarget, setMarkIssuedTarget] = useState<{ items: MarkIssuedItem[]; label: string } | null>(null);
  const [markIssuedNote, setMarkIssuedNote] = useState("");
  const [markIssuedAmount, setMarkIssuedAmount] = useState<string>(""); // dollars, single-row only
  const [markIssuedRefundedAt, setMarkIssuedRefundedAt] = useState<string>(""); // YYYY-MM-DD, optional
  const [markIssuedSubmitting, setMarkIssuedSubmitting] = useState(false);

  // Pay-on-Terms email settings (recipients + schedule), loaded from DB
  type PotRecipient = { id: string; name: string; email: string; enabled: boolean };
  type PotSchedule = {
    enabled: boolean;
    frequency: string;
    send_hour_utc: number;
    last_sent_at: string | null;
    last_window_end: string | null;
    last_status: string | null;
  };
  const [potRecipients, setPotRecipients] = useState<PotRecipient[]>([]);
  const [potSchedule, setPotSchedule] = useState<PotSchedule>({
    enabled: false,
    frequency: "off",
    send_hour_utc: 14,
    last_sent_at: null,
    last_window_end: null,
    last_status: null,
  });
  const [newRecipName, setNewRecipName] = useState("");
  const [newRecipEmail, setNewRecipEmail] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ---- Reporting period for the manual "Send Now" email ----
  // Both are "YYYY-MM-DD" strings interpreted in US Eastern wall-clock time.
  // Default is "yesterday Eastern" so opening the dialog mirrors what the
  // automated daily cron would send.
  const easternYmd = useCallback((d: Date): string => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }, []);
  // Add/subtract `daysAgo` calendar days from today's Eastern date. Uses
  // pure UTC calendar arithmetic so the result is correct on DST transition
  // days (no off-by-one when called near midnight Eastern on the day after
  // a clock change).
  const easternYmdDaysAgo = useCallback(
    (daysAgo: number) => {
      const todayYmd = easternYmd(new Date());
      const [y, m, d] = todayYmd.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d - daysAgo));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    },
    [easternYmd],
  );
  const [emailFromYmd, setEmailFromYmd] = useState<string>("");
  const [emailToYmd, setEmailToYmd] = useState<string>("");
  const [emailPreset, setEmailPreset] = useState<
    "today" | "yesterday" | "last7" | "lastweek" | "lastmonth" | "custom"
  >("yesterday");

  // When the dialog opens, default to "yesterday Eastern" if not yet set.
  useEffect(() => {
    if (emailDialogOpen && !emailFromYmd && !emailToYmd) {
      const y = easternYmdDaysAgo(1);
      setEmailFromYmd(y);
      setEmailToYmd(y);
      setEmailPreset("yesterday");
    }
  }, [emailDialogOpen, emailFromYmd, emailToYmd, easternYmdDaysAgo]);

  const applyPreset = (preset: typeof emailPreset) => {
    setEmailPreset(preset);
    if (preset === "today") {
      const t = easternYmdDaysAgo(0);
      setEmailFromYmd(t);
      setEmailToYmd(t);
    } else if (preset === "yesterday") {
      const y = easternYmdDaysAgo(1);
      setEmailFromYmd(y);
      setEmailToYmd(y);
    } else if (preset === "last7") {
      setEmailFromYmd(easternYmdDaysAgo(7));
      setEmailToYmd(easternYmdDaysAgo(1));
    } else if (preset === "lastweek") {
      // Previous Mon → Sun in Eastern
      const todayE = new Date(`${easternYmdDaysAgo(0)}T12:00:00Z`);
      const dow = todayE.getUTCDay(); // 0=Sun..6=Sat
      const daysToLastSunday = dow === 0 ? 7 : dow;
      const daysToLastMonday = daysToLastSunday + 6;
      setEmailFromYmd(easternYmdDaysAgo(daysToLastMonday));
      setEmailToYmd(easternYmdDaysAgo(daysToLastSunday));
    } else if (preset === "lastmonth") {
      const todayY = easternYmdDaysAgo(0);
      const [y, m] = todayY.split("-").map(Number);
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      setEmailFromYmd(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01`);
      setEmailToYmd(
        `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      );
    }
  };

  const formatYmdLabel = (ymd: string): string => {
    if (!ymd) return "—";
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return ymd;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const [viewMode, setViewMode] = useState<"by-provider" | "pharmacy-only">("by-provider");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("all");
  // Encoded value for the Provider filter dropdown. Conventions:
  //   "all"                       — no filter
  //   "provider:<provider.id>"    — scope to a single supervising provider
  //   "delegate:<delegationId>"   — scope to a single assistant; backend
  //                                 filters by submitted_by_delegation_id
  // Derived helpers below extract the actual id used by each branch.
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedPlatformManager, setSelectedPlatformManager] = useState<string>("all");
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
      // includeDelegates=true also returns provider assistants so the
      // dropdown can scope the report to one assistant's submissions.
      const response = await fetch("/api/admin/providers?includeDelegates=true");
      const data = await response.json();
      if (response.ok) {
        const providerList: ProviderOption[] =
          data.providers?.map(
            (provider: {
              id: string;
              prefix?: string | null;
              first_name: string;
              last_name: string;
              email: string;
              is_delegate?: boolean;
              delegation_id?: string | null;
              supervising_provider_name?: string | null;
            }) => ({
              id: provider.id,
              name: `${provider.prefix || "Dr."} ${provider.first_name} ${provider.last_name}`.trim(),
              email: provider.email,
              isDelegate: provider.is_delegate === true,
              delegationId: provider.delegation_id ?? null,
              supervisingProviderName:
                provider.supervising_provider_name ?? null,
            }),
          ) || [];
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

  const fetchPotSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settings");
      const data = await res.json();
      if (res.ok) {
        setPotRecipients(data.recipients || []);
        if (data.schedule) setPotSchedule(data.schedule);
      } else {
        console.error("[pot-settings] load failed:", data);
      }
    } catch (e) {
      console.error("[pot-settings] load error:", e);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const addRecipient = async () => {
    const name = newRecipName.trim();
    const email = newRecipEmail.trim();
    if (!name || !email) {
      toast.error("Name and email are both required");
      return;
    }
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-recipient", name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add recipient");
      setPotRecipients((prev) => [...prev, data.recipient]);
      setNewRecipName("");
      setNewRecipEmail("");
      toast.success(`Added ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add recipient");
    } finally {
      setSettingsSaving(false);
    }
  };

  const removeRecipient = async (id: string) => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-recipient", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      setPotRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove recipient");
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleRecipient = async (id: string, enabled: boolean) => {
    const prevSnapshot = potRecipients;
    setPotRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r)),
    );
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-recipient", id, enabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update recipient");
      }
    } catch (e) {
      // Roll back the optimistic change and re-sync from server.
      setPotRecipients(prevSnapshot);
      toast.error(e instanceof Error ? e.message : "Failed to update recipient");
      void fetchPotSettings();
    }
  };

  const saveSchedule = async (next: PotSchedule) => {
    const prevSnapshot = potSchedule;
    setPotSchedule(next);
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-schedule",
          enabled: next.enabled,
          frequency: next.frequency,
          sendHourUtc: next.send_hour_utc,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save schedule");
      }
    } catch (e) {
      setPotSchedule(prevSnapshot);
      toast.error(e instanceof Error ? e.message : "Failed to save schedule");
      void fetchPotSettings();
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
      // Provider filter: encoded as "provider:<id>" (filter client-side
      // by p.provider.id) or "delegate:<delegationId>" (filter server-side
      // by submitted_by_delegation_id so the report itself is narrower).
      const providerSelectionId = selectedProvider.startsWith("provider:")
        ? selectedProvider.slice("provider:".length)
        : null;
      const delegateSelectionId = selectedProvider.startsWith("delegate:")
        ? selectedProvider.slice("delegate:".length)
        : null;
      if (delegateSelectionId)
        params.append("delegationId", delegateSelectionId);

      const response = await fetch(`/api/admin/pharmacy-reports?${params.toString()}`);

      const data = await response.json();

      if (response.ok) {
        let filteredReports = data.report || [];

        if (providerSelectionId) {
          filteredReports = filteredReports.map((report: PharmacyReport) => ({
            ...report,
            providers: (report.providers || []).filter(
              (p) => p.provider.id === providerSelectionId
            ),
          })).filter((report: PharmacyReport) => (report.providers || []).length > 0);
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
    fetchPotSettings();
  }, [fetchPotSettings]);

  useEffect(() => {
    if (emailDialogOpen) fetchPotSettings();
  }, [emailDialogOpen, fetchPotSettings]);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPharmacy, selectedProvider, startDate, endDate]);

  // ---- Accounting & Refunds: fetch + actions ----
  const fetchRefunds = useCallback(async () => {
    setRefundsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", new Date(startDate).toISOString());
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        params.append("endDate", e.toISOString());
      }
      if (selectedPharmacy !== "all") params.append("pharmacyId", selectedPharmacy);
      // Mirror the main report's provider/delegation filter so this tab's
      // numbers are scoped the same way as the rest of the page.
      if (selectedProvider.startsWith("provider:")) {
        params.append("providerId", selectedProvider.slice("provider:".length));
      } else if (selectedProvider.startsWith("delegate:")) {
        params.append("delegationId", selectedProvider.slice("delegate:".length));
      }
      params.append("statusFilter", refundStatusFilter);
      params.append("showResolved", String(showResolvedRefunds));
      const res = await fetch(`/api/admin/pharmacy-reports/refunds?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to fetch refunds");
        return;
      }
      setRefundReports(data.reports || []);
      setRefundSummary(data.summary || {
        totalRejectedCents: 0, totalCancelledCents: 0, totalOwedCents: 0, totalIssuedCents: 0,
        totalNotApplicable: 0, cardOwedCents: 0, potOwedCents: 0,
      });
    } catch (e) {
      console.error("Error fetching refunds:", e);
      toast.error(`Failed to fetch refunds: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRefundsLoading(false);
    }
  }, [startDate, endDate, selectedPharmacy, selectedProvider, refundStatusFilter, showResolvedRefunds]);

  useEffect(() => {
    if (activeTab === "refunds") {
      fetchRefunds();
    }
  }, [activeTab, fetchRefunds]);

  const openMarkIssuedDialog = (items: MarkIssuedItem[], label: string) => {
    if (items.length === 0) return;
    setMarkIssuedTarget({ items, label });
    setMarkIssuedNote("");
    setMarkIssuedRefundedAt("");
    // Pre-fill the amount field for single-row actions so the admin can
    // tweak it; bulk actions leave it blank and use each row's stored amount.
    setMarkIssuedAmount(items.length === 1 ? (items[0].defaultAmountCents / 100).toFixed(2) : "");
    setMarkIssuedDialogOpen(true);
  };

  const submitMarkIssued = async () => {
    if (!markIssuedTarget) return;
    const isSingle = markIssuedTarget.items.length === 1;

    let overrideAmountCents: number | null = null;
    if (isSingle) {
      const v = markIssuedAmount.trim();
      if (!v) {
        toast.error("Refund amount is required");
        return;
      }
      const parsed = Number(v);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Refund amount must be a non-negative number");
        return;
      }
      overrideAmountCents = Math.round(parsed * 100);
    }

    let refundedAtIso: string | undefined;
    if (markIssuedRefundedAt.trim()) {
      const d = new Date(markIssuedRefundedAt + "T12:00:00");
      if (Number.isNaN(d.getTime())) {
        toast.error("Refunded-at must be a valid date");
        return;
      }
      refundedAtIso = d.toISOString();
    }

    setMarkIssuedSubmitting(true);
    let issuedCount = 0;
    let totalCents = 0;
    let firstError: string | null = null;
    try {
      for (const item of markIssuedTarget.items) {
        const amountCents = overrideAmountCents ?? item.defaultAmountCents;
        const res = await fetch("/api/admin/pharmacy-reports/refunds/mark-issued", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prescriptionId: item.prescriptionId,
            refundAmountCents: amountCents,
            note: markIssuedNote || undefined,
            refundedAt: refundedAtIso,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!firstError) firstError = data.error || `Failed for ${item.prescriptionId}`;
          continue;
        }
        if (!data.alreadyIssued) {
          issuedCount += 1;
          totalCents += amountCents;
        }
        if (data.partial && data.txnMirror && !data.txnMirror.ok) {
          toast.warning(
            `Refund saved, but card transaction mirror did not update for ${item.prescriptionId.slice(0, 8)}. Please follow up.`,
          );
        }
      }
      if (firstError) {
        toast.error(firstError);
      } else {
        toast.success(
          `Marked ${issuedCount} refund${issuedCount === 1 ? "" : "s"} issued ($${(totalCents / 100).toFixed(2)})`,
        );
      }
      setMarkIssuedDialogOpen(false);
      setMarkIssuedTarget(null);
      await fetchRefunds();
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setMarkIssuedSubmitting(false);
    }
  };

  const downloadRefundsCsv = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", new Date(startDate).toISOString());
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      params.append("endDate", e.toISOString());
    }
    if (selectedPharmacy !== "all") params.append("pharmacyId", selectedPharmacy);
    if (selectedProvider.startsWith("provider:")) {
      params.append("providerId", selectedProvider.slice("provider:".length));
    } else if (selectedProvider.startsWith("delegate:")) {
      params.append("delegationId", selectedProvider.slice("delegate:".length));
    }
    params.append("statusFilter", refundStatusFilter);
    // Pass the same showResolved gate the on-screen list uses so the CSV
    // matches what the admin sees row-for-row.
    params.append("showResolved", String(showResolvedRefunds));
    window.location.href = `/api/admin/pharmacy-reports/refunds/export?${params.toString()}`;
  };

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

      const totalOrders = providers.reduce((s, p) => s + (p.orders || []).length, 0);
      const totalAmount = providers.reduce((s, p) => s + (p.orders || []).reduce((os, o) => os + o.price, 0), 0);

      return { ...report, providers, totalOrders, totalAmount };
    })
    .filter((report) => (report.providers || []).length > 0);

  // Pay-on-Terms derived data: only providers who are currently on terms,
  // and only orders that are themselves on-terms (i.e. were not actually
  // charged on a card — the API tags each order with payOnTerms accordingly).
  // By default also only show orders that are still unsettled.
  const payOnTermsReports = filteredReports
    .map((report) => {
      const providers = (report.providers || [])
        .map((p) => {
          if (!p.provider.payOnTerms) return null;
          const orders = (p.orders || []).filter(
            (o) =>
              o.payOnTerms === true &&
              (showSettled ? true : !o.payOnTermsSettledAt),
          );
          if (orders.length === 0) return null;
          const totalCents = orders.reduce((s, o) => s + (o.payOnTermsAmountCents || 0), 0);
          const unsettledCents = orders
            .filter((o) => !o.payOnTermsSettledAt)
            .reduce((s, o) => s + (o.payOnTermsAmountCents || 0), 0);
          return { ...p, orders, payOnTermsTotalCents: totalCents, payOnTermsOwedCents: unsettledCents };
        })
        .filter((p): p is Provider & { payOnTermsTotalCents: number; payOnTermsOwedCents: number } => p !== null);
      return { ...report, providers };
    })
    .filter((r) => r.providers.length > 0);

  const totalOwedCents = payOnTermsReports.reduce(
    (s, r) => s + r.providers.reduce((ss, p) => ss + p.payOnTermsOwedCents, 0),
    0,
  );
  const totalOwedRxCount = payOnTermsReports.reduce(
    (s, r) => s + r.providers.reduce((ss, p) => ss + p.orders.filter((o) => !o.payOnTermsSettledAt).length, 0),
    0,
  );
  // Total rows in the current Pay-on-Terms view, regardless of settled
  // state. Used to gate the Email Report button so it stays enabled
  // whenever there is something visible to "print" — including when the
  // admin toggles "Show settled" ON to email a settled-only summary.
  const totalVisibleRxCount = payOnTermsReports.reduce(
    (s, r) => s + r.providers.reduce((ss, p) => ss + p.orders.length, 0),
    0,
  );
  // Settled-only totals so the hero card can show what the user just
  // marked paid (otherwise the card stays at "Total Owed = $0" with no
  // visible feedback that the settle action worked).
  const totalSettledCents = payOnTermsReports.reduce(
    (s, r) =>
      s +
      r.providers.reduce(
        (ss, p) =>
          ss +
          p.orders
            .filter((o) => !!o.payOnTermsSettledAt)
            .reduce((acc, o) => acc + (o.payOnTermsAmountCents || 0), 0),
        0,
      ),
    0,
  );
  const totalSettledRxCount = payOnTermsReports.reduce(
    (s, r) =>
      s + r.providers.reduce((ss, p) => ss + p.orders.filter((o) => !!o.payOnTermsSettledAt).length, 0),
    0,
  );
  const totalOnTermsProviderCount = (() => {
    const ids = new Set<string>();
    for (const r of payOnTermsReports) {
      for (const p of r.providers) {
        if (p.provider.id) ids.add(p.provider.id);
      }
    }
    return ids.size;
  })();

  const handleSendPayOnTermsEmail = async () => {
    if (!emailFromYmd || !emailToYmd) {
      toast.error("Please choose a reporting period first.");
      return;
    }
    if (emailFromYmd > emailToYmd) {
      toast.error("From date must be on or before To date.");
      return;
    }
    setEmailSending(true);
    try {
      const filtersBody: Record<string, string> = {};
      if (selectedPharmacy !== "all") filtersBody.pharmacyId = selectedPharmacy;
      // Mirror EVERY on-screen filter so the emailed report is row-for-row
      // identical to what the admin sees on the tab — supervising
      // provider, assistant/delegate, group, platform manager, and the
      // free-text search box.
      if (selectedProvider.startsWith("provider:"))
        filtersBody.providerId = selectedProvider.slice("provider:".length);
      if (selectedProvider.startsWith("delegate:"))
        filtersBody.delegationId = selectedProvider.slice("delegate:".length);
      if (selectedGroup !== "all") filtersBody.groupId = selectedGroup;
      if (selectedPlatformManager !== "all")
        filtersBody.platformManagerId = selectedPlatformManager;
      if (searchTerm.trim()) filtersBody.searchTerm = searchTerm.trim();
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // No recipients in body → server uses the saved DB recipient list.
          window: { fromYmd: emailFromYmd, toYmd: emailToYmd },
          filters: filtersBody,
          // Mirror the on-screen "Show settled" toggle so the emailed
          // report matches what the admin currently sees on the tab.
          includeSettled: showSettled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }
      if (data.sent) {
        const periodLabel = data.window?.shortLabel || "selected period";
        if (data.rxCount === 0) {
          toast.success(
            `Report sent to ${(data.recipients || []).join(", ")} — ${periodLabel} (no Rx in this period)`,
          );
        } else {
          toast.success(
            `Report sent to ${(data.recipients || []).join(", ")} — ${periodLabel} · $${(data.totalCents / 100).toFixed(2)} across ${data.providerCount} provider${data.providerCount === 1 ? "" : "s"}`,
          );
        }
      } else {
        toast.info(data.reason || "No data to send");
      }
      setEmailDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  const handleMarkProviderSettled = async (
    providerId: string,
    providerName: string,
    prescriptionIds: string[],
  ) => {
    if (prescriptionIds.length === 0) return;
    if (
      !window.confirm(
        `Mark ${prescriptionIds.length} prescription${prescriptionIds.length === 1 ? "" : "s"} for ${providerName} as settled? This means you've collected payment outside the platform.`,
      )
    ) {
      return;
    }
    setSettling(providerId);
    try {
      const res = await fetch("/api/admin/pharmacy-reports/pay-on-terms-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark settled");
      }
      toast.success(`Marked ${data.settled} prescription${data.settled === 1 ? "" : "s"} settled for ${providerName}`);
      fetchReports();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark settled");
    } finally {
      setSettling(null);
    }
  };

  // Properly escape a single CSV field per RFC 4180: wrap in quotes, double
  // any internal quotes. Without this, a comma in a med name or patient name
  // shifts every following column by one.
  const csvField = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };

  const exportToCSV = () => {
    const csvRows: string[] = [];
    const todayYmd = new Date().toISOString().split("T")[0];

    // Period suffix for the filename so multiple exports are
    // distinguishable on disk.
    let periodSuffix = "";
    if (startDate && endDate) {
      periodSuffix = `_${startDate}_to_${endDate}`;
    } else if (startDate) {
      periodSuffix = `_from_${startDate}`;
    } else if (endDate) {
      periodSuffix = `_until_${endDate}`;
    }

    let filename: string;
    let exportedRowCount = 0;

    if (activeTab === "payment-on-terms") {
      // Export ONLY what the Payment on Terms tab is currently showing:
      // on-terms providers, on-terms orders, honoring the "Show settled"
      // toggle, the page filters, and the date range. Adds POT-specific
      // columns (Owed Amount, Settlement Status, Settled Date).
      csvRows.push(
        [
          "Pharmacy",
          "Provider",
          "Provider Email",
          "Group",
          "Platform Manager",
          "Patient",
          "Medication",
          "Quantity",
          "Refills",
          "Submitted Date",
          "List Price",
          "Tier",
          "Tier Discount %",
          "Tier Discount $",
          "Net Med Price",
          "Provider Fee",
          "Shipping",
          "Total Charged",
          "Owed Amount",
          "Settlement Status",
          "Settled Date",
        ]
          .map(csvField)
          .join(","),
      );

      payOnTermsReports.forEach((report) => {
        report.providers.forEach((providerData) => {
          const group = groups.find((g) => g.id === providerData.provider.group_id);
          providerData.orders.forEach((order) => {
            const owedDollars = (order.payOnTermsAmountCents || 0) / 100;
            const status = order.payOnTermsSettledAt ? "Settled" : "Outstanding";
            const settledDate = order.payOnTermsSettledAt
              ? new Date(order.payOnTermsSettledAt).toLocaleDateString()
              : "";
            // Use the canonical breakdown cents from the API so list -
            // discount = net always ties out. Fall back to legacy fields
            // only for pre-deploy rows that don't carry the new fields.
            const listD = (order.listPriceCents || 0) / 100;
            const tierPct = order.tierDiscountPct || 0;
            const discD = (order.tierDiscountCents || 0) / 100;
            const netMedD =
              order.netMedCents !== undefined
                ? order.netMedCents / 100
                : order.medicationPrice || 0;
            const feeD =
              order.providerFeeCents !== undefined
                ? order.providerFeeCents / 100
                : order.providerFees || 0;
            const shipD = (order.shippingCents || 0) / 100;
            const totalD =
              (order.totalChargedCents || 0) / 100 || netMedD + feeD + shipD;
            csvRows.push(
              [
                report.pharmacy.name,
                providerData.provider.name,
                providerData.provider.email,
                group?.name || "",
                group?.platform_manager_name || "",
                order.patient,
                order.medication,
                order.quantity,
                order.refills,
                new Date(order.date).toLocaleDateString(),
                `$${listD.toFixed(2)}`,
                order.tierName || "",
                tierPct ? `${tierPct}%` : "",
                `$${discD.toFixed(2)}`,
                `$${netMedD.toFixed(2)}`,
                `$${feeD.toFixed(2)}`,
                `$${shipD.toFixed(2)}`,
                `$${totalD.toFixed(2)}`,
                `$${owedDollars.toFixed(2)}`,
                status,
                settledDate,
              ]
                .map(csvField)
                .join(","),
            );
            exportedRowCount++;
          });
        });
      });

      const settledTag = showSettled ? "all" : "outstanding";
      filename = `pay-on-terms-${settledTag}${periodSuffix}_${todayYmd}.csv`;
    } else {
      // Overview / Details tabs: export the full page-filtered list.
      csvRows.push(
        [
          "Pharmacy",
          "Provider",
          "Provider Email",
          "Group",
          "Platform Manager",
          "Patient",
          "Medication",
          "Quantity",
          "Refills",
          "Date",
          "List Price",
          "Tier",
          "Tier Discount %",
          "Tier Discount $",
          "Net Med Price",
          "Provider Fee",
          "Shipping",
          "Total Charged",
          "Status",
        ]
          .map(csvField)
          .join(","),
      );

      filteredReports.forEach((report) => {
        report.providers.forEach((providerData) => {
          const group = groups.find((g) => g.id === providerData.provider.group_id);
          providerData.orders.forEach((order) => {
            // Same canonical-cents rule as Pay-on-Terms CSV above.
            const listD = (order.listPriceCents || 0) / 100;
            const tierPct = order.tierDiscountPct || 0;
            const discD = (order.tierDiscountCents || 0) / 100;
            const netMedD =
              order.netMedCents !== undefined
                ? order.netMedCents / 100
                : order.medicationPrice || 0;
            const feeD =
              order.providerFeeCents !== undefined
                ? order.providerFeeCents / 100
                : order.providerFees || 0;
            const shipD = (order.shippingCents || 0) / 100;
            const totalD =
              (order.totalChargedCents || 0) / 100 || netMedD + feeD + shipD;
            csvRows.push(
              [
                report.pharmacy.name,
                providerData.provider.name,
                providerData.provider.email,
                group?.name || "",
                group?.platform_manager_name || "",
                order.patient,
                order.medication,
                order.quantity,
                order.refills,
                new Date(order.date).toLocaleDateString(),
                `$${listD.toFixed(2)}`,
                order.tierName || "",
                tierPct ? `${tierPct}%` : "",
                `$${discD.toFixed(2)}`,
                `$${netMedD.toFixed(2)}`,
                `$${feeD.toFixed(2)}`,
                `$${shipD.toFixed(2)}`,
                `$${totalD.toFixed(2)}`,
                order.status,
              ]
                .map(csvField)
                .join(","),
            );
            exportedRowCount++;
          });
        });
      });

      filename = `pharmacy-reports${periodSuffix}_${todayYmd}.csv`;
    }

    if (exportedRowCount === 0) {
      toast.info("Nothing to export — current view has no rows.");
      return;
    }

    // Prepend BOM so Excel opens UTF-8 cleanly (handles é, ñ, etc.).
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(
      `Exported ${exportedRowCount} row${exportedRowCount === 1 ? "" : "s"} → ${filename}`,
    );
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
              <button
                onClick={() => setActiveTab("payment-on-terms")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === "payment-on-terms"
                    ? "bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white shadow-md shadow-blue-200/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                data-testid="button-tab-payment-on-terms"
              >
                <DollarSign className="h-4 w-4" />
                Payment on Terms
              </button>
              {/* Accounting & Refunds tab — hidden per Joseph (May 2026).
                  All state, fetchers, and panel JSX remain in place so we
                  can re-enable by removing this `false &&` gate. Do NOT
                  delete the underlying code without an explicit ask. */}
              {false && (
                <button
                  onClick={() => setActiveTab("refunds")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === "refunds"
                      ? "bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white shadow-md shadow-blue-200/50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                  data-testid="button-tab-refunds"
                >
                  <Receipt className="h-4 w-4" />
                  Accounting & Refunds
                </button>
              )}
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

                {viewMode === "by-provider" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="provider" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger id="provider" className="bg-white" data-testid="select-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {/* Real providers first, sorted by name. */}
                        {providers
                          .filter((p) => !p.isDelegate)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((provider) => (
                            <SelectItem
                              key={`provider:${provider.id}`}
                              value={`provider:${provider.id}`}
                              data-testid={`select-item-provider-${provider.id}`}
                            >
                              {provider.name} ({provider.email})
                            </SelectItem>
                          ))}
                        {/* Assistants (delegates) appear below, each
                            labeled with the supervising provider so the
                            admin can tell them apart at a glance. */}
                        {providers.some((p) => p.isDelegate) && (
                          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-t border-gray-100 mt-1 pt-2">
                            Provider Assistants
                          </div>
                        )}
                        {providers
                          .filter((p) => p.isDelegate && p.delegationId)
                          .sort((a, b) => {
                            const sa = a.supervisingProviderName || "";
                            const sb = b.supervisingProviderName || "";
                            if (sa !== sb) return sa.localeCompare(sb);
                            return a.name.localeCompare(b.name);
                          })
                          .map((delegate) => (
                            <SelectItem
                              key={`delegate:${delegate.delegationId}`}
                              value={`delegate:${delegate.delegationId}`}
                              data-testid={`select-item-delegate-${delegate.delegationId}`}
                            >
                              {delegate.name} (Assistant of{" "}
                              {delegate.supervisingProviderName || "Unknown"})
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

          {activeTab === "payment-on-terms" && (
            <div className="space-y-6" data-testid="tab-payment-on-terms-content">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" data-testid="text-pay-on-terms-title">Payment on Terms</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Prescriptions submitted by providers on terms billing — collect outside the platform, then mark settled.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" data-testid="label-show-settled">
                    <Checkbox
                      checked={showSettled}
                      onCheckedChange={(v) => setShowSettled(!!v)}
                      data-testid="checkbox-show-settled"
                    />
                    Show settled
                  </label>
                  <Button
                    onClick={() => {
                      setEmailDialogOpen(true);
                    }}
                    // Enabled whenever there are visible rows in the
                    // current view — print/email what's on screen,
                    // including settled-only views after marking paid.
                    disabled={isLoading || totalVisibleRxCount === 0}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md shadow-emerald-200/50"
                    data-testid="button-email-pay-on-terms"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email Report
                  </Button>
                </div>
              </div>

              {/* Hero summary card — when "Show settled" is OFF (default)
                  this is the unsettled balance owed. When ON we ALSO
                  surface a Total Settled tile so the admin can confirm
                  the rows they just marked paid are reflected, and so
                  the Email Report button has something meaningful to
                  send to the accountant. */}
              <div
                className={`grid gap-4 ${showSettled ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
                data-testid="card-pay-on-terms-summary"
              >
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50/80 to-white">
                  <CardContent className="pt-5 pb-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Owed (Unsettled)</p>
                        <p className="text-3xl font-bold text-emerald-700" data-testid="text-total-owed-pay-on-terms">
                          ${(totalOwedCents / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {totalOwedRxCount} prescription{totalOwedRxCount === 1 ? "" : "s"} across {totalOnTermsProviderCount} provider{totalOnTermsProviderCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {showSettled && (
                  <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50/80 to-white">
                    <CardContent className="pt-5 pb-5 px-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-blue-700" />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Settled (in view)</p>
                          <p className="text-3xl font-bold text-blue-700" data-testid="text-total-settled-pay-on-terms">
                            ${(totalSettledCents / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {totalSettledRxCount} prescription{totalSettledRxCount === 1 ? "" : "s"} marked paid in this period
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {isLoading ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-[#1E3A8A]" />
                    <p className="font-medium">Loading reports...</p>
                  </CardContent>
                </Card>
              ) : payOnTermsReports.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200" data-testid="card-empty-pay-on-terms">
                  <CardContent className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">
                      {showSettled ? "No pay-on-terms prescriptions in this view" : "All caught up — nothing owed"}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {showSettled
                        ? "Try widening the date filter."
                        : 'Toggle "Show settled" to see historical settlements, or check back later.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                payOnTermsReports.map((report) => (
                  <Card key={report.pharmacy.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-pot-pharmacy-${report.pharmacy.id}`}>
                    <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50/60 to-white border-b border-emerald-100/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-sm">{report.pharmacy.name.charAt(0)}</span>
                          </div>
                          <div>
                            <CardTitle className="text-lg text-gray-900">{report.pharmacy.name}</CardTitle>
                            <p className="text-sm text-gray-400 mt-0.5">
                              <span className="font-semibold text-gray-600">{report.providers.length}</span> provider{report.providers.length === 1 ? "" : "s"} on terms
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {report.providers.map((providerData) => {
                        const unsettledIds = providerData.orders
                          .filter((o) => !o.payOnTermsSettledAt)
                          .map((o) => o.id);
                        const isSettlingThis = settling === providerData.provider.id;
                        return (
                          <div key={providerData.provider.id} className="mb-8 last:mb-0" data-testid={`section-pot-provider-${providerData.provider.id}`}>
                            <div className="bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-transparent border border-emerald-100/60 p-4 rounded-xl mb-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
                                    <Users className="h-4 w-4 text-emerald-700" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-base text-gray-900" data-testid={`text-pot-provider-name-${providerData.provider.id}`}>
                                      {providerData.provider.name}
                                    </h3>
                                    <p className="text-xs text-gray-400">{providerData.provider.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200" data-testid={`text-pot-owed-${providerData.provider.id}`}>
                                    <DollarSign className="h-3 w-3" />
                                    ${(providerData.payOnTermsOwedCents / 100).toFixed(2)} owed
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isSettlingThis || unsettledIds.length === 0}
                                    onClick={() =>
                                      handleMarkProviderSettled(
                                        providerData.provider.id,
                                        providerData.provider.name,
                                        unsettledIds,
                                      )
                                    }
                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    data-testid={`button-mark-settled-${providerData.provider.id}`}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    {isSettlingThis ? "Marking..." : `Mark ${unsettledIds.length} Settled`}
                                  </Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-3 ml-11">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200/50">
                                  <ShoppingCart className="h-3 w-3" />
                                  {providerData.orders.length} rx ({unsettledIds.length} unsettled)
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
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Submitted by</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Amount Owed</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Settled</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {providerData.orders.map((order, idx) => (
                                    <TableRow key={order.id} className={`transition-colors hover:bg-emerald-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`} data-testid={`row-pot-order-${order.id}`}>
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
                                      <TableCell className="text-sm" data-testid={`text-pot-submittedby-${order.id}`}>
                                        {order.submittedBy ? (
                                          <span
                                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md"
                                            title={order.submittedBy.email}
                                          >
                                            {order.submittedBy.name}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">Provider</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap text-sm font-bold text-emerald-700 text-right" data-testid={`text-pot-amount-${order.id}`}>
                                        ${((order.payOnTermsAmountCents || 0) / 100).toFixed(2)}
                                      </TableCell>
                                      <TableCell>
                                        {order.payOnTermsSettledAt ? (
                                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {new Date(order.payOnTermsSettledAt).toLocaleDateString()}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                            <AlertCircle className="h-3 w-3" />
                                            Owed
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <StatusBadge status={order.status} />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="space-y-6" data-testid="tab-refunds-content">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900" data-testid="text-refunds-title">Accounting &amp; Refunds</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Rejected and cancelled prescriptions where money is owed back to a patient (card refund) or
                    credited back to a provider on terms. Mark each refund issued once accounting has processed it.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={refundStatusFilter}
                    onValueChange={(v) => setRefundStatusFilter(v as typeof refundStatusFilter)}
                  >
                    <SelectTrigger className="w-[180px] bg-white" data-testid="select-refund-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owed">Owed only</SelectItem>
                      <SelectItem value="issued">Issued only</SelectItem>
                      <SelectItem value="not_applicable">No refund needed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <Checkbox
                      checked={showResolvedRefunds}
                      onCheckedChange={(v) => setShowResolvedRefunds(!!v)}
                      data-testid="checkbox-show-resolved-refunds"
                    />
                    Show resolved
                  </label>
                  <Button
                    variant="outline"
                    onClick={fetchRefunds}
                    disabled={refundsLoading}
                    className="border-gray-200"
                    data-testid="button-refresh-refunds"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${refundsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadRefundsCsv}
                    className="border-gray-200"
                    data-testid="button-export-refunds-csv"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-rose-50/80 to-white" data-testid="card-refund-total-rejected">
                  <CardContent className="pt-5 pb-5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-rose-700" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Rejected</p>
                        <p className="text-2xl font-bold text-rose-700" data-testid="text-refund-total-rejected">
                          ${(refundSummary.totalRejectedCents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50/80 to-white" data-testid="card-refund-total-owed">
                  <CardContent className="pt-5 pb-5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Refunds Owed</p>
                        <p className="text-2xl font-bold text-amber-700" data-testid="text-refund-total-owed">
                          ${(refundSummary.totalOwedCents / 100).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          ${(refundSummary.cardOwedCents / 100).toFixed(2)} card • ${(refundSummary.potOwedCents / 100).toFixed(2)} POT
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50/80 to-white" data-testid="card-refund-issued">
                  <CardContent className="pt-5 pb-5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Refunds Issued</p>
                        <p className="text-2xl font-bold text-emerald-700" data-testid="text-refund-total-issued">
                          ${(refundSummary.totalIssuedCents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50/80 to-white" data-testid="card-refund-cancelled">
                  <CardContent className="pt-5 pb-5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cancelled</p>
                        <p className="text-2xl font-bold text-slate-700" data-testid="text-refund-total-cancelled">
                          ${(refundSummary.totalCancelledCents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {refundsLoading ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="p-12 text-center text-gray-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-[#1E3A8A]" />
                    <p className="font-medium">Loading refunds...</p>
                  </CardContent>
                </Card>
              ) : refundReports.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200" data-testid="card-empty-refunds">
                  <CardContent className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">
                      {refundStatusFilter === "owed" && !showResolvedRefunds
                        ? "All caught up — no refunds owed"
                        : "No refunds match these filters"}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {refundStatusFilter === "owed" && !showResolvedRefunds
                        ? 'Toggle "Show resolved" or change the status filter to see history.'
                        : "Try widening the date range or changing the status filter."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                refundReports.map((report) => (
                  <Card key={report.pharmacy.id} className="border-0 shadow-md overflow-hidden" data-testid={`card-refunds-pharmacy-${report.pharmacy.id}`}>
                    <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/60 to-white border-b border-amber-100/40">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-sm">{report.pharmacy.name.charAt(0)}</span>
                          </div>
                          <div>
                            <CardTitle className="text-lg text-gray-900">{report.pharmacy.name}</CardTitle>
                            <p className="text-sm text-gray-400 mt-0.5">
                              <span className="font-semibold text-amber-700">${(report.owedCents / 100).toFixed(2)}</span> owed
                              <span className="mx-2 text-gray-300">|</span>
                              <span className="font-semibold text-emerald-700">${(report.issuedCents / 100).toFixed(2)}</span> issued
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {report.providers.map((providerData) => {
                        const owedItems: MarkIssuedItem[] = providerData.orders
                          .filter((o) => o.refund.status === "owed" && o.refund.id)
                          .map((o) => ({ prescriptionId: o.id, defaultAmountCents: o.refund.amountCents }));
                        return (
                          <div key={providerData.provider.id} className="mb-8 last:mb-0" data-testid={`section-refunds-provider-${providerData.provider.id}`}>
                            <div className="bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-transparent border border-amber-100/60 p-4 rounded-xl mb-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-amber-600/10 flex items-center justify-center flex-shrink-0">
                                    <Users className="h-4 w-4 text-amber-700" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-base text-gray-900">{providerData.provider.name}</h3>
                                    <p className="text-xs text-gray-400">{providerData.provider.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-white px-3 py-1.5 rounded-lg border border-amber-200">
                                    <DollarSign className="h-3 w-3" />
                                    ${(providerData.owedCents / 100).toFixed(2)} owed ({providerData.owedCount})
                                  </span>
                                  {providerData.issuedCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                                      <CheckCircle2 className="h-3 w-3" />
                                      ${(providerData.issuedCents / 100).toFixed(2)} issued ({providerData.issuedCount})
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={owedItems.length === 0}
                                    onClick={() =>
                                      openMarkIssuedDialog(
                                        owedItems,
                                        `all ${owedItems.length} owed refund${owedItems.length === 1 ? "" : "s"} for ${providerData.provider.name}`,
                                      )
                                    }
                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    data-testid={`button-mark-all-issued-${providerData.provider.id}`}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    Mark {owedItems.length} Issued
                                  </Button>
                                </div>
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
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rx Status</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Method</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Refund Amt</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Refund Status</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Issued / Note</TableHead>
                                    <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {providerData.orders.map((order, idx) => {
                                    const methodLabel = order.refund.method === "card"
                                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md"><CreditCard className="h-3 w-3" />Card</span>
                                      : order.refund.method === "pot_credit"
                                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md"><Wallet className="h-3 w-3" />POT Credit</span>
                                      : <span className="text-xs text-gray-400">—</span>;
                                    const statusLabel = order.refund.status === "owed"
                                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"><AlertCircle className="h-3 w-3" />Owed</span>
                                      : order.refund.status === "issued"
                                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md" title={order.refund.issuedAt ? `Issued ${new Date(order.refund.issuedAt).toLocaleString()}${order.refund.issuedBy?.name ? ` by ${order.refund.issuedBy.name}` : ""}` : ""}><CheckCircle2 className="h-3 w-3" />Issued{order.refund.issuedAt ? ` ${new Date(order.refund.issuedAt).toLocaleDateString()}` : ""}</span>
                                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">N/A</span>;
                                    return (
                                      <TableRow key={order.id} className={`transition-colors hover:bg-amber-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`} data-testid={`row-refund-${order.id}`}>
                                        <TableCell className="whitespace-nowrap text-sm text-gray-600">{new Date(order.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-mono text-xs text-gray-400">{order.queue_id || "N/A"}</TableCell>
                                        <TableCell className="text-sm font-medium text-gray-700">{order.patient}</TableCell>
                                        <TableCell className="text-sm text-gray-600">{order.medication}</TableCell>
                                        <TableCell><StatusBadge status={order.status} /></TableCell>
                                        <TableCell>{methodLabel}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm font-bold text-amber-700 text-right" data-testid={`text-refund-amount-${order.id}`}>
                                          ${(order.refund.amountCents / 100).toFixed(2)}
                                        </TableCell>
                                        <TableCell>{statusLabel}</TableCell>
                                        <TableCell className="text-xs text-gray-600 max-w-[260px]" data-testid={`cell-refund-meta-${order.id}`}>
                                          {order.refund.issuedAt ? (
                                            <div className="space-y-0.5">
                                              <div className="font-medium text-gray-700" data-testid={`text-refund-issued-at-${order.id}`}>
                                                {new Date(order.refund.issuedAt).toLocaleString()}
                                              </div>
                                              {order.refund.issuedBy?.name && (
                                                <div className="text-[11px] text-gray-400">by {order.refund.issuedBy.name}</div>
                                              )}
                                              {order.refund.note && (
                                                <div className="text-[11px] text-gray-500 italic break-words" title={order.refund.note} data-testid={`text-refund-note-${order.id}`}>
                                                  &ldquo;{order.refund.note}&rdquo;
                                                </div>
                                              )}
                                            </div>
                                          ) : order.refund.note ? (
                                            <div className="text-[11px] text-gray-500 italic break-words" title={order.refund.note} data-testid={`text-refund-note-${order.id}`}>
                                              &ldquo;{order.refund.note}&rdquo;
                                            </div>
                                          ) : (
                                            <span className="text-gray-300">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {order.refund.status === "owed" && order.refund.id ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                openMarkIssuedDialog(
                                                  [{ prescriptionId: order.id, defaultAmountCents: order.refund.amountCents }],
                                                  `refund of $${(order.refund.amountCents / 100).toFixed(2)} for ${order.patient} (${order.medication})`,
                                                )
                                              }
                                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                              data-testid={`button-mark-issued-${order.id}`}
                                            >
                                              Mark Issued
                                            </Button>
                                          ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}

              <Dialog open={markIssuedDialogOpen} onOpenChange={setMarkIssuedDialogOpen}>
                <DialogContent data-testid="dialog-mark-issued">
                  <DialogHeader>
                    <DialogTitle>Mark refund issued</DialogTitle>
                    <DialogDescription>
                      You are confirming that accounting has issued {markIssuedTarget?.label}. For card-paid orders this
                      also stamps the original card transaction as refunded. This action is logged.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {markIssuedTarget?.items.length === 1 ? (
                      <div className="space-y-2">
                        <Label htmlFor="refund-amount" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Refund amount (USD)
                        </Label>
                        <Input
                          id="refund-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={markIssuedAmount}
                          onChange={(e) => setMarkIssuedAmount(e.target.value)}
                          placeholder="0.00"
                          data-testid="input-refund-amount"
                        />
                        <p className="text-[11px] text-gray-500">
                          Pre-filled from the original charge. Edit if accounting issued a partial refund.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
                        Bulk action — each row will be marked issued for its original charged amount.
                        Use the per-row button to override an individual amount.
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="refund-date" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Refunded at (optional)
                      </Label>
                      <Input
                        id="refund-date"
                        type="date"
                        value={markIssuedRefundedAt}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setMarkIssuedRefundedAt(e.target.value)}
                        data-testid="input-refund-date"
                      />
                      <p className="text-[11px] text-gray-500">
                        Leave blank to use today. Use this to back-date a refund accounting already issued.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="refund-note" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Note (optional)
                      </Label>
                      <Input
                        id="refund-note"
                        value={markIssuedNote}
                        onChange={(e) => setMarkIssuedNote(e.target.value)}
                        placeholder="e.g. Refunded via AuthNet, Ref #12345"
                        maxLength={500}
                        data-testid="input-refund-note"
                      />
                      <p className="text-[11px] text-gray-500">
                        Do not include patient PHI (diagnoses, SSN, etc). Notes are written to the audit log.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setMarkIssuedDialogOpen(false)}
                      disabled={markIssuedSubmitting}
                      data-testid="button-cancel-mark-issued"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={submitMarkIssued}
                      disabled={markIssuedSubmitting}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
                      data-testid="button-confirm-mark-issued"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {markIssuedSubmitting ? "Marking..." : "Confirm Issued"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                                <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Submitted by</TableHead>
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
                                  <TableCell className="text-sm" data-testid={`text-submittedby-${order.id}`}>
                                    {order.submittedBy ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md"
                                        title={order.submittedBy.email}
                                      >
                                        {order.submittedBy.name}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Provider</span>
                                    )}
                                  </TableCell>
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
                                  <TableHead className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Submitted by</TableHead>
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
                                    <TableCell className="text-sm" data-testid={`text-submittedby-${order.id}`}>
                                      {order.submittedBy ? (
                                        <span
                                          className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-md"
                                          title={order.submittedBy.email}
                                        >
                                          {order.submittedBy.name}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">Provider</span>
                                      )}
                                    </TableCell>
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

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent data-testid="dialog-email-pay-on-terms">
          <DialogHeader>
            <DialogTitle>Email Pay-on-Terms Report</DialogTitle>
            <DialogDescription>
              Send a reconciliation report for prescriptions submitted within the
              date range you choose below. Each row shows whether it&apos;s still
              outstanding or has been settled / paid by card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Reporting period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reporting period
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: "today", label: "Today" },
                  { key: "yesterday", label: "Yesterday" },
                  { key: "last7", label: "Last 7 days" },
                  { key: "lastweek", label: "Last week (Mon–Sun)" },
                  { key: "lastmonth", label: "Last month" },
                  { key: "custom", label: "Custom" },
                ] as { key: typeof emailPreset; label: string }[]).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                      emailPreset === p.key
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    data-testid={`button-preset-${p.key}`}
                    aria-pressed={emailPreset === p.key}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <Label className="text-[11px] text-gray-500" htmlFor="email-from-date">
                    From
                  </Label>
                  <Input
                    id="email-from-date"
                    type="date"
                    value={emailFromYmd}
                    onChange={(e) => {
                      setEmailFromYmd(e.target.value);
                      setEmailPreset("custom");
                    }}
                    className="h-8 text-xs"
                    data-testid="input-email-from-date"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-gray-500" htmlFor="email-to-date">
                    To (inclusive)
                  </Label>
                  <Input
                    id="email-to-date"
                    type="date"
                    value={emailToYmd}
                    onChange={(e) => {
                      setEmailToYmd(e.target.value);
                      setEmailPreset("custom");
                    }}
                    className="h-8 text-xs"
                    data-testid="input-email-to-date"
                  />
                </div>
              </div>
              <div
                className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"
                data-testid="text-resolved-window"
              >
                <p className="text-xs text-blue-900">
                  <strong>Period:</strong>{" "}
                  {emailFromYmd && emailToYmd
                    ? emailFromYmd === emailToYmd
                      ? `${formatYmdLabel(emailFromYmd)} (US Eastern)`
                      : `${formatYmdLabel(emailFromYmd)} → ${formatYmdLabel(emailToYmd)} (US Eastern)`
                    : "—"}
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Includes prescriptions <em>submitted</em> in this window — newly billed only,
                  not the cumulative outstanding balance.
                  {(selectedPharmacy !== "all" || selectedProvider !== "all") && (
                    <>
                      <br />
                      <strong>Note:</strong> the page filter
                      {selectedPharmacy !== "all" && selectedProvider !== "all" ? "s" : ""} above
                      {selectedPharmacy !== "all" ? " (pharmacy)" : ""}
                      {selectedPharmacy !== "all" && selectedProvider !== "all" ? " and" : ""}
                      {selectedProvider.startsWith("provider:") ? " (provider)" : ""}
                      {selectedProvider.startsWith("delegate:")
                        ? " (assistant — note: this email is sent per supervising provider, so the assistant filter is ignored here)"
                        : ""}{" "}
                      will further narrow this report.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Will be sent to
                </Label>
                <span className="text-[11px] text-gray-400" data-testid="text-recipient-count">
                  {potRecipients.filter((r) => r.enabled).length} of {potRecipients.length} active
                </span>
              </div>
              {settingsLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : potRecipients.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  No recipients yet. Add one below — these are the people who&apos;ll get the report.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {potRecipients.map((r) => (
                    <span
                      key={r.id}
                      className={`inline-flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 ${
                        r.enabled
                          ? "bg-blue-50 border-blue-200 text-blue-900"
                          : "bg-gray-100 border-gray-200 text-gray-500 line-through"
                      }`}
                      data-testid={`chip-recipient-${r.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRecipient(r.id, !r.enabled)}
                        title={r.enabled ? "Click name to disable" : "Click name to enable"}
                        className="font-semibold focus:outline-none"
                        data-testid={`button-toggle-recipient-${r.id}`}
                        aria-pressed={r.enabled}
                        aria-label={`${r.enabled ? "Disable" : "Enable"} recipient ${r.name}`}
                      >
                        {r.name}
                      </button>
                      <span className="text-[10px] opacity-70">{r.email}</span>
                      <button
                        type="button"
                        onClick={() => removeRecipient(r.id)}
                        className="ml-1 opacity-50 hover:opacity-100"
                        data-testid={`button-remove-recipient-${r.id}`}
                        title="Remove recipient"
                        aria-label={`Remove recipient ${r.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Name (e.g. Jordan Smith)"
                  value={newRecipName}
                  onChange={(e) => setNewRecipName(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-new-recipient-name"
                />
                <Input
                  placeholder="email@example.com"
                  value={newRecipEmail}
                  onChange={(e) => setNewRecipEmail(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-new-recipient-email"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRecipient}
                  disabled={settingsSaving || !newRecipName.trim() || !newRecipEmail.trim()}
                  data-testid="button-add-recipient"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Schedule */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Auto-send schedule
                </Label>
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <Checkbox
                    checked={potSchedule.enabled}
                    onCheckedChange={(v) =>
                      saveSchedule({ ...potSchedule, enabled: !!v })
                    }
                    data-testid="checkbox-schedule-enabled"
                  />
                  Enabled
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={potSchedule.frequency}
                  onValueChange={(v) =>
                    saveSchedule({ ...potSchedule, frequency: v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-schedule-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly_monday">Weekly (Monday)</SelectItem>
                    <SelectItem value="weekly_friday">Weekly (Friday)</SelectItem>
                    <SelectItem value="monthly_first">Monthly (1st)</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={String(potSchedule.send_hour_utc)}
                  onValueChange={(v) =>
                    saveSchedule({ ...potSchedule, send_hour_utc: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-schedule-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, "0")}:00 UTC
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-gray-400" data-testid="text-last-sent">
                Last auto-send:{" "}
                {potSchedule.last_sent_at
                  ? new Date(potSchedule.last_sent_at).toLocaleString()
                  : "Never"}
                {potSchedule.last_window_end
                  ? ` · last covered through ${new Date(
                      new Date(potSchedule.last_window_end).getTime() - 1,
                    ).toLocaleDateString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })} (US Eastern)`
                  : ""}
                {potSchedule.last_status ? ` · ${potSchedule.last_status}` : ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={emailSending}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendPayOnTermsEmail}
              disabled={emailSending}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700"
              data-testid="button-confirm-send-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              {emailSending ? "Sending..." : "Send Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
