"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, User, Calendar, Pill, Hash, FileText, RefreshCw, AlertCircle, Send, Mail, DollarSign, CheckCircle2, BadgeDollarSign, Truck, Package, Edit3, MapPin, Pencil, X, Flag, Printer, XCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PrescriptionProgressTracker } from "@/app/(features)/prescriptions/_components/PrescriptionProgressTracker";

interface AdminPrescription {
  id: string;
  queueId: string;
  submittedAt: string;
  sentToPharmacyAt?: string | null;
  statusUpdatedAt?: string;
  providerName: string;
  patientName: string;
  patientEmail?: string | null;
  medication: string;
  strength: string;
  quantity: number;
  refills: number;
  sig: string;
  status: string;
  paymentStatus?: string;
  patientPrice?: number | null;
  shippingFeeCents?: number | null;
  profitCents?: number | null;
  submissionGroupId?: string | null;
  trackingNumber?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  billingStatus?: string;
  patientCopay?: string;
  deliveryDate?: string;
  lotNumber?: string;
  orderProgress?: string;
  carrierStatus?: string;
  trackingCarrier?: string;
  estimatedDelivery?: string;
  patientId?: string;
  hasCustomAddress?: boolean;
  customAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  patientAddress?: { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null;
  paymentToken?: string | null;
  paymentTransactionId?: string | null;
  /**
   * Net settled amount across this rx's order group (sum of completed
   * payment_transactions minus refunds). null when rx is not part of a
   * group. Source: server endpoint /api/admin/prescriptions, derived
   * from payment_transactions ledger (Greenwich/Rahmany incident, May 2026).
   */
  groupPaidCents?: number | null;
  /**
   * Greenwich PDF health badge (Trevor Haynes incident, May 7-8 2026).
   * "ok"  → Electronic Rx in storage is the proper format (>= 200KB).
   * "bad" → image-only/missing — server-side auto-heal in submit-to-
   *         pharmacy-core SHOULD have prevented this; if you ever see
   *         "bad" on a submitted Greenwich row, that is a real bug.
   * "na"  → not applicable (non-Greenwich pharmacy or pre-submission row).
   */
  pdfHealth?: "ok" | "bad" | "na";
  /**
   * When pdfHealth==="bad", a short machine-readable code explaining
   * which layer failed: "content:<errs>" | "no_push_confirmation" |
   * "storage_lookup_failed" | "no_storage_path" | "storage_row_missing"
   * | "size_<bytes>b_below_<thresh>". Used to render a meaningful
   * tooltip on the red badge.
   */
  pdfHealthReason?: string | null;
}

const getEffectiveStatus = (rx: AdminPrescription): string => {
  if (rx.status === "submitted" && (!rx.queueId || rx.queueId === "N/A")) {
    return rx.paymentStatus === "paid" ? "payment_received" : "pending_payment";
  }
  return rx.status;
};

const LATE_THRESHOLD_HOURS = 72;
// "rejected" is terminal because the order will never ship — pharmacy declined
// it (e.g. out of stock). A refund is owed but there's no shipping action left,
// so it should not appear in the Late filter.
const TERMINAL_STATUSES = ["shipped", "delivered", "picked_up", "cancelled", "rejected"];

const isOrderLate = (rx: AdminPrescription): { late: boolean; hoursStuck: number } => {
  if (!rx.sentToPharmacyAt) return { late: false, hoursStuck: 0 };
  if (TERMINAL_STATUSES.includes(rx.status?.toLowerCase())) return { late: false, hoursStuck: 0 };
  const hoursStuck = (Date.now() - new Date(rx.sentToPharmacyAt).getTime()) / (1000 * 60 * 60);
  return { late: hoursStuck >= LATE_THRESHOLD_HOURS, hoursStuck: Math.round(hoursStuck) };
};

const STATUS_OPTIONS = [
  "All",
  "submitted",
  "pending_payment",
  "payment_received",
  "paused",
  "packed",
  "approved",
  "picked_up",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "pending_payment":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "payment_received":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "paused":
      // Renamed for human-readable display: "In Production ⭐". The DB value
      // stays "paused" (don't break existing rows / queries / cron). Greenwich
      // confirmed (Lacy, May 12 2026): paused = the compound is actively being
      // produced and will fill as soon as production completes (currently
      // TB500 / peptide variations). Teal/emerald conveys positive forward
      // motion, not the alarming orange we previously used.
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
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// Greenwich's PAUSED workflow state actually means the compound is in active
// production (TB500 / peptide variations etc) and will fill as soon as
// production completes — confirmed by Lacy at Greenwich, May 12 2026. Show
// "In Production ⭐" in the UI; DB value stays "paused" for back-compat.
const formatStatusLabel = (status: string): string => {
  const s = (status || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "paused") return "In Production ⭐";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
};

const formatDateTime = (dateTime: string) => {
  const date = new Date(dateTime);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<AdminPrescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [lateOnly, setLateOnly] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<AdminPrescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmittingToPharmacy, setIsSubmittingToPharmacy] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [paymentLinkResult, setPaymentLinkResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideTracking, setOverrideTracking] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideResult, setOverrideResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [editAddress, setEditAddress] = useState<{ street?: string; city?: string; state?: string; zipCode?: string; country?: string }>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressNotification, setAddressNotification] = useState<{ recipients: string[] } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminPrescription | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelConfirmName, setCancelConfirmName] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const cancellingRef = useRef(false);
  useEffect(() => {
    setSubmitResult(null);
    setIsSubmittingToPharmacy(false);
    setPaymentLinkResult(null);
    setIsSendingPaymentLink(false);
    setIsMarkingPaid(false);
    setShowOverrideForm(false);
    setOverrideStatus("");
    setOverrideTracking("");
    setOverrideNote("");
    setOverrideResult(null);
    setShowAddressEdit(false);
    setSavingAddress(false);
    setAddressNotification(null);
  }, [selectedPrescription?.id]);

  const sendingRef = useRef(false);
  const handleSendPaymentLink = async (rx: AdminPrescription) => {
    if (sendingRef.current) return;
    if (!rx.patientEmail) {
      setPaymentLinkResult({ success: false, message: "No patient email on file" });
      return;
    }
    if (rx.patientPrice == null) {
      setPaymentLinkResult({ success: false, message: "No price set for this prescription" });
      return;
    }
    sendingRef.current = true;
    setIsSendingPaymentLink(true);
    setPaymentLinkResult(null);
    try {
      const allGroupMembers = rx.submissionGroupId
        ? prescriptions.filter(
            (p) =>
              p.submissionGroupId === rx.submissionGroupId &&
              p.paymentStatus !== "paid"
          )
        : [rx];

      const missingPrice = allGroupMembers.filter((p) => p.patientPrice == null);
      if (missingPrice.length > 0) {
        setPaymentLinkResult({
          success: false,
          message: `${missingPrice.length} item(s) in this group have no price set: ${missingPrice.map((p) => p.medication).join(", ")}`,
        });
        sendingRef.current = false;
        setIsSendingPaymentLink(false);
        return;
      }

      const groupedRxs = allGroupMembers;
      const prescriptionIds = groupedRxs.map((p) => p.id);
      let totalMedicationCostCents = 0;
      let totalShippingFeeCents = 0;
      let totalOversightFeeCents = 0;
      const medNames: string[] = [];

      for (const grx of groupedRxs) {
        totalMedicationCostCents += Math.round((grx.patientPrice ?? 0) * 100);
        totalShippingFeeCents += grx.shippingFeeCents ?? 0;
        // Defensive: never let a negative profit_cents reduce the
        // amount the patient is billed (Greenwich/Rahmany incident).
        const rawOver = grx.profitCents ?? 0;
        if (Number.isFinite(rawOver) && rawOver > 0) {
          totalOversightFeeCents += rawOver;
        }
        medNames.push(grx.medication);
      }

      const description = groupedRxs.length > 1
        ? `Payment for ${groupedRxs.length} medications: ${medNames.join(", ")}`
        : `Payment for ${rx.medication} prescription`;

      const response = await fetch("/api/payments/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prescriptionIds,
          consultationFeeCents: totalOversightFeeCents,
          medicationCostCents: totalMedicationCostCents,
          shippingFeeCents: totalShippingFeeCents,
          description,
          patientEmail: rx.patientEmail,
          sendEmail: true,
        }),
      });
      const data = await response.json();
      if (response.ok && (data.success || data.paymentLink)) {
        const itemCount = groupedRxs.length;
        setPaymentLinkResult({
          success: true,
          message: data.existing
            ? `Existing payment link resent to ${rx.patientEmail}`
            : itemCount > 1
              ? `Payment link for ${itemCount} items created and sent to ${rx.patientEmail}`
              : `Payment link created and sent to ${rx.patientEmail}`,
        });
        loadPrescriptions();
      } else {
        setPaymentLinkResult({ success: false, message: data.error || "Failed to send payment link" });
      }
    } catch {
      setPaymentLinkResult({ success: false, message: "Network error — please try again" });
    } finally {
      sendingRef.current = false;
      setIsSendingPaymentLink(false);
    }
  };

  const handleMarkAsPaid = async (prescriptionId: string) => {
    setIsMarkingPaid(true);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.warning) {
          toast.warning(data.warning, { duration: 8000 });
        } else {
          toast.success("Prescription marked as paid and sent to pharmacy!");
        }
        loadPrescriptions();
        setSelectedPrescription(null);
      } else {
        toast.error(data.error || "Failed to mark as paid");
      }
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setIsMarkingPaid(false);
    }
  };

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

  const handleAdminOverride = async (prescriptionId: string) => {
    if (!overrideStatus && !overrideTracking.trim()) {
      toast.error("Enter a status or tracking number");
      return;
    }
    setIsOverriding(true);
    setOverrideResult(null);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/admin-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: overrideStatus || undefined,
          trackingNumber: overrideTracking.trim() || undefined,
          note: overrideNote.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setOverrideResult({ success: true, message: data.message || "Updated successfully" });
        toast.success("Prescription updated!");
        loadPrescriptions();
        setTimeout(() => setSelectedPrescription(null), 1500);
      } else {
        setOverrideResult({ success: false, message: data.error || "Update failed" });
        toast.error(data.error || "Update failed");
      }
    } catch {
      setOverrideResult({ success: false, message: "Network error" });
      toast.error("Network error — please try again");
    } finally {
      setIsOverriding(false);
    }
  };

  const closeCancelDialog = () => {
    setCancelTarget(null);
    setCancelReason("");
    setCancelNote("");
    setCancelConfirmName("");
  };

  const handleCancelOrder = async (rx: AdminPrescription) => {
    if (cancellingRef.current) return;
    if (!cancelReason) return;
    cancellingRef.current = true;
    setIsCancelling(true);

    const reason = cancelReason;
    const note = cancelNote.trim();
    const adminNoteText = `[CANCEL] ${reason}${note ? ` — ${note}` : ""}`;

    let cancelledOk = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`/api/prescriptions/${rx.id}/admin-override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "cancelled", note: adminNoteText }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Failed to cancel — please try again");
        return;
      }
      cancelledOk = true;

      try {
        const emailRes = await fetch(
          `/api/admin/prescriptions/${rx.id}/notify-cancellation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ reason }),
          },
        );
        const emailData = await emailRes.json().catch(() => ({}));
        if (emailRes.ok && emailData?.success) {
          const sentCount = Array.isArray(emailData.sent) ? emailData.sent.length : 0;
          const failedCount = Array.isArray(emailData.failed) ? emailData.failed.length : 0;
          if (failedCount > 0) {
            toast.warning(
              `Order cancelled. ${sentCount} email${sentCount === 1 ? "" : "s"} sent, ${failedCount} failed.`,
            );
          } else {
            toast.success(
              `Order cancelled — ${sentCount} email${sentCount === 1 ? "" : "s"} sent.`,
            );
          }
        } else {
          toast.warning(
            "Order cancelled — but notification emails failed to send.",
          );
        }
      } catch {
        toast.warning(
          "Order cancelled — but notification emails failed to send.",
        );
      }

      closeCancelDialog();
      loadPrescriptions();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.error("Cancel request timed out — please retry");
      } else if (!cancelledOk) {
        toast.error("Network error — please try again");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsCancelling(false);
      cancellingRef.current = false;
    }
  };

  const loadPrescriptions = useCallback(async () => {
    try {
      setLoadError(null);
      const url = statusFilter === "cancelled"
        ? "/api/admin/prescriptions?includeCancelled=true"
        : "/api/admin/prescriptions";
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error("Error loading prescriptions:", data.error);
        setLoadError(data.error || "Failed to load prescriptions");
        return;
      }

      const freshList = data.prescriptions || [];
      setPrescriptions(freshList);

      setSelectedPrescription((prev) => {
        if (!prev) return null;
        const updated = freshList.find((p: AdminPrescription) => p.id === prev.id);
        return updated || null;
      });
    } catch (error) {
      console.error("Error loading prescriptions:", error);
      setLoadError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedPrescription?.trackingNumber) return;
    if (selectedPrescription.status === "delivered") return;

    let cancelled = false;
    fetch("/api/prescriptions/sync-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prescriptionId: selectedPrescription.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.synced) {
          loadPrescriptions();
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedPrescription?.id, selectedPrescription?.trackingNumber, selectedPrescription?.status, loadPrescriptions]);

  useEffect(() => {
    loadPrescriptions();

    const interval = setInterval(loadPrescriptions, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [loadPrescriptions]);


  const filteredPrescriptions = prescriptions.filter((prescription) => {
    const matchesSearch =
      prescription.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.medication.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prescription.queueId.toLowerCase().includes(searchQuery.toLowerCase());

    const effectiveStatus = getEffectiveStatus(prescription);
    const matchesStatus =
      statusFilter === "All" || effectiveStatus.toLowerCase() === statusFilter.toLowerCase();

    const matchesLate = !lateOnly || isOrderLate(prescription).late;

    return matchesSearch && matchesStatus && matchesLate;
  });

  const visiblePrescriptions = prescriptions;
  const lateCount = visiblePrescriptions.filter((p) => isOrderLate(p).late).length;

  const getStatusCount = (status: string) => {
    if (status === "All") return visiblePrescriptions.length;
    return visiblePrescriptions.filter((p) => getEffectiveStatus(p).toLowerCase() === status.toLowerCase()).length;
  };

  return (
    <div className="mx-auto py-8 px-4" style={{ maxWidth: "95vw" }}>
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
                  {status === "All" ? status : formatStatusLabel(status)} ({getStatusCount(status)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => setLateOnly((v) => !v)}
          data-testid="toggle-late-only"
          title={`Rule: paid + at pharmacy >${LATE_THRESHOLD_HOURS}h + not yet shipped/picked up/delivered`}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            lateOnly
              ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
              : "bg-white text-red-700 border-red-300 hover:bg-red-50"
          }`}
        >
          <Flag className="w-4 h-4" />
          Late only ({lateCount})
        </button>

        <a
          href="/admin/prescriptions/late-report"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-print-late-report"
          title="Open the printable Late Orders report in a new tab — share with the pharmacy"
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            lateCount > 0
              ? "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed pointer-events-none"
          }`}
        >
          <Printer className="w-4 h-4" />
          Print late report
        </a>

        <button
          type="button"
          onClick={async () => {
            if (isPulling) return;
            setIsPulling(true);
            const t = toast.loading("Pulling status updates from Greenwich…");
            try {
              const r = await fetch("/api/admin/trigger-cron", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ job: "digitalrx-reconcile" }),
              });
              const data = await r.json();
              toast.dismiss(t);
              if (!r.ok) {
                toast.error(data.error || "Pull failed — check server logs");
              } else {
                toast.success("Pull complete — refreshing queue");
                await loadPrescriptions();
              }
            } catch {
              toast.dismiss(t);
              toast.error("Network error during pull");
            } finally {
              setIsPulling(false);
            }
          }}
          disabled={isPulling}
          data-testid="button-pull-greenwich"
          title="Ask Greenwich for the latest status on every stuck order — runs the same job that fires automatically at 6:00 PM Chicago time daily."
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            isPulling
              ? "bg-gray-100 text-gray-500 border-gray-300 cursor-wait"
              : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isPulling ? "animate-spin" : ""}`} />
          {isPulling ? "Pulling…" : "Pull from Greenwich"}
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground" data-testid="text-results-count">
          Showing {filteredPrescriptions.length} of {visiblePrescriptions.length} prescriptions
        </p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold w-[140px]">Ordered / Paid</TableHead>
                <TableHead className="font-semibold">Provider</TableHead>
                <TableHead className="font-semibold">Patient</TableHead>
                <TableHead className="font-semibold">Medication</TableHead>
                <TableHead className="font-semibold w-[100px]">Qty/Refills</TableHead>
                <TableHead className="font-semibold w-[80px]">Price</TableHead>
                <TableHead className="font-semibold">Pharmacy</TableHead>
                <TableHead className="font-semibold w-[110px]">Queue ID</TableHead>
                <TableHead className="font-semibold">SIG</TableHead>
                <TableHead className="font-semibold w-[150px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading prescriptions...
                    </div>
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm font-medium">{loadError}</p>
                      <button onClick={loadPrescriptions} className="text-xs text-blue-600 hover:underline mt-1">
                        Try again
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredPrescriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No prescriptions found matching your filters
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  const batchKeys: string[] = [];
                  const groupIdMap: Record<string, string> = {};
                  let groupCounter = 0;

                  const txIdMap: Record<string, string> = {};

                  for (let i = 0; i < filteredPrescriptions.length; i++) {
                    const curr = filteredPrescriptions[i] as any;
                    const sgId = curr.submissionGroupId;
                    const txId = curr.paymentTransactionId;

                    if (sgId) {
                      // Split the submission group by payment status so that
                      // paid items render as their own batch and unpaid items
                      // render as a separate batch (Greenwich/Rahmany incident
                      // remediation, May 2026). After Phase C recovery, the
                      // legitimately-paid Pinealon must NOT be visually
                      // grouped with the 5 reset rxs awaiting a fresh
                      // bulk payment.
                      const payBucket = curr.paymentStatus === "paid" ? "paid" : "unpaid";
                      const sgKey = `${sgId}::${payBucket}`;
                      if (!groupIdMap[sgKey]) {
                        groupCounter++;
                        groupIdMap[sgKey] = `g${groupCounter}`;
                      }
                      batchKeys.push(groupIdMap[sgKey]);
                    } else if (txId) {
                      if (!txIdMap[txId]) {
                        groupCounter++;
                        txIdMap[txId] = `t${groupCounter}`;
                      }
                      batchKeys.push(txIdMap[txId]);
                    } else {
                      groupCounter++;
                      batchKeys.push(`g${groupCounter}`);
                    }
                  }

                  const shippingPerGroup: Record<string, number> = {};
                  for (let i = 0; i < filteredPrescriptions.length; i++) {
                    const rx = filteredPrescriptions[i] as any;
                    const k = batchKeys[i];
                    const fee = rx.shippingFeeCents ?? 0;
                    if (fee > 0) {
                      shippingPerGroup[k] = (shippingPerGroup[k] || 0) + 1;
                    }
                  }
                  const invalidGroups = new Set(
                    Object.entries(shippingPerGroup)
                      .filter(([, count]) => count > 1)
                      .map(([key]) => key)
                  );
                  for (let i = 0; i < batchKeys.length; i++) {
                    if (invalidGroups.has(batchKeys[i])) {
                      groupCounter++;
                      batchKeys[i] = `solo${groupCounter}`;
                    }
                  }

                  const keyCounts: Record<string, number> = {};
                  batchKeys.forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1; });

                  const groupBgs = [
                    "#EFF6FF", "#F5F3FF", "#FFFBEB", "#ECFDF5", "#FFF1F2",
                  ];
                  const groupBorders = [
                    "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E",
                  ];
                  let colorCounter = 0;
                  const keyColorMap: Record<string, number> = {};
                  Object.entries(keyCounts).forEach(([key, count]) => {
                    if (count > 1 && !(key in keyColorMap)) {
                      keyColorMap[key] = colorCounter % groupBgs.length;
                      colorCounter++;
                    }
                  });

                  const seenKeys = new Set<string>();

                  // Greenwich watch list — 5 orders Lauren Summers is actively
                  // tracking (May 19 2026). Highlighted amber so Joseph can spot
                  // them at a glance in the Incoming Queue. Remove this set
                  // once all 5 ship.
                  const GREENWICH_WATCH_QUEUE_IDS = new Set([
                    "2233282", // Bielot — packed
                    "2186204", // Wicks  — re-queued
                    "2203179", // Landow — re-queued
                    "2222233", // Province — re-queued
                    "2199336", // Koch — still working
                  ]);

                  return filteredPrescriptions.map((prescription: any, idx: number) => {
                  const key = batchKeys[idx];
                  const isMultiBatch = keyCounts[key] > 1;
                  const isFirstInBatch = isMultiBatch && !seenKeys.has(key);
                  seenKeys.add(key);
                  const batchSize = keyCounts[key];
                  const colorIdx = keyColorMap[key] ?? 0;
                  const isWatched = GREENWICH_WATCH_QUEUE_IDS.has(
                    String(prescription.queueId ?? "").trim()
                  );

                  return (
                  <TableRow
                    key={prescription.id}
                    className={`cursor-pointer transition-colors hover:bg-blue-50/50`}
                    style={isWatched ? {
                      backgroundColor: "#FEF3C7", // amber-100
                      borderLeft: "4px solid #D97706", // amber-600
                    } : isMultiBatch ? {
                      backgroundColor: groupBgs[colorIdx],
                      borderLeft: `4px solid ${groupBorders[colorIdx]}`,
                    } : {
                      backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA",
                    }}
                    onClick={() => { setSubmitResult(null); setSelectedPrescription(prescription); }}
                    data-testid={`row-prescription-${prescription.id}`}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {(() => {
                        // ─────────────────────────────────────────────────────
                        // 3-STATE PAYMENT/SUBMISSION LABEL (May 2026)
                        // ─────────────────────────────────────────────────────
                        // The previous 2-state label said "Pending payment" for
                        // any rx without sentToPharmacyAt — even after the
                        // patient HAD paid (status moved to
                        // submitting_to_pharmacy). That misled admins into
                        // thinking the patient still owed money. Fix:
                        //   • Not paid yet              → "Awaiting payment"
                        //   • Paid but not yet at pharm → "Pending pharmacy submission"
                        //   • At pharmacy               → "Sent to pharmacy Xd later"
                        const ordered = prescription.submittedAt ? new Date(prescription.submittedAt) : null;
                        const paid = prescription.sentToPharmacyAt ? new Date(prescription.sentToPharmacyAt) : null;
                        const isPaid = prescription.paymentStatus === "paid";

                        // PAID-NO-LEDGER DETECTION DISABLED on May 1, 2026.
                        // Misfires on any legacy paid rx where the
                        // payment_transaction_id link was never backfilled
                        // by older code paths. The fan-out fixes in the
                        // webhook + verify-and-complete routes already
                        // prevent any new corruption of this shape from
                        // being created — the UI alarm is unnecessary
                        // and was creating false positives.
                        const paidNoLedger = false;

                        const paidLabel = (() => {
                          if (paidNoLedger) return "Paid (no ledger) — investigate";
                          if (paid && ordered) {
                            const diffMs = paid.getTime() - ordered.getTime();
                            const diffH = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffD = Math.floor(diffH / 24);
                            if (diffD >= 1) return `Sent to pharmacy ${diffD}d later`;
                            if (diffH >= 1) return `Sent to pharmacy ${diffH}h later`;
                            return "Sent to pharmacy same day";
                          }
                          if (isPaid) return "Pending pharmacy submission";
                          return "Awaiting payment";
                        })();

                        // Color coding: red = patient hasn't paid OR paid-no-ledger
                        // corruption; amber = paid but stuck pre-pharmacy; muted = at pharmacy
                        const labelColor = paidNoLedger
                          ? "text-red-600 font-bold"
                          : paid
                            ? "text-muted-foreground"
                            : isPaid
                              ? "text-amber-600"
                              : "text-red-600";

                        const { late, hoursStuck } = isOrderLate(prescription);
                        const daysStuck = Math.floor(hoursStuck / 24);
                        const lateLabel = daysStuck >= 1 ? `${daysStuck}d` : `${hoursStuck}h`;
                        const tooltip = `Ordered ${ordered ? formatDateTime(prescription.submittedAt) : "—"}${
                          paid
                            ? `\nSent to pharmacy ${formatDateTime(prescription.sentToPharmacyAt!)}`
                            : isPaid
                              ? "\nPaid — awaiting pharmacy submission"
                              : "\nPatient has NOT paid yet"
                        }${late ? `\n\n⚑ LATE: At pharmacy ${hoursStuck}h (>${LATE_THRESHOLD_HOURS}h threshold) and not yet shipped` : ""}`;
                        return (
                          <div className="flex flex-col leading-tight gap-0.5" title={tooltip}>
                            {/* LATE badge hidden May 12 2026 — queue is clean,
                                Greenwich PAUSED is now correctly shown as
                                "In Production ⭐". Filter logic preserved for
                                future re-enable; only the visual chip is gone. */}
                            {false && late && (
                              <span
                                className="inline-flex items-center gap-0.5 self-start text-[9px] font-bold uppercase px-1.5 py-0 rounded bg-red-600 text-white tracking-wide"
                                data-testid={`flag-late-${prescription.id}`}
                              >
                                <Flag className="w-2.5 h-2.5" /> Late · {lateLabel}
                              </span>
                            )}
                            <span data-testid={`text-ordered-${prescription.id}`}>
                              {ordered ? formatDateTime(prescription.submittedAt) : "—"}
                            </span>
                            <span
                              className={`text-[11px] ${labelColor}`}
                              data-testid={`text-paid-${prescription.id}`}
                            >
                              {paidLabel}
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {prescription.providerName}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {prescription.patientName}
                        {isFirstInBatch && isMultiBatch && (
                          <span className="ml-1 inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: groupBorders[colorIdx] }}>
                            {batchSize} items
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-col">
                        <span
                          className="font-medium truncate"
                          title={prescription.medication}
                        >
                          {prescription.medication}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {prescription.strength}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>Qty: {prescription.quantity}</span>
                        <span className="text-muted-foreground">
                          Ref: {prescription.refills}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-price-${prescription.id}`}>
                      {prescription.patientPrice != null ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-green-700">${prescription.patientPrice.toFixed(2)}</span>
                          {(prescription.shippingFeeCents ?? 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              +${((prescription.shippingFeeCents ?? 0) / 100).toFixed(2)} ship
                            </span>
                          )}
                          {(() => {
                            // ─────────────────────────────────────────────
                            // PAID/OWED MISMATCH BADGE (May 2026, Greenwich)
                            // ─────────────────────────────────────────────
                            // Show a red badge when the rx is part of a
                            // group AND the group has been partially paid
                            // (paidCents > 0) but the collected amount is
                            // less than the total owed across the group.
                            // This catches the exact failure mode of the
                            // Rahmany incident: a single rx in the group
                            // was billed, partial payment cleared, but
                            // the rest of the group never recovered.
                            if (!prescription.submissionGroupId) return null;
                            if (prescription.groupPaidCents == null) return null;
                            // FAKE-PAID CASE A DISABLED on May 1, 2026.
                            // Misfired on every legitimately paid grouped
                            // order because the API's groupPaidCents query
                            // only counts payment_transactions whose
                            // order_group_id column is populated; legacy
                            // single-rx payments have NULL order_group_id
                            // on the tx row, so their group reads as $0
                            // collected and every paid rx in the group
                            // would erroneously show "Fake-paid". Restored
                            // original early-return so only true under-paid
                            // groups (CASE B below) trigger the badge.
                            if (prescription.groupPaidCents <= 0) return null;

                            // Sum owed across all rxs in this group, from
                            // the in-memory list snapshot (already loaded).
                            const groupRows = prescriptions.filter(
                              (r) => r.submissionGroupId === prescription.submissionGroupId,
                            );
                            if (groupRows.length === 0) return null;

                            let owedCents = 0;
                            for (const r of groupRows) {
                              const med = r.patientPrice != null ? Math.round(Number(r.patientPrice) * 100) : 0;
                              owedCents += med + (r.shippingFeeCents ?? 0) + (r.profitCents ?? 0);
                            }

                            const paidCents = prescription.groupPaidCents;
                            const shortBy = owedCents - paidCents;

                            // CASE B — UNDER-PAID GROUP (original logic):
                            // Some money collected but less than owed.
                            if (shortBy <= 50) return null; // ignore <$0.50 rounding noise

                            return (
                              <span
                                className="mt-1 inline-flex items-center gap-1 self-start text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white tracking-wide"
                                title={`Group has collected $${(paidCents / 100).toFixed(2)} of $${(owedCents / 100).toFixed(2)} owed (short $${(shortBy / 100).toFixed(2)}). Investigate before submitting any rx in this group.`}
                                data-testid={`badge-paid-mismatch-${prescription.id}`}
                              >
                                ⚠ Paid ${(paidCents / 100).toFixed(2)} / Owed ${(owedCents / 100).toFixed(2)}
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {prescription.pharmacyName ? (
                        <span className="font-medium text-sm" style={{ color: prescription.pharmacyColor || "#1E3A8A" }}>
                          {prescription.pharmacyName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not specified</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-queue-id-${prescription.id}`}>
                      <div className="flex flex-col items-start gap-1">
                        {prescription.queueId && prescription.queueId !== "N/A" ? (
                          <span className="font-mono text-sm font-semibold text-gray-800">
                            {prescription.queueId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">--</span>
                        )}
                        {/* Greenwich PDF health badge — Trevor Haynes incident,
                            May 7-8 2026. Server-side auto-heal in
                            submit-to-pharmacy-core ensures every Greenwich
                            submission ships with the proper Electronic Rx,
                            so this badge should always be green. A red badge
                            here means the auto-heal itself failed AND the
                            order still went out (per Joseph's "nothing stops
                            the order" rule) — that is a real bug to fix. */}
                        {/* Green "PDF ✓" badge intentionally hidden — a checkmark
                            on every row is visual noise. Only the red "PDF !"
                            badge is rendered (below) so the column lights up
                            ONLY when an order needs operator attention. */}
                        {prescription.pdfHealth === "bad" && (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-700 border-red-400 text-[10px] px-1.5 py-0 font-semibold whitespace-nowrap"
                            title={(() => {
                              const r = prescription.pdfHealthReason || "";
                              if (r.startsWith("content:")) return `Greenwich PDF content failed validation (${r.slice(8)}). Likely missing the AIM drug-name prefix because the prescription has no catalog medication. Order shipped — fix and re-submit.`;
                              if (r === "no_push_confirmation") return "Submitted to Greenwich but the PDF was never confirmed pushed. Race victim: order went out, but Greenwich likely never received the Electronic Rx. Resend.";
                              if (r === "storage_lookup_failed") return "Could not verify the Greenwich PDF in storage (storage lookup failed). Investigate before assuming healthy.";
                              if (r === "no_storage_path") return "Submitted to Greenwich with no PDF path on the row at all. Order shipped without a PDF.";
                              if (r === "storage_row_missing") return "PDF path is set but the file is missing from storage. Order shipped without a PDF.";
                              if (r.startsWith("size_")) return `PDF is image-only / too small (${r}). Server auto-heal failed — order still shipped per the no-block rule.`;
                              return "Greenwich PDF health check failed. Investigate this row.";
                            })()}
                            data-testid={`badge-pdf-bad-${prescription.id}`}
                          >
                            PDF !
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p
                        className="text-sm truncate cursor-help"
                        title={prescription.sig}
                      >
                        {prescription.sig}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(getEffectiveStatus(prescription))} text-xs px-2 py-1 whitespace-nowrap`}
                        >
                          {formatStatusLabel(getEffectiveStatus(prescription))}
                        </Badge>
                        {prescription.statusUpdatedAt && (
                          <span
                            className="text-[11px] text-muted-foreground whitespace-nowrap"
                            data-testid={`text-status-date-${prescription.id}`}
                            title={`Status last changed at ${new Date(prescription.statusUpdatedAt).toLocaleString()}`}
                          >
                            since {new Date(prescription.statusUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {new Date(prescription.statusUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                });
                })()
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !isCancelling) closeCancelDialog();
        }}
      >
        <DialogContent className="max-w-lg" data-testid="modal-cancel-order">
          {cancelTarget && (() => {
            const lastName =
              (cancelTarget.patientName || "").trim().split(/\s+/).slice(-1)[0] || "";
            const lastNameMatch =
              lastName.length > 0 &&
              cancelConfirmName.trim().toLowerCase() === lastName.toLowerCase();
            const canSubmit = !!cancelReason && lastNameMatch && !isCancelling;
            const isPaid = cancelTarget.paymentStatus === "paid";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl text-red-700" data-testid="text-cancel-title">
                    Cancel Order
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div
                    className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm space-y-1"
                    data-testid="text-cancel-summary"
                  >
                    <div>
                      <span className="text-muted-foreground">Patient: </span>
                      <span className="font-medium">{cancelTarget.patientName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Medication: </span>
                      <span className="font-medium">
                        {cancelTarget.medication}
                        {cancelTarget.strength ? ` ${cancelTarget.strength}` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Quantity: </span>
                      <span className="font-medium">{cancelTarget.quantity}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment: </span>
                      <span className="font-medium">
                        {cancelTarget.paymentStatus || "unpaid"}
                        {isPaid && cancelTarget.patientPrice != null
                          ? ` — $${cancelTarget.patientPrice.toFixed(2)}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cancel-reason">
                      Reason <span className="text-red-600">*</span>
                    </Label>
                    <Select value={cancelReason} onValueChange={setCancelReason}>
                      <SelectTrigger id="cancel-reason" data-testid="select-cancel-reason">
                        <SelectValue placeholder="Choose a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                        <SelectItem value="Patient Request">Patient Request</SelectItem>
                        <SelectItem value="Clinical Hold">Clinical Hold</SelectItem>
                        <SelectItem value="Pharmacy Rejection">Pharmacy Rejection</SelectItem>
                        <SelectItem value="Duplicate Order">Duplicate Order</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cancel-note">
                      Internal note{" "}
                      <span className="text-muted-foreground text-xs font-normal">
                        (optional, logged but not emailed)
                      </span>
                    </Label>
                    <Textarea
                      id="cancel-note"
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      rows={2}
                      placeholder="Anything else worth recording…"
                      data-testid="input-cancel-note"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cancel-confirm">
                      Type the patient&apos;s last name (
                      <span className="font-mono text-foreground">{lastName}</span>) to confirm{" "}
                      <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="cancel-confirm"
                      value={cancelConfirmName}
                      onChange={(e) => setCancelConfirmName(e.target.value)}
                      placeholder="Patient's last name"
                      autoComplete="off"
                      data-testid="input-cancel-confirm"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCancelDialog}
                    disabled={isCancelling}
                    data-testid="button-cancel-nevermind"
                  >
                    Nevermind
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleCancelOrder(cancelTarget)}
                    disabled={!canSubmit}
                    data-testid="button-cancel-confirm"
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Cancelling…
                      </>
                    ) : (
                      "Cancel order"
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPrescription} onOpenChange={(open) => { if (!open) { setSelectedPrescription(null); setSubmitResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-prescription-detail">
          {selectedPrescription && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-xl font-bold text-[#1E3A8A]">
                    Prescription Details
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(getEffectiveStatus(selectedPrescription))} text-xs px-2.5 py-1`}
                  >
                    {formatStatusLabel(getEffectiveStatus(selectedPrescription))}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
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
                      <p className="text-sm font-semibold" data-testid="text-submitted-date">{formatDateTime(selectedPrescription.submittedAt)}</p>
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

                <PrescriptionProgressTracker
                  status={getEffectiveStatus(selectedPrescription)}
                  trackingNumber={selectedPrescription.trackingNumber}
                  pharmacyName={selectedPrescription.pharmacyName}
                  billingStatus={selectedPrescription.billingStatus ?? (selectedPrescription.paymentStatus === "paid" ? "paid" : undefined)}
                  patientCopay={selectedPrescription.patientCopay}
                  carrierStatus={selectedPrescription.carrierStatus}
                  trackingCarrier={selectedPrescription.trackingCarrier}
                  estimatedDelivery={selectedPrescription.estimatedDelivery}
                />

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

                {(() => {
                  // Modal group: include ONLY the rxs in the same submission
                  // group that share the selected rx's payment status. After
                  // the Greenwich/Rahmany Phase C recovery, the paid Pinealon
                  // must render alone, while the 5 reset rxs render together
                  // as one $449.50 bulk-rebill group. Without this filter the
                  // Group Total would mix paid and unpaid items.
                  const selectedPaidBucket =
                    selectedPrescription.paymentStatus === "paid" ? "paid" : "unpaid";
                  const groupMembers = selectedPrescription.submissionGroupId
                    ? prescriptions.filter(
                        (p) =>
                          p.submissionGroupId === selectedPrescription.submissionGroupId &&
                          (p.paymentStatus === "paid" ? "paid" : "unpaid") === selectedPaidBucket,
                      )
                    : [selectedPrescription];
                  const isGrouped = groupMembers.length > 1;
                  // GROUP TOTAL CALCULATION (Greenwich/Rahmany incident
                  // remediation, May 2026). Explicit for-loop with typeof-
                  // guarded coercion and per-iteration NaN protection.
                  // Negative profit_cents (data corruption from partial-
                  // payment incidents) is clamped to zero so it cannot
                  // silently reduce the patient-facing total.
                  let groupTotalMedCents = 0;
                  let groupTotalShippingCents = 0;
                  let groupTotalOversightCents = 0;
                  for (const m of groupMembers) {
                    const rawPrice = m.patientPrice;
                    const priceN =
                      typeof rawPrice === "number"
                        ? rawPrice
                        : rawPrice == null
                          ? 0
                          : parseFloat(String(rawPrice));
                    if (Number.isFinite(priceN)) {
                      groupTotalMedCents += Math.round(priceN * 100);
                    }
                    const rawShip = m.shippingFeeCents;
                    const shipN =
                      typeof rawShip === "number"
                        ? rawShip
                        : rawShip == null
                          ? 0
                          : parseFloat(String(rawShip));
                    if (Number.isFinite(shipN)) {
                      groupTotalShippingCents += Math.round(shipN);
                    }
                    const rawOver = m.profitCents;
                    const overN =
                      typeof rawOver === "number"
                        ? rawOver
                        : rawOver == null
                          ? 0
                          : parseFloat(String(rawOver));
                    // Defensive clamp: profit_cents represents an internal
                    // pharmacy margin/oversight fee and must never be added
                    // to a patient total as a NEGATIVE number. The Greenwich/
                    // Rahmany incident left several rxs with profit_cents
                    // = -patient_price_cents which silently zeroed the
                    // displayed Group Total. Negative or non-finite values
                    // contribute zero — they never reduce the total.
                    if (Number.isFinite(overN) && overN > 0) {
                      groupTotalOversightCents += Math.round(overN);
                    }
                  }
                  const groupTotalCents =
                    groupTotalMedCents + groupTotalShippingCents + groupTotalOversightCents;
                  const groupTotalMed = groupTotalMedCents / 100;
                  const groupTotalShipping = groupTotalShippingCents;
                  const groupTotalOversight = groupTotalOversightCents;
                  const groupTotal = groupTotalCents / 100;
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-sm text-green-900 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Pricing
                        {isGrouped && (
                          <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {groupMembers.length} items in group
                          </Badge>
                        )}
                      </h4>
                      {isGrouped ? (
                        <div className="space-y-2">
                          {groupMembers.map((gm) => (
                            <div key={gm.id} className={`flex items-center justify-between text-sm px-2 py-1.5 rounded ${gm.id === selectedPrescription.id ? "bg-green-100 font-semibold" : "bg-white"}`} data-testid={`text-group-item-${gm.id}`}>
                              <span className="truncate mr-2">{gm.medication}</span>
                              <span className="whitespace-nowrap">
                                {gm.patientPrice != null ? `$${Number(gm.patientPrice).toFixed(2)}` : "No price"}
                                {(Number(gm.shippingFeeCents) || 0) > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">+${((Number(gm.shippingFeeCents) || 0) / 100).toFixed(2)} ship</span>
                                )}
                              </span>
                            </div>
                          ))}
                          {(groupTotalShipping > 0 || groupTotalOversight > 0) && (
                            <div className="border-t border-green-200 pt-2 px-2 space-y-1">
                              {groupTotalShipping > 0 && (
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Shipping & Handling</span>
                                  <span>${(groupTotalShipping / 100).toFixed(2)}</span>
                                </div>
                              )}
                              {groupTotalOversight > 0 && (
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Oversight & Monitoring</span>
                                  <span>${(groupTotalOversight / 100).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="border-t border-green-300 pt-2 flex items-center justify-between px-2">
                            <span className="text-sm font-semibold text-green-900">Group Total</span>
                            <span className="text-base font-bold text-green-800" data-testid="text-group-total">${groupTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          // Defensive Number() coercion + integer-cents math
                          // for the single-rx (non-grouped) branch — same
                          // hardening pattern as the group branch above.
                          const singleMedCents =
                            selectedPrescription.patientPrice != null
                              ? Math.round(Number(selectedPrescription.patientPrice) * 100)
                              : null;
                          const singleShippingCents = Number(selectedPrescription.shippingFeeCents) || 0;
                          const rawSingleOver = Number(selectedPrescription.profitCents);
                          // Same defensive clamp as the group branch:
                          // negative profit_cents (data-corruption from
                          // partial-payment incidents) must never reduce
                          // the patient-facing total.
                          const singleOversightCents =
                            Number.isFinite(rawSingleOver) && rawSingleOver > 0
                              ? rawSingleOver
                              : 0;
                          const singleTotalCents =
                            singleMedCents != null
                              ? singleMedCents + singleShippingCents + singleOversightCents
                              : null;
                          return (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Medication Cost</p>
                                <p className="text-sm font-semibold" data-testid="text-med-cost">
                                  {singleMedCents != null ? `$${(singleMedCents / 100).toFixed(2)}` : "Not set"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Shipping</p>
                                <p className="text-sm font-semibold" data-testid="text-shipping">
                                  ${(singleShippingCents / 100).toFixed(2)}
                                </p>
                              </div>
                              {singleOversightCents > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Oversight & Monitoring</p>
                                  <p className="text-sm font-semibold" data-testid="text-oversight">
                                    ${(singleOversightCents / 100).toFixed(2)}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="text-base font-bold text-green-800" data-testid="text-total">
                                  {singleTotalCents != null ? `$${(singleTotalCents / 100).toFixed(2)}` : "Not set"}
                                </p>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  );
                })()}

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#1E3A8A]" />
                    Shipping Address
                  </h4>
                  {(() => {
                    const addr = selectedPrescription.hasCustomAddress && selectedPrescription.customAddress
                      ? selectedPrescription.customAddress
                      : selectedPrescription.patientAddress;
                    if (addr && (addr.street || addr.city)) {
                      return (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900" data-testid="text-shipping-address">
                              {[addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")}
                            </p>
                            {selectedPrescription.hasCustomAddress && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                                Custom address for this order
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <p className="text-amber-600 font-medium" data-testid="text-no-address">No shipping address on file</p>
                    );
                  })()}

                  {!showAddressEdit ? (
                    <div className="pt-2 border-t border-gray-200">
                      <Button type="button" variant="outline" size="sm" data-testid="btn-admin-edit-address" onClick={() => {
                        const addr = selectedPrescription.hasCustomAddress && selectedPrescription.customAddress
                          ? selectedPrescription.customAddress
                          : selectedPrescription.patientAddress;
                        setEditAddress({
                          street: addr?.street || "",
                          city: addr?.city || "",
                          state: addr?.state || "",
                          zipCode: addr?.zipCode || "",
                          country: addr?.country || "US",
                        });
                        setShowAddressEdit(true);
                      }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit Shipping Address
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900">Update Shipping Address</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddressEdit(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-edit-street">Street Address</Label>
                        <Input id="admin-edit-street" data-testid="input-admin-edit-street" placeholder="123 Main St" value={editAddress.street || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, street: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="admin-edit-city">City</Label>
                          <Input id="admin-edit-city" data-testid="input-admin-edit-city" placeholder="City" value={editAddress.city || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, city: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-edit-state">State</Label>
                          <Input id="admin-edit-state" data-testid="input-admin-edit-state" placeholder="FL" value={editAddress.state || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, state: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="admin-edit-zip">Zip Code</Label>
                          <Input id="admin-edit-zip" data-testid="input-admin-edit-zip" placeholder="33101" value={editAddress.zipCode || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, zipCode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-edit-country">Country</Label>
                          <Input id="admin-edit-country" data-testid="input-admin-edit-country" placeholder="US" value={editAddress.country || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, country: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" data-testid="btn-admin-save-address-patient" disabled={savingAddress || !editAddress.street?.trim() || !editAddress.city?.trim()} onClick={async () => {
                          setSavingAddress(true);
                          try {
                            const res = await fetch(`/api/prescriptions/${selectedPrescription.id}/update-address`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ address: editAddress, saveToPatient: true }),
                            });
                            const result = await res.json();
                            if (!res.ok || !result.success) throw new Error(result.error || "Failed to update address");
                            setSelectedPrescription({
                              ...selectedPrescription,
                              hasCustomAddress: true,
                              customAddress: { ...editAddress },
                              patientAddress: { ...editAddress },
                            });
                            setShowAddressEdit(false);
                            if (result.pharmacyNotified && result.notifiedRecipients?.length > 0) {
                              setAddressNotification({ recipients: result.notifiedRecipients });
                              toast.success("Address updated — pharmacy has been notified");
                            } else {
                              setAddressNotification(null);
                              toast.success(result.message || "Address updated on prescription and patient record");
                            }
                            loadPrescriptions();
                          } catch (err) {
                            console.error("Failed to update address:", err);
                            toast.error("Failed to update address");
                          } finally {
                            setSavingAddress(false);
                          }
                        }}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          {savingAddress ? "Saving..." : "Save to Patient Record & Prescription"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" data-testid="btn-admin-save-address-rx-only" disabled={savingAddress || !editAddress.street?.trim() || !editAddress.city?.trim()} onClick={async () => {
                          setSavingAddress(true);
                          try {
                            const res = await fetch(`/api/prescriptions/${selectedPrescription.id}/update-address`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ address: editAddress, saveToPatient: false }),
                            });
                            const result = await res.json();
                            if (!res.ok || !result.success) throw new Error(result.error || "Failed to update address");
                            setSelectedPrescription({
                              ...selectedPrescription,
                              hasCustomAddress: true,
                              customAddress: { ...editAddress },
                            });
                            setShowAddressEdit(false);
                            if (result.pharmacyNotified && result.notifiedRecipients?.length > 0) {
                              setAddressNotification({ recipients: result.notifiedRecipients });
                              toast.success("Address updated — pharmacy has been notified");
                            } else {
                              setAddressNotification(null);
                              toast.success(result.message || "Address updated on this prescription only");
                            }
                            loadPrescriptions();
                          } catch (err) {
                            console.error("Failed to update address:", err);
                            toast.error("Failed to update address");
                          } finally {
                            setSavingAddress(false);
                          }
                        }}>
                          <Truck className="mr-1.5 h-3.5 w-3.5" />
                          {savingAddress ? "Saving..." : "This Prescription Only"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowAddressEdit(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {addressNotification && addressNotification.recipients.length > 0 && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2" data-testid="address-notification-banner">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Pharmacy notified via email</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          Sent to: {addressNotification.recipients.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {getEffectiveStatus(selectedPrescription) === "pending_payment" && (() => {
                  const payGroupMembers = selectedPrescription.submissionGroupId
                    ? prescriptions.filter(p => p.submissionGroupId === selectedPrescription.submissionGroupId && p.paymentStatus !== "paid")
                    : [selectedPrescription];
                  const payIsGrouped = payGroupMembers.length > 1;

                  return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm text-blue-900 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Payment Actions
                      {payIsGrouped && (
                        <Badge variant="outline" className="ml-1 text-xs bg-blue-100 text-blue-800 border-blue-300">
                          Applies to all {payGroupMembers.length} items
                        </Badge>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Patient Email</p>
                        <p className="text-sm font-medium" data-testid="text-patient-email">
                          {selectedPrescription.patientEmail || "Not on file"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Button
                        onClick={() => handleSendPaymentLink(selectedPrescription)}
                        disabled={isSendingPaymentLink || !selectedPrescription.patientEmail || selectedPrescription.patientPrice == null}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-send-payment-link"
                      >
                        {isSendingPaymentLink ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending Payment Link...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            {payIsGrouped ? `Send Payment Link (${payGroupMembers.length} items)` : "Send Payment Link to Patient"}
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleMarkAsPaid(selectedPrescription.id)}
                        disabled={isMarkingPaid}
                        variant="outline"
                        className="w-full border-violet-300 text-violet-700 hover:bg-violet-50"
                        data-testid="button-mark-as-paid"
                      >
                        {isMarkingPaid ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Marking as Paid...
                          </>
                        ) : (
                          <>
                            <BadgeDollarSign className="h-4 w-4 mr-2" />
                            {payIsGrouped ? `Mark All ${payGroupMembers.length} Items as Paid` : "Mark as Paid"}
                          </>
                        )}
                      </Button>
                    </div>

                    {paymentLinkResult && (
                      <div className={`flex items-center gap-2 text-sm mt-2 ${paymentLinkResult.success ? "text-green-600" : "text-red-600"}`}>
                        {paymentLinkResult.success && <CheckCircle2 className="h-4 w-4" />}
                        {!paymentLinkResult.success && <AlertCircle className="h-4 w-4" />}
                        {paymentLinkResult.message}
                      </div>
                    )}
                  </div>
                  );
                })()}

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
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Submitting to Pharmacy...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit to Pharmacy
                        </>
                      )}
                    </Button>
                    {submitResult && (
                      <p className={`text-sm mt-2 text-center ${submitResult.success ? "text-green-600" : "text-red-600"}`}>
                        {submitResult.message}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  {!showOverrideForm && getEffectiveStatus(selectedPrescription) !== "cancelled" && (
                    <Button
                      variant="outline"
                      onClick={() => setCancelTarget(selectedPrescription)}
                      className="w-full border-red-300 text-red-700 hover:bg-red-50"
                      data-testid="button-open-cancel"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Order (stop all polling + notify)
                    </Button>
                  )}
                  {!showOverrideForm ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowOverrideForm(true);
                        setOverrideStatus(getEffectiveStatus(selectedPrescription));
                        setOverrideTracking(selectedPrescription.trackingNumber || "");
                      }}
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                      data-testid="button-open-override"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Manual Status / Tracking Override
                    </Button>
                  ) : (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3" data-testid="form-admin-override">
                      <h4 className="font-semibold text-sm text-orange-900 flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Manual Override
                      </h4>
                      <p className="text-xs text-orange-700">
                        Use this when the pharmacy confirms a status change but DigitalRx API hasn&apos;t updated. The patient will be notified automatically.
                      </p>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Status</Label>
                        <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                          <SelectTrigger className="bg-white" data-testid="select-override-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="packed">Packed</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="picked_up">Shipped / Picked Up</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Tracking Number</Label>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <Input
                            value={overrideTracking}
                            onChange={(e) => setOverrideTracking(e.target.value)}
                            placeholder="e.g. 870226650547"
                            className="bg-white"
                            data-testid="input-override-tracking"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Note (optional)</Label>
                        <Input
                          value={overrideNote}
                          onChange={(e) => setOverrideNote(e.target.value)}
                          placeholder="e.g. Confirmed by Leyla via email"
                          className="bg-white"
                          data-testid="input-override-note"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => handleAdminOverride(selectedPrescription.id)}
                          disabled={isOverriding || (!overrideStatus && !overrideTracking.trim())}
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                          data-testid="button-apply-override"
                        >
                          {isOverriding ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Package className="h-4 w-4 mr-2" />
                              Apply Override
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => { setShowOverrideForm(false); setOverrideResult(null); }}
                          className="text-gray-500"
                          data-testid="button-cancel-override"
                        >
                          Cancel
                        </Button>
                      </div>

                      {overrideResult && (
                        <div className={`flex items-center gap-2 text-sm ${overrideResult.success ? "text-green-600" : "text-red-600"}`}>
                          {overrideResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                          {overrideResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
