"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Pill,
  CheckCircle2,
  Copy,
  Printer,
  MapPin,
  DollarSign,
  FileText,
  Pencil,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BillPatientModal } from "@/components/billing/BillPatientModal";
import { EditPrescriptionModal } from "./EditPrescriptionModal";
import { PrescriptionProgressTracker } from "./PrescriptionProgressTracker";

interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

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
  patientId?: string;
  hasCustomAddress?: boolean;
  customAddress?: AddressData | null;
  patientAddress?: AddressData | null;
  // Provider Assistance audit: present when a delegate submitted on the
  // prescriber's behalf. doctorName is still the prescriber.
  submittedByDelegationId?: string | null;
  submittedBy?: { name: string; title: string } | null;
  // Order group identifier — used by the Bill Patient modal full-group
  // expansion (Greenwich/Rahmany incident remediation, May 2026) to find
  // unpaid sibling rxs and bill them together. Mirrors the field on the
  // parent page.tsx Prescription type.
  submissionGroupId?: string | null;
  paymentTransactionId?: string | null;
}

const CONSULTATION_REASON_LABELS: Record<string, string> = {
  dose_titration: "Dose Titration & Adjustment",
  side_effect_monitoring: "Side Effect & Safety Monitoring",
  therapeutic_response: "Therapeutic Response Review",
  adherence_tracking: "Medication Adherence Tracking",
  contraindication_screening: "Contraindication Screening",
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

// Function to print receipt using iframe (avoids CSS color compatibility issues)
const printReceipt = () => {
  const element = document.getElementById("aim-receipt");
  if (!element) {
    toast.error("Could not find receipt content");
    return;
  }

  // Clone the element and remove buttons
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".print-hide").forEach((el) => el.remove());

  // Create iframe for printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    toast.error("Could not create print view");
    document.body.removeChild(iframe);
    return;
  }

  // Write content with inline styles
  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AIM Receipt</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 12px; color: #333; font-size: 0.86rem; }
        img { max-width: 100%; height: auto; }
        .text-center { text-align: center; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .text-sm { font-size: 0.75rem; }
        .text-base { font-size: 0.8rem; }
        .text-lg { font-size: 0.92rem; }
        .text-xl { font-size: 0.98rem; }
        .text-2xl { font-size: 1.03rem; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-900 { color: #111827; }
        .mb-2 { margin-bottom: 0.17rem; }
        .mb-4 { margin-bottom: 0.29rem; }
        .mt-1 { margin-top: 0.12rem; }
        .pt-2, .pt-3, .pt-4 { padding-top: 0.17rem; }
        .pb-4 { padding-bottom: 0.29rem; }
        .space-y-2 > * + * { margin-top: 0.29rem; }
        .space-y-3 > * + * { margin-top: 0.29rem; }
        .space-y-4 > * + * { margin-top: 0.29rem; }
        .space-y-6 > * + * { margin-top: 0.29rem; }
        .border-t { border-top: 1px solid #e5e7eb; }
        .border-b { border-bottom: 1px solid #e5e7eb; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
        .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
        .gap-4 { gap: 0.4rem; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .justify-between { justify-content: space-between; }
        .rounded-lg { border-radius: 0.3rem; }
        .p-4 { padding: 0.4rem; }
        .bg-blue-50 { background-color: #eff6ff; }
        .bg-green-50 { background-color: #f0fdf4; }
        .inline-flex { display: inline-flex; }
        .justify-center { justify-content: center; }
        .w-16 { width: 1.75rem; }
        .h-16 { height: 1.75rem; }
        .rounded-full { border-radius: 9999px; }
        a { color: #00AEEF; text-decoration: none; }
        .hidden { display: none; }
        .print-hide-tracker { display: none !important; }
        [data-print-only="true"] { display: block !important; }
        table { border-collapse: collapse; }
        td { vertical-align: middle; }
        @media print {
          body { padding: 6px; }
          @page { margin: 7mm; }
          .print-logo { height: 37px !important; margin-bottom: 0 !important; }
        }
      </style>
    </head>
    <body>
      ${clone.innerHTML}
    </body>
    </html>
  `);
  iframeDoc.close();

  // Wait for images to load then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };
};

function getPrintStepIndex(status: string, paymentStatus?: string): number {
  const s = status.trim().toLowerCase().replace(/[\s_-]/g, "");
  const bs = paymentStatus?.trim().toLowerCase() || "";
  if (s === "delivered" || s === "completed") return 6;
  if (s === "shipped" || s === "pickedup") return 5;
  if (s === "approved" || s === "providerapproved") return 4;
  if (s === "packed" || s === "processing" || s === "pharmacyprocessing" || s === "compounding" || s === "paused") return 3;
  if (s === "submitted" && bs !== "pending") return 2;
  if (s === "paymentreceived" || s === "billed" || bs === "paid" || bs === "billed" || bs === "cash") return 2;
  if (s === "billing" || s === "paymentpending" || s === "pendingpayment" || bs === "pending") return 1;
  return 0;
}

const PRINT_STEPS = [
  { label: "Order Created", desc: "Saved in system" },
  { label: "Payment", desc: "Awaiting payment" },
  { label: "Sent to Pharmacy", desc: "Submitted after payment" },
  { label: "Processing", desc: "Rx being filled" },
  { label: "Approved", desc: "Pharmacist OK" },
  { label: "Shipped", desc: "With carrier" },
  { label: "Delivered", desc: "Received" },
];

function PrintProgressTracker({
  status,
  paymentStatus,
  patientPrice,
  pharmacyName,
  trackingNumber,
  trackingCarrier,
}: {
  status: string;
  paymentStatus?: string;
  patientPrice?: string;
  pharmacyName?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
}) {
  const idx = getPrintStepIndex(status, paymentStatus);
  const bs = paymentStatus?.trim().toLowerCase() || "";
  const isPaid = bs === "paid" || bs === "billed" || bs === "cash" || idx >= 2;
  const copay = patientPrice ? parseFloat(patientPrice).toFixed(2) : null;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600, fontSize: "13px", color: "#111827" }}>Order Progress</span>
        <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {copay && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "9999px",
                border: "1px solid",
                borderColor: isPaid ? "#a7f3d0" : "#fde68a",
                backgroundColor: isPaid ? "#f0fdf4" : "#fffbeb",
                color: isPaid ? "#047857" : "#b45309",
              }}
            >
              {isPaid ? `Paid · $${copay}` : `Due · $${copay}`}
            </span>
          )}
          {pharmacyName && (
            <span style={{ fontSize: "11px", color: "#6b7280", backgroundColor: "#f3f4f6", padding: "2px 8px", borderRadius: "9999px" }}>
              {pharmacyName}
            </span>
          )}
        </span>
      </div>
      {idx < 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "6px 10px", marginBottom: "8px", fontSize: "11px", fontWeight: 500, color: "#92400e" }}>
          ⚠ Order will NOT be sent to the pharmacy until payment is received.
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <tbody>
          {PRINT_STEPS.map((step, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <tr key={i}>
                <td style={{ width: "18px", padding: "3px 6px 3px 0", verticalAlign: "middle", color: done ? "#10B981" : current ? "#1E3A8A" : "#d1d5db", fontWeight: 700, fontSize: "13px" }}>
                  {done ? "✓" : current ? "▸" : "○"}
                </td>
                <td style={{ padding: "3px 0", verticalAlign: "middle", fontWeight: done || current ? 600 : 400, color: done ? "#10B981" : current ? "#1E3A8A" : "#9CA3AF" }}>
                  {step.label}
                  {current && <span style={{ fontSize: "9px", marginLeft: "6px", color: "#6b7280" }}>← Current</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {trackingNumber && (
        <div style={{ marginTop: "8px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "6px 10px", fontSize: "11px" }}>
          <span style={{ color: "#6b7280", textTransform: "uppercase", fontSize: "9px", fontWeight: 600, letterSpacing: "0.5px" }}>{trackingCarrier || "Carrier"} Tracking</span>
          <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#1E3A8A", fontSize: "12px" }}>{trackingNumber}</div>
        </div>
      )}
    </div>
  );
}

interface PrescriptionModalsProps {
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  selectedPrescription: Prescription | null;
  setSelectedPrescription: (prescription: Prescription | null) => void;
  isBillModalOpen: boolean;
  setIsBillModalOpen: (open: boolean) => void;
  isSubmittingToPharmacy: boolean;
  handleSubmitToPharmacy: (prescriptionId: string) => void;
  onPrescriptionUpdated?: () => void;
  hideEdit?: boolean;
  /**
   * Full prescription list from parent — used to expand a single-row
   * Bill Patient click into the FULL group of unpaid siblings so the
   * provider modal bills the correct total. Required by the server-side
   * full-group integrity guard added in May 2026 (Greenwich/Rahmany).
   */
  allPrescriptions?: Prescription[];
}

export function PrescriptionModals({
  isDialogOpen,
  setIsDialogOpen,
  selectedPrescription,
  setSelectedPrescription,
  isBillModalOpen,
  setIsBillModalOpen,
  isSubmittingToPharmacy,
  handleSubmitToPharmacy,
  onPrescriptionUpdated,
  hideEdit,
  allPrescriptions,
}: PrescriptionModalsProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [editAddress, setEditAddress] = useState<AddressData>({ street: "", city: "", state: "", zipCode: "", country: "US" });
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressNotification, setAddressNotification] = useState<{ recipients: string[] } | null>(null);

  useEffect(() => {
    setIsEditModalOpen(false);
    setIsBillModalOpen(false);
    setShowAddressEdit(false);
    setAddressNotification(null);
  }, [selectedPrescription?.id, setIsBillModalOpen]);

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
          onPrescriptionUpdated?.();
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedPrescription?.id, selectedPrescription?.trackingNumber, selectedPrescription?.status, onPrescriptionUpdated]);

  return (
    <>
      {/* AIM Official Receipt Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-full">
          {selectedPrescription && (
            <div className="space-y-6 print-container" id="aim-receipt">
              {/* AIM Logo */}
              <div className="text-center pt-4">
                <img
                  src="https://app.aimrx.com/logo-header.png"
                  alt="AIM Medical Technologies"
                  className="h-[80px] mx-auto print-logo"
                />
              </div>

              {/* Letterhead */}
              <div className="text-center text-sm text-gray-600 border-b pb-4 print-letterhead">
                <p className="font-semibold text-gray-900">
                  AIM Medical Technologies
                </p>
                <p>106 E 6th St, Suite 900 · Austin, TX 78701</p>
                <p>(769) 304-1830 · Mon–Fri 9AM–6PM CST</p>
              </div>

              {/* Success Checkmark & Headline */}
              <div className="text-center py-4 print-title">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 print-icon"
                  style={{ backgroundColor: "#00AEEF20" }}
                >
                  <CheckCircle2
                    className="w-10 h-10"
                    style={{ color: "#00AEEF" }}
                  />
                </div>
                <h2
                  className="text-2xl font-bold"
                  style={{ color: "#00AEEF" }}
                >
                  Order Successfully Submitted
                </h2>
              </div>

              {/* Reference Information */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 print-section print-ref">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 print-text">
                      Reference #
                    </p>
                    <p className="font-bold text-lg print-ref-title">
                      {selectedPrescription.queueId}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="print-hide"
                    onClick={() => {
                      const textarea = document.createElement("textarea");
                      textarea.value = selectedPrescription.queueId;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      try {
                        document.execCommand("copy");
                        toast.success("Reference # copied to clipboard");
                      } catch {
                        toast.error("Failed to copy");
                      }
                      document.body.removeChild(textarea);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t print-grid-2">
                  <div>
                    <p className="text-sm text-gray-600 print-text">Patient</p>
                    <p className="font-medium print-text">
                      {selectedPrescription.patientName}
                    </p>
                    {selectedPrescription.patientDOB && (
                      <p className="text-sm text-gray-600 print-text-sm">
                        DOB:{" "}
                        {new Date(
                          String(selectedPrescription.patientDOB).slice(0, 10) + "T00:00:00",
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 print-text">Date</p>
                    <p className="font-medium print-text">
                      {formatDateTime(selectedPrescription.dateTime)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-600 print-text">
                    Prescribed by
                  </p>
                  <p className="font-medium print-text">
                    {selectedPrescription.doctorName || "Unknown Provider"}
                  </p>
                </div>
              </div>

              {/* Progress Tracker (screen only) */}
              <div className="print-section print-production print-hide-tracker">
                <PrescriptionProgressTracker
                  status={selectedPrescription.status}
                  trackingNumber={selectedPrescription.trackingNumber}
                  pharmacyName={selectedPrescription.pharmacyName}
                  billingStatus={selectedPrescription.paymentStatus}
                  patientCopay={selectedPrescription.patientPrice}
                  carrierStatus={selectedPrescription.carrierStatus}
                  trackingCarrier={selectedPrescription.trackingCarrier}
                  estimatedDelivery={selectedPrescription.estimatedDelivery}
                />
              </div>

              {/* Print-friendly Progress Tracker (print only) */}
              <div className="hidden print-show-tracker" data-print-only="true">
                <PrintProgressTracker
                  status={selectedPrescription.status}
                  paymentStatus={selectedPrescription.paymentStatus}
                  patientPrice={selectedPrescription.patientPrice}
                  pharmacyName={selectedPrescription.pharmacyName}
                  trackingNumber={selectedPrescription.trackingNumber}
                  trackingCarrier={selectedPrescription.trackingCarrier}
                />
              </div>

              {/* Medications List */}
              <div className="space-y-3">
                <h3
                  className="font-semibold text-lg print-details-title"
                  style={{ color: "#00AEEF" }}
                >
                  Prescription Details
                </h3>

                {selectedPrescription.submittedBy && (
                  <div
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    data-testid={`text-submitted-by-${selectedPrescription.id}`}
                  >
                    Submitted by{" "}
                    <span className="font-semibold">
                      {selectedPrescription.submittedBy.name}
                    </span>{" "}
                    ({selectedPrescription.submittedBy.title}) on behalf of{" "}
                    <span className="font-semibold">
                      {selectedPrescription.doctorName ?? "the prescriber"}
                    </span>
                    .
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 space-y-3 print-section">
                  {/* Medication Name */}
                  <div className="grid grid-cols-2 gap-4 print-grid-2">
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Medication
                      </p>
                      <p className="text-base font-semibold text-gray-900 print-text">
                        {selectedPrescription.medication}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Vial Size
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.vialSize || "5mL"}
                      </p>
                    </div>
                  </div>

                  {/* Dosage Information */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200 print-grid">
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Dosage Amount
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.dosageAmount ||
                          selectedPrescription.strength}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Unit
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.dosageUnit || "mg"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Form
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.form !== "N/A"
                          ? selectedPrescription.form
                          : "Injectable"}
                      </p>
                    </div>
                  </div>

                  {/* Quantity and Refills */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200 print-grid">
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Quantity
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        Refills
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.refills}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium print-text-sm">
                        DAW
                      </p>
                      <p className="text-base text-gray-900 print-text">
                        {selectedPrescription.dispenseAsWritten ? "Yes" : "No"}
                      </p>
                    </div>
                  </div>

                  {/* SIG - How to Use */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 font-medium print-text-sm">
                      How to Use This Medication (Patient Directions)
                    </p>
                    <p className="text-base text-gray-900 mt-1 leading-relaxed print-text">
                      {selectedPrescription.sig ||
                        "Inject 0.5mL subcutaneously once daily in the evening. Rotate injection sites between abdomen, thigh, and upper arm. Store in refrigerator between 36-46°F. Allow to reach room temperature before injection. Dispose of used syringes in approved sharps container."}
                    </p>
                  </div>

                  {/* Pricing Breakdown — Group-aware (May 2026 fix).
                      Mirrors admin/prescriptions/page.tsx L1247-1420
                      pattern for grouped orders. When the selected rx
                      is part of a multi-item submission group, list
                      every sibling medication and render ONE Group
                      Total. Without this, the provider sees only the
                      selected rx's price and total, then has to open
                      each sibling separately to see 5 Totals like
                      $900, $108, etc — which is exactly the bug
                      Joseph reported May 1, 2026. Same paid-bucket
                      filter as the admin modal so post-Phase-C
                      Pinealon (paid) renders alone and the 5 reset
                      siblings (unpaid) render together. */}
                  {(() => {
                    const selectedPaidBucket =
                      selectedPrescription.paymentStatus === "paid" ? "paid" : "unpaid";
                    const groupMembers =
                      selectedPrescription.submissionGroupId && allPrescriptions
                        ? allPrescriptions.filter(
                            (p) =>
                              p.submissionGroupId === selectedPrescription.submissionGroupId &&
                              (p.paymentStatus === "paid" ? "paid" : "unpaid") === selectedPaidBucket,
                          )
                        : [selectedPrescription];
                    const isGrouped = groupMembers.length > 1;

                    // Defensive integer-cents sums. Same hardening
                    // pattern as the admin modal: clamp negative
                    // profit_cents (the Greenwich/Rahmany incident
                    // left several rxs with profit_cents = -patient_
                    // price_cents which silently zeroed totals).
                    let groupMedCents = 0;
                    let groupShipCents = 0;
                    let groupFeeCents = 0;
                    for (const m of groupMembers) {
                      const rawPrice = m.patientPrice;
                      const priceN =
                        typeof rawPrice === "number"
                          ? rawPrice
                          : rawPrice == null
                            ? 0
                            : parseFloat(String(rawPrice));
                      if (Number.isFinite(priceN)) {
                        groupMedCents += Math.round(priceN * 100);
                      }
                      const rawShip = m.shippingFeeCents;
                      const shipN =
                        typeof rawShip === "number"
                          ? rawShip
                          : rawShip == null
                            ? 0
                            : parseFloat(String(rawShip));
                      if (Number.isFinite(shipN)) {
                        groupShipCents += Math.round(shipN);
                      }
                      const rawOver = m.profitCents;
                      const overN =
                        typeof rawOver === "number"
                          ? rawOver
                          : rawOver == null
                            ? 0
                            : parseFloat(String(rawOver));
                      if (Number.isFinite(overN) && overN > 0) {
                        groupFeeCents += Math.round(overN);
                      }
                    }
                    const groupTotalCents =
                      groupMedCents + groupShipCents + groupFeeCents;

                    return (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-gray-600 font-medium print-text-sm">
                            Pricing
                          </p>
                          {isGrouped && (
                            <span
                              className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                              data-testid="badge-pricing-group-count"
                            >
                              {groupMembers.length} items in group
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {isGrouped ? (
                            <>
                              {groupMembers.map((gm) => {
                                const rawP = gm.patientPrice;
                                const pN =
                                  typeof rawP === "number"
                                    ? rawP
                                    : rawP == null
                                      ? 0
                                      : parseFloat(String(rawP));
                                const isCurrent = gm.id === selectedPrescription.id;
                                return (
                                  <div
                                    key={gm.id}
                                    className={`flex justify-between text-sm rounded px-2 py-1.5 ${isCurrent ? "bg-blue-50 font-semibold" : ""}`}
                                    data-testid={`text-group-item-${gm.id}`}
                                  >
                                    <span className="truncate mr-2 text-gray-800">
                                      {gm.medication}
                                    </span>
                                    <span className="whitespace-nowrap text-gray-900">
                                      ${Number.isFinite(pN) ? pN.toFixed(2) : "0.00"}
                                    </span>
                                  </div>
                                );
                              })}
                              {(groupShipCents > 0 || groupFeeCents > 0) && (
                                <div className="border-t border-gray-200 pt-2 px-2 space-y-1">
                                  {groupShipCents > 0 && (
                                    <div className="flex justify-between text-xs text-gray-600">
                                      <span>Shipping &amp; Handling</span>
                                      <span>${(groupShipCents / 100).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {groupFeeCents > 0 && (
                                    <div className="flex justify-between text-xs text-gray-600">
                                      <span>Consultation Fee</span>
                                      <span>${(groupFeeCents / 100).toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600 print-text-sm">
                                  Medication Price:
                                </span>
                                <span className="text-sm font-semibold text-gray-900 print-text-sm">
                                  ${(groupMedCents / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600 print-text-sm">
                                  Shipping Fee:
                                </span>
                                <span className="text-sm font-semibold text-gray-900 print-text-sm">
                                  ${(groupShipCents / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600 print-text-sm">
                                  Consultation Fee
                                  {selectedPrescription.consultationReason
                                    ? ` (${CONSULTATION_REASON_LABELS[selectedPrescription.consultationReason] || selectedPrescription.consultationReason})`
                                    : ""}
                                  :
                                </span>
                                <span className="text-sm font-semibold text-gray-900 print-text-sm">
                                  ${(groupFeeCents / 100).toFixed(2)}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-300">
                            <span className="text-base font-semibold text-gray-900 print-text">
                              {isGrouped ? `Group Total (${groupMembers.length} items):` : "Total:"}
                            </span>
                            <span
                              className="text-xl font-bold text-gray-900 print-text"
                              data-testid="text-pricing-total"
                            >
                              ${(groupTotalCents / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg" style={{ color: "#00AEEF" }}>
                  <Truck className="inline-block mr-2 h-5 w-5" />
                  Shipping Address
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {(() => {
                    const addr = selectedPrescription.hasCustomAddress && selectedPrescription.customAddress
                      ? selectedPrescription.customAddress
                      : selectedPrescription.patientAddress;
                    if (addr && (addr.street || addr.city)) {
                      return (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">
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
                      <p className="text-amber-600 font-medium">No shipping address on file</p>
                    );
                  })()}

                  {!showAddressEdit ? (
                    <div className="pt-2 border-t border-gray-200">
                      <Button type="button" variant="outline" size="sm" data-testid="btn-edit-shipping-address" onClick={() => {
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
                        <Label htmlFor="edit-street">Street Address</Label>
                        <Input id="edit-street" data-testid="input-edit-street" placeholder="123 Main St" value={editAddress.street || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, street: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="edit-city">City</Label>
                          <Input id="edit-city" data-testid="input-edit-city" placeholder="City" value={editAddress.city || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, city: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-state">State</Label>
                          <Input id="edit-state" data-testid="input-edit-state" placeholder="FL" value={editAddress.state || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, state: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="edit-zip">Zip Code</Label>
                          <Input id="edit-zip" data-testid="input-edit-zip" placeholder="33101" value={editAddress.zipCode || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, zipCode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-country">Country</Label>
                          <Input id="edit-country" data-testid="input-edit-country" placeholder="US" value={editAddress.country || ""} onChange={(e) => setEditAddress((prev) => ({ ...prev, country: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" data-testid="btn-save-address-to-rx-and-patient" disabled={savingAddress || !editAddress.street?.trim() || !editAddress.city?.trim()} onClick={async () => {
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
                            onPrescriptionUpdated?.();
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
                        <Button type="button" variant="secondary" size="sm" data-testid="btn-save-address-to-rx-only" disabled={savingAddress || !editAddress.street?.trim() || !editAddress.city?.trim()} onClick={async () => {
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
                            onPrescriptionUpdated?.();
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
              </div>

              {/* Notes from Pharmacy - Always show */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 print-section print-notes">
                <p className="font-semibold text-sm text-gray-700 mb-2 print-text">
                  📋 Important Notes from AIM Pharmacy:
                </p>
                <div className="text-sm text-gray-900 space-y-1">
                  {(
                    selectedPrescription.pharmacyNotes ||
                    "• Keep refrigerated at 36-46°F until use\n• This medication requires proper injection technique - review instructions with your provider\n• Report any unusual side effects to your doctor immediately\n• Do not share needles or medication with others\n• Dispose of used supplies in an approved sharps container"
                  )
                    .split("\n")
                    .map((line, index) => (
                      <p
                        key={index}
                        className="leading-relaxed print-text-sm"
                      >
                        {line}
                      </p>
                    ))}
                </div>
              </div>

              {/* Fulfillment Box */}
              <div
                className="border-2 rounded-lg p-4 space-y-3 print-section print-pickup"
                style={{ borderColor: "#00AEEF" }}
              >
                <div className="flex items-start gap-2">
                  <MapPin
                    className="w-5 h-5 mt-0.5 print-hide"
                    style={{ color: "#00AEEF" }}
                  />
                  <div>
                    <h3
                      className="font-semibold text-lg mb-2"
                      style={{ color: "#00AEEF" }}
                    >
                      Fulfilling Pharmacy
                    </h3>
                    <p className="font-semibold text-gray-900 print-text">
                      {selectedPrescription.pharmacyName || "AIM Medical Technologies"}
                    </p>
                    {!selectedPrescription.pharmacyName && (
                      <a
                        href="https://maps.google.com/?q=106+E+6th+St+Suite+900+Austin+TX+78701"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline inline-block mt-1 print-text-sm"
                        style={{ color: "#00AEEF" }}
                      >
                        106 E 6th St, Suite 900, Austin, TX 78701 →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-3 print-hide">
                {/* Edit Prescription + Mark as Paid - only when pending_payment */}
                {selectedPrescription.status === "pending_payment" && (
                  <>
                    {!hideEdit && (
                      <Button
                        onClick={() => setIsEditModalOpen(true)}
                        variant="outline"
                        className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                      >
                        <Pencil className="h-5 w-5 mr-2" />
                        Edit Prescription
                      </Button>
                    )}
                    {/* Mark as Paid - hidden in provider terminal, admin-only feature */}
                  </>
                )}

                {/* Bill Patient Button - varies based on payment_status */}
                {selectedPrescription.paymentStatus === "paid" ? (
                  <>
                    <Button
                      disabled
                      variant="outline"
                      className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 cursor-not-allowed"
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Payment Received
                    </Button>
                    {/* Manual Submit to Pharmacy button - shows when paid but not yet submitted */}
                    {selectedPrescription.status === "payment_received" && (
                      <Button
                        onClick={() =>
                          handleSubmitToPharmacy(selectedPrescription.id)
                        }
                        disabled={isSubmittingToPharmacy}
                        variant="outline"
                        className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                      >
                        {isSubmittingToPharmacy ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Pill className="h-5 w-5 mr-2" />
                            Submit to Pharmacy
                          </>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setIsBillModalOpen(true);
                    }}
                    variant="outline"
                    className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                  >
                    <DollarSign className="h-5 w-5 mr-2" />
                    Bill Patient
                  </Button>
                )}

                {/* View PDF Button - only show if PDF is attached */}
                {selectedPrescription.pdfStoragePath && (
                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          `/api/prescriptions/${selectedPrescription.id}/pdf`,
                        );
                        const data = await response.json();
                        if (data.success && data.url) {
                          window.open(data.url, "_blank");
                        } else {
                          toast.error("Failed to load PDF");
                        }
                      } catch {
                        toast.error("Failed to load PDF");
                      }
                    }}
                    variant="outline"
                    className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                  >
                    <FileText className="h-5 w-5 mr-2" />
                    View Prescription PDF
                  </Button>
                )}

                <Button
                  onClick={() => printReceipt()}
                  variant="outline"
                  className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                >
                  <Printer className="h-5 w-5 mr-2" />
                  Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill Patient Modal */}
      {selectedPrescription && (() => {
        // ──────────────────────────────────────────────────────────────────
        // FULL-GROUP EXPANSION (Greenwich/Rahmany incident, May 2026)
        // ──────────────────────────────────────────────────────────────────
        // When the provider opens Bill Patient on a row that is part of an
        // order group (submissionGroupId), include ALL unpaid siblings so
        // the modal shows the full patient owe-amount and the resulting
        // /api/payments/generate-link call passes the server's
        // full-group integrity guard (returns 422 on partial bills).
        //
        // Mirrors the admin pattern at admin/prescriptions/page.tsx L201-217.

        const groupMembers = (selectedPrescription.submissionGroupId && allPrescriptions)
          ? allPrescriptions.filter(
              (p) =>
                p.submissionGroupId === selectedPrescription.submissionGroupId &&
                p.paymentStatus !== "paid",
            )
          : [selectedPrescription];

        // De-dupe + always include the selected rx itself even if for any
        // reason it is missing from the in-memory list snapshot.
        const groupMembersById = new Map(groupMembers.map((p) => [p.id, p]));
        if (!groupMembersById.has(selectedPrescription.id)) {
          groupMembersById.set(selectedPrescription.id, selectedPrescription);
        }
        const finalGroup = Array.from(groupMembersById.values());

        const groupedRxIds = finalGroup.map((p) => p.id);

        let totalMedicationCostCents = 0;
        let totalShippingFeeCents = 0;
        let totalOversightFeeCents = 0;
        const groupMedNames: string[] = [];

        for (const grx of finalGroup) {
          const pp = grx.patientPrice ? parseFloat(grx.patientPrice) : 0;
          totalMedicationCostCents += Number.isFinite(pp) ? Math.round(pp * 100) : 0;
          totalShippingFeeCents += grx.shippingFeeCents ?? 0;
          totalOversightFeeCents += grx.profitCents ?? 0;
          groupMedNames.push(grx.medication);
        }

        return (
          <BillPatientModal
            isOpen={isBillModalOpen}
            onClose={() => setIsBillModalOpen(false)}
            prescriptionId={selectedPrescription.id}
            prescriptionIds={groupedRxIds.length > 1 ? groupedRxIds : undefined}
            patientName={selectedPrescription.patientName}
            patientEmail={selectedPrescription.patientEmail}
            medication={
              groupedRxIds.length > 1
                ? `${groupedRxIds.length} medications: ${groupMedNames.join(", ")}`
                : selectedPrescription.medication
            }
            medicationCostCents={totalMedicationCostCents}
            profitCents={totalOversightFeeCents}
            shippingFeeCents={totalShippingFeeCents}
            paymentStatus={selectedPrescription.paymentStatus}
          />
        );
      })()}

      {/* Edit Prescription Modal */}
      {selectedPrescription && (
        <EditPrescriptionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          prescription={selectedPrescription}
          onSaved={(updatedFields) => {
            setIsEditModalOpen(false);
            // Immediately update in-memory prescription so receipt modal reflects changes
            setSelectedPrescription({
              ...selectedPrescription,
              ...updatedFields,
              strength: `${updatedFields.dosageAmount}${updatedFields.dosageUnit}`,
            });
            onPrescriptionUpdated?.();
          }}
        />
      )}
    </>
  );
}
