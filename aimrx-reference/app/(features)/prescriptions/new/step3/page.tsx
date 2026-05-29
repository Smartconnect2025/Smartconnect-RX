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
  Truck,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { useDemoGuard } from "@/hooks/use-demo-guard";
import {
  type TierDiscountResult,
} from "@core/services/pricing/tierDiscountService";
import {
  clearPrescriptionSession,
  getCart,
  getCartShippingFee,
  getCartOversightFees,
  type CartItem,
} from "../prescriptionSessionUtils";
import { generatePrescriptionPdf } from "@/utils/generatePrescriptionPdf";
import {
  isGreenwichPharmacy,
  GREENWICH_CLINIC_NAME,
  formatBillToNote,
  quantityInMl,
  daysSupplyFromVialCount,
  classifyDosageForm,
  quantityForOral,
  daysSupplyForOral,
} from "@core/utils/digitalrx-format";

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

const REASON_LABELS: Record<string, string> = {
  dose_titration: "Dose Titration & Adjustment",
  side_effect_monitoring: "Side Effect & Safety Monitoring",
  therapeutic_response: "Therapeutic Response Review",
  adherence_tracking: "Medication Adherence Tracking",
  contraindication_screening: "Contraindication Screening",
};

export default function PrescriptionStep3Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [shippingFee, setShippingFee] = useState("0");
  const [oversightFees, setOversightFees] = useState<Array<{ fee: string; reason: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientLoadError, setPatientLoadError] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{ name: string; dataUrl: string } | null>(null);
  const [tierDiscount, setTierDiscount] = useState<TierDiscountResult | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"shipping" | "pickup">("shipping");
  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressPromptShown, setAddressPromptShown] = useState(false);
  const [customAddress, setCustomAddress] = useState<AddressData>({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });
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
        // Default to the ORIGINAL direct-supabase query (preserves the
        // exact pre-existing behaviour for real providers — RLS allows
        // them to read their own patients). Only delegate-role users
        // (Provider Assistants) take the new server endpoint, because
        // RLS blocks the direct query for them.
        let role: string | null = null;
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.id) {
            const { data: roleRow } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", authUser.id)
              .maybeSingle();
            role = (roleRow as { role?: string } | null)?.role ?? null;
          }
        } catch { /* fall back to direct query */ }

        let patient: Record<string, unknown> | null = null;
        let fetchFailed = false;
        if (role === "delegate") {
          const res = await fetch(
            `/api/basic-emr/patients?id=${encodeURIComponent(patientId)}`,
            { credentials: "include", cache: "no-store" },
          );
          if (!res.ok) {
            console.error("Error fetching patient (delegate):", res.status);
            fetchFailed = true;
          } else {
            const json = await res.json();
            patient = json.patient as Record<string, unknown>;
          }
        } else {
          const { data, error } = await supabase
            .from("patients")
            .select(
              "id, first_name, last_name, date_of_birth, email, phone, data, physical_address",
            )
            .eq("id", patientId)
            .single();
          if (error || !data) {
            console.error("Error fetching patient:", error);
            fetchFailed = true;
          } else {
            patient = data as unknown as Record<string, unknown>;
          }
        }

        if (fetchFailed || !patient) {
          toast.error("Failed to load patient information");
          setPatientLoadError(true);
        } else {
          const addr = (patient.physical_address as AddressData | null) ?? null;
          const dataBlob = (patient.data as { gender?: string } | null) ?? null;
          setSelectedPatient({
            id: patient.id as string,
            firstName: patient.first_name as string,
            lastName: patient.last_name as string,
            dateOfBirth: patient.date_of_birth as string,
            email: patient.email as string,
            phone: patient.phone as string,
            gender: ((patient as { gender?: string }).gender ?? dataBlob?.gender) as string | undefined,
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
    if (selectedPatient && !loadingPatient && !addressPromptShown && deliveryMethod === "shipping") {
      const hasAddress = selectedPatient.physicalAddress && (selectedPatient.physicalAddress.street || selectedPatient.physicalAddress.city);
      if (!hasAddress) {
        setShowAddressForm(true);
        setAddressPromptShown(true);
      }
    }
  }, [selectedPatient, loadingPatient, addressPromptShown, deliveryMethod]);

  useEffect(() => {
    const fetchTierDiscount = async () => {
      if (!user?.id) return;
      // Use the server endpoint instead of calling the tier service
      // directly with `user.id`. The endpoint resolves the acting
      // provider server-side, so an assistant (delegate) sees the
      // SUPERVISING provider's discount — which is the same discount
      // actually applied at checkout.
      try {
        const res = await fetch("/api/provider/effective-tier-discount", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const result = (await res.json()) as TierDiscountResult;
        if (result.discountPercentage > 0) {
          setTierDiscount(result);
        }
      } catch {
        /* non-fatal — falls back to no displayed discount */
      }
    };
    fetchTierDiscount();
  }, [user?.id]);

  useEffect(() => {
    const items = getCart();
    if (items.length === 0) {
      router.push(`/prescriptions/new/step2?patientId=${patientId}`);
      return;
    }
    setCartItems(items);
    setShippingFee(getCartShippingFee());
    setOversightFees(getCartOversightFees());

    const pdfData = sessionStorage.getItem("prescriptionPdfData");
    const pdfName = sessionStorage.getItem("prescriptionPdfName");
    if (pdfData && pdfName) {
      setPdfInfo({ name: pdfName, dataUrl: pdfData });
    }
  }, [router, patientId]);

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
            <h2 className="text-xl font-semibold text-gray-800 mb-4">No patient selected</h2>
            <Button onClick={() => router.push("/prescriptions/new/step1")}>Go Back to Step 1</Button>
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
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Failed to load patient information</h2>
            <p className="text-muted-foreground mb-4">Please go back and try again.</p>
            <Button onClick={() => router.push(`/prescriptions/new/step2?patientId=${patientId}`)}>Go Back to Step 2</Button>
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
            <p className="text-muted-foreground">Loading patient information...</p>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  if (cartItems.length === 0) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-5xl py-8 px-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">No medications in cart</h2>
            <Button onClick={() => router.push(`/prescriptions/new/step2?patientId=${patientId}`)}>Go Back to Step 2</Button>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  const handleBack = () => {
    router.push(`/prescriptions/new/step2?patientId=${patientId}`);
  };

  const medicationsSubtotal = cartItems.reduce((sum, item) => sum + parseFloat(item.patientPrice || "0") * (parseInt(item.quantity) || 1), 0);
  const oversightTotal = oversightFees.reduce((sum, f) => sum + parseFloat(f.fee || "0"), 0);
  const shippingTotal = parseFloat(shippingFee || "0");
  const grandTotal = medicationsSubtotal + oversightTotal + shippingTotal;

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

      if (deliveryMethod === "shipping") {
        const effectiveAddress = useCustomAddress ? customAddress : selectedPatient.physicalAddress;
        if (!effectiveAddress || (!effectiveAddress.street && !effectiveAddress.city)) {
          toast.error("Please enter a shipping address for this patient before submitting.");
          setShowAddressForm(true);
          setSubmitting(false);
          return;
        }
      }

      const encounterId = sessionStorage.getItem("encounterId");
      const appointmentId = sessionStorage.getItem("appointmentId");

      // Provider Assistance + direct providers — single server-side
      // resolver call. The endpoint uses the same authorizing-provider
      // resolver that submit-to-pharmacy-core and regenerate-stale-pdf
      // use, so the initial PDF is built from the EXACT same data the
      // pharmacy will receive. No placeholder NPI fallback, no client
      // races. Manning incident, Task #65 — May 9 2026.
      //
      // HARD RULE: if this lookup fails, ABORT submission. Falling back
      // to the assistant's empty row or a placeholder NPI is what
      // caused Manning's PDF to ship as a 7KB stub, which then forced
      // a 13-15 minute janitor heal cycle on every assistant order.
      const presRes = await fetch("/api/prescriptions/new-rx-prescriber", {
        cache: "no-store",
      });
      const presJson = await presRes.json().catch(() => ({}));
      if (!presRes.ok || !presJson?.success || !presJson?.prescriber) {
        const msg =
          (presJson && typeof presJson.error === "string" && presJson.error) ||
          "Could not load your prescriber profile. Please refresh and try again.";
        toast.error("Cannot submit prescription", { description: msg });
        setSubmitting(false);
        setSubmissionProgress("");
        return;
      }
      const ap = presJson.prescriber as {
        provider_user_id: string;
        prefix: string | null;
        first_name: string | null;
        last_name: string | null;
        npi_number: string | null;
        dea_number: string | null;
        company_name: string | null;
        phone_number: string | null;
        signature_url: string | null;
        physical_address: AddressData | null;
        via_delegation: boolean;
        delegation_id: string | null;
      };
      const providerPrefix = ap.prefix || "Dr.";
      const providerFirstName = ap.first_name || "";
      const providerLastName = ap.last_name || "";
      const providerNpi = ap.npi_number || "";
      const providerDea: string | undefined = ap.dea_number ?? undefined;
      const providerCompanyName: string | undefined =
        ap.company_name ?? undefined;
      const providerPhone: string | undefined = ap.phone_number ?? undefined;
      const providerSignatureUrl: string | undefined =
        ap.signature_url ?? undefined;
      const providerAddress: AddressData | null = ap.physical_address ?? null;

      const totalOversightFeesCents = oversightFees.reduce(
        (sum, item) => sum + (parseFloat(item.fee) || 0) * 100,
        0,
      );
      const consultationReason = oversightFees.find((item) => item.reason)?.reason || null;

      const prescriptionIds: string[] = [];
      const submissionGroupId = crypto.randomUUID();

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        setSubmissionProgress(`Submitting medication ${i + 1} of ${cartItems.length}: ${item.medication}`);

        const isFirstItem = i === 0;

        const submissionPayload = {
          prescriber_id: user.id,
          patient_id: patientId,
          encounter_id: encounterId || null,
          appointment_id: appointmentId || null,
          medication: item.medication,
          dosage: item.strength,
          dosage_amount: item.dosageAmount || null,
          dosage_unit: item.dosageUnit || null,
          vial_size: item.vialSize || null,
          form: item.form || null,
          quantity: parseInt(item.quantity) || 1,
          refills: parseInt(item.refills),
          sig: item.sig,
          dispense_as_written: item.dispenseAsWritten || false,
          pharmacy_notes: item.pharmacyNotes || null,
          patient_price: item.patientPrice ? (parseFloat(item.patientPrice) * (parseInt(item.quantity) || 1)).toFixed(2) : null,
          pharmacy_id: item.selectedPharmacyId || null,
          medication_id: item.selectedMedicationId || null,
          profit_cents: isFirstItem ? totalOversightFeesCents : 0,
          consultation_reason: isFirstItem ? consultationReason : null,
          shipping_fee_cents: isFirstItem ? Math.round(shippingTotal * 100) : 0,
          submission_group_id: submissionGroupId,
          refill_frequency_days: item.refillFrequencyDays ? parseInt(item.refillFrequencyDays) : null,
          delivery_method: deliveryMethod,
          has_custom_address: deliveryMethod === "shipping" ? useCustomAddress : false,
          custom_address: deliveryMethod === "shipping" && useCustomAddress ? customAddress : null,
          patient: {
            first_name: selectedPatient.firstName,
            last_name: selectedPatient.lastName,
            date_of_birth: selectedPatient.dateOfBirth || "1990-01-01",
            phone: selectedPatient.phone || "",
            email: selectedPatient.email || "",
          },
          prescriber: {
            prefix: providerPrefix,
            first_name: providerFirstName,
            last_name: providerLastName,
            npi: providerNpi,
            dea: providerDea,
          },
        };

        const response = await fetch("/api/prescriptions/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submissionPayload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Failed to submit ${item.medication}`);
        }

        const prescriptionId = result.prescription_id;
        prescriptionIds.push(prescriptionId);

        // Greenwich requires the structured Electronic Rx PDF (NPI/SPI/DEA
        // header, framed Rx box, "AIM" drug-name prefix). User-uploaded files
        // (scans, phone photos, foreign Rx templates) get rejected or sit in
        // their queue tagged "NO RX IMAGE / WRONG FORMAT". Provider-uploaded
        // PDFs from Step 1 are honored for OTHER pharmacies but ALWAYS
        // overridden for Greenwich — we regenerate fresh below.
        // (Hard rule established May 7 2026 after the Trevor Haynes incident:
        // his Sunny Haynes 5/7 + Amanda Chase 5/5 submissions reached
        // Greenwich with 74-124KB JPEG-in-PDF wrappers because his Step 1
        // upload was preferred over the generator output.)
        const isGreenwichItem = isGreenwichPharmacy(item.selectedPharmacyId);
        let pdfToUpload = isGreenwichItem ? null : pdfInfo;
        if (!pdfToUpload && prescriptionId) {
          try {
            const patientAddress = useCustomAddress ? customAddress : selectedPatient.physicalAddress;
            const dateWritten = new Date().toISOString().split("T")[0];

            // ── Greenwich-aware PDF formatting ────────────────────────
            // When this submission targets the Greenwich pharmacy, fetch the
            // catalog row so we can render the SAME drug-name string, mL Qty,
            // computed Days Supply, NDC, and "Bill to ..." Notes line that
            // app/api/prescriptions/[id]/submit-to-pharmacy/route.ts ships in
            // the API payload. Errors fall through to the legacy values so the
            // PDF always renders.
            const isGreenwich = isGreenwichPharmacy(item.selectedPharmacyId);
            let catalogDrugName: string | undefined = undefined;
            let catalogNdc: string | undefined = undefined;
            let greenwichQty: string | undefined = undefined;
            let greenwichDaysSupply: string | undefined = undefined;
            let greenwichNotes: string | undefined = undefined;
            if (isGreenwich && item.selectedMedicationId) {
              try {
                const { data: med } = await supabase
                  .from("pharmacy_medications")
                  .select("name, ndc, vial_size, form")
                  .eq("id", item.selectedMedicationId)
                  .maybeSingle();
                if (med) {
                  catalogDrugName = med.name ?? undefined;
                  catalogNdc = med.ndc ?? undefined;
                  const vialCount = parseInt(item.quantity, 10);
                  if (med.vial_size && Number.isFinite(vialCount) && vialCount > 0) {
                    // Branch by dosage form: injection → mL; capsule/tablet → unit count.
                    let formBucket: "injection" | "capsule" | "tablet" = "injection";
                    try {
                      formBucket = classifyDosageForm(med.form);
                    } catch (formErr) {
                      console.warn("[step3] Greenwich classifyDosageForm failed; defaulting to injection", formErr);
                    }
                    try {
                      greenwichQty = formBucket === "injection"
                        ? quantityInMl(vialCount, med.vial_size).toString()
                        : quantityForOral(vialCount, med.vial_size).toString();
                    } catch (qtyErr) {
                      console.warn("[step3] Greenwich qty computation failed; falling back to raw quantity", qtyErr);
                    }
                    try {
                      greenwichDaysSupply = formBucket === "injection"
                        ? String(daysSupplyFromVialCount(vialCount))
                        : String(daysSupplyForOral(vialCount));
                    } catch (dsErr) {
                      console.warn("[step3] Greenwich daysSupply computation failed", dsErr);
                    }
                  }
                  const billToLine = formatBillToNote(GREENWICH_CLINIC_NAME);
                  const existingNotes = (item.pharmacyNotes || "").trim();
                  greenwichNotes = existingNotes
                    ? `${existingNotes}\n${billToLine}`
                    : billToLine;
                }
              } catch (catalogErr) {
                console.warn("[step3] Greenwich catalog fetch failed; PDF will use legacy values", catalogErr);
              }
            }

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
                prefix: providerPrefix,
                firstName: providerFirstName,
                lastName: providerLastName,
                npi: providerNpi,
                dea: providerDea,
                companyName: providerCompanyName,
                street: providerAddress?.street,
                city: providerAddress?.city,
                state: providerAddress?.state,
                zip: providerAddress?.zipCode,
                phone: providerPhone,
              },
              rx: {
                drugName: item.medication,
                useGreenwichFormat: isGreenwich && !!catalogDrugName,
                catalogDrugName,
                ndc: catalogNdc,
                qty: greenwichQty || item.quantity,
                daysSupply: greenwichDaysSupply,
                dateWritten,
                refills: item.refills,
                instructions: item.sig,
                notes: greenwichNotes || item.pharmacyNotes,
                daw: item.dispenseAsWritten ? "Y" : "N",
                pon: prescriptionId
                  ? String(prescriptionId).slice(-8).toUpperCase()
                  : undefined,
              },
              signatureUrl: providerSignatureUrl,
            });

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            pdfToUpload = { name: filename, dataUrl };
          } catch (genError) {
            console.error("PDF generation error:", genError);
          }
        }

        if (pdfToUpload && prescriptionId) {
          try {
            const dataUrlParts = pdfToUpload.dataUrl.split(",");
            if (dataUrlParts.length === 2) {
              const mimeMatch = dataUrlParts[0].match(/:(.*?);/);
              const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";
              const base64Data = dataUrlParts[1];
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              const blob = new Blob([bytes], { type: mimeType });
              const formData = new FormData();
              formData.append("file", blob, pdfToUpload.name);

              await fetch(`/api/prescriptions/${prescriptionId}/pdf`, {
                method: "POST",
                body: formData,
              });
            }
          } catch (pdfError) {
            console.error("PDF upload error:", pdfError);
          }
        }
      }

      toast.success(
        cartItems.length === 1
          ? "Prescription created! Now collect payment."
          : `${cartItems.length} prescriptions created! Now collect payment.`,
        { duration: 4000, icon: <CheckCircle2 className="h-5 w-5" /> },
      );

      clearPrescriptionSession();
      setSubmitting(false);

      router.push(
        `/prescriptions/new/step4?prescriptionIds=${prescriptionIds.join(",")}`,
      );
    } catch (error) {
      setSubmitting(false);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit prescriptions";
      toast.error("Submission failed", { description: errorMessage, duration: 6000 });
      console.error("Submission error:", error);
    }
  };

  return (
    <DefaultLayout>
      {submitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold text-foreground">
              Creating your prescriptions...
            </p>
            <p className="text-sm text-muted-foreground">{submissionProgress}</p>
          </div>
        </div>
      )}

      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Prescription</h1>
              <p className="text-muted-foreground mt-2">Step 3 of 4: Review & Create</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/")} disabled={submitting}>
              Cancel
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">✓</div>
              <span className="ml-2 text-sm text-muted-foreground">Patient</span>
            </div>
            <div className="w-12 h-0.5 bg-green-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">✓</div>
              <span className="ml-2 text-sm text-muted-foreground">Medication</span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">3</div>
              <span className="ml-2 font-medium">Review</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">4</div>
              <span className="ml-2 text-sm text-muted-foreground">Collect Payment</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">Review Prescriptions</h2>
            <span className="ml-auto text-sm text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" />
              {cartItems.length} {cartItems.length === 1 ? "medication" : "medications"}
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{safeString(selectedPatient.firstName)} {safeString(selectedPatient.lastName)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{selectedPatient.dateOfBirth ? new Date(String(selectedPatient.dateOfBirth).slice(0, 10) + "T00:00:00").toLocaleDateString() : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{safeString(selectedPatient.email) || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{safeString(selectedPatient.phone) || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  {(() => {
                    const addr = useCustomAddress ? customAddress : selectedPatient.physicalAddress;
                    if (addr && (addr.street || addr.city)) {
                      return (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                          <p className="font-medium">
                            {[addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-1">
                        <p className="font-semibold text-amber-700">No shipping address on file</p>
                        <p className="text-xs text-amber-600 mt-1">Enter an address below — you can save it to the patient&apos;s record or use it for this order only.</p>
                      </div>
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
                  <Button type="button" variant="outline" size="sm" onClick={() => {
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
                  }}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {useCustomAddress ? "Edit Override Address" : "Override Address for This Prescription"}
                  </Button>
                  {useCustomAddress && (
                    <Button type="button" variant="ghost" size="sm" className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                      setUseCustomAddress(false);
                      setCustomAddress({ street: "", city: "", state: "", zipCode: "", country: "US" });
                    }}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove Override
                    </Button>
                  )}
                </div>
              ) : (
                <div className="pt-3 border-t border-gray-200 mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Override Shipping Address</h4>
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" data-testid="btn-save-address-to-patient" onClick={async () => {
                      try {
                        const { error: updateError } = await supabase
                          .from("patients")
                          .update({ physical_address: { street: customAddress.street, city: customAddress.city, state: customAddress.state, zipCode: customAddress.zipCode, country: customAddress.country || "US" } })
                          .eq("id", patientId);
                        if (updateError) throw updateError;
                        setSelectedPatient((prev) => prev ? { ...prev, physicalAddress: { ...customAddress } } : prev);
                        setUseCustomAddress(false);
                        setShowAddressForm(false);
                        toast.success("Address saved to patient record");
                      } catch (err) {
                        console.error("Failed to update patient address:", err);
                        toast.error("Failed to save address to patient record");
                      }
                    }} disabled={!customAddress.street?.trim() || !customAddress.city?.trim()}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Save to Patient Record
                    </Button>
                    <Button type="button" variant="secondary" size="sm" data-testid="btn-save-address-override" onClick={() => { setUseCustomAddress(true); setShowAddressForm(false); }} disabled={!customAddress.street?.trim() || !customAddress.city?.trim()}>
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                      Use for This Order Only
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddressForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {pdfInfo && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Prescription Document</h3>
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

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Medications ({cartItems.length})
            </h3>
            <div className="space-y-4">
              {cartItems.map((item, index) => (
                <div key={item.id} className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-100" data-testid={`review-item-${index}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-lg text-gray-900">{safeString(item.medication)}</p>
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded-full text-white mt-1"
                        style={{ backgroundColor: item.selectedPharmacyColor || "#1E3A8A" }}
                      >
                        {safeString(item.selectedPharmacyName)}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">${(parseFloat(item.patientPrice || "0") * (parseInt(item.quantity) || 1)).toFixed(2)}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Strength</p>
                      <p className="font-medium">{safeString(item.strength)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Form</p>
                      <p className="font-medium">{safeString(item.form) || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-medium">{safeString(item.quantity)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Refills</p>
                      <p className="font-medium">{safeString(item.refills)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Directions (SIG)</p>
                    <p className="text-sm text-gray-900">{safeString(item.sig)}</p>
                  </div>
                  {item.pharmacyNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes to Pharmacy</p>
                      <p className="text-sm text-gray-900">{safeString(item.pharmacyNotes)}</p>
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    DAW: {item.dispenseAsWritten ? "Yes" : "No"}
                    {item.vialSize ? ` · Vial: ${item.vialSize}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {shippingTotal > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Shipping and Handling</h3>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-900">Delivery Fee</p>
                  <p className="text-xl font-bold text-gray-900">${shippingTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {oversightFees.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Clinical Services & Fulfillment</h3>
              <div className="space-y-3">
                {oversightFees.map((item, index) => (
                  <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground">Medication Adherence & Doctor Oversight</p>
                        <p className="font-medium text-gray-900">{REASON_LABELS[item.reason] || safeString(item.reason)}</p>
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

          <div className="space-y-3">
            <div className="border-t border-dashed border-gray-300" />

            {(oversightTotal > 0 || shippingTotal > 0) && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-gray-900">Total Service & Delivery Fees</p>
                  <p className="text-xl font-bold text-green-700">${(oversightTotal + shippingTotal).toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-gray-600">
                    <span>{item.medication}{parseInt(item.quantity) > 1 ? ` × ${item.quantity}` : ""}</span>
                    <span>${(parseFloat(item.patientPrice || "0") * (parseInt(item.quantity) || 1)).toFixed(2)}</span>
                  </div>
                ))}
                {shippingTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping & handling</span>
                    <span>${shippingTotal.toFixed(2)}</span>
                  </div>
                )}
                {oversightTotal > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Oversight & monitoring</span>
                    <span>${oversightTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-green-100 rounded-lg p-5 border border-green-300">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">Final Patient Cost</h3>
                <p className="text-2xl font-bold text-green-800">${grandTotal.toFixed(2)}</p>
              </div>
              {tierDiscount && tierDiscount.discountPercentage > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {safeString(tierDiscount.discountPercentage)}% discount applied ({safeString(tierDiscount.tierName)})
                </p>
              )}
            </div>
          </div>

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
              data-testid="button-create-prescriptions"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Create {cartItems.length === 1 ? "Prescription" : `${cartItems.length} Prescriptions`} & Continue
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
