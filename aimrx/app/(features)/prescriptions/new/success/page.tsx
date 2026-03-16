"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { usePharmacy } from "@/contexts/PharmacyContext";

export default function PrescriptionSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queueId, setQueueId] = useState<string>("");
  const [encounterId, setEncounterId] = useState<string>("");
  const { pharmacy, isLoading } = usePharmacy();
  const [selectedPharmacy, setSelectedPharmacy] = useState<{name: string, color: string} | null>(null);
  const [paymentData, setPaymentData] = useState<{
    patientCharged: string;
    pharmacyReceived: string;
    doctorProfit: string;
  } | null>(null);

  useEffect(() => {
    const queue = searchParams.get("queueId");
    const encounter = searchParams.get("encounterId");

    if (queue) setQueueId(queue);
    if (encounter) setEncounterId(encounter);

    // Load selected pharmacy from sessionStorage
    const savedData = sessionStorage.getItem("prescriptionData");
    if (savedData) {
      const data = JSON.parse(savedData);
      if (data.selectedPharmacyName && data.selectedPharmacyColor) {
        setSelectedPharmacy({
          name: data.selectedPharmacyName,
          color: data.selectedPharmacyColor,
        });
      }

      // Extract payment data
      if (data.patientPrice) {
        const price = parseFloat(data.patientPrice);

        setPaymentData({
          patientCharged: price.toFixed(2),
          pharmacyReceived: price.toFixed(2),
          doctorProfit: "0.00",
        });
      }
    }
  }, [searchParams]);

  const handleGoToDashboard = () => {
    router.push("/prescriptions");
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto max-w-2xl py-16 px-4">
        <div className="bg-white rounded-lg border border-border shadow-sm p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Prescription Submitted Successfully!
            </h1>
            {selectedPharmacy ? (
              <>
                <p className="text-lg text-gray-700 mb-2">
                  Prescription successfully sent to{" "}
                  <span
                    className="font-bold text-xl"
                    style={{ color: selectedPharmacy.color }}
                  >
                    {selectedPharmacy.name}
                  </span>
                </p>
                <div
                  className="inline-block px-4 py-2 rounded-full text-sm font-semibold text-white mt-2"
                  style={{ backgroundColor: selectedPharmacy.color }}
                >
                  ✓ {selectedPharmacy.name}
                </div>
              </>
            ) : !isLoading && pharmacy ? (
              <>
                <p className="text-lg text-gray-700 mb-2">
                  Prescription successfully sent to{" "}
                  <span
                    className="font-bold"
                    style={{ color: pharmacy.primary_color || "#1E3A8A" }}
                  >
                    {pharmacy.name}
                  </span>
                </p>
                {pharmacy.tagline && (
                  <p className="text-sm italic text-gray-500 mb-4">
                    {pharmacy.tagline}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground mb-4">
                Your prescription has been sent to the pharmacy for processing.
              </p>
            )}

            {queueId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 mt-6">
                <p className="text-sm text-muted-foreground mb-1">Queue ID</p>
                <p className="text-lg font-mono font-semibold text-foreground">
                  {queueId}
                </p>
              </div>
            )}

            {encounterId && (
              <p className="text-sm text-muted-foreground">
                Linked to encounter visit
              </p>
            )}
          </div>

          {/* AUTOMATIC PAYMENT BREAKDOWN */}
          {paymentData && (
            <div className="mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-green-500 rounded-2xl p-6 shadow-2xl">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-black text-green-800 mb-1">
                    💰 Payment Processed Automatically
                  </h2>
                  <p className="text-sm text-green-700 font-semibold">
                    All transactions completed instantly • No invoices • No waiting
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Patient Charged */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-md border-2 border-gray-200">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Patient Charged</p>
                      <p className="text-xs text-gray-500">Full amount paid by patient</p>
                    </div>
                    <p className="text-3xl font-black text-gray-900">${paymentData.patientCharged}</p>
                  </div>

                  {/* You Kept (Profit) */}
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg">
                    <div>
                      <p className="text-base text-white font-black">YOU KEPT (Profit)</p>
                      <p className="text-xs text-green-100 font-semibold">Deposited instantly to your account</p>
                    </div>
                    <p className="text-4xl font-black text-white drop-shadow-2xl">
                      +${paymentData.doctorProfit}
                    </p>
                  </div>

                  {/* Pharmacy Received */}
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border-2 border-blue-300">
                    <div>
                      <p className="text-sm text-blue-700 font-semibold">Pharmacy Received</p>
                      <p className="text-xs text-blue-600">Sent automatically to pharmacy</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">${paymentData.pharmacyReceived}</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white/60 rounded-lg border border-green-200">
                  <p className="text-xs text-gray-700 text-center font-semibold">
                    ✓ Money in your bank in seconds • Stripe Connect automatic split payment
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleGoToDashboard}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
