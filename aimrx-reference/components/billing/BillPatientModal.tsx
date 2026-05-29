"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Mail,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSpinner() {
  return (
    <div className="space-y-6 py-4 overflow-y-auto max-h-[500px]">
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Checking payment status...</p>
      </div>
    </div>
  );
}

function PatientInfoCard({
  patientName,
  medication,
}: {
  patientName: string;
  medication: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Patient:</span>
        <span className="font-medium">{patientName}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-gray-600">Medication:</span>
        <span className="font-medium">{medication}</span>
      </div>
    </div>
  );
}

interface PaymentFormFieldsProps {
  patientEmail: string;
  setPatientEmail: (value: string) => void;
  consultationFeeDollars: string;
  medicationCostDollars: string;
  shippingFeeDollars: string;
  description: string;
  setDescription: (value: string) => void;
  totalAmount: string;
  emailHelperText: string;
  idPrefix: string;
}

function PaymentFormFields({
  patientEmail,
  setPatientEmail,
  consultationFeeDollars,
  medicationCostDollars,
  shippingFeeDollars,
  description,
  setDescription,
  totalAmount,
  emailHelperText,
  idPrefix,
}: PaymentFormFieldsProps) {
  return (
    <>
      {/* Patient Email */}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}Email`}>
          Patient Email Address
          <span className="text-red-500 ml-1">*</span>
        </Label>
        <Input
          id={`${idPrefix}Email`}
          type="email"
          placeholder="patient@example.com"
          value={patientEmail}
          onChange={(e) => setPatientEmail(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">{emailHelperText}</p>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Consultation Fee</span>
          <span className="font-medium">${consultationFeeDollars}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Medication Cost</span>
          <span className="font-medium">${medicationCostDollars}</span>
        </div>
        {parseFloat(shippingFeeDollars) > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Shipping Fee</span>
            <span className="font-medium">${shippingFeeDollars}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-xl font-bold text-blue-600">${totalAmount}</span>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}Description`}>Description (Optional)</Label>
        <Textarea
          id={`${idPrefix}Description`}
          placeholder="Payment description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <p className="text-sm text-muted-foreground">
          This will appear on the payment form and receipt
        </p>
      </div>
    </>
  );
}

interface PaymentLinkResultViewProps {
  paymentUrl: string;
  expiresAt: string | null;
  isExistingLink: boolean;
  emailSent: boolean;
  patientName: string;
  patientEmail: string;
  consultationFeeDollars: string;
  medicationCostDollars: string;
  shippingFeeDollars: string;
  totalAmount: string;
  loading: boolean;
  onCopyLink: () => void;
  onChargeDirectly: () => void;
  onResendEmail: () => void;
  onDeleteLink: () => void;
  deleting: boolean;
  onClose: () => void;
}

function PaymentLinkResultView({
  paymentUrl,
  expiresAt,
  isExistingLink,
  emailSent,
  patientName,
  patientEmail,
  consultationFeeDollars,
  medicationCostDollars,
  shippingFeeDollars,
  totalAmount,
  loading,
  onCopyLink,
  onChargeDirectly,
  onResendEmail,
  onDeleteLink,
  deleting,
  onClose,
}: PaymentLinkResultViewProps) {
  return (
    <div className="space-y-6 py-4 overflow-y-auto max-h-[500px]">
      {/* Success Header */}
      <div className="text-center py-4">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isExistingLink ? "bg-yellow-100" : "bg-green-100"
          }`}
        >
          {isExistingLink ? (
            <AlertCircle className="w-10 h-10 text-yellow-600" />
          ) : (
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {isExistingLink
            ? "Existing Payment Link"
            : emailSent
              ? "Payment Link Sent!"
              : "Payment Link Generated!"}
        </h3>
        <p className="text-gray-600">
          {isExistingLink
            ? emailSent
              ? `A payment link already exists. Email resent to ${patientEmail}`
              : `A payment link was previously generated for this prescription`
            : emailSent
              ? `Payment link sent to ${patientEmail}`
              : `Send this secure link to ${patientName} to complete payment`}
        </p>
      </div>

      {/* Existing Link Warning Banner */}
      {isExistingLink && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">
                This is an existing payment link
              </p>
              <p>
                A payment link was already generated for this prescription and
                an email was sent to the patient. The amounts shown below are
                from the original link and cannot be changed.
                {emailSent && " The patient has been notified again via email."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Total Amount:</span>
          <span className="text-lg font-bold text-gray-900">
            ${totalAmount}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Consultation Fee:</span>
          <span className="font-medium">${consultationFeeDollars}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Medication Cost:</span>
          <span className="font-medium">${medicationCostDollars}</span>
        </div>
        {parseFloat(shippingFeeDollars) > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Shipping Fee:</span>
            <span className="font-medium">${shippingFeeDollars}</span>
          </div>
        )}
      </div>

      {/* Payment URL */}
      <div className="space-y-2">
        <Label>Payment Link</Label>
        <div className="flex gap-2">
          <Input value={paymentUrl} readOnly className="font-mono text-sm" />
          <Button
            variant="outline"
            size="icon"
            onClick={onCopyLink}
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>This payment link does not expire</span>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Next Steps:</h4>
        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
          <li>Copy and send this link to {patientName} via email or text</li>
          <li>Patient clicks the link and completes payment</li>
          <li>You&apos;ll be notified when payment is received</li>
          <li>Order automatically progresses to pharmacy processing</li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {isExistingLink && (
          <Button
            onClick={onChargeDirectly}
            className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
            disabled={loading || deleting}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Charge Directly
              </>
            )}
          </Button>
        )}
        <div className="flex gap-3">
          {isExistingLink && !emailSent && (
            <Button
              onClick={onResendEmail}
              variant="outline"
              className="flex-1"
              disabled={loading || deleting}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Email to Patient"
              )}
            </Button>
          )}
          <Button
            onClick={onClose}
            variant={isExistingLink ? "outline" : "default"}
            className={`${isExistingLink && !emailSent ? "flex-1" : isExistingLink ? "w-full" : "w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"}`}
          >
            Done
          </Button>
        </div>
        {isExistingLink && (
          <Button
            onClick={onDeleteLink}
            variant="outline"
            className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
            disabled={loading || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Link
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface BillPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescriptionId: string;
  prescriptionIds?: string[];
  patientName: string;
  patientEmail?: string;
  medication: string;
  medicationCostCents?: number;
  profitCents?: number;
  shippingFeeCents?: number;
  paymentStatus?: string;
  initialPaymentMethod?: "send-link" | "charge-now";
  onPaymentSuccess?: () => void;
}

export function BillPatientModal({
  isOpen,
  onClose,
  prescriptionId,
  prescriptionIds,
  patientName,
  patientEmail: initialPatientEmail,
  medication,
  medicationCostCents = 0,
  profitCents = 0,
  shippingFeeCents = 0,
  initialPaymentMethod,
  onPaymentSuccess,
}: BillPatientModalProps) {
  // Form state
  const [paymentMethod, setPaymentMethod] = useState<
    "send-link" | "charge-now"
  >(initialPaymentMethod || "send-link");
  const [consultationFeeDollars, setConsultationFeeDollars] = useState(
    (profitCents / 100).toFixed(2),
  );
  const [medicationCostDollars, setMedicationCostDollars] = useState(
    (medicationCostCents / 100).toFixed(2),
  );
  const [shippingFeeDollars, setShippingFeeDollars] = useState(
    (shippingFeeCents / 100).toFixed(2),
  );
  const [description, setDescription] = useState(
    `Payment for ${medication} prescription`,
  );
  const [patientEmail, setPatientEmail] = useState(initialPatientEmail || "");
  // For Charge Now (provider pays on patient's behalf), default to NOT
  // emailing a receipt to the patient. Provider can opt-in per charge.
  const [sendReceiptToPatient, setSendReceiptToPatient] = useState(false);

  useEffect(() => {
    if (isOpen && initialPaymentMethod) {
      setPaymentMethod(initialPaymentMethod);
    }
  }, [isOpen, initialPaymentMethod]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Result state
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isExistingLink, setIsExistingLink] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset form state from props when modal opens or props change
  useEffect(() => {
    if (isOpen && !paymentUrl) {
      setConsultationFeeDollars((profitCents / 100).toFixed(2));
      setMedicationCostDollars((medicationCostCents / 100).toFixed(2));
      setShippingFeeDollars((shippingFeeCents / 100).toFixed(2));
      setDescription(`Payment for ${medication} prescription`);
      setPatientEmail(initialPatientEmail || "");
      // Always default the receipt-to-patient checkbox to OFF for each
      // new modal session so a previous "checked" choice cannot leak
      // into the next charge.
      setSendReceiptToPatient(false);
    }
  }, [
    isOpen,
    profitCents,
    medicationCostCents,
    shippingFeeCents,
    medication,
    initialPatientEmail,
    paymentUrl,
  ]);

  // Check for existing payment link when modal opens
  useEffect(() => {
    if (isOpen) {
      checkExistingPaymentLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prescriptionId]);

  const calculateTotal = () => {
    const consultationFee = parseFloat(consultationFeeDollars) || 0;
    const medicationCost = parseFloat(medicationCostDollars) || 0;
    const shippingFee = parseFloat(shippingFeeDollars) || 0;
    return (consultationFee + medicationCost + shippingFee).toFixed(2);
  };

  // ============================================================================
  // API Handlers
  // ============================================================================

  // Returns true if an existing link was found (and surfaced into UI state),
  // false otherwise. Returning a boolean avoids relying on stale React state
  // in callers that need to know the outcome of this lookup immediately.
  const checkExistingPaymentLink = async (): Promise<boolean> => {
    if (paymentUrl) return true;
    try {
      setCheckingStatus(true);
      const response = await fetch(
        `/api/payments/check-link/${prescriptionId}`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (response.ok && data.success && data.hasExistingLink) {
        setPaymentUrl(data.existingLink.paymentUrl);
        setPaymentToken(data.existingLink.paymentToken);
        setExpiresAt(data.existingLink.expiresAt);
        setIsExistingLink(true);
        setConsultationFeeDollars(
          (data.existingLink.consultationFeeCents / 100).toFixed(2),
        );
        setMedicationCostDollars(
          (data.existingLink.medicationCostCents / 100).toFixed(2),
        );
        setShippingFeeDollars(
          ((data.existingLink.shippingFeeCents || 0) / 100).toFixed(2),
        );
        if (data.existingLink.description)
          setDescription(data.existingLink.description);
        if (data.existingLink.patientEmail)
          setPatientEmail(data.existingLink.patientEmail);
        return true;
      }
      return false;
    } catch (error) {
      // Silently handle check errors
      return false;
    } finally {
      setCheckingStatus(false);
    }
  };

  const validateForm = () => {
    const consultationFee = parseFloat(consultationFeeDollars);
    const medicationCost = parseFloat(medicationCostDollars);
    if (isNaN(consultationFee)) {
      toast.error("Please enter a valid consultation fee");
      return false;
    }
    if (isNaN(medicationCost) || medicationCost < 0) {
      toast.error("Please enter a valid medication cost");
      return false;
    }
    const shippingFee = parseFloat(shippingFeeDollars) || 0;
    if (isNaN(shippingFee)) {
      toast.error("Please enter a valid shipping fee");
      return false;
    }
    if (consultationFee + medicationCost + shippingFee <= 0) {
      toast.error("Total amount must be greater than $0.00");
      return false;
    }
    if (!patientEmail || !patientEmail.includes("@")) {
      toast.error("Please enter a valid patient email address");
      return false;
    }
    return true;
  };

  const handleGeneratePaymentLink = async () => {
    if (!validateForm()) return;

    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), 25000);

    try {
      setLoading(true);
      const consultationFee = parseFloat(consultationFeeDollars);
      const medicationCost = parseFloat(medicationCostDollars);

      const shippingFee = parseFloat(shippingFeeDollars) || 0;

      const response = await fetch("/api/payments/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          prescriptionId,
          prescriptionIds: prescriptionIds || [prescriptionId],
          consultationFeeCents: Math.round(consultationFee * 100),
          medicationCostCents: Math.round(medicationCost * 100),
          shippingFeeCents: Math.round(shippingFee * 100),
          description,
          patientEmail,
          sendEmail: true,
        }),
      });
      clearTimeout(clientTimeout);

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.paidOnTerms) {
          toast.success(
            data.message || "Auto-paid on terms — submitted to pharmacy",
            {
              icon: <CheckCircle2 className="h-5 w-5" />,
              description: data.providerName
                ? `Provider ${data.providerName} is on terms — payment skipped`
                : "Payment flow skipped for this provider",
            },
          );
          if (onPaymentSuccess) onPaymentSuccess();
          if (onClose) onClose();
          return;
        }
        setPaymentUrl(data.paymentUrl);
        setPaymentToken(data.paymentToken);
        setEmailSent(data.emailSent || false);
        setIsExistingLink(data.existing || false);
        setExpiresAt(data.expiresAt || null);

        if (data.existing) {
          toast.info("Payment link already exists for this prescription", {
            icon: <AlertCircle className="h-5 w-5" />,
            description: data.emailSent
              ? `Email resent to ${patientEmail}`
              : "Use the existing link below",
          });
        } else if (data.emailSent) {
          toast.success("Payment link sent to patient's email!", {
            icon: <CheckCircle2 className="h-5 w-5" />,
            description: `Email sent to ${patientEmail}`,
          });
        } else {
          toast.success("Payment link generated successfully!", {
            icon: <CheckCircle2 className="h-5 w-5" />,
            description: "Copy the link below to send to patient",
          });
        }
      } else {
        toast.error(data.error || "Failed to generate payment link");
      }
    } catch (error) {
      clearTimeout(clientTimeout);
      // If the request hung (network or server timeout), the link may still
      // have been created server-side. Refresh the existing-link lookup so
      // the provider sees it instead of being stuck on a spinner forever.
      const aborted =
        (error as { name?: string } | undefined)?.name === "AbortError";
      if (aborted) {
        toast.warning(
          "Taking longer than expected — checking if the link was created…",
          { icon: <AlertCircle className="h-5 w-5" /> },
        );
        // Try a few times with short backoff: the server-side commit may
        // not be visible the very first millisecond after our client abort.
        let recovered = false;
        for (const wait of [0, 1500, 3000]) {
          if (wait) await new Promise((r) => setTimeout(r, wait));
          recovered = await checkExistingPaymentLink();
          if (recovered) break;
        }
        if (recovered) {
          toast.success("Payment link recovered — see below.", {
            icon: <CheckCircle2 className="h-5 w-5" />,
          });
        } else {
          toast.error(
            "We couldn't confirm the link. Please close and try again, or check the prescription page.",
          );
        }
      } else {
        toast.error("Failed to generate payment link");
      }
    } finally {
      setLoading(false);
    }
  };

  // Charge Now — external-redirect flow.
  //
  // History: between Apr 21 and Apr 25 2026 this modal embedded the
  // Authorize.Net hosted form in an iframe and called verify-and-complete
  // from a parent-window message handler. That path produced an orphan
  // triple-charge incident on Apr 25 (Jerry Horani — three Authnet auth+capture
  // transactions for $29 each, none reconciled to the prescription row,
  // because the iframe handler did not lock the Charge button between
  // submissions). The post-mortem decision was to remove the inline iframe
  // entirely and reinstate the original external-redirect flow that the
  // Send Link tab and email recipients have always used.
  //
  // The new flow:
  //   1. Call /api/payments/generate-link (same endpoint the email tab uses)
  //      with sendEmail:false so no email goes to the patient.
  //   2. Open /payment/<paymentToken>?from=provider-dashboard in a new tab.
  //   3. Close this modal and tell the provider to refresh the prescription
  //      list when payment is complete.
  // The patient-facing /payment/<token> page handles the Authnet handoff
  // and verify-and-complete polling. That page is the single source of
  // truth for finalizing payment, which eliminates the dual-codepath risk.
  const handleChargeNow = async () => {
    if (!validateForm()) return;

    // Pre-open a blank tab SYNCHRONOUSLY inside the click handler so the
    // browser treats this as a user-gesture popup and won't block it. We
    // navigate this tab to the real payment page once generate-link returns
    // a token. If the popup is blocked, window.open returns null and we
    // fall back to clipboard. Without this pre-open, popup blockers fire
    // because the navigation happens after an awaited fetch (no longer a
    // direct user gesture).
    const prelaunchedTab = window.open("about:blank", "_blank");

    try {
      setLoading(true);

      const consultationFee = parseFloat(consultationFeeDollars);
      const medicationCost = parseFloat(medicationCostDollars);
      const shippingFee = parseFloat(shippingFeeDollars) || 0;

      // Reuse an existing payment_token if check-link already found one,
      // otherwise mint a fresh one (no email sent to patient).
      let currentPaymentToken = paymentToken;
      if (!currentPaymentToken) {
        const generateResponse = await fetch("/api/payments/generate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prescriptionId,
            prescriptionIds: prescriptionIds || [prescriptionId],
            consultationFeeCents: Math.round(consultationFee * 100),
            medicationCostCents: Math.round(medicationCost * 100),
            shippingFeeCents: Math.round(shippingFee * 100),
            description,
            patientEmail,
            sendEmail: false,
            sendReceiptToPatient,
          }),
        });

        const generateData = await generateResponse.json();
        if (!generateResponse.ok || !generateData.success) {
          // Don't leave an empty tab dangling on error.
          if (prelaunchedTab && !prelaunchedTab.closed) prelaunchedTab.close();
          toast.error(
            generateData.error || "Failed to create payment transaction",
          );
          return;
        }

        // Provider-on-terms shortcut — no payment needed, already submitted
        // to pharmacy server-side by generate-link. This is the ONE legitimate
        // success path inside handleChargeNow because the server has already
        // recorded the payment, so onPaymentSuccess (which marks billing done
        // upstream and may redirect) is correct here.
        if (generateData.paidOnTerms) {
          if (prelaunchedTab && !prelaunchedTab.closed) prelaunchedTab.close();
          toast.success(
            generateData.message || "Auto-paid on terms — submitted to pharmacy",
            {
              icon: <CheckCircle2 className="h-5 w-5" />,
              description: generateData.providerName
                ? `Provider ${generateData.providerName} is on terms — payment skipped`
                : "Payment flow skipped for this provider",
            },
          );
          if (onPaymentSuccess) onPaymentSuccess();
          handleClose();
          return;
        }

        currentPaymentToken = generateData.paymentToken;
        setPaymentToken(currentPaymentToken);
      }

      // Navigate the pre-opened tab to the patient-facing payment page. The
      // `from=provider-dashboard` query string tells get-hosted-token to
      // respect the provider's receipt-to-patient checkbox (instead of
      // forcing TRUE as it does for patient-link flows) and tells the
      // success page to render a "you can close this tab" message.
      //
      // `srp` carries the CURRENT checkbox state. We have to plumb it through
      // the URL because when an existing payment_token is reused, the
      // generate-link call is skipped, so the row's send_receipt_to_patient
      // column may still hold a stale value from when the token was first
      // minted (potentially via Send Link, which forces TRUE). Without this,
      // a provider who unchecks "send receipt" during Charge Now on a reused
      // token would still see a receipt go out — exactly the privacy
      // regression flagged on the rework re-review.
      const srp = sendReceiptToPatient ? "1" : "0";
      const path = `/payment/${currentPaymentToken}?from=provider-dashboard&srp=${srp}`;
      if (!prelaunchedTab) {
        // Popup blocker fired at click-time. Fall back to copying the URL
        // so staff can paste it. We DO NOT call onPaymentSuccess here —
        // payment has not happened yet.
        const fullUrl = window.location.origin + path;
        try {
          await navigator.clipboard.writeText(fullUrl);
          toast.warning(
            "Popup blocked — payment URL copied to your clipboard. Paste it into a new tab.",
            { icon: <AlertCircle className="h-5 w-5" /> },
          );
        } catch {
          toast.error(
            "Popup blocked. Please allow popups for this site, or copy this URL manually:",
            { description: fullUrl, duration: 15000 },
          );
        }
        return;
      }

      // Navigate the pre-opened blank tab to the real URL, then sever the
      // opener relationship for security (equivalent to rel="noopener").
      try {
        prelaunchedTab.location.href = path;
      } catch {
        // Cross-origin or closed-tab edge case — fall back to opening fresh.
        window.open(path, "_blank", "noopener,noreferrer");
      }
      try {
        prelaunchedTab.opener = null;
      } catch {
        // Some browsers throw on assigning opener cross-realm; safe to ignore.
      }

      toast.success("Payment page opened in a new tab", {
        icon: <CheckCircle2 className="h-5 w-5" />,
        description:
          "Refresh the prescription list when the patient completes payment.",
      });
      // CRITICAL: do NOT call onPaymentSuccess here. Opening a new tab
      // means the patient/provider has not submitted a card yet — calling
      // onPaymentSuccess would mark the prescription as paid upstream
      // (handleBillingSuccess in step4/page.tsx) and redirect, exactly the
      // false-positive completion that the architect flagged. The actual
      // success signal is verify-and-complete polling on the patient page.
      handleClose();
    } catch (error) {
      // Close the dangling blank tab on any unexpected error.
      if (prelaunchedTab && !prelaunchedTab.closed) {
        try {
          prelaunchedTab.close();
        } catch {
          // ignore
        }
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to open payment page",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChargeDirectly = async () => {
    if (!paymentToken) {
      toast.error("Payment token not found");
      return;
    }
    setPaymentMethod("charge-now");
    setPaymentUrl(null);
  };

  const handleCopyLink = () => {
    if (!paymentUrl) return;
    const textarea = document.createElement("textarea");
    textarea.value = paymentUrl;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      toast.success("Payment link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
    document.body.removeChild(textarea);
  };

  const handleDeleteLink = async () => {
    try {
      setDeleting(true);
      const response = await fetch(
        `/api/payments/check-link/${prescriptionId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Payment link deleted");
        // Reset to form view
        setPaymentUrl(null);
        setPaymentToken(null);
        setIsExistingLink(false);
        setExpiresAt(null);
        setEmailSent(false);
        // Re-sync form fields from props
        setConsultationFeeDollars((profitCents / 100).toFixed(2));
        setMedicationCostDollars((medicationCostCents / 100).toFixed(2));
        setShippingFeeDollars((shippingFeeCents / 100).toFixed(2));
        setDescription(`Payment for ${medication} prescription`);
        setPatientEmail(initialPatientEmail || "");
      } else {
        toast.error(data.error || "Failed to delete payment link");
      }
    } catch {
      toast.error("Failed to delete payment link");
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setPaymentUrl(null);
    setPaymentToken(null);
    setPaymentMethod("send-link");
    setConsultationFeeDollars((profitCents / 100).toFixed(2));
    setMedicationCostDollars((medicationCostCents / 100).toFixed(2));
    setShippingFeeDollars((shippingFeeCents / 100).toFixed(2));
    setDescription(`Payment for ${medication} prescription`);
    setIsExistingLink(false);
    setExpiresAt(null);
    setEmailSent(false);
    onClose();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Bill Patient</DialogTitle>
          <DialogDescription>
            Generate a secure payment link for {patientName}
          </DialogDescription>
        </DialogHeader>

        {checkingStatus ? (
          <LoadingSpinner />
        ) : paymentUrl ? (
          <PaymentLinkResultView
            paymentUrl={paymentUrl}
            expiresAt={expiresAt}
            isExistingLink={isExistingLink}
            emailSent={emailSent}
            patientName={patientName}
            patientEmail={patientEmail}
            consultationFeeDollars={consultationFeeDollars}
            medicationCostDollars={medicationCostDollars}
            shippingFeeDollars={shippingFeeDollars}
            totalAmount={calculateTotal()}
            loading={loading}
            onCopyLink={handleCopyLink}
            onChargeDirectly={handleChargeDirectly}
            onResendEmail={handleGeneratePaymentLink}
            onDeleteLink={handleDeleteLink}
            deleting={deleting}
            onClose={handleClose}
          />
        ) : (
          <div className="space-y-6 py-4 overflow-y-auto max-h-[500px]">
            <PatientInfoCard
              patientName={patientName}
              medication={medication}
            />

            <Tabs
              value={paymentMethod}
              onValueChange={(val) => setPaymentMethod(val as "send-link" | "charge-now")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="send-link" className="flex-1 gap-2">
                  <Mail className="h-4 w-4" />
                  Send Payment Link
                </TabsTrigger>
                <TabsTrigger value="charge-now" className="flex-1 gap-2">
                  <CreditCard className="h-4 w-4" />
                  Charge Now
                </TabsTrigger>
              </TabsList>

              <TabsContent value="send-link" className="space-y-4 mt-4">
                <PaymentFormFields
                  patientEmail={patientEmail}
                  setPatientEmail={setPatientEmail}
                  consultationFeeDollars={consultationFeeDollars}
                  medicationCostDollars={medicationCostDollars}
                  shippingFeeDollars={shippingFeeDollars}
                  description={description}
                  setDescription={setDescription}
                  totalAmount={calculateTotal()}
                  emailHelperText="Payment link will be sent to this email automatically"
                  idPrefix="sendLink"
                />
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGeneratePaymentLink}
                    className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Payment Link"
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="charge-now" className="space-y-4 mt-4">
                <PaymentFormFields
                  patientEmail={patientEmail}
                  setPatientEmail={setPatientEmail}
                  consultationFeeDollars={consultationFeeDollars}
                  medicationCostDollars={medicationCostDollars}
                  shippingFeeDollars={shippingFeeDollars}
                  description={description}
                  setDescription={setDescription}
                  totalAmount={calculateTotal()}
                  emailHelperText="Used for the card billing record. A receipt is only emailed if you check the box below."
                  idPrefix="chargeNow"
                />

                <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <Checkbox
                    id="chargeNowSendReceipt"
                    checked={sendReceiptToPatient}
                    onCheckedChange={(checked) =>
                      setSendReceiptToPatient(checked === true)
                    }
                    className="mt-0.5"
                    data-testid="checkbox-send-receipt"
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="chargeNowSendReceipt"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Email receipt to patient
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Off by default. Leave unchecked when the provider is
                      paying and the patient should not be notified.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                  Clicking the button below opens the secure Authorize.Net
                  payment page in a new browser tab. The patient (or you, on
                  the patient&apos;s behalf) completes payment there. Refresh
                  the prescription list when payment is complete to see the
                  updated status.
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                    disabled={loading}
                    data-testid="button-charge-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleChargeNow}
                    className="flex-1 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
                    disabled={loading}
                    data-testid="button-process-payment"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opening payment page...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Secure Payment Page
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
