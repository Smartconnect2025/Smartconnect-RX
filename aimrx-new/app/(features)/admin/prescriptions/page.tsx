"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Search, User, Calendar, Pill, Hash, FileText, RefreshCw, AlertCircle,
  Send, Mail, DollarSign, CheckCircle2, Truck, MapPin, Pencil, X,
  ExternalLink, AlertTriangle, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PrescriptionProgressTracker } from "@/app/(features)/prescriptions/_components/PrescriptionProgressTracker";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";

interface AdminPrescription {
  id: string;
  queueId: string;
  submittedAt: string;
  providerName: string;
  patientName: string;
  patientEmail: string | null;
  medication: string;
  strength: string;
  quantity: number;
  refills: number;
  sig: string;
  status: string;
  paymentStatus?: string;
  patientPrice?: number | null;
  shippingFeeCents?: number | null;
  profitCents?: number;
  submissionGroupId?: string | null;
  trackingNumber?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  carrierStatus?: string;
  estimatedDelivery?: string;
  patientId?: string;
  hasCustomAddress?: boolean;
  customAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  patientAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  paymentToken?: string | null;
  paymentTransactionId?: string | null;
  billingStatus?: string;
  patientCopay?: string;
}

const getEffectiveStatus = (rx: AdminPrescription): string => {
  if (rx.status === "submitted" && (!rx.queueId || rx.queueId === "N/A")) {
    return rx.paymentStatus === "paid" ? "payment_received" : "pending_payment";
  }
  return rx.status;
};

const STATUS_OPTIONS = [
  "All",
  "submitted",
  "pending_payment",
  "payment_received",
  "packed",
  "approved",
  "picked_up",
  "shipped",
  "delivered",
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "pending_payment":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "payment_received":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "packed":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "picked_up":
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatDateTime = (dateTime: string) => {
  const date = new Date(dateTime);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { datePart, timePart };
};

const formatAddress = (addr: { street?: string; city?: string; state?: string; zipCode?: string; zip?: string } | null | undefined): string => {
  if (!addr) return "";
  return [addr.street, addr.city, addr.state, addr.zipCode || addr.zip].filter(Boolean).join(", ");
};

const GROUP_BG_COLORS = ["#EFF6FF", "#F5F3FF", "#FFFBEB", "#ECFDF5", "#FFF1F2"];
const GROUP_BORDER_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E"];

const getTrackingUrl = (trackingNumber: string, carrier?: string): string => {
  const c = (carrier || "").toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  return `https://parcelsapp.com/en/tracking/${trackingNumber}`;
};

interface PharmacyOption {
  id: string;
  name: string;
}

const OVERRIDE_STATUSES = [
  "submitted", "packed", "approved", "shipped", "delivered", "ready_for_pickup", "cancelled",
];

export default function AdminPrescriptionsPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [prescriptions, setPrescriptions] = useState<AdminPrescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedPrescription, setSelectedPrescription] = useState<AdminPrescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmittingToPharmacy, setIsSubmittingToPharmacy] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>("all");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scopeChecked, setScopeChecked] = useState(false);

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [markPaidResult, setMarkPaidResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [paymentLinkResult, setPaymentLinkResult] = useState<{ success: boolean; message: string } | null>(null);

  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [addressForm, setAddressForm] = useState({ street: "", city: "", state: "", zipCode: "", country: "US" });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressResult, setAddressResult] = useState<{ success: boolean; message: string } | null>(null);

  const [showOverride, setShowOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideTracking, setOverrideTracking] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [isApplyingOverride, setIsApplyingOverride] = useState(false);

  const groupColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let colorIdx = 0;
    prescriptions.forEach((rx) => {
      if (rx.submissionGroupId && !map.has(rx.submissionGroupId)) {
        map.set(rx.submissionGroupId, colorIdx % 5);
        colorIdx++;
      }
    });
    return map;
  }, [prescriptions]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    prescriptions.forEach((rx) => {
      if (rx.submissionGroupId) {
        counts.set(rx.submissionGroupId, (counts.get(rx.submissionGroupId) || 0) + 1);
      }
    });
    return counts;
  }, [prescriptions]);

  const groupFirstIds = useMemo(() => {
    const firstIds = new Set<string>();
    const seen = new Set<string>();
    prescriptions.forEach((rx) => {
      if (rx.submissionGroupId && !seen.has(rx.submissionGroupId)) {
        seen.add(rx.submissionGroupId);
        firstIds.add(rx.id);
      }
    });
    return firstIds;
  }, [prescriptions]);

  useEffect(() => {
    const checkScope = async () => {
      if (!user?.id) return;

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleRow?.role === "admin") {
        const { data: pharmacyAdminData } = await supabase
          .from("pharmacy_admins")
          .select("pharmacy_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!pharmacyAdminData) {
          setIsSuperAdmin(true);
        } else if (pharmacyAdminData.pharmacy_id) {
          setSelectedPharmacy(pharmacyAdminData.pharmacy_id);
        }
      } else {
        const { data } = await supabase
          .from("pharmacy_admins")
          .select("pharmacy_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.pharmacy_id) {
          setSelectedPharmacy(data.pharmacy_id);
        }
      }
      setScopeChecked(true);
    };
    checkScope();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!scopeChecked || !isSuperAdmin) return;
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
    fetchPharmacies();
  }, [scopeChecked, isSuperAdmin]);

  const handleSubmitToPharmacy = async (prescriptionId: string) => {
    setIsSubmittingToPharmacy(true);
    setSubmitResult(null);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/submit-to-pharmacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        setSubmitResult({ success: true, message: `Submitted to pharmacy! Queue ID: ${data.queue_id}` });
        loadPrescriptions();
      } else {
        setSubmitResult({ success: false, message: data.error || "Failed to submit" });
      }
    } catch {
      setSubmitResult({ success: false, message: "Network error — please try again" });
    } finally {
      setIsSubmittingToPharmacy(false);
    }
  };

  const handleMarkPaid = async (prescriptionId: string) => {
    setIsMarkingPaid(true);
    setMarkPaidResult(null);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        setMarkPaidResult({ success: true, message: "Prescription marked as paid and sent to pharmacy!" });
        loadPrescriptions();
        setTimeout(() => setSelectedPrescription(null), 1500);
      } else {
        setMarkPaidResult({ success: false, message: data.error || "Failed to mark as paid" });
      }
    } catch {
      setMarkPaidResult({ success: false, message: "Network error — please try again" });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleSendPaymentLink = async (rx: AdminPrescription) => {
    setIsSendingPaymentLink(true);
    setPaymentLinkResult(null);
    try {
      const groupRxs = rx.submissionGroupId
        ? prescriptions.filter((p) => p.submissionGroupId === rx.submissionGroupId)
        : [rx];

      const totalMedCents = groupRxs.reduce((sum, p) => sum + ((p.patientPrice || 0) * 100), 0);
      const totalShipCents = groupRxs.reduce((sum, p) => sum + (p.shippingFeeCents || 0), 0);
      const totalProfitCents = groupRxs.reduce((sum, p) => sum + (p.profitCents || 0), 0);

      const response = await fetch("/api/payments/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriptionIds: groupRxs.map((p) => p.id),
          medicationCostCents: totalMedCents,
          shippingFeeCents: totalShipCents,
          consultationFeeCents: totalProfitCents,
          description: `Payment for ${groupRxs.length} medication(s): ${groupRxs.map((p) => p.medication).join(", ")}`,
          patientEmail: rx.patientEmail,
          sendEmail: true,
        }),
      });
      const data = await response.json();
      if (data.success || data.paymentUrl) {
        setPaymentLinkResult({ success: true, message: "Payment link sent to patient!" });
      } else {
        setPaymentLinkResult({ success: false, message: data.error || "Failed to generate payment link" });
      }
    } catch {
      setPaymentLinkResult({ success: false, message: "Network error — please try again" });
    } finally {
      setIsSendingPaymentLink(false);
    }
  };

  const handleSaveAddress = async (prescriptionId: string, saveToPatient: boolean) => {
    setIsSavingAddress(true);
    setAddressResult(null);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/update-address`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_address: addressForm,
          saveToPatient,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAddressResult({
          success: true,
          message: saveToPatient
            ? "Address updated for prescription and patient record. Pharmacy notified."
            : "Address updated for this prescription only. Pharmacy notified.",
        });
        setShowAddressEdit(false);
        loadPrescriptions();
      } else {
        setAddressResult({ success: false, message: data.error || "Failed to update address" });
      }
    } catch {
      setAddressResult({ success: false, message: "Network error — please try again" });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleApplyOverride = async (prescriptionId: string) => {
    setIsApplyingOverride(true);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/admin-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus || undefined,
          trackingNumber: overrideTracking || undefined,
          note: overrideNote || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        loadPrescriptions();
        setTimeout(() => {
          setSelectedPrescription(null);
          setShowOverride(false);
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setIsApplyingOverride(false);
    }
  };

  const handleSyncTracking = useCallback(async (prescriptionId: string) => {
    try {
      const response = await fetch("/api/prescriptions/sync-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId }),
      });
      const data = await response.json();
      if (data.updated) {
        loadPrescriptions();
      }
    } catch {
      // silent
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasLoadedOnce = useRef(false);

  const loadPrescriptions = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnce.current) {
        setIsLoading(true);
      }
      setLoadError(null);
      const params = new URLSearchParams();
      if (selectedPharmacy && selectedPharmacy !== "all") {
        params.set("pharmacyId", selectedPharmacy);
      }
      const url = `/api/admin/prescriptions${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { signal });
      const data = await response.json();

      if (signal?.aborted) return;

      if (!response.ok) {
        console.error("Error loading prescriptions:", data.error);
        setLoadError(data.error || "Failed to load prescriptions");
        return;
      }

      setPrescriptions(data.prescriptions || []);
      hasLoadedOnce.current = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error loading prescriptions:", error);
      if (!hasLoadedOnce.current) {
        setLoadError("Failed to connect to server");
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [selectedPharmacy]);

  useEffect(() => {
    const controller = new AbortController();
    loadPrescriptions(controller.signal);

    const interval = setInterval(() => loadPrescriptions(controller.signal), 15000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadPrescriptions]);

  useEffect(() => {
    if (selectedPrescription?.trackingNumber && getEffectiveStatus(selectedPrescription) !== "delivered") {
      handleSyncTracking(selectedPrescription.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrescription?.id]);

  useEffect(() => {
    if (selectedPrescription) {
      const updated = prescriptions.find((p) => p.id === selectedPrescription.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedPrescription)) {
        setSelectedPrescription(updated);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescriptions]);

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    const matchesSearch =
      prescription.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.medication.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.queueId.toLowerCase().includes(searchQuery.toLowerCase());

    const effectiveStatus = getEffectiveStatus(prescription);
    const matchesStatus =
      statusFilter === "All" || effectiveStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => {
    if (status === "All") return prescriptions.length;
    return prescriptions.filter((p) => getEffectiveStatus(p).toLowerCase() === status.toLowerCase()).length;
  };

  const getGroupRxs = (rx: AdminPrescription): AdminPrescription[] => {
    if (!rx.submissionGroupId) return [rx];
    return prescriptions.filter((p) => p.submissionGroupId === rx.submissionGroupId);
  };

  const computeTotal = (rx: AdminPrescription): number => {
    const groupRxs = getGroupRxs(rx);
    return groupRxs.reduce((sum, p) => {
      return sum + (p.patientPrice || 0) + ((p.shippingFeeCents || 0) / 100) + ((p.profitCents || 0) / 100);
    }, 0);
  };

  const openPrescriptionDetail = (rx: AdminPrescription) => {
    setSelectedPrescription(rx);
    setSubmitResult(null);
    setMarkPaidResult(null);
    setPaymentLinkResult(null);
    setAddressResult(null);
    setShowAddressEdit(false);
    setShowOverride(false);
    setOverrideStatus(rx.status || "");
    setOverrideTracking(rx.trackingNumber || "");
    setOverrideNote("");
  };

  const currentAddress = selectedPrescription?.hasCustomAddress && selectedPrescription?.customAddress
    ? selectedPrescription.customAddress
    : selectedPrescription?.patientAddress;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Incoming Prescriptions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Click any row to view full details and order progress
            </p>
          </div>
        </div>
      </div>

      {isSuperAdmin && pharmacies.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pharmacy-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</Label>
              <Select value={selectedPharmacy} onValueChange={setSelectedPharmacy}>
                <SelectTrigger id="pharmacy-filter" className="w-[260px] bg-white" data-testid="select-pharmacy-filter">
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
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, provider, medication, or Queue ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        <div className="w-64 flex-shrink-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "All" ? status : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")} ({getStatusCount(status)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          Showing {filteredPrescriptions.length} of {prescriptions.length} prescriptions
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed min-w-[800px]">
            <colgroup>
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[110px]" />
              <col style={{ width: "22%" }} />
              <col className="w-[70px]" />
              <col className="w-[65px]" />
              <col className="w-[90px]" />
              <col style={{ width: "18%" }} />
              <col className="w-[95px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-sm px-3 whitespace-nowrap">Date</TableHead>
                <TableHead className="font-semibold text-sm px-3">Provider</TableHead>
                <TableHead className="font-semibold text-sm px-3">Patient</TableHead>
                <TableHead className="font-semibold text-sm px-3">Medication</TableHead>
                <TableHead className="font-semibold text-sm px-3 whitespace-nowrap">Qty/Refills</TableHead>
                <TableHead className="font-semibold text-sm px-3">Price</TableHead>
                <TableHead className="font-semibold text-sm px-3">Pharmacy</TableHead>
                <TableHead className="font-semibold text-sm px-3">SIG</TableHead>
                <TableHead className="font-semibold text-sm px-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading prescriptions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm font-medium">{loadError}</p>
                      <button onClick={() => loadPrescriptions()} className="text-xs text-blue-600 hover:underline mt-1">
                        Try again
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredPrescriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No prescriptions found matching your filters
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrescriptions.map((prescription, idx) => {
                  const { datePart, timePart } = formatDateTime(prescription.submittedAt);
                  const groupIdx = prescription.submissionGroupId
                    ? groupColorMap.get(prescription.submissionGroupId)
                    : undefined;
                  const isGrouped = groupIdx !== undefined;
                  const isFirstInGroup = groupFirstIds.has(prescription.id);
                  const groupCount = prescription.submissionGroupId
                    ? groupCounts.get(prescription.submissionGroupId) || 0
                    : 0;

                  return (
                  <TableRow
                    key={prescription.id}
                    className="cursor-pointer transition-colors hover:bg-blue-50/50"
                    style={isGrouped ? {
                      backgroundColor: GROUP_BG_COLORS[groupIdx!],
                      borderLeft: `4px solid ${GROUP_BORDER_COLORS[groupIdx!]}`,
                    } : {
                      backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                    }}
                    onClick={() => openPrescriptionDetail(prescription)}
                    data-testid={`row-prescription-${prescription.id}`}
                  >
                    <TableCell className="text-sm whitespace-nowrap py-3 px-3">
                      {datePart}, {timePart}
                    </TableCell>
                    <TableCell className="text-sm py-3 px-3">
                      {prescription.providerName}
                    </TableCell>
                    <TableCell className="text-sm py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {prescription.patientName}
                        {isFirstInGroup && groupCount > 1 && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
                            style={{ backgroundColor: GROUP_BORDER_COLORS[groupIdx!] }}
                          >
                            {groupCount} items
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-3 overflow-hidden">
                      <div className="overflow-hidden">
                        <span className="text-sm truncate block" title={prescription.medication}>
                          {prescription.medication}
                        </span>
                        <span className="text-xs text-muted-foreground truncate block">
                          {prescription.strength}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap py-3 px-3">
                      <div>
                        <div>Qty: {prescription.quantity}</div>
                        <div className="text-muted-foreground">Ref: {prescription.refills}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm py-3 px-3">
                      {prescription.patientPrice != null ? (
                        <div>
                          <div className="font-semibold">${Number(prescription.patientPrice).toFixed(2)}</div>
                          {(prescription.shippingFeeCents || 0) > 0 && (
                            <div className="text-xs text-muted-foreground">+${((prescription.shippingFeeCents || 0) / 100).toFixed(2)} ship</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-3 overflow-hidden">
                      {prescription.pharmacyName ? (
                        <span className="text-sm truncate block" style={{ color: prescription.pharmacyColor || "#1E3A8A" }} title={prescription.pharmacyName}>
                          {prescription.pharmacyName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-3 overflow-hidden">
                      <p className="text-sm truncate cursor-help" title={prescription.sig}>
                        {prescription.sig}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(getEffectiveStatus(prescription))} text-xs px-2 py-0.5 whitespace-nowrap`}
                      >
                        {getEffectiveStatus(prescription).charAt(0).toUpperCase() + getEffectiveStatus(prescription).slice(1).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selectedPrescription} onOpenChange={(open) => { if (!open) setSelectedPrescription(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-prescription-detail">
          {selectedPrescription && (() => {
            const effectiveStatus = getEffectiveStatus(selectedPrescription);
            const groupRxs = getGroupRxs(selectedPrescription);
            const isGrouped = groupRxs.length > 1;
            const total = computeTotal(selectedPrescription);
            const addr = currentAddress;

            return (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-xl font-bold text-[#1E3A8A]">
                    Prescription Details
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(effectiveStatus)} text-xs px-2.5 py-1`}
                  >
                    {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1).replace(/_/g, " ")}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* Section 2: Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Queue ID</p>
                      <p className="text-sm font-mono font-semibold" data-testid="text-queue-id">{selectedPrescription.queueId}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Submitted</p>
                      <p className="text-sm font-semibold" data-testid="text-submitted-date">{formatDateTime(selectedPrescription.submittedAt).datePart} {formatDateTime(selectedPrescription.submittedAt).timePart}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Provider</p>
                      <p className="text-sm font-semibold" data-testid="text-provider-name">{selectedPrescription.providerName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Patient</p>
                      <p className="text-sm font-semibold" data-testid="text-patient-name">{selectedPrescription.patientName}</p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Progress Tracker */}
                <PrescriptionProgressTracker
                  status={effectiveStatus}
                  trackingNumber={selectedPrescription.trackingNumber}
                  pharmacyName={selectedPrescription.pharmacyName}
                  billingStatus={selectedPrescription.billingStatus}
                  patientCopay={selectedPrescription.patientCopay}
                />

                {/* Section 4: Medication Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-[#1E3A8A]" />
                    Medication Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Medication</p>
                      <p className="text-sm font-medium" data-testid="text-medication">{selectedPrescription.medication}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Strength</p>
                      <p className="text-sm font-medium" data-testid="text-strength">{selectedPrescription.strength || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-sm font-medium" data-testid="text-quantity">{selectedPrescription.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refills</p>
                      <p className="text-sm font-medium" data-testid="text-refills">{selectedPrescription.refills}</p>
                    </div>
                  </div>
                  {selectedPrescription.sig && (
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        SIG Instructions
                      </p>
                      <p className="text-sm font-medium mt-0.5" data-testid="text-sig">{selectedPrescription.sig}</p>
                    </div>
                  )}
                </div>

                {/* Section 5: Pricing */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Pricing
                    {isGrouped && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs ml-2">
                        {groupRxs.length} items in group
                      </Badge>
                    )}
                  </h4>

                  {isGrouped ? (
                    <div className="space-y-2">
                      {groupRxs.map((grx) => (
                        <div
                          key={grx.id}
                          className={`flex justify-between items-center text-sm px-2 py-1 rounded ${grx.id === selectedPrescription.id ? "bg-green-100" : ""}`}
                        >
                          <span className="truncate mr-2">{grx.medication}</span>
                          <span className="flex-shrink-0 font-medium">
                            ${Number(grx.patientPrice || 0).toFixed(2)}
                            {(grx.shippingFeeCents || 0) > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">+${((grx.shippingFeeCents || 0) / 100).toFixed(2)} ship</span>
                            )}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-green-300 pt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Shipping & Handling</span>
                          <span>${(groupRxs.reduce((s, p) => s + (p.shippingFeeCents || 0), 0) / 100).toFixed(2)}</span>
                        </div>
                        {groupRxs.reduce((s, p) => s + (p.profitCents || 0), 0) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Oversight & Monitoring</span>
                            <span>${(groupRxs.reduce((s, p) => s + (p.profitCents || 0), 0) / 100).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-green-700 text-lg pt-1">
                          <span>Group Total</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Medication Cost</span>
                        <span>${Number(selectedPrescription.patientPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Shipping</span>
                        <span>${((selectedPrescription.shippingFeeCents || 0) / 100).toFixed(2)}</span>
                      </div>
                      {(selectedPrescription.profitCents || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Oversight & Monitoring</span>
                          <span>${((selectedPrescription.profitCents || 0) / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-green-700 text-lg border-t border-green-300 pt-2">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 6: Shipping Address */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#1E3A8A]" />
                    Shipping Address
                  </h4>
                  {addr && formatAddress(addr) ? (
                    <div>
                      <p className="text-sm">{formatAddress(addr)}</p>
                      {selectedPrescription.hasCustomAddress && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs mt-1">
                          Custom address for this order
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600">No shipping address on file</p>
                  )}

                  {!showAddressEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddressForm({
                          street: addr?.street || "",
                          city: addr?.city || "",
                          state: addr?.state || "",
                          zipCode: addr?.zipCode || "",
                          country: addr?.country || "US",
                        });
                        setShowAddressEdit(true);
                        setAddressResult(null);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit Shipping Address
                    </Button>
                  ) : (
                    <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-white">
                      <div>
                        <Label className="text-xs">Street Address</Label>
                        <Input
                          value={addressForm.street}
                          onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">City</Label>
                          <Input
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">State</Label>
                          <Input
                            value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Zip Code</Label>
                          <Input
                            value={addressForm.zipCode}
                            onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleSaveAddress(selectedPrescription.id, true)}
                          disabled={isSavingAddress}
                        >
                          {isSavingAddress ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Save to Patient Record & Prescription
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveAddress(selectedPrescription.id, false)}
                          disabled={isSavingAddress}
                        >
                          This Prescription Only
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddressEdit(false)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {addressResult && (
                    <p className={`text-sm ${addressResult.success ? "text-green-600 bg-green-50 border border-green-200" : "text-red-600"} rounded px-3 py-2`}>
                      {addressResult.message}
                    </p>
                  )}
                </div>

                {/* Section 7: Payment Actions */}
                {effectiveStatus === "pending_payment" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      Payment Actions
                    </h4>
                    {selectedPrescription.patientEmail && (
                      <p className="text-xs text-muted-foreground">Patient email: {selectedPrescription.patientEmail}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => handleSendPaymentLink(selectedPrescription)}
                        disabled={isSendingPaymentLink || !selectedPrescription.patientEmail || !selectedPrescription.patientPrice}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isSendingPaymentLink ? (
                          <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                        ) : (
                          <><Mail className="h-4 w-4 mr-2" />
                            {isGrouped ? `Send Payment Link (${groupRxs.length} items)` : "Send Payment Link to Patient"}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleMarkPaid(selectedPrescription.id)}
                        disabled={isMarkingPaid}
                        className="border-violet-300 text-violet-700 hover:bg-violet-50"
                      >
                        {isMarkingPaid ? (
                          <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                        ) : (
                          <><CheckCircle2 className="h-4 w-4 mr-2" />
                            {isGrouped ? `Mark All ${groupRxs.length} Items as Paid` : "Mark as Paid"}
                          </>
                        )}
                      </Button>
                    </div>
                    {paymentLinkResult && (
                      <p className={`text-sm ${paymentLinkResult.success ? "text-green-600" : "text-red-600"}`}>
                        {paymentLinkResult.message}
                      </p>
                    )}
                    {markPaidResult && (
                      <p className={`text-sm ${markPaidResult.success ? "text-green-600" : "text-red-600"}`}>
                        {markPaidResult.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Section 8: Submit to Pharmacy */}
                {(!selectedPrescription.queueId || selectedPrescription.queueId === "N/A") && (
                  <div className="pt-2 space-y-2">
                    {selectedPrescription.paymentStatus !== "paid" && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        Payment not yet received — admin override will submit without payment confirmation.
                      </p>
                    )}
                    <Button
                      onClick={() => handleSubmitToPharmacy(selectedPrescription.id)}
                      disabled={isSubmittingToPharmacy}
                      className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
                      data-testid="button-submit-to-pharmacy"
                    >
                      {isSubmittingToPharmacy ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting to Pharmacy...</>
                      ) : (
                        <><Send className="h-4 w-4 mr-2" />Submit to Pharmacy</>
                      )}
                    </Button>
                    {submitResult && (
                      <p className={`text-sm mt-2 text-center ${submitResult.success ? "text-green-600" : "text-red-600"}`}>
                        {submitResult.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Section 9: Manual Status / Tracking Override */}
                <div className="pt-2">
                  {!showOverride ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowOverride(true)}
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Manual Status / Tracking Override
                    </Button>
                  ) : (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-orange-800 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Manual Override
                      </h4>
                      <p className="text-xs text-orange-700">
                        Use this when the pharmacy confirms a status change but the API hasn't updated. The patient will be notified automatically.
                      </p>
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                          <SelectTrigger className="mt-1 bg-white">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {OVERRIDE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tracking Number</Label>
                        <div className="relative mt-1">
                          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={overrideTracking}
                            onChange={(e) => setOverrideTracking(e.target.value)}
                            className="pl-10 bg-white"
                            placeholder="e.g. 870226650547"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Note (optional)</Label>
                        <Input
                          value={overrideNote}
                          onChange={(e) => setOverrideNote(e.target.value)}
                          className="mt-1 bg-white"
                          placeholder="e.g. Confirmed by Leyla via email"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApplyOverride(selectedPrescription.id)}
                          disabled={isApplyingOverride || (!overrideStatus && !overrideTracking)}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {isApplyingOverride ? (
                            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                          ) : (
                            "Apply Override"
                          )}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowOverride(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
