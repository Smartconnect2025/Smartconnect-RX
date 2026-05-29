"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Mail,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { BillPatientModal } from "@/components/billing/BillPatientModal";

interface PrescriptionBillingItem {
  id: string;
  medication: string;
  patientPrice: number;
  profitCents: number;
  shippingFeeCents: number;
}

interface OrderBillingData {
  prescriptions: PrescriptionBillingItem[];
  patientName: string;
  patientEmail: string;
  totalPatientPrice: number;
  totalProfitCents: number;
  totalShippingFeeCents: number;
  paymentStatus: string;
}

export default function PrescriptionStep4Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prescriptionIdsParam = searchParams.get("prescriptionIds");
  const legacyPrescriptionId = searchParams.get("prescriptionId");
  const { user } = useUser();
  const supabase = useMemo(() => createClient(), []);

  const [billingData, setBillingData] = useState<OrderBillingData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"send-link" | "charge-now">("send-link");
  const [billingCompleted, setBillingCompleted] = useState(false);
  const [paidOnTermsActive, setPaidOnTermsActive] = useState(false);
  const [paidOnTermsProviderName, setPaidOnTermsProviderName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    async function loadPrescriptions() {
      setLoadingData(true);

      let prescriptionIds: string[] = [];

      if (prescriptionIdsParam) {
        prescriptionIds = prescriptionIdsParam.split(",").filter(Boolean);
      } else if (legacyPrescriptionId) {
        prescriptionIds = [legacyPrescriptionId];
      }

      if (prescriptionIds.length === 0) {
        toast.error("No prescription IDs found");
        router.push("/prescriptions?refresh=true");
        return;
      }

      // ORIGINAL behaviour for real providers (direct supabase). Only
      // delegate-role users (Provider Assistants) take the new server
      // endpoint, because RLS blocks the direct query for them.
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

      type BillingRow = {
        id: string;
        medication: string | null;
        patient_price: number | string | null;
        profit_cents: number | null;
        shipping_fee_cents: number | null;
        payment_status: string | null;
        patient:
          | { first_name: string; last_name: string; email?: string }
          | Array<{ first_name: string; last_name: string; email?: string }>
          | null;
      };
      let data: BillingRow[] = [];
      let fetchOk = true;

      if (role === "delegate") {
        const res = await fetch(
          `/api/prescriptions/billing-info?ids=${encodeURIComponent(prescriptionIds.join(","))}`,
          { credentials: "include", cache: "no-store" },
        );
        const json = await res.json().catch(() => ({}));
        data = (json?.prescriptions ?? []) as BillingRow[];
        fetchOk = res.ok;
      } else {
        const { data: rows, error } = await supabase
          .from("prescriptions")
          .select(`
            id,
            medication,
            patient_price,
            profit_cents,
            shipping_fee_cents,
            payment_status,
            patient:patients(first_name, last_name, email)
          `)
          .in("id", prescriptionIds);
        if (error) {
          fetchOk = false;
        } else {
          data = (rows ?? []) as unknown as BillingRow[];
        }
      }

      if (!fetchOk || data.length === 0) {
        toast.error("Could not load prescription details");
        router.push("/prescriptions?refresh=true");
        return;
      }

      const firstPatient = Array.isArray(data[0].patient) ? data[0].patient[0] : data[0].patient;
      const patientName = firstPatient
        ? `${(firstPatient as { first_name: string }).first_name} ${(firstPatient as { last_name: string }).last_name}`
        : "Unknown Patient";
      const patientEmail = (firstPatient as { email?: string })?.email || "";

      const prescriptions: PrescriptionBillingItem[] = data.map((rx) => ({
        id: rx.id,
        medication: rx.medication || "Unknown Medication",
        patientPrice: Number(rx.patient_price) || 0,
        profitCents: rx.profit_cents || 0,
        shippingFeeCents: rx.shipping_fee_cents || 0,
      }));

      setBillingData({
        prescriptions,
        patientName,
        patientEmail,
        totalPatientPrice: prescriptions.reduce((s, p) => s + p.patientPrice, 0),
        totalProfitCents: prescriptions.reduce((s, p) => s + p.profitCents, 0),
        totalShippingFeeCents: prescriptions.reduce((s, p) => s + p.shippingFeeCents, 0),
        paymentStatus: data[0].payment_status || "pending",
      });

      // Pay-on-terms auto-bypass: if the prescribing provider is flagged
      // pay_on_terms, skip the Collect Payment screen entirely. We auto-call
      // generate-link, which marks every rx paid + submits to pharmacy, with
      // no patient receipt/email/SMS.
      try {
        const checkRes = await fetch("/api/prescriptions/check-pay-on-terms", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prescriptionIds }),
        });
        const checkJson = await checkRes.json().catch(() => ({}));
        if (checkRes.ok && checkJson?.payOnTerms === true) {
          setPaidOnTermsActive(true);
          setLoadingData(false);
          const genRes = await fetch("/api/payments/generate-link", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prescriptionId: prescriptionIds[0],
              prescriptionIds,
            }),
          });
          const genJson = await genRes.json().catch(() => ({}));
          if (genRes.ok && genJson?.paidOnTerms === true) {
            setPaidOnTermsProviderName(genJson.providerName || null);
            setBillingCompleted(true);
            const noun = prescriptionIds.length > 1 ? "Prescriptions" : "Prescription";
            toast.success(
              `${noun} auto-paid on terms — submitted to pharmacy. No patient receipt sent.`,
              { duration: 5000, icon: <CheckCircle2 className="h-5 w-5" /> },
            );
            setTimeout(() => router.push("/prescriptions?refresh=true"), 2500);
            return;
          }
          // bypass call failed — fall through to normal payment screen
          setPaidOnTermsActive(false);
          toast.error(
            genJson?.error || "Auto-bill on terms failed — please collect payment manually.",
          );
        }
      } catch (err) {
        console.warn("[step4] pay-on-terms check failed; falling back to normal flow:", err);
      }

      setLoadingData(false);
    }

    loadPrescriptions();
  }, [user?.id, prescriptionIdsParam, legacyPrescriptionId, supabase, router]);

  useEffect(() => {
    if (billingCompleted) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [billingCompleted]);

  const handleSelectMethod = (method: "send-link" | "charge-now") => {
    setInitialPaymentMethod(method);
    setBillingModalOpen(true);
  };

  const handleBillingClose = () => {
    setBillingModalOpen(false);
  };

  const handleBillingSuccess = () => {
    setBillingCompleted(true);
    setBillingModalOpen(false);
    const msg = billingData && billingData.prescriptions.length > 1
      ? "Payment collected! Prescriptions will be sent to pharmacy."
      : "Payment collected! Prescription will be sent to pharmacy.";
    toast.success(msg, { duration: 5000, icon: <CheckCircle2 className="h-5 w-5" /> });
    setTimeout(() => {
      router.push("/prescriptions?refresh=true");
    }, 2000);
  };

  const handleSkipWithWarning = () => {
    const count = billingData?.prescriptions.length || 1;
    const noun = count > 1 ? "prescriptions" : "prescription";
    if (window.confirm(
      `Are you sure you want to leave without collecting payment?\n\nThe ${noun} will NOT be sent to the pharmacy until payment is collected. You can bill the patient later from the prescriptions dashboard.`
    )) {
      router.push("/prescriptions?refresh=true");
    }
  };

  if (!prescriptionIdsParam && !legacyPrescriptionId) {
    return (
      <DefaultLayout>
        <div className="container max-w-7xl mx-auto py-8 px-4 text-center">
          <p className="text-muted-foreground">No prescription ID found.</p>
          <Button className="mt-4" onClick={() => router.push("/prescriptions")}>
            Go to Prescriptions
          </Button>
        </div>
      </DefaultLayout>
    );
  }

  const totalCostDollars = billingData
    ? billingData.totalPatientPrice + billingData.totalProfitCents / 100 + billingData.totalShippingFeeCents / 100
    : 0;

  return (
    <DefaultLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Prescription</h1>
              <p className="text-muted-foreground mt-2">Step 4 of 4: Collect Payment</p>
            </div>
            <Button variant="outline" onClick={handleSkipWithWarning} className="text-gray-500" data-testid="button-skip-billing">
              Skip for Now
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
            <div className="w-12 h-0.5 bg-green-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">✓</div>
              <span className="ml-2 text-sm text-muted-foreground">Review</span>
            </div>
            <div className="w-12 h-0.5 bg-blue-500"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">4</div>
              <span className="ml-2 font-semibold text-blue-700">Collect Payment</span>
            </div>
          </div>
        </div>

        {paidOnTermsActive && !billingCompleted ? (
          <div className="bg-white border border-amber-200 rounded-xl p-10 text-center shadow-sm" data-testid="status-pay-on-terms-processing">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-6">
              <ShieldCheck className="w-12 h-12 text-amber-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Auto-Billing on Terms…</h2>
            <p className="text-gray-600 text-lg">
              This provider is set to <strong>Pay on Terms</strong>. Skipping patient payment and submitting straight to the pharmacy.
            </p>
            <p className="text-sm text-muted-foreground mt-2">No payment link, receipt, or billing message will be sent to the patient.</p>
          </div>
        ) : billingCompleted ? (
          <div className="bg-white border border-green-200 rounded-xl p-10 text-center shadow-sm" data-testid="status-payment-complete">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {paidOnTermsProviderName ? "Auto-Paid on Terms!" : "Payment Collected!"}
            </h2>
            <p className="text-gray-600 text-lg">
              {paidOnTermsProviderName
                ? `Billed to ${paidOnTermsProviderName} on terms — no patient receipt sent. ${
                    billingData && billingData.prescriptions.length > 1
                      ? "Prescriptions submitted to pharmacy."
                      : "Prescription submitted to pharmacy."
                  }`
                : billingData && billingData.prescriptions.length > 1
                ? "The prescriptions are now being processed and will be sent to the pharmacy."
                : "The prescription is now being processed and will be sent to the pharmacy."}
            </p>
            <p className="text-sm text-muted-foreground mt-4">Redirecting to your prescriptions...</p>
          </div>
        ) : loadingData ? (
          <div className="bg-white border rounded-xl p-10 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex items-start gap-4" data-testid="warning-payment-required">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-900 text-lg">Payment Required Before Pharmacy Submission</h3>
                <p className="text-amber-800 mt-1">
                  {billingData && billingData.prescriptions.length > 1
                    ? <>These {billingData.prescriptions.length} prescriptions will <strong>NOT</strong> be sent to the pharmacy until payment is collected.</>
                    : <>This prescription will <strong>NOT</strong> be sent to the pharmacy until payment is collected.</>}
                  {" "}Choose how you&apos;d like to collect payment from <strong>{billingData?.patientName}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Order Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground">Patient</p>
                  <p className="font-medium">{billingData?.patientName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Patient Email</p>
                  <p className="font-medium">{billingData?.patientEmail || "Not on file"}</p>
                </div>
              </div>

              {billingData && billingData.prescriptions.length > 1 && (
                <div className="border-t pt-3 space-y-2 mb-3">
                  {billingData.prescriptions.map((rx) => (
                    <div key={rx.id} className="flex justify-between text-sm" data-testid={`billing-item-${rx.id}`}>
                      <span className="text-gray-700">{rx.medication}</span>
                      <span className="font-medium">${rx.patientPrice.toFixed(2)}</span>
                    </div>
                  ))}
                  {billingData.totalShippingFeeCents > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Shipping & handling</span>
                      <span>${(billingData.totalShippingFeeCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {billingData.totalProfitCents > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Oversight & monitoring</span>
                      <span>${(billingData.totalProfitCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {billingData && billingData.prescriptions.length === 1 && (
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-muted-foreground">Medication</p>
                    <p className="font-medium">{billingData.prescriptions[0].medication}</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <p className="text-muted-foreground font-medium">Total Cost</p>
                  <p className="font-bold text-lg text-green-700">${totalCostDollars.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <button
                onClick={() => handleSelectMethod("send-link")}
                className="group relative bg-white border-2 border-blue-200 hover:border-blue-500 rounded-xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="button-send-payment-link"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Mail className="h-7 w-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Send Payment Link</h3>
                    <p className="text-sm text-blue-600 font-medium">Recommended</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Email a secure payment link to the patient. They&apos;ll pay online at their convenience.
                </p>
                <div className="mt-4 flex items-center text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
                  <span>Select this option</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handleSelectMethod("charge-now")}
                className="group relative bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                data-testid="button-charge-now"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center transition-colors">
                    <CreditCard className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Charge Patient Now</h3>
                    <p className="text-sm text-emerald-600 font-medium">Instant processing</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Enter the patient&apos;s credit card details and charge them immediately.
                </p>
                <div className="mt-4 flex items-center text-emerald-600 font-medium text-sm group-hover:gap-2 transition-all">
                  <span>Select this option</span>
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={handleSkipWithWarning}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                data-testid="link-skip-billing"
              >
                I&apos;ll bill the patient later ({billingData && billingData.prescriptions.length > 1 ? "prescriptions" : "prescription"} will remain pending)
              </button>
            </div>
          </div>
        )}

        {billingData && (
          <BillPatientModal
            isOpen={billingModalOpen}
            onClose={handleBillingClose}
            prescriptionId={billingData.prescriptions[0].id}
            prescriptionIds={billingData.prescriptions.map((rx) => rx.id)}
            patientName={billingData.patientName}
            patientEmail={billingData.patientEmail}
            medication={billingData.prescriptions.map((rx) => rx.medication).join(", ")}
            medicationCostCents={Math.round(billingData.totalPatientPrice * 100)}
            profitCents={billingData.totalProfitCents}
            shippingFeeCents={billingData.totalShippingFeeCents}
            paymentStatus={billingData.paymentStatus}
            initialPaymentMethod={initialPaymentMethod}
            onPaymentSuccess={handleBillingSuccess}
          />
        )}
      </div>
    </DefaultLayout>
  );
}
