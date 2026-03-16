"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
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
import { Plus, Pill } from "lucide-react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { toast } from "sonner";
import { CompleteProfileModal } from "@/features/provider-profile";
import { PrescriptionModals } from "./_components/PrescriptionModals";

// Force dynamic rendering - prescriptions are user-specific
export const dynamic = "force-dynamic";

// Print styles for single-page receipt
const printStyles = `
@media print {
  @page {
    size: auto;
    margin: 7mm;
  }

  /* Hide the main app content */
  #__next > *:not([data-radix-portal]),
  body > div:first-child > *:not([data-radix-portal]) {
    display: none !important;
  }

  /* Hide non-print elements */
  .print-hide {
    display: none !important;
  }

  /* Hide Radix overlay/backdrop but keep dialog */
  [data-radix-dialog-overlay] {
    display: none !important;
  }

  /* Make dialog content visible and positioned for print */
  [role="dialog"] {
    position: static !important;
    transform: none !important;
    max-height: none !important;
    max-width: 100% !important;
    width: 100% !important;
    overflow: visible !important;
    box-shadow: none !important;
    border: none !important;
    background: white !important;
    padding: 0 !important;
  }

  /* Hide dialog close button */
  [role="dialog"] button[class*="absolute"][class*="right"],
  [role="dialog"] > button:first-child {
    display: none !important;
  }

  /* Ensure portal is visible */
  [data-radix-portal] {
    display: block !important;
    position: static !important;
  }

  /* Kill all space-y gaps in print */
  .print-container,
  .print-container * {
    --tw-space-y-reverse: 0 !important;
  }
  .print-container > * + * {
    margin-top: 0.17rem !important;
  }

  /* Container spacing */
  .print-container {
    padding: 0 !important;
  }

  /* Compact logo */
  .print-logo {
    height: 37px !important;
    margin-bottom: 0 !important;
  }

  /* Compact letterhead */
  .print-letterhead {
    padding-bottom: 0.17rem !important;
    padding-top: 0 !important;
    margin-bottom: 0 !important;
    font-size: 0.69rem !important;
  }

  .print-letterhead p {
    margin: 0 !important;
    line-height: 1.2 !important;
  }

  /* Smaller success icon + title */
  .print-title {
    padding: 0.12rem 0 !important;
  }

  .print-icon {
    width: 1.75rem !important;
    height: 1.75rem !important;
    margin-bottom: 0.12rem !important;
  }

  .print-icon svg {
    width: 1.15rem !important;
    height: 1.15rem !important;
  }

  .print-title h2 {
    font-size: 0.98rem !important;
  }

  /* Compact sections */
  .print-section {
    padding: 0.29rem !important;
    margin-bottom: 0 !important;
    border-radius: 3px !important;
  }

  /* Smaller text */
  .print-text {
    font-size: 0.69rem !important;
    line-height: 1.2 !important;
  }

  .print-text-sm {
    font-size: 0.63rem !important;
    line-height: 1.15 !important;
  }

  /* Compact grids */
  .print-grid {
    gap: 0.17rem !important;
    padding-top: 0.17rem !important;
  }

  .print-grid-2 {
    gap: 0.23rem !important;
    padding-top: 0.17rem !important;
  }

  /* Reference section */
  .print-ref {
    padding: 0.29rem !important;
  }

  .print-ref-title {
    font-size: 0.86rem !important;
  }

  /* Production box */
  .print-production {
    padding: 0.29rem !important;
  }

  .print-production h3 {
    font-size: 0.75rem !important;
    margin-bottom: 0 !important;
  }

  .print-production p {
    font-size: 0.63rem !important;
    line-height: 1.2 !important;
    margin-bottom: 0 !important;
  }

  /* Prescription details */
  .print-details-title {
    font-size: 0.8rem !important;
    margin-bottom: 0.12rem !important;
  }

  /* Notes section */
  .print-notes {
    padding: 0.29rem !important;
  }

  .print-notes p {
    font-size: 0.63rem !important;
    line-height: 1.2 !important;
  }

  /* Pickup location */
  .print-pickup {
    padding: 0.29rem !important;
    border-width: 1px !important;
  }

  .print-pickup h3 {
    font-size: 0.75rem !important;
    margin-bottom: 0 !important;
  }

  .print-pickup p,
  .print-pickup a {
    font-size: 0.63rem !important;
    line-height: 1.2 !important;
  }
}
`;

interface Prescription {
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
  carrierStatus?: string;
  trackingCarrier?: string;
  estimatedDelivery?: string;
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

// Map DigitalRx status to display status
const mapDigitalRxStatus = (
  statusData: DigitalRxStatusData,
): { status: string; trackingNumber?: string } => {
  if (statusData.DeliveredDate) {
    return {
      status: "Delivered",
      trackingNumber: statusData.TrackingNumber,
    };
  } else if (statusData.PickupDate) {
    return {
      status: "Shipped",
      trackingNumber: statusData.TrackingNumber,
    };
  } else if (statusData.ApprovedDate) {
    return { status: "Approved" };
  } else if (statusData.PackDateTime) {
    return { status: "Processing" };
  } else if (statusData.BillingStatus) {
    return { status: "Billing" };
  }
  return { status: "Submitted" };
};

export default function PrescriptionsPage() {
  const supabase = createClient();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] =
    useState<Prescription | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // const [, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"in-progress" | "completed">(
    "in-progress",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [checkingActive, setCheckingActive] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isSubmittingToPharmacy, setIsSubmittingToPharmacy] = useState(false);

  // Profile completion modal state
  const [showCompleteProfileModal, setShowCompleteProfileModal] =
    useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState({
    npi: false,
    medicalLicense: false,
    signature: false,
  });

  // Load prescriptions from Supabase with real-time updates
  const loadPrescriptions = useCallback(async () => {
    if (!user?.id) {
      return;
    }

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
        fedex_status,
        tracking_carrier,
        estimated_delivery,
        pharmacy_id,
        pdf_storage_path,
        patient:patients(first_name, last_name, date_of_birth, email),
        pharmacy:pharmacies(name, primary_color)
      `,
      )
      .eq("prescriber_id", user.id)
      .eq("prescription_type", "prescription")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("❌ Error loading prescriptions:", error);
    }

    // Also fetch doctor name
    const { data: providerData } = await supabase
      .from("providers")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error loading prescriptions:", error);
      return;
    }

    if (data) {
      const doctorName = providerData
        ? `Dr. ${providerData.first_name} ${providerData.last_name}`
        : "Unknown Provider";

      const formatted = data.map((rx) => {
        const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
        const pharmacy = Array.isArray(rx.pharmacy)
          ? rx.pharmacy[0]
          : rx.pharmacy;
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
          carrierStatus: rx.fedex_status,
          trackingCarrier: rx.tracking_carrier,
          estimatedDelivery: rx.estimated_delivery,
        };
      });

      setPrescriptions(formatted);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    loadPrescriptions();

    // Set up real-time subscription for prescription changes
    const channel = supabase
      .channel("prescriptions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prescriptions",
          filter: `prescriber_id=eq.${user?.id}`,
        },
        () => {
          loadPrescriptions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPrescriptions, supabase, user?.id]);

  // Force refresh when redirected with ?refresh=true
  useEffect(() => {
    const shouldRefresh = searchParams.get("refresh");
    if (shouldRefresh === "true") {
      loadPrescriptions();
      // Remove the refresh param from URL
      router.replace("/prescriptions");
    }
  }, [searchParams, loadPrescriptions, router]);

  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch("/api/provider/profile-check", {
          credentials: "include",
        });
        if (!response.ok) return;
        const data = await response.json();

        if (data.success && data.missing) {
          const hasMissing = data.missing.npi || data.missing.medicalLicense ||
            data.missing.signature;

          if (hasMissing) {
            setMissingProfileFields(data.missing);
            setShowCompleteProfileModal(true);
          }
        }
      } catch (error) {
        console.error("Error checking profile completion:", error);
      }
    };

    checkProfileCompletion();
  }, [user?.id]);

  // Fetch real status updates from DigitalRx
  const fetchStatusUpdates = useCallback(async () => {
    if (!user?.id) return;
    if (prescriptions.length === 0) return; // Don't fetch if no prescriptions

    try {
      const response = await fetch("/api/prescriptions/status-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        // Silently fail - status updates are not critical
        // (Pharmacy backend may not be configured for status polling)
        return;
      }

      const data = await response.json();

      if (data.success && data.statuses) {
        // Update prescriptions with new statuses
        setPrescriptions((prev) => {
          const updated = prev.map((prescription) => {
            const statusUpdate = data.statuses.find(
              (s: {
                prescription_id: string;
                success: boolean;
                status?: DigitalRxStatusData;
              }) => s.prescription_id === prescription.id,
            );

            if (statusUpdate && statusUpdate.success && statusUpdate.status) {
              const { status, trackingNumber } = mapDigitalRxStatus(
                statusUpdate.status,
              );
              return {
                ...prescription,
                status,
                ...(trackingNumber && { trackingNumber }),
              };
            }

            return prescription;
          });

          return updated;
        });
      }
    } catch {
      // Silently fail - status updates are not critical
    }
  }, [user?.id, prescriptions.length]);

  // Fetch status updates on mount and when prescriptions change
  useEffect(() => {
    if (prescriptions.length > 0) {
      fetchStatusUpdates();
    }
  }, [prescriptions.length, fetchStatusUpdates]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatusUpdates();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchStatusUpdates]);

  const handleCreatePrescription = async () => {
    setCheckingActive(true);
    try {
      const profileResponse = await fetch("/api/provider/profile-check", {
        credentials: "include",
      });
      const profileData = await profileResponse.json();

      if (profileData.success && profileData.missing) {
        const hasMissing = profileData.missing.npi || profileData.missing.medicalLicense ||
          profileData.missing.signature;

        if (hasMissing) {
          setMissingProfileFields(profileData.missing);
          setShowCompleteProfileModal(true);
          return;
        }
      }

      // Then check if account is active
      const response = await fetch("/api/provider/check-active");
      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error("Unable to verify account status");
        return;
      }

      if (!data.is_active) {
        toast.error(
          "Your account is inactive. Please contact administrator to activate your account.",
          {
            duration: 5000,
          },
        );
        return;
      }

      // If active and profile complete, navigate to prescription form
      router.push("/prescriptions/new/step1");
    } catch (error) {
      console.error("Error checking active status:", error);
      toast.error("Unable to verify account status");
    } finally {
      setCheckingActive(false);
    }
  };

  const handleViewDetails = async (prescription: Prescription) => {
    // Force refresh the prescription data from database
    const { data: freshData, error } = await supabase
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
        fedex_status,
        tracking_carrier,
        estimated_delivery,
        pdf_storage_path,
        patient:patients(first_name, last_name, date_of_birth)
      `,
      )
      .eq("id", prescription.id)
      .single();

    if (error) {
      console.error("❌ Error fetching fresh prescription data:", error);
      setSelectedPrescription(prescription);
    } else {
      const freshPrescription = {
        ...prescription,
        medication: freshData.medication,
        strength: freshData.dosage,
        quantity: freshData.quantity,
        refills: freshData.refills,
        status: freshData.status || prescription.status,
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
        carrierStatus: freshData.fedex_status,
        trackingCarrier: freshData.tracking_carrier,
        estimatedDelivery: freshData.estimated_delivery,
      };

      setSelectedPrescription(freshPrescription);
    }

    setIsDialogOpen(true);
  };

  const handleSubmitToPharmacy = async (prescriptionId: string) => {
    setIsSubmittingToPharmacy(true);
    try {
      const response = await fetch(
        `/api/prescriptions/${prescriptionId}/submit-to-pharmacy`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check for invalid parameters error from DigitalRx
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

      toast.success("Prescription submitted to pharmacy successfully");

      // Update the selected prescription status locally
      if (selectedPrescription) {
        setSelectedPrescription({
          ...selectedPrescription,
          status: "submitted",
          queueId: data.queue_id,
        });
      }

      // Reload prescriptions to reflect the change
      loadPrescriptions();
    } catch (error) {
      console.error("Error submitting to pharmacy:", error);
      toast.error("Failed to submit to pharmacy");
    } finally {
      setIsSubmittingToPharmacy(false);
    }
  };

  // Filter prescriptions based on active tab and search query
  const filteredPrescriptions = prescriptions.filter((rx) => {
    // Filter by tab
    const tabMatch =
      activeTab === "in-progress"
        ? rx.status.toLowerCase() !== "delivered"
        : rx.status.toLowerCase() === "delivered";

    // Filter by search query
    if (!searchQuery.trim()) return tabMatch;

    const query = searchQuery.toLowerCase();
    const searchMatch =
      rx.patientName.toLowerCase().includes(query) ||
      rx.medication.toLowerCase().includes(query) ||
      rx.id.slice(-4).toLowerCase().includes(query);

    return tabMatch && searchMatch;
  });

  return (
    <DefaultLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Search Bar and New Prescription Button */}
        <div className="mb-6">
          <div className="flex justify-between items-center gap-4 mb-4">
            <Input
              placeholder="Search by patient, medication or ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md border-gray-300 rounded-lg"
            />
            <Button
              size="sm"
              className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
              onClick={handleCreatePrescription}
              disabled={checkingActive}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Prescription
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
                {prescriptions.filter(
                  (rx) => rx.status.toLowerCase() !== "delivered",
                ).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                    {
                      prescriptions.filter(
                        (rx) => rx.status.toLowerCase() !== "delivered",
                      ).length
                    }
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "completed"
                    ? "border-[#1E3A8A] text-[#1E3A8A]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                }`}
              >
                Completed
                {prescriptions.filter(
                  (rx) => rx.status.toLowerCase() === "delivered",
                ).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                    {
                      prescriptions.filter(
                        (rx) => rx.status.toLowerCase() === "delivered",
                      ).length
                    }
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Prescriptions Table */}
        {filteredPrescriptions.length === 0 ? (
          <div className="bg-white border border-border rounded-lg p-12 text-center">
            <Pill className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {activeTab === "in-progress"
                ? "No prescriptions in progress"
                : "No completed prescriptions"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {activeTab === "in-progress"
                ? "All prescriptions have been delivered"
                : "No prescriptions have been completed yet"}
            </p>
            {activeTab === "in-progress" && (
              <Button
                onClick={handleCreatePrescription}
                disabled={checkingActive}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Prescription
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Ref</TableHead>
                    <TableHead className="font-semibold">Date & Time</TableHead>
                    <TableHead className="font-semibold">
                      Patient Name
                    </TableHead>
                    <TableHead className="font-semibold">
                      Medication + Strength/Dosage
                    </TableHead>
                    <TableHead className="font-semibold">
                      Quantity / Refills
                    </TableHead>
                    <TableHead className="font-semibold">Pharmacy</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((prescription) => (
                    <TableRow
                      key={prescription.id}
                      className="hover:bg-gray-50"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {prescription.id.slice(-4).toUpperCase()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(prescription.dateTime)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {prescription.patientName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {prescription.medication}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {prescription.strength}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>Qty: {prescription.quantity}</span>
                          <span className="text-sm text-muted-foreground">
                            Refills: {prescription.refills}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {prescription.pharmacyName ? (
                          <span
                            className="font-medium"
                            style={{
                              color: prescription.pharmacyColor || "#1E3A8A",
                            }}
                          >
                            {prescription.pharmacyName}
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
                            className={`${getStatusColor(prescription.status)} text-xs px-2 py-1`}
                          >
                            {formatStatusLabel(prescription.status)}
                          </Badge>
                          {prescription.queueId &&
                            prescription.queueId !== "N/A" && (
                              <span className="text-xs text-muted-foreground">
                                Queue: {prescription.queueId}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(prescription)}
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

        {/* Print styles */}
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
          onPrescriptionUpdated={() => {
            loadPrescriptions();
            if (selectedPrescription) {
              handleViewDetails(selectedPrescription);
            }
          }}
        />

        {/* Complete Profile Modal */}
        <CompleteProfileModal
          open={showCompleteProfileModal}
          onOpenChange={setShowCompleteProfileModal}
          missingFields={missingProfileFields}
        />
      </div>
    </DefaultLayout>
  );
}
