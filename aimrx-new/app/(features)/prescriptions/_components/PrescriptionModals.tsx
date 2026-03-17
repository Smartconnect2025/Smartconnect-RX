"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  BadgeDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { BillPatientModal } from "@/components/billing/BillPatientModal";
import { EditPrescriptionModal } from "./EditPrescriptionModal";
import { PrescriptionProgressTracker } from "./PrescriptionProgressTracker";

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
  pharmacyId?: string;
  pharmacyName?: string;
  pharmacyColor?: string;
  profitCents?: number;
  shippingFeeCents?: number;
  totalPaidCents?: number;
  paymentStatus?: string;
  pdfStoragePath?: string;
  consultationReason?: string;
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
}: PrescriptionModalsProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const handleMarkAsPaid = async () => {
    if (!selectedPrescription) return;
    setIsMarkingPaid(true);
    try {
      const response = await fetch(
        `/api/prescriptions/${selectedPrescription.id}/mark-paid`,
        { method: "POST" },
      );
      const data = await response.json();
      if (data.success) {
        toast.success("Prescription marked as paid");
        setIsDialogOpen(false);
        onPrescriptionUpdated?.();
      } else {
        toast.error(data.error || "Failed to mark as paid");
      }
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setIsMarkingPaid(false);
    }
  };

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
                  src="https://i.imgur.com/r65O4DB.png"
                  alt="SmartConnect RX"
                  className="h-[80px] mx-auto print-logo"
                />
              </div>

              {/* Letterhead */}
              <div className="text-center text-sm text-gray-600 border-b pb-4 print-letterhead">
                <p className="font-semibold text-gray-900">
                  SmartConnect RX
                </p>
                <p>106 E 6th St, Suite 900 · Austin, TX 78701</p>
                <p>(512) 377-9898 · Mon–Fri 9AM–6PM CST</p>
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
                          selectedPrescription.patientDOB,
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

              {/* Progress Tracker */}
              <div className="print-section print-production">
                <PrescriptionProgressTracker
                  status={selectedPrescription.status}
                  trackingNumber={selectedPrescription.trackingNumber}
                  pharmacyName={selectedPrescription.pharmacyName}
                  billingStatus={selectedPrescription.paymentStatus}
                  patientCopay={selectedPrescription.patientPrice}
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

                  {/* Pricing Breakdown */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 font-medium mb-2 print-text-sm">
                      Pricing
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 print-text-sm">
                          Medication Price:
                        </span>
                        <span className="text-sm font-semibold text-gray-900 print-text-sm">
                          $
                          {selectedPrescription.patientPrice
                            ? parseFloat(
                                selectedPrescription.patientPrice,
                              ).toFixed(2)
                            : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 print-text-sm">
                          Shipping Fee:
                        </span>
                        <span className="text-sm font-semibold text-gray-900 print-text-sm">
                          $
                          {selectedPrescription.shippingFeeCents
                            ? (
                                selectedPrescription.shippingFeeCents / 100
                              ).toFixed(2)
                            : "0.00"}
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
                          $
                          {selectedPrescription.profitCents
                            ? (
                                selectedPrescription.profitCents / 100
                              ).toFixed(2)
                            : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="text-base font-semibold text-gray-900 print-text">
                          Total:
                        </span>
                        <span className="text-xl font-bold text-gray-900 print-text">
                          $
                          {(() => {
                            const medicationPrice = parseFloat(
                              selectedPrescription.patientPrice || "299.00",
                            );
                            const providerFees =
                              selectedPrescription.profitCents
                                ? selectedPrescription.profitCents / 100
                                : 0;
                            const shippingFee =
                              selectedPrescription.shippingFeeCents
                                ? selectedPrescription.shippingFeeCents / 100
                                : 0;
                            return (
                              medicationPrice +
                              providerFees +
                              shippingFee
                            ).toFixed(2);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
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
                      Pickup Location
                    </h3>
                    <p className="font-semibold text-gray-900 print-text">
                      SmartConnect RX
                    </p>
                    <a
                      href="https://maps.google.com/?q=106+E+6th+St+Suite+900+Austin+TX+78701"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline inline-block mt-1 print-text-sm"
                      style={{ color: "#00AEEF" }}
                    >
                      106 E 6th St, Suite 900, Austin, TX 78701 →
                    </a>
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
                    <Button
                      onClick={handleMarkAsPaid}
                      disabled={isMarkingPaid}
                      variant="outline"
                      className="w-full text-lg py-6 border-[#1E3A8A]/60 text-[#1E3A8A]/80 hover:bg-[#1E3A8A]/5"
                    >
                      {isMarkingPaid ? (
                        "Marking as Paid..."
                      ) : (
                        <>
                          <BadgeDollarSign className="h-5 w-5 mr-2" />
                          Mark as Paid
                        </>
                      )}
                    </Button>
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
      {selectedPrescription && (
        <BillPatientModal
          isOpen={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          prescriptionId={selectedPrescription.id}
          pharmacyId={selectedPrescription.pharmacyId}
          patientName={selectedPrescription.patientName}
          patientEmail={selectedPrescription.patientEmail}
          medication={selectedPrescription.medication}
          medicationCostCents={
            selectedPrescription.patientPrice
              ? Math.round(
                  parseFloat(selectedPrescription.patientPrice) * 100,
                )
              : 0
          }
          profitCents={selectedPrescription.profitCents}
          shippingFeeCents={selectedPrescription.shippingFeeCents}
          paymentStatus={selectedPrescription.paymentStatus}
        />
      )}

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
