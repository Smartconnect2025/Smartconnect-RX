"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  CreditCard,
  Mail,
  Send,
  DollarSign,
  AlertTriangle,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { BillPatientModal } from "@/components/billing/BillPatientModal";

interface PrescriptionDetails {
  id: string;
  medication: string;
  dosage: string;
  quantity: number;
  refills: number;
  sig: string;
  patient_price: number;
  profit_cents: number;
  shipping_fee_cents: number;
  status: string;
  pharmacy_id: string;
  patient_id: string;
  patientName: string;
  patientEmail: string;
  pharmacyName: string;
}

export default function Step4PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prescriptionId = searchParams.get("prescriptionId");
  const { user } = useUser();
  const supabase = createClient();

  const [prescription, setPrescription] = useState<PrescriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBillModal, setShowBillModal] = useState(false);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"send-link" | "charge-now">("send-link");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const loadPrescription = useCallback(async () => {
    if (!prescriptionId) return;
    setLoading(true);
    try {
      const { data: rx, error } = await supabase
        .from("prescriptions")
        .select(`
          id, medication, dosage, quantity, refills, sig,
          patient_price, profit_cents, shipping_fee_cents,
          status, pharmacy_id, patient_id,
          patients!inner(first_name, last_name, email),
          pharmacies!inner(name)
        `)
        .eq("id", prescriptionId)
        .single();

      if (error || !rx) {
        toast.error("Could not load prescription details");
        router.push("/prescriptions");
        return;
      }

      const patients = rx.patients as unknown as { first_name: string; last_name: string; email: string };
      const pharmacies = rx.pharmacies as unknown as { name: string };

      setPrescription({
        id: rx.id,
        medication: rx.medication,
        dosage: rx.dosage,
        quantity: rx.quantity,
        refills: rx.refills,
        sig: rx.sig,
        patient_price: rx.patient_price || 0,
        profit_cents: rx.profit_cents || 0,
        shipping_fee_cents: rx.shipping_fee_cents || 0,
        status: rx.status,
        pharmacy_id: rx.pharmacy_id,
        patient_id: rx.patient_id,
        patientName: `${patients.first_name} ${patients.last_name}`,
        patientEmail: patients.email || "",
        pharmacyName: pharmacies.name,
      });

      if (rx.status === "payment_received" || rx.status === "submitted") {
        setPaymentComplete(true);
      }
    } catch {
      toast.error("Error loading prescription");
    } finally {
      setLoading(false);
    }
  }, [prescriptionId, supabase, router]);

  useEffect(() => {
    loadPrescription();
  }, [loadPrescription]);

  const handleMarkPaid = async () => {
    if (!prescriptionId) return;
    setMarkingPaid(true);
    try {
      const response = await fetch(`/api/prescriptions/${prescriptionId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to mark as paid");
      }
      setPaymentComplete(true);
      toast.success("Prescription marked as paid and submitted to pharmacy!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as paid");
    } finally {
      setMarkingPaid(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentComplete(true);
    toast.success("Payment received! Prescription submitted to pharmacy.");
  };

  const handleOpenBillModal = (method: "send-link" | "charge-now") => {
    setInitialPaymentMethod(method);
    setShowBillModal(true);
  };

  const medicationCostCents = Math.round((prescription?.patient_price || 0) * 100);
  const profitCents = prescription?.profit_cents || 0;
  const shippingCents = prescription?.shipping_fee_cents || 0;
  const totalCents = medicationCostCents + profitCents + shippingCents;

  if (!prescriptionId) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-3xl py-12 px-4 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">No prescription selected</h2>
          <Button onClick={() => router.push("/prescriptions")}>Go to Prescriptions</Button>
        </div>
      </DefaultLayout>
    );
  }

  if (loading) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-3xl py-12 px-4 flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </DefaultLayout>
    );
  }

  if (paymentComplete) {
    return (
      <DefaultLayout>
        <div className="container mx-auto max-w-3xl py-12 px-4">
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Complete</h2>
            <p className="text-gray-600 mb-6">
              The prescription has been submitted to the pharmacy for processing.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 max-w-md mx-auto">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient</span>
                  <span className="font-medium">{prescription?.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Medication</span>
                  <span className="font-medium">{prescription?.medication}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pharmacy</span>
                  <span className="font-medium">{prescription?.pharmacyName}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.push("/prescriptions")}
              >
                View All Prescriptions
              </Button>
              <Button
                onClick={() => router.push("/prescriptions/new/step1")}
              >
                New Prescription
              </Button>
            </div>
          </div>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Collect Payment</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Step 4 of 4
            </span>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Patient</span>
            </div>
            <div className="w-8 h-0.5 bg-green-500" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Medication</span>
            </div>
            <div className="w-8 h-0.5 bg-green-500" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Review</span>
            </div>
            <div className="w-8 h-0.5 bg-blue-500" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-xs font-bold text-white">4</span>
              </div>
              <span className="text-xs font-semibold text-blue-600">Payment</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Payment required before pharmacy submission</p>
            <p className="text-sm text-amber-700 mt-1">
              The prescription will be submitted to {prescription?.pharmacyName} once payment is collected.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Prescription Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Patient</span>
              <p className="font-medium text-gray-900">{prescription?.patientName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Pharmacy</span>
              <p className="font-medium text-gray-900">{prescription?.pharmacyName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Medication</span>
              <p className="font-medium text-gray-900">{prescription?.medication}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Quantity</span>
              <p className="font-medium text-gray-900">{prescription?.quantity}</p>
            </div>
          </div>

          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medication Cost</span>
              <span className="font-medium">${(medicationCostCents / 100).toFixed(2)}</span>
            </div>
            {profitCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Consultation Fee</span>
                <span className="font-medium">${(profitCents / 100).toFixed(2)}</span>
              </div>
            )}
            {shippingCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping Fee</span>
                <span className="font-medium">${(shippingCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-blue-600">
                ${(totalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Choose Payment Method</h3>

          <button
            onClick={() => handleOpenBillModal("send-link")}
            className="w-full bg-white border-2 border-blue-200 hover:border-blue-400 rounded-xl p-5 text-left transition-all hover:shadow-md group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">Send Payment Link</h4>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Email a secure payment link to the patient. They can pay at their convenience.
                </p>
              </div>
              <Send className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors mt-1" />
            </div>
          </button>

          <button
            onClick={() => handleOpenBillModal("charge-now")}
            className="w-full bg-white border-2 border-gray-200 hover:border-green-400 rounded-xl p-5 text-left transition-all hover:shadow-md group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Charge Patient Now</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Process payment immediately with the patient&apos;s card on file or enter card details.
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-gray-400 group-hover:text-green-500 transition-colors mt-1" />
            </div>
          </button>

          <button
            onClick={handleMarkPaid}
            disabled={markingPaid}
            className="w-full bg-white border-2 border-gray-200 hover:border-amber-400 rounded-xl p-5 text-left transition-all hover:shadow-md group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                {markingPaid ? (
                  <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
                ) : (
                  <Banknote className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Mark as Paid</h4>
                <p className="text-sm text-gray-600 mt-1">
                  For cash, Venmo, Zelle, or other external payments already collected.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/prescriptions")}
            className="text-gray-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Skip for now
          </Button>
          <p className="text-xs text-gray-400">Prescription stays as pending until payment is collected</p>
        </div>
      </div>

      {prescription && (
        <BillPatientModal
          isOpen={showBillModal}
          onClose={() => {
            setShowBillModal(false);
            loadPrescription();
          }}
          prescriptionId={prescription.id}
          pharmacyId={prescription.pharmacy_id}
          patientName={prescription.patientName}
          patientEmail={prescription.patientEmail}
          medication={prescription.medication}
          medicationCostCents={medicationCostCents}
          profitCents={profitCents}
          shippingFeeCents={shippingCents}
          paymentStatus={prescription.status}
        />
      )}
    </DefaultLayout>
  );
}
