"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { DelegateProfileBanner } from "@/features/delegate-profile";
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
  refillFrequencyDays?: number | null;
  submissionGroupId?: string | null;
  paymentTransactionId?: string | null;
}


const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "billing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "paused":
      return "bg-teal-100 text-teal-800 border-teal-200";
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
  if (trimmed.toLowerCase() === "paused") return "In Production ⭐";

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
  const supabase = useMemo(() => createClient(), []);
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const canSeePricing =
    userRole === "admin" || userRole === "super_admin";

  // Profile completion modal state
  const [showCompleteProfileModal, setShowCompleteProfileModal] =
    useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState({
    npi: false,
    medicalLicense: false,
    signature: false,
  });

  // Load prescriptions from Supabase with real-time updates.
  // Each user sees ONLY the prescriptions they themselves submitted
  // (prescriber_id = own user.id). Providers and Provider Assistants are
  // treated as separate prescribers — assistants see only Rx they wrote.
  // To share, place users in the same organization/clinic group.
  const loadPrescriptions = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const prescriberId: string = user.id;

    // Use the server endpoint (admin client) so RLS variations don't
    // hide rows from delegate-role users (Provider Assistants). For
    // regular providers the result is identical to the legacy direct
    // supabase query because both filter on prescriber_id = own user.id.
    type RxRow = {
      id: string;
      queue_id: string;
      submitted_at: string;
      medication: string;
      dosage: string;
      dosage_amount: string | null;
      dosage_unit: string | null;
      vial_size: string | null;
      form: string | null;
      quantity: number;
      refills: number;
      sig: string;
      dispense_as_written: boolean;
      pharmacy_notes: string | null;
      patient_price: number | string | null;
      profit_cents: number | null;
      consultation_reason: string | null;
      refill_frequency_days: number | null;
      shipping_fee_cents: number | null;
      total_paid_cents: number | null;
      status: string;
      payment_status: string | null;
      tracking_number: string | null;
      fedex_status: string | null;
      estimated_delivery: string | null;
      pharmacy_id: string | null;
      pdf_storage_path: string | null;
      patient_id: string;
      has_custom_address: boolean | null;
      custom_address: Record<string, unknown> | null;
      submitted_by_delegation_id: string | null;
      prescriber_id: string | null;
      doctor_name: string | null;
      patient:
        | { first_name: string; last_name: string; date_of_birth: string; email?: string; physical_address?: Record<string, unknown> | null }
        | Array<{ first_name: string; last_name: string; date_of_birth: string; email?: string; physical_address?: Record<string, unknown> | null }>
        | null;
      pharmacy:
        | { name: string; primary_color?: string | null }
        | Array<{ name: string; primary_color?: string | null }>
        | null;
      payment_transactions: Array<{ id: string }> | null;
    };
    // Capture role for UI affordances only (banners, etc.). The actual
    // prescription list ALWAYS comes from /api/prescriptions/list now,
    // which computes the full clinic peer set (supervising provider +
    // all sibling assistants) so a Provider Assistant's submission is
    // visible to her doctor and to her co-assistants — fixes the May
    // 2026 "I placed an order, went back to check, it's gone" incident.
    let role: string | null = null;
    try {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", prescriberId)
        .maybeSingle();
      role = (roleRow as { role?: string } | null)?.role ?? null;
    } catch { /* role is best-effort; list endpoint handles auth on its own */ }
    setUserRole(role);

    let data: RxRow[] | null = null;
    let error: { message: string } | null = null;

    try {
      const res = await fetch("/api/prescriptions/list", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        error = { message: `HTTP ${res.status}` };
      } else {
        const json = await res.json();
        data = (json?.prescriptions ?? []) as RxRow[];
      }
    } catch (e) {
      error = { message: e instanceof Error ? e.message : "fetch failed" };
    }

    if (error) {
      console.error("❌ Error loading prescriptions:", error);
      return;
    }

    if (data) {
      // Per-row prescriber name is now resolved SERVER-SIDE in
      // /api/prescriptions/list and arrives as `doctor_name` on each row
      // (May 19 2026, LifeMed multi-login incident). The lookup MUST stay
      // server-side because RLS on the `providers` table prevents a
      // clinic seat (e.g. Lydia Cole) from reading other clinic seats'
      // (e.g. Whipps's) provider row via the browser-authenticated
      // client — a client-side lookup would silently degrade every
      // cross-seat row to "Unknown Provider". Do NOT re-add a client-side
      // providers query here. Trust `rx.doctor_name` from the API.

      // Provider Assistance: batch-fetch the audit info for any rows that
      // were submitted by a delegate, so we can render
      // "Submitted by <Assistant> (<Title>) on behalf of <Doctor>".
      const delegationIds = Array.from(
        new Set(
          data
            .map((rx) => rx.submitted_by_delegation_id)
            .filter((v): v is string => !!v),
        ),
      );
      const submittedByMap = new Map<
        string,
        { name: string; title: string }
      >();
      if (delegationIds.length > 0) {
        const { data: delegationRows } = await supabase
          .from("delegations")
          .select(
            "id, delegate_first_name, delegate_last_name, delegate_title",
          )
          .in("id", delegationIds);
        for (const row of delegationRows ?? []) {
          submittedByMap.set(row.id, {
            name: `${row.delegate_first_name} ${row.delegate_last_name}`.trim(),
            title: row.delegate_title,
          });
        }
      }

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
          doctorName: rx.doctor_name || "Unknown Provider",
          medication: rx.medication,
          strength: rx.dosage,
          quantity: rx.quantity,
          refills: rx.refills,
          sig: rx.sig,
          status: rx.status || "submitted",
          trackingNumber: rx.tracking_number,
          form: rx.form ?? "",
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
          estimatedDelivery: rx.estimated_delivery,
          refillFrequencyDays: rx.refill_frequency_days || null,
          patientId: rx.patient_id,
          hasCustomAddress: rx.has_custom_address || false,
          customAddress: rx.custom_address as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null,
          patientAddress: (() => {
            const p = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
            return (p?.physical_address as { street?: string; city?: string; state?: string; zipCode?: string; country?: string } | null) || null;
          })(),
          paymentTransactionId: (() => {
            const txs = (rx as any).payment_transactions;
            if (Array.isArray(txs) && txs.length > 0) return txs[0].id;
            return null;
          })(),
          submissionGroupId: null as string | null,
          submittedByDelegationId: rx.submitted_by_delegation_id ?? null,
          submittedBy: rx.submitted_by_delegation_id
            ? submittedByMap.get(rx.submitted_by_delegation_id) ?? null
            : null,
        };
      });

      try {
        const groupRes = await fetch("/api/prescriptions/submission-groups");
        if (groupRes.ok) {
          const { groups } = await groupRes.json();
          if (groups) {
            for (const rx of formatted) {
              if (groups[rx.id]) {
                rx.submissionGroupId = groups[rx.id];
              }
            }
          }
        }
      } catch {}

      setPrescriptions(formatted as unknown as Prescription[]);
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
        body: JSON.stringify({}),
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

  useEffect(() => {
    setSelectedPrescription((prev) => {
      if (!prev) return null;
      const updated = prescriptions.find((p) => p.id === prev.id);
      return updated || null;
    });
  }, [prescriptions]);

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
        refill_frequency_days,
        shipping_fee_cents,
        total_paid_cents,
        status,
        payment_status,
        tracking_number,
        fedex_status,
        estimated_delivery,
        pdf_storage_path,
        submitted_by_delegation_id,
        patient:patients(first_name, last_name, date_of_birth)
      `,
      )
      .eq("id", prescription.id)
      .single();

    if (error) {
      console.error("❌ Error fetching fresh prescription data:", error);
      setSelectedPrescription(prescription);
    } else {
      // If this Rx was submitted by a delegate, fetch the audit info so the
      // detail dialog can show "Submitted by X (Title) on behalf of Dr. Y".
      let freshSubmittedBy: { name: string; title: string } | null = null;
      if (freshData.submitted_by_delegation_id) {
        const { data: dRow } = await supabase
          .from("delegations")
          .select("delegate_first_name, delegate_last_name, delegate_title")
          .eq("id", freshData.submitted_by_delegation_id)
          .maybeSingle();
        if (dRow) {
          freshSubmittedBy = {
            name: `${dRow.delegate_first_name} ${dRow.delegate_last_name}`.trim(),
            title: dRow.delegate_title,
          };
        }
      }

      const freshPrescription = {
        ...prescription,
        submittedByDelegationId:
          freshData.submitted_by_delegation_id ?? null,
        submittedBy:
          freshSubmittedBy ?? (prescription as any).submittedBy ?? null,
        queueId: freshData.queue_id || "N/A",
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
        estimatedDelivery: freshData.estimated_delivery,
        refillFrequencyDays: freshData.refill_frequency_days || null,
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
        <DelegateProfileBanner />
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
                    {canSeePricing && (
                      <TableHead className="font-semibold text-right">
                        Amount
                      </TableHead>
                    )}
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const batchKeys: string[] = [];
                    const groupIdMap: Record<string, string> = {};
                    const txIdMap: Record<string, string> = {};
                    let groupCounter = 0;

                    for (let i = 0; i < filteredPrescriptions.length; i++) {
                      const curr = filteredPrescriptions[i];
                      const sgId = curr.submissionGroupId;
                      const txId = curr.paymentTransactionId;

                      if (sgId) {
                        if (!groupIdMap[sgId]) { groupCounter++; groupIdMap[sgId] = `g${groupCounter}`; }
                        batchKeys.push(groupIdMap[sgId]);
                      } else if (txId) {
                        if (!txIdMap[txId]) { groupCounter++; txIdMap[txId] = `t${groupCounter}`; }
                        batchKeys.push(txIdMap[txId]);
                      } else {
                        groupCounter++;
                        batchKeys.push(`g${groupCounter}`);
                      }
                    }

                    const shippingPerGroup: Record<string, number> = {};
                    for (let i = 0; i < filteredPrescriptions.length; i++) {
                      const k = batchKeys[i];
                      const fee = filteredPrescriptions[i].shippingFeeCents ?? 0;
                      if (fee > 0) shippingPerGroup[k] = (shippingPerGroup[k] || 0) + 1;
                    }
                    const invalidGroups = new Set(Object.entries(shippingPerGroup).filter(([, c]) => c > 1).map(([k]) => k));
                    for (let i = 0; i < batchKeys.length; i++) {
                      if (invalidGroups.has(batchKeys[i])) { groupCounter++; batchKeys[i] = `solo${groupCounter}`; }
                    }

                    const keyCounts: Record<string, number> = {};
                    batchKeys.forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1; });

                    const groupBgs = ["#EFF6FF", "#F5F3FF", "#FFFBEB", "#ECFDF5", "#FFF1F2"];
                    const groupBorders = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#F43F5E"];
                    let colorCounter = 0;
                    const keyColorMap: Record<string, number> = {};
                    Object.entries(keyCounts).forEach(([key, count]) => {
                      if (count > 1 && !(key in keyColorMap)) { keyColorMap[key] = colorCounter % groupBgs.length; colorCounter++; }
                    });

                    const seenKeys = new Set<string>();

                    return filteredPrescriptions.map((prescription, idx) => {
                      const key = batchKeys[idx];
                      const isMultiBatch = keyCounts[key] > 1;
                      const isFirstInBatch = isMultiBatch && !seenKeys.has(key);
                      seenKeys.add(key);
                      const batchSize = keyCounts[key];
                      const colorIdx = keyColorMap[key] ?? 0;

                      return (
                    <TableRow
                      key={prescription.id}
                      className="hover:bg-gray-50"
                      style={isMultiBatch ? { backgroundColor: groupBgs[colorIdx], borderLeft: `3px solid ${groupBorders[colorIdx]}` } : undefined}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {prescription.id.slice(-4).toUpperCase()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(prescription.dateTime)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {prescription.patientName}
                          {isFirstInBatch && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: groupBorders[colorIdx] }}>
                              {batchSize} items
                            </span>
                          )}
                        </div>
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
                      {canSeePricing && (
                      <TableCell className="text-right whitespace-nowrap">
                        {(() => {
                          const ship = prescription.shippingFeeCents ?? 0;
                          const totalCents = prescription.totalPaidCents ?? 0;
                          const medCents = Math.max(totalCents - ship, 0);
                          const fmt = (c: number) =>
                            `$${(c / 100).toFixed(2)}`;
                          if (totalCents <= 0) {
                            const pp = prescription.patientPrice;
                            return pp ? (
                              <span
                                className="font-medium"
                                data-testid={`text-amount-${prescription.id}`}
                              >
                                ${pp}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                —
                              </span>
                            );
                          }
                          return (
                            <div
                              className="flex flex-col items-end"
                              data-testid={`text-amount-${prescription.id}`}
                            >
                              <span className="font-semibold">
                                {fmt(totalCents)}
                              </span>
                              {ship > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {fmt(medCents)} med + {fmt(ship)} ship
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      )}
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
                      );
                    });
                  })()}
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
          allPrescriptions={prescriptions}
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
