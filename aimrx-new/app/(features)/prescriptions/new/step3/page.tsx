"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  File,
  MapPin,
  Pencil,
  X,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import { clearPrescriptionSession, getCart, getSharedFees } from "../prescriptionSessionUtils";
import type { CartItem, SharedFees } from "../prescriptionSessionUtils";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";

interface PharmacyMedicationData {
  ndc?: string;
  dosageInstructions?: string;
  notes?: string;
}

interface PrescriptionFormData {
  medication: string;
  strength: string;
  dosageAmount?: string;
  dosageUnit?: string;
  vialSize?: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes: string;
  patientPrice?: string;
  selectedPharmacyId?: string;
  selectedPharmacyName?: string;
  selectedPharmacyColor?: string;
  selectedMedicationId?: string;
  oversightFees?: Array<{ fee: string; reason: string }>;
  shippingFee?: string;
  refillFrequencyDays?: string;
}

interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  gender?: string;
  physicalAddress?: AddressData;
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export default function PrescriptionStep3Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const [prescriptionData, setPrescriptionData] =
    useState<PrescriptionFormData | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [sharedFees, setSharedFees] = useState<SharedFees>({ shippingFee: "25.00", oversightFees: [] });
  const [isMultiOrder, setIsMultiOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(
    null,
  );
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientLoadError, setPatientLoadError] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [customAddress, setCustomAddress] = useState<AddressData>({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });
  const [pharmacyMedData, setPharmacyMedData] =
    useState<PharmacyMedicationData | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { user } = useUser();
  const { isDemo: isDemoAccount, guardAction: demoGuard } = useDemoGuard();

  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId) {
        setLoadingPatient(false);
        return;
      }

      try {
        const { data: patient, error } = await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .single();

        if (error) {
          console.error("Error fetching patient:", error);
          toast.error("Failed to load patient information");
          setPatientLoadError(true);
        } else {
          const addr = patient.physical_address as AddressData | null;
          setSelectedPatient({
            id: patient.id,
            firstName: patient.first_name,
            lastName: patient.last_name,
            dateOfBirth: patient.date_of_birth,
            email: patient.email,
            phone: patient.phone,
            gender: patient.gender,
            physicalAddress: addr || undefined,
          });
        }
      } catch (error) {
        console.error("Error fetching patient:", error);
        toast.error("Failed to load patient information");
        setPatientLoadError(true);
      } finally {
        setLoadingPatient(false);
      }
    };

    fetchPatient();
  }, [patientId, supabase]);


  useEffect(() => {
    const cart = getCart();
    if (cart.length > 0) {
      setCartItems(cart);
      setSharedFees(getSharedFees());
      setIsMultiOrder(true);
      return;
    }

    const data = sessionStorage.getItem("prescriptionFormData");

    if (!data) {
      router.push("/prescriptions/new/step1?error=session_expired");
      return;
    }

    let loadedData;
    try {
      loadedData = JSON.parse(data);
    } catch {
      sessionStorage.removeItem("prescriptionFormData");
      router.push("/prescriptions/new/step1?error=session_expired");
      return;
    }

    if (!loadedData || typeof loadedData !== "object" || Array.isArray(loadedData) || typeof loadedData.medication !== "string") {
      sessionStorage.removeItem("prescriptionFormData");
      router.push("/prescriptions/new/step1?error=session_expired");
      return;
    }

    setPrescriptionData(loadedData);

    if (loadedData.selectedMedicationId) {
      supabase
        .from("pharmacy_medications")
        .select("ndc, dosage_instructions, notes")
        .eq("id", loadedData.selectedMedicationId)
        .single()
        .then(({ data: medData }) => {
          if (medData) {
            setPharmacyMedData({
              ndc: medData.ndc,
              dosageInstructions: medData.dosage_instructions,
              notes: medData.notes,
            });
          }
        });
    }

    const pdfData = sessionStorage.getItem("prescriptionPdfData");
    const pdfName = sessionStorage.getItem("prescriptionPdfName");
    if (pdfData && pdfName) {
      setPdfInfo({ name: pdfName, dataUrl: pdfData });
    }
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      if (!window.location.pathname.startsWith("/prescriptions/new/")) {
        clearPrescriptionSession();
      }
    };
  }, []);

  if (!patientId) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              No patient selected
            </h2>
            <Button onClick={() => router.push("/prescriptions/new/step1")}>
              Go Back to Step 1
            </Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  if (patientLoadError) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Failed to load patient information
            </h2>
            <p className="text-muted-foreground mb-4">
              Please go back and try again.
            </p>
            <Button onClick={() => router.push(`/prescriptions/new/step2?patientId=${patientId}`)}>
              Go Back to Step 2
            </Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  if (loadingPatient || !selectedPatient) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">
              Loading patient information...
            </p>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  if (!isMultiOrder && !prescriptionData) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              No prescription data found
            </h2>
            <Button
              onClick={() =>
                router.push("/prescriptions/new/step2?patientId=" + patientId)
              }
            >
              Go Back to Step 2
            </Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  const handleBack = () => {
    router.push(`/prescriptions/new/step2?patientId=${patientId}`);
  };

  const buildSubmissionPayload = async (
    item: CartItem | PrescriptionFormData,
    isFirstItem: boolean,
    fees: SharedFees,
    providerData: {
      firstName: string;
      lastName: string;
      npi: string;
      phone?: string;
      signatureUrl?: string;
      address?: AddressData | null;
    },
    submissionGroupId?: string,
  ) => {
    const totalOversightFeesCents = isFirstItem && Array.isArray(fees.oversightFees)
      ? fees.oversightFees.reduce((sum, f) => sum + (parseFloat(f.fee) || 0) * 100, 0)
      : 0;

    const consultationReason = isFirstItem && Array.isArray(fees.oversightFees)
      ? (fees.oversightFees.find((f) => f.reason)?.reason || null)
      : null;

    const shippingFeeCents = isFirstItem
      ? Math.round(parseFloat(fees.shippingFee || "0") * 100)
      : 0;

    const encounterId = sessionStorage.getItem("encounterId");
    const appointmentId = sessionStorage.getItem("appointmentId");

    const strength = item.strength || `${(item as CartItem).dosageAmount || ""}${(item as CartItem).dosageUnit || ""}`;
    const medId = "selectedMedicationId" in item ? (item as CartItem).selectedMedicationId : undefined;
    const pharmacyId = "selectedPharmacyId" in item ? (item as CartItem).selectedPharmacyId : undefined;
    const refillFreq = "refillFrequencyDays" in item ? (item as CartItem).refillFrequencyDays : undefined;

    return {
      prescriber_id: user!.id,
      patient_id: patientId,
      encounter_id: encounterId || null,
      appointment_id: appointmentId || null,
      medication: item.medication,
      dosage: strength,
      dosage_amount: ("dosageAmount" in item ? item.dosageAmount : null) || null,
      dosage_unit: ("dosageUnit" in item ? item.dosageUnit : null) || null,
      vial_size: ("vialSize" in item ? item.vialSize : null) || null,
      form: item.form || null,
      quantity: parseInt(item.quantity),
      refills: parseInt(item.refills),
      sig: item.sig,
      dispense_as_written: item.dispenseAsWritten || false,
      pharmacy_notes: item.pharmacyNotes || null,
      patient_price: ("patientPrice" in item ? item.patientPrice : null) || null,
      pharmacy_id: pharmacyId || null,
      medication_id: medId || null,
      profit_cents: totalOversightFeesCents,
      consultation_reason: consultationReason,
      shipping_fee_cents: shippingFeeCents,
      refill_frequency_days: refillFreq ? parseInt(refillFreq) : null,
      submission_group_id: submissionGroupId || null,
      has_custom_address: useCustomAddress,
      custom_address: useCustomAddress ? customAddress : null,
      patient: {
        first_name: selectedPatient!.firstName,
        last_name: selectedPatient!.lastName,
        date_of_birth: selectedPatient!.dateOfBirth || "1990-01-01",
        phone: selectedPatient!.phone || "",
        email: selectedPatient!.email || "",
      },
      prescriber: {
        first_name: providerData.firstName,
        last_name: providerData.lastName,
        npi: "1234567890",
        dea: "AB1234563",
      },
    };
  };

  const generateAndUploadPdf = async (
    prescriptionId: string,
    item: CartItem | PrescriptionFormData,
    providerData: {
      firstName: string;
      lastName: string;
      npi: string;
      phone?: string;
      signatureUrl?: string;
      address?: AddressData | null;
    },
  ) => {
    try {
      const patientAddress = useCustomAddress
        ? customAddress
        : selectedPatient!.physicalAddress;

      const strength = item.strength || `${(item as CartItem).dosageAmount || ""}${(item as CartItem).dosageUnit || ""}`;
      const dateWritten = new Date().toISOString().split("T")[0];

      const { blob, filename } = await generatePrescriptionPdf({
        patient: {
          firstName: selectedPatient!.firstName,
          lastName: selectedPatient!.lastName,
          dob: selectedPatient!.dateOfBirth || "",
          sex: selectedPatient!.gender === "male" ? "M" : "F",
          street: patientAddress?.street,
          city: patientAddress?.city,
          state: patientAddress?.state,
          zip: patientAddress?.zipCode,
          phone: selectedPatient!.phone,
        },
        doctor: {
          firstName: providerData.firstName,
          lastName: providerData.lastName,
          npi: providerData.npi,
          street: providerData.address?.street,
          city: providerData.address?.city,
          state: providerData.address?.state,
          zip: providerData.address?.zipCode,
          phone: providerData.phone,
        },
        rx: {
          drugName: item.medication,
          qty: item.quantity,
          dateWritten,
          refills: item.refills,
          instructions: item.sig,
          notes: item.pharmacyNotes,
          daw: item.dispenseAsWritten ? "Y" : "N",
        },
        signatureUrl: providerData.signatureUrl,
      });

      const formData = new FormData();
      formData.append("file", blob, filename);

      await fetch(`/api/prescriptions/${prescriptionId}/pdf`, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      console.error("PDF generation/upload failed for", prescriptionId, err);
    }
  };

  const handleSubmit = async () => {
    if (isDemoAccount) {
      demoGuard(() => {});
      return;
    }
    setSubmitting(true);

    try {
      if (!user || !patientId || !selectedPatient) {
        throw new Error("Missing user or patient information");
      }

      if (!selectedPatient.firstName || !selectedPatient.lastName) {
        throw new Error("Patient information is incomplete. Please try again.");
      }

      const { data: fetchedProvider } = await supabase
        .from("providers")
        .select("first_name, last_name, npi_number, phone_number, signature_url, physical_address")
        .eq("user_id", user.id)
        .single();

      const providerData = {
        firstName: fetchedProvider?.first_name || "Provider",
        lastName: fetchedProvider?.last_name || "User",
        npi: fetchedProvider?.npi_number || "1234567890",
        phone: fetchedProvider?.phone_number,
        signatureUrl: fetchedProvider?.signature_url,
        address: fetchedProvider?.physical_address as AddressData | null,
      };

      if (isMultiOrder && cartItems.length > 0) {
        const existingIds = sessionStorage.getItem("submittedPrescriptionIds");
        const prescriptionIds: string[] = existingIds ? JSON.parse(existingIds) : [];
        const startIndex = prescriptionIds.length;
        const total = cartItems.length;
        setSubmitProgress({ current: startIndex, total });

        const submissionGroupId = crypto.randomUUID();

        for (let i = startIndex; i < cartItems.length; i++) {
          const item = cartItems[i];
          const isFirst = i === 0;

          setSubmitProgress({ current: i + 1, total });

          const payload = await buildSubmissionPayload(item, isFirst, sharedFees, providerData, submissionGroupId);

          const response = await fetch("/api/prescriptions/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await response.json().catch(() => ({}));

          if (!response.ok || !result.success) {
            sessionStorage.setItem("submittedPrescriptionIds", JSON.stringify(prescriptionIds));
            throw new Error(result.error || `Failed to submit prescription ${i + 1} (${item.medication})`);
          }

          prescriptionIds.push(result.prescription_id);
          sessionStorage.setItem("submittedPrescriptionIds", JSON.stringify(prescriptionIds));

          await generateAndUploadPdf(result.prescription_id, item, providerData);
        }

        toast.success(`${prescriptionIds.length} prescriptions created! Now collect payment.`, {
          duration: 4000,
          icon: <CheckCircle2 className="h-5 w-5" />,
        });

        sessionStorage.removeItem("submittedPrescriptionIds");
        clearPrescriptionSession();
        setSubmitting(false);

        router.push(`/prescriptions/new/step4?prescriptionIds=${prescriptionIds.join(",")}`);
      } else if (prescriptionData) {
        const fees: SharedFees = {
          shippingFee: prescriptionData.shippingFee || "0",
          oversightFees: prescriptionData.oversightFees || [],
        };

        const payload = await buildSubmissionPayload(prescriptionData, true, fees, providerData);

        const response = await fetch("/api/prescriptions/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to submit prescription");
        }

        const prescriptionId = result.prescription_id;

        let pdfToUpload = pdfInfo;
        if (!pdfToUpload && prescriptionId) {
          try {
            const patientAddress = useCustomAddress
              ? customAddress
              : selectedPatient.physicalAddress;

            const dateWritten = new Date().toISOString().split("T")[0];

            const { blob, filename } = await generatePrescriptionPdf({
              patient: {
                firstName: selectedPatient.firstName,
                lastName: selectedPatient.lastName,
                dob: selectedPatient.dateOfBirth || "",
                sex: selectedPatient.gender === "male" ? "M" : "F",
                street: patientAddress?.street,
                city: patientAddress?.city,
                state: patientAddress?.state,
                zip: patientAddress?.zipCode,
                phone: selectedPatient.phone,
              },
              doctor: {
                firstName: providerData.firstName,
                lastName: providerData.lastName,
                npi: providerData.npi,
                street: providerData.address?.street,
                city: providerData.address?.city,
                state: providerData.address?.state,
                zip: providerData.address?.zipCode,
                phone: providerData.phone,
              },
              rx: {
                drugName: prescriptionData.medication,
                qty: prescriptionData.quantity,
                dateWritten,
                refills: prescriptionData.refills,
                ndc: pharmacyMedData?.ndc,
                instructions: prescriptionData.sig || pharmacyMedData?.dosageInstructions,
                notes: prescriptionData.pharmacyNotes || pharmacyMedData?.notes,
                daw: prescriptionData.dispenseAsWritten ? "Y" : "N",
              },
              signatureUrl: providerData.signatureUrl,
            });

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            pdfToUpload = { name: filename, dataUrl };
          } catch (genError) {
            console.error("Error generating PDF:", genError);
            toast.warning("Prescription created but PDF generation failed");
          }
        }

        if (pdfToUpload && prescriptionId) {
          try {
            const dataUrlParts = pdfToUpload.dataUrl.split(",");
            if (dataUrlParts.length !== 2) {
              throw new Error("Invalid data URL format");
            }

            const mimeMatch = dataUrlParts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";
            const base64Data = dataUrlParts[1];

            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: mimeType });

            const formDataObj = new FormData();
            formDataObj.append("file", blob, pdfToUpload.name);

            const uploadResponse = await fetch(
              `/api/prescriptions/${prescriptionId}/pdf`,
              {
                method: "POST",
                body: formDataObj,
              },
            );

            const pdfResult = await uploadResponse.json();

            if (!pdfResult.success) {
              console.error("PDF upload failed:", pdfResult.error);
              toast.warning("Prescription created but PDF upload failed", {
                description: pdfResult.error,
                duration: 5000,
              });
            }
          } catch (pdfError) {
            console.error("Error uploading PDF:", pdfError);
            toast.warning("Prescription created but PDF upload failed");
          }
        }

        toast.success("Prescription created! Now collect payment.", {
          duration: 4000,
          icon: <CheckCircle2 className="h-5 w-5" />,
        });

        clearPrescriptionSession();
        setSubmitting(false);

        router.push(`/prescriptions/new/step4?prescriptionId=${prescriptionId}`);
      }
    } catch (error) {
      setSubmitting(false);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit prescription";

      toast.error("Submission failed", {
        description: errorMessage,
        duration: 6000,
      });
      console.error("Submission error:", error);
    }
  };

  const reasonLabels: Record<string, string> = {
    dose_titration: "Dose Titration & Adjustment",
    side_effect_monitoring: "Side Effect & Safety Monitoring",
    therapeutic_response: "Therapeutic Response Review",
    adherence_tracking: "Medication Adherence Tracking",
    contraindication_screening: "Contraindication Screening",
  };

  const displayFees = isMultiOrder ? sharedFees : {
    shippingFee: prescriptionData?.shippingFee || "0",
    oversightFees: prescriptionData?.oversightFees || [],
  };

  const itemsToDisplay = isMultiOrder ? cartItems : (prescriptionData ? [prescriptionData] : []);

  const totalMedicationCost = itemsToDisplay.reduce(
    (sum, item) => {
      const unitPrice = parseFloat(("patientPrice" in item ? item.patientPrice : "0") || "0");
      const qty = parseInt(item.quantity) || 1;
      return sum + (unitPrice * qty);
    },
    0,
  );
  const totalOversightFees = Array.isArray(displayFees.oversightFees)
    ? displayFees.oversightFees.reduce((sum, f) => sum + (parseFloat(f.fee || "0")), 0)
    : 0;
  const totalShipping = parseFloat(displayFees.shippingFee || "0");
  const grandTotal = totalMedicationCost + totalOversightFees + totalShipping;

  return (
    <DefaultLayout>
      {submitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold text-foreground">
              {isMultiOrder
                ? `Submitting prescription ${submitProgress.current} of ${submitProgress.total}...`
                : "Creating prescription..."}
            </p>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your request
            </p>
          </div>
        </div>
      )}

      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  New Prescription
                </h1>
                {isMultiOrder && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {cartItems.length} items
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-2">
                Step 3 of 3: Review & Submit
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Select Patient
              </span>
            </div>
            <div className="w-12 h-0.5 bg-green-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="ml-2 text-sm text-muted-foreground">
                Prescription Details
              </span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                3
              </div>
              <span className="ml-2 font-medium">Review & Submit</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">
              {isMultiOrder ? `Review ${cartItems.length} Prescriptions` : "Review Prescription"}
            </h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Patient Information
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {`${safeString(selectedPatient.firstName)} ${safeString(selectedPatient.lastName)}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {selectedPatient.dateOfBirth
                      ? new Date(selectedPatient.dateOfBirth).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">
                    {safeString(selectedPatient.email) || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">
                    {safeString(selectedPatient.phone) || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  {(() => {
                    const addr = useCustomAddress
                      ? customAddress
                      : selectedPatient.physicalAddress;
                    if (addr && (addr.street || addr.city)) {
                      return (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                          <p className="font-medium">
                            {[addr.street, addr.city, addr.state, addr.zipCode]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p className="font-medium text-amber-600">
                        No address on file
                      </p>
                    );
                  })()}
                  {useCustomAddress && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                      Custom address for this prescription
                    </span>
                  )}
                </div>
              </div>

              {!showAddressForm ? (
                <div className="pt-2 border-t border-gray-200 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!useCustomAddress && selectedPatient.physicalAddress) {
                        setCustomAddress({
                          street: selectedPatient.physicalAddress.street || "",
                          city: selectedPatient.physicalAddress.city || "",
                          state: selectedPatient.physicalAddress.state || "",
                          zipCode: selectedPatient.physicalAddress.zipCode || "",
                          country: selectedPatient.physicalAddress.country || "US",
                        });
                      }
                      setShowAddressForm(true);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {useCustomAddress
                      ? "Edit Override Address"
                      : "Override Address for This Prescription"}
                  </Button>
                  {useCustomAddress && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setUseCustomAddress(false);
                        setCustomAddress({ street: "", city: "", state: "", zipCode: "", country: "US" });
                      }}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove Override
                    </Button>
                  )}
                </div>
              ) : (
                <div className="pt-3 border-t border-gray-200 mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Override Shipping Address
                    </h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddressForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-street">Street Address</Label>
                    <Input id="override-street" placeholder="123 Main St" value={customAddress.street || ""} onChange={(e) => setCustomAddress((prev) => ({ ...prev, street: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="override-city">City</Label>
                      <Input id="override-city" placeholder="City" value={customAddress.city || ""} onChange={(e) => setCustomAddress((prev) => ({ ...prev, city: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-state">State</Label>
                      <Input id="override-state" placeholder="FL" value={customAddress.state || ""} onChange={(e) => setCustomAddress((prev) => ({ ...prev, state: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="override-zip">Zip Code</Label>
                      <Input id="override-zip" placeholder="33101" value={customAddress.zipCode || ""} onChange={(e) => setCustomAddress((prev) => ({ ...prev, zipCode: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-country">Country</Label>
                      <Input id="override-country" placeholder="US" value={customAddress.country || ""} onChange={(e) => setCustomAddress((prev) => ({ ...prev, country: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" onClick={() => { setUseCustomAddress(true); setShowAddressForm(false); }} disabled={!customAddress.street?.trim() || !customAddress.city?.trim()}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Save Override
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddressForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isMultiOrder && pdfInfo && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Prescription Document
              </h3>
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <File className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{safeString(pdfInfo.name)}</p>
                  <p className="text-sm text-gray-500">PDF document attached</p>
                </div>
              </div>
            </div>
          )}

          {isMultiOrder ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Medications ({cartItems.length})
              </h3>
              {cartItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <p className="font-semibold text-lg text-gray-900">{item.medication}</p>
                    </div>
                    {item.selectedPharmacyName && (
                      <span
                        className="text-xs px-2 py-1 rounded-full text-white font-medium"
                        style={{ backgroundColor: item.selectedPharmacyColor || "#1E3A8A" }}
                      >
                        {item.selectedPharmacyName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Strength</p>
                      <p className="font-medium">{item.strength}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Form</p>
                      <p className="font-medium">{item.form || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Qty</p>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-medium">${((parseFloat(item.patientPrice) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">SIG</p>
                    <p className="font-medium">{item.sig}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : prescriptionData && (
            <>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Medication Information
                </h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Medication</p>
                      <p className="font-semibold text-lg">{safeString(prescriptionData.medication)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Strength/Dosage</p>
                      <p className="font-medium">{safeString(prescriptionData.strength)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Form</p>
                      <p className="font-medium">{safeString(prescriptionData.form) || "N/A"}</p>
                    </div>
                    {prescriptionData.vialSize && (
                      <div>
                        <p className="text-sm text-muted-foreground">Vial Size</p>
                        <p className="font-medium">{safeString(prescriptionData.vialSize)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="font-medium">{safeString(prescriptionData.quantity)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Refills</p>
                      <p className="font-medium">{safeString(prescriptionData.refills)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dispense as Written</p>
                      <p className="font-medium">{prescriptionData.dispenseAsWritten ? "Yes" : "No"}</p>
                    </div>
                    {prescriptionData.selectedPharmacyName && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Pharmacy</p>
                        <p className="font-semibold text-lg" style={{ color: prescriptionData.selectedPharmacyColor || "#1E3A8A" }}>
                          {safeString(prescriptionData.selectedPharmacyName)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Directions for Patient (SIG)</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900">{safeString(prescriptionData.sig)}</p>
                </div>
              </div>

              {prescriptionData.pharmacyNotes && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Notes to Pharmacy</h3>
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <p className="text-gray-900 whitespace-pre-wrap">{safeString(prescriptionData.pharmacyNotes)}</p>
                  </div>
                </div>
              )}

              {prescriptionData.patientPrice && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Price of Medication</h3>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-2xl font-bold text-gray-900">
                      ${((parseFloat(prescriptionData.patientPrice || "0") || 0) * (parseInt(prescriptionData.quantity) || 1)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="border-t border-dashed border-gray-300" />

          {totalShipping > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Delivery</h3>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {(sharedFees as any).selectedShippingOption === "refrigerated_overnight" ? "Refrigerated Overnight" : "Standard Overnight"}
                    </p>
                    <p className="text-xs text-muted-foreground">Overnight delivery</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">${totalShipping.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {false && Array.isArray(displayFees.oversightFees) && displayFees.oversightFees.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Clinical Services & Fulfillment.</h3>
              <div className="space-y-3">
                {displayFees.oversightFees.map((item, index) => (
                  <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground">Medication Adherence & Doctor Oversight</p>
                        <p className="font-medium text-gray-900">{reasonLabels[item.reason] || safeString(item.reason)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Fee Amount</p>
                        <p className="text-xl font-bold text-gray-900">${parseFloat(item.fee).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {grandTotal > 0 && (
            <div className="space-y-3">
              <div className="border-t border-dashed border-gray-300" />

              {totalShipping > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-900">Total Delivery Fees</p>
                    <p className="text-xl font-bold text-green-700">${totalShipping.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div className="bg-green-100 rounded-lg p-5 border border-green-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-semibold text-gray-900">Final Patient Cost</h3>
                  <p className="text-2xl font-bold text-green-800">${grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t">
            <Button variant="outline" onClick={handleBack} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Edit
            </Button>
            <Button
              onClick={handleSubmit}
              size="lg"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {isMultiOrder ? `Prescribe ${cartItems.length} Medications` : "Prescribe"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
