"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DefaultLayout from "@/components/layout/DefaultLayout";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCw, CalendarClock, SkipForward, XCircle } from "lucide-react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { toast } from "sonner";
import { PrescriptionModals } from "../prescriptions/_components/PrescriptionModals";

// Force dynamic rendering - refills are user-specific
export const dynamic = "force-dynamic";

// Print styles (same as prescriptions page)
const printStyles = `
@media print {
  @page { size: auto; margin: 7mm; }
  #__next > *:not([data-radix-portal]),
  body > div:first-child > *:not([data-radix-portal]) { display: none !important; }
  .print-hide { display: none !important; }
  [data-radix-dialog-overlay] { display: none !important; }
  [role="dialog"] {
    position: static !important; transform: none !important;
    max-height: none !important; max-width: 100% !important;
    width: 100% !important; overflow: visible !important;
    box-shadow: none !important; border: none !important;
    background: white !important; padding: 0 !important;
  }
  [role="dialog"] button[class*="absolute"][class*="right"],
  [role="dialog"] > button:first-child { display: none !important; }
  [data-radix-portal] { display: block !important; position: static !important; }
}
`;

interface Refill {
  id: string;
  queueId: string;
  dateTime: string;
  patientName: string;
  patientEmail?: string;
  patientDOB?: string;
  doctorName?: string;
  medication: string;
  strength: string;
  quantity: number;
  refills: number;
  status: string;
  sig: string;
  form: string;
  dispenseAsWritten: boolean;
  pharmacyNotes?: string;
  trackingNumber?: string;
  patientPrice?: string;
  vialSize?: string;
  dosageAmount?: string;
  dosageUnit?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  profitCents?: number;
  shippingFeeCents?: number;
  totalPaidCents?: number;
  paymentStatus?: string;
  pdfStoragePath?: string;
  consultationReason?: string;
  // Refill-specific fields
  parentPrescriptionId?: string;
  parentSubmittedAt?: string;
  refillNumber?: number;
}

interface ScheduledRefill {
  id: string;
  patientName: string;
  medication: string;
  strength: string;
  nextRefillDate: string;
  totalRefillsToDate: number;
  refills: number;
  pharmacyName?: string;
  pharmacyColor?: string;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "billing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "processing":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatStatusLabel = (status: string) => {
  const trimmed = status.trim();
  if (!trimmed) return "";
  if (trimmed.toUpperCase() === "N/A") return "N/A";
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ""))
    .join(" ");
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

interface DigitalRxStatusData {
  BillingStatus?: string;
  PackDateTime?: string;
  ApprovedDate?: string;
  PickupDate?: string;
  DeliveredDate?: string;
  TrackingNumber?: string;
}

const mapDigitalRxStatus = (
  statusData: DigitalRxStatusData,
): { status: string; trackingNumber?: string } => {
  if (statusData.DeliveredDate) {
    return { status: "Delivered", trackingNumber: statusData.TrackingNumber };
  } else if (statusData.PickupDate) {
    return { status: "Shipped", trackingNumber: statusData.TrackingNumber };
  } else if (statusData.ApprovedDate) {
    return { status: "Approved" };
  } else if (statusData.PackDateTime) {
    return { status: "Processing" };
  } else if (statusData.BillingStatus) {
    return { status: "Billing" };
  }
  return { status: "Submitted" };
};

export default function RefillsPage() {
  const supabase = createClient();
  const { user } = useUser();
  const router = useRouter();
  const [refills, setRefills] = useState<Refill[]>([]);
  const [selectedPrescription, setSelectedPrescription] =
    useState<Refill | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"in-progress" | "scheduled">(
    "in-progress",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduledRefills, setScheduledRefills] = useState<ScheduledRefill[]>(
    [],
  );
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isSubmittingToPharmacy, setIsSubmittingToPharmacy] = useState(false);
  const [scheduledActionTarget, setScheduledActionTarget] =
    useState<ScheduledRefill | null>(null);

  const loadRefills = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        queue_id,
        submitted_at,
        medication,
        dosage,
        dosage_amount,
        dosage_unit,
        vial_size,
        form,
        quantity,
        refills,
        sig,
        dispense_as_written,
        pharmacy_notes,
        patient_price,
        profit_cents,
        consultation_reason,
        shipping_fee_cents,
        total_paid_cents,
        status,
        payment_status,
        tracking_number,
        pharmacy_id,
        pdf_storage_path,
        parent_prescription_id,
        patient:patients(first_name, last_name, date_of_birth, email),
        pharmacy:pharmacies(name, primary_color)
      `,
      )
      .eq("prescriber_id", user.id)
      .eq("prescription_type", "refill")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error loading refills:", error);
      return;
    }

    // Fetch doctor name
    const { data: providerData } = await supabase
      .from("providers")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single();

    if (data) {
      const doctorName = providerData
        ? `Dr. ${providerData.first_name} ${providerData.last_name}`
        : "Unknown Provider";

      // Collect unique parent IDs to fetch parent info
      const parentIds = [
        ...new Set(
          data
            .map((rx) => rx.parent_prescription_id)
            .filter(Boolean) as string[],
        ),
      ];

      // Fetch parent prescriptions for "Original Rx" column
      let parentMap: Record<string, { submitted_at: string }> = {};
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from("prescriptions")
          .select("id, submitted_at")
          .in("id", parentIds);

        if (parents) {
          parentMap = Object.fromEntries(
            parents.map((p) => [p.id, { submitted_at: p.submitted_at }]),
          );
        }
      }

      // Count refills per parent to determine refill number
      const parentRefillCounts: Record<string, string[]> = {};
      // Sort by submitted_at ascending to number refills in order
      const sorted = [...data].sort(
        (a, b) =>
          new Date(a.submitted_at).getTime() -
          new Date(b.submitted_at).getTime(),
      );
      for (const rx of sorted) {
        const pid = rx.parent_prescription_id;
        if (pid) {
          if (!parentRefillCounts[pid]) parentRefillCounts[pid] = [];
          parentRefillCounts[pid].push(rx.id);
        }
      }

      const formatted: Refill[] = data.map((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        const pharmacy = Array.isArray(rx.pharmacy)
          ? rx.pharmacy[0]
          : rx.pharmacy;
        const parentId = rx.parent_prescription_id;
        const parent = parentId ? parentMap[parentId] : undefined;

        // Determine refill number (position among siblings)
        let refillNumber = 1;
        if (parentId && parentRefillCounts[parentId]) {
          refillNumber = parentRefillCounts[parentId].indexOf(rx.id) + 1;
        }

        return {
          id: rx.id,
          queueId: rx.queue_id || "N/A",
          dateTime: rx.submitted_at,
          patientName: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",
          patientEmail: patient?.email,
          patientDOB: patient?.date_of_birth,
          doctorName,
          medication: rx.medication,
          strength: rx.dosage,
          quantity: rx.quantity,
          refills: rx.refills,
          sig: rx.sig,
          status: rx.status || "submitted",
          trackingNumber: rx.tracking_number,
          form: rx.form,
          dispenseAsWritten: rx.dispense_as_written || false,
          pharmacyNotes: rx.pharmacy_notes,
          patientPrice: rx.patient_price,
          vialSize: rx.vial_size,
          dosageAmount: rx.dosage_amount,
          dosageUnit: rx.dosage_unit,
          pharmacyName: pharmacy?.name,
          pharmacyColor: pharmacy?.primary_color,
          profitCents: rx.profit_cents,
          consultationReason: rx.consultation_reason as string | undefined,
          shippingFeeCents: rx.shipping_fee_cents,
          totalPaidCents: rx.total_paid_cents,
          paymentStatus: rx.payment_status,
          pdfStoragePath: rx.pdf_storage_path,
          parentPrescriptionId: parentId || undefined,
          parentSubmittedAt: parent?.submitted_at,
          refillNumber,
        };
      });

      setRefills(formatted);
    }
  }, [supabase, user?.id]);

  const loadScheduledRefills = useCallback(async () => {
    if (!user?.id) return;

    // Calculate today start and end-of-tomorrow in UTC
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const tomorrowEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 2,
    ).toISOString();

    const { data, error } = await supabase
      .from("prescriptions")
      .select(
        `
        id,
        medication,
        dosage,
        next_refill_date,
        total_refills_to_date,
        refills,
        pharmacy_id,
        patient:patients(first_name, last_name),
        pharmacy:pharmacies(name, primary_color)
      `,
      )
      .eq("prescriber_id", user.id)
      .eq("prescription_type", "prescription")
      .not("next_refill_date", "is", null)
      .gte("next_refill_date", todayStart)
      .lte("next_refill_date", tomorrowEnd)
      .order("next_refill_date", { ascending: true });

    if (error) {
      console.error("Error loading scheduled refills:", error);
      return;
    }

    if (data) {
      // Filter: only those with remaining refills
      const eligible = data.filter(
        (rx) => (rx.total_refills_to_date ?? 0) < (rx.refills ?? 0),
      );

      const formatted: ScheduledRefill[] = eligible.map((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        const pharmacy = Array.isArray(rx.pharmacy)
          ? rx.pharmacy[0]
          : rx.pharmacy;

        return {
          id: rx.id,
          patientName: patient
            ? `${patient.first_name} ${patient.last_name}`
            : "Unknown Patient",
          medication: rx.medication,
          strength: rx.dosage,
          nextRefillDate: rx.next_refill_date!,
          totalRefillsToDate: rx.total_refills_to_date ?? 0,
          refills: rx.refills ?? 0,
          pharmacyName: pharmacy?.name,
          pharmacyColor: pharmacy?.primary_color,
        };
      });

      setScheduledRefills(formatted);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    loadRefills();
    loadScheduledRefills();

    const channel = supabase
      .channel("refills-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `prescriber_id=eq.${user?.id}`,
        },
        () => {
          loadRefills();
          loadScheduledRefills();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRefills, loadScheduledRefills, supabase, user?.id]);

  // Fetch real status updates from DigitalRx
  const fetchStatusUpdates = useCallback(async () => {
    if (!user?.id || refills.length === 0) return;

    try {
      const response = await fetch("/api/prescriptions/status-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.success && data.statuses) {
        setRefills((prev) =>
          prev.map((refill) => {
            const statusUpdate = data.statuses.find(
              (s: {
                prescription_id: string;
                success: boolean;
                status?: DigitalRxStatusData;
              }) => s.prescription_id === refill.id,
            );

            if (statusUpdate?.success && statusUpdate.status) {
              const { status, trackingNumber } = mapDigitalRxStatus(
                statusUpdate.status,
              );
              return {
                ...refill,
                status,
                ...(trackingNumber && { trackingNumber }),
              };
            }
            return refill;
          }),
        );
      }
    } catch {
      // Silently fail
    }
  }, [user?.id, refills.length]);

  useEffect(() => {
    if (refills.length > 0) fetchStatusUpdates();
  }, [refills.length, fetchStatusUpdates]);

  useEffect(() => {
    const interval = setInterval(fetchStatusUpdates, 30000);
    return () => clearInterval(interval);
  }, [fetchStatusUpdates]);

  const handleViewDetails = async (refill: Refill) => {
    const { data: freshData, error } = await supabase
      .from("prescriptions")
      .select(
        `
        id, queue_id, submitted_at, medication, dosage, dosage_amount,
        dosage_unit, vial_size, form, quantity, refills, sig,
        dispense_as_written, pharmacy_notes, patient_price, profit_cents,
        consultation_reason, shipping_fee_cents, total_paid_cents, status,
        payment_status, tracking_number, pdf_storage_path,
        patient:patients(first_name, last_name, date_of_birth)
      `,
      )
      .eq("id", refill.id)
      .single();

    if (error) {
      setSelectedPrescription(refill);
    } else {
      setSelectedPrescription({
        ...refill,
        medication: freshData.medication,
        strength: freshData.dosage,
        quantity: freshData.quantity,
        refills: freshData.refills,
        status: freshData.status || refill.status,
        vialSize: freshData.vial_size,
        form: freshData.form,
        patientPrice: freshData.patient_price,
        pharmacyNotes: freshData.pharmacy_notes,
        sig: freshData.sig,
        dispenseAsWritten: freshData.dispense_as_written || false,
        dosageAmount: freshData.dosage_amount,
        dosageUnit: freshData.dosage_unit,
        profitCents: freshData.profit_cents,
        consultationReason: freshData.consultation_reason as string | undefined,
        shippingFeeCents: freshData.shipping_fee_cents,
        totalPaidCents: freshData.total_paid_cents,
        paymentStatus: freshData.payment_status,
        pdfStoragePath: freshData.pdf_storage_path,
        trackingNumber: freshData.tracking_number,
      });
    }

    setIsDialogOpen(true);
  };

  const handleSubmitToPharmacy = async (prescriptionId: string) => {
    setIsSubmittingToPharmacy(true);
    try {
      const response = await fetch(
        `/api/prescriptions/${prescriptionId}/submit-to-pharmacy`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        if (
          data.error === "DigitalRx did not return a QueueID" &&
          data.details?.Error?.includes("Invalid Parameters")
        ) {
          toast.error("Invalid parameters, check pharmacy integration details");
        } else {
          toast.error(data.error || "Failed to submit to pharmacy");
        }
        return;
      }

      toast.success("Refill submitted to pharmacy successfully");

      if (selectedPrescription) {
        setSelectedPrescription({
          ...selectedPrescription,
          status: "submitted",
          queueId: data.queue_id,
        });
      }

      loadRefills();
    } catch (error) {
      console.error("Error submitting to pharmacy:", error);
      toast.error("Failed to submit to pharmacy");
    } finally {
      setIsSubmittingToPharmacy(false);
    }
  };

  const handleSkipRefill = async (rx: ScheduledRefill) => {
    const { data: parent, error: fetchError } = await supabase
      .from("prescriptions")
      .select("id, next_refill_date, refill_frequency_days, prescription_type")
      .eq("id", rx.id)
      .eq("prescription_type", "prescription")
      .single();

    if (fetchError || !parent) {
      toast.error("Original prescription not found");
      setScheduledActionTarget(null);
      return;
    }

    const currentDate = new Date(parent.next_refill_date);
    const newDate = new Date(
      currentDate.getTime() + (parent.refill_frequency_days ?? 0) * 86400000,
    ).toISOString();

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({ next_refill_date: newDate })
      .eq("id", parent.id);

    if (updateError) {
      toast.error("Failed to skip refill");
      return;
    }

    toast.success("Refill skipped — next refill moved forward");
    setScheduledActionTarget(null);
    loadScheduledRefills();
  };

  const handleCancelAllRefills = async (rx: ScheduledRefill) => {
    const { data: parent, error: fetchError } = await supabase
      .from("prescriptions")
      .select("id, total_refills_to_date, prescription_type")
      .eq("id", rx.id)
      .eq("prescription_type", "prescription")
      .single();

    if (fetchError || !parent) {
      toast.error("Original prescription not found");
      setScheduledActionTarget(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("prescriptions")
      .update({
        refills: parent.total_refills_to_date ?? 0,
        next_refill_date: null,
      })
      .eq("id", parent.id);

    if (updateError) {
      toast.error("Failed to cancel refills");
      return;
    }

    toast.success("All future refills have been cancelled");
    setScheduledActionTarget(null);
    loadScheduledRefills();
  };

  const filteredRefills = refills.filter((rx) => {
    if (rx.status.toLowerCase() === "delivered") return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const refMatch = rx.parentPrescriptionId
      ? rx.parentPrescriptionId.slice(-4).toLowerCase().includes(query)
      : false;
    return (
      rx.patientName.toLowerCase().includes(query) ||
      rx.medication.toLowerCase().includes(query) ||
      refMatch
    );
  });

  const filteredScheduled = scheduledRefills.filter((rx) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      rx.patientName.toLowerCase().includes(query) ||
      rx.medication.toLowerCase().includes(query) ||
      rx.id.slice(-4).toLowerCase().includes(query)
    );
  });

  return (
    <DefaultLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center gap-4 mb-4">
            <Input
              placeholder="Search by patient or medication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md border-gray-300 rounded-lg"
            />
            <Button
              size="sm"
              variant="outline"
              className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white"
              onClick={() => router.push("/prescriptions")}
            >
              View Prescriptions
            </Button>
          </div>

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("in-progress")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "in-progress"
                    ? "border-[#1E3A8A] text-[#1E3A8A]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                }`}
              >
                In Progress
                {refills.filter((rx) => rx.status.toLowerCase() !== "delivered")
                  .length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                    {
                      refills.filter(
                        (rx) => rx.status.toLowerCase() !== "delivered",
                      ).length
                    }
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("scheduled")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "scheduled"
                    ? "border-[#1E3A8A] text-[#1E3A8A]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                }`}
              >
                Scheduled
                {scheduledRefills.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                    {scheduledRefills.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* In Progress Tab — Refills Table */}
        {activeTab === "in-progress" && (
          <>
            {filteredRefills.length === 0 ? (
              <div className="bg-white border border-border rounded-lg p-12 text-center">
                <RefreshCw className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  No refills in progress
                </h3>
                <p className="text-muted-foreground mb-6">
                  Refills are automatically created when prescriptions are due
                  for renewal
                </p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Rx Ref</TableHead>
                        <TableHead className="font-semibold">
                          Date & Time
                        </TableHead>
                        <TableHead className="font-semibold">
                          Patient Name
                        </TableHead>
                        <TableHead className="font-semibold">
                          Refill #
                        </TableHead>
                        <TableHead className="font-semibold">
                          Medication + Strength/Dosage
                        </TableHead>

                        <TableHead className="font-semibold">
                          Pharmacy
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRefills.map((refill) => (
                        <TableRow key={refill.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {refill.parentPrescriptionId
                              ? refill.parentPrescriptionId
                                  .slice(-4)
                                  .toUpperCase()
                              : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(refill.dateTime)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {refill.patientName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                            >
                              Refill {refill.refillNumber}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {refill.medication}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {refill.strength}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            {refill.pharmacyName ? (
                              <span
                                className="font-medium"
                                style={{
                                  color: refill.pharmacyColor || "#1E3A8A",
                                }}
                              >
                                {refill.pharmacyName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Not specified
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <Badge
                                variant="outline"
                                className={`${getStatusColor(refill.status)} text-xs px-2 py-1`}
                              >
                                {formatStatusLabel(refill.status)}
                              </Badge>
                              {refill.queueId && refill.queueId !== "N/A" && (
                                <span className="text-xs text-muted-foreground">
                                  Queue: {refill.queueId}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(refill)}
                              className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white"
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Scheduled Tab — Upcoming Refills */}
        {activeTab === "scheduled" && (
          <>
            {filteredScheduled.length === 0 ? (
              <div className="bg-white border border-border rounded-lg p-12 text-center">
                <CalendarClock className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  No refills scheduled
                </h3>
                <p className="text-muted-foreground mb-6">
                  No prescriptions are eligible for refill today or tomorrow
                </p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Rx Ref</TableHead>
                        <TableHead className="font-semibold">
                          Patient Name
                        </TableHead>
                        <TableHead className="font-semibold">
                          Medication + Strength/Dosage
                        </TableHead>
                        <TableHead className="font-semibold">
                          Next Refill
                        </TableHead>
                        <TableHead className="font-semibold">
                          Refills Used
                        </TableHead>
                        <TableHead className="font-semibold">
                          Pharmacy
                        </TableHead>
                        <TableHead className="font-semibold text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScheduled.map((rx) => {
                        const refillDate = new Date(rx.nextRefillDate);
                        const today = new Date();
                        const isToday =
                          refillDate.getFullYear() === today.getFullYear() &&
                          refillDate.getMonth() === today.getMonth() &&
                          refillDate.getDate() === today.getDate();

                        return (
                          <TableRow key={rx.id} className="hover:bg-gray-50">
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {rx.id.slice(-4).toUpperCase()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {rx.patientName}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {rx.medication}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {rx.strength}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  isToday
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {isToday ? "Today" : "Tomorrow"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                              >
                                {rx.totalRefillsToDate} of {rx.refills}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {rx.pharmacyName ? (
                                <span
                                  className="font-medium"
                                  style={{
                                    color: rx.pharmacyColor || "#1E3A8A",
                                  }}
                                >
                                  {rx.pharmacyName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  Not specified
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScheduledActionTarget(rx)}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                Manage
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        <style dangerouslySetInnerHTML={{ __html: printStyles }} />

        <PrescriptionModals
          isDialogOpen={isDialogOpen}
          setIsDialogOpen={setIsDialogOpen}
          selectedPrescription={selectedPrescription}
          setSelectedPrescription={setSelectedPrescription}
          isBillModalOpen={isBillModalOpen}
          setIsBillModalOpen={setIsBillModalOpen}
          isSubmittingToPharmacy={isSubmittingToPharmacy}
          handleSubmitToPharmacy={handleSubmitToPharmacy}
          hideEdit
          onPrescriptionUpdated={() => {
            loadRefills();
            if (selectedPrescription) {
              handleViewDetails(selectedPrescription);
            }
          }}
        />

        {/* Scheduled Refill Action Modal */}
        <Dialog
          open={!!scheduledActionTarget}
          onOpenChange={(open) => {
            if (!open) setScheduledActionTarget(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Scheduled Refill</DialogTitle>
              <DialogDescription>
                {scheduledActionTarget?.medication} for{" "}
                {scheduledActionTarget?.patientName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <button
                onClick={() =>
                  scheduledActionTarget &&
                  handleSkipRefill(scheduledActionTarget)
                }
                className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-amber-50 hover:border-amber-200 transition-colors text-left"
              >
                <SkipForward className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Skip This Refill</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Move the next refill date forward by one cycle. The
                    remaining refill count stays the same.
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  scheduledActionTarget &&
                  handleCancelAllRefills(scheduledActionTarget)
                }
                className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-red-50 hover:border-red-200 transition-colors text-left"
              >
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">
                    Cancel All Future Refills
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Stop all upcoming refills for this prescription permanently.
                    This cannot be undone.
                  </p>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DefaultLayout>
  );
}
