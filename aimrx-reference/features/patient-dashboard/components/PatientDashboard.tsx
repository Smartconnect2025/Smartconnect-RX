"use client";

import { useUser } from "@core/auth";
import DefaultLayout from "@/components/layout/DefaultLayout";
import { PatientProfileCard } from "./PatientProfileCard";
import { MyProviderCard } from "./MyProviderCard";
import { MyPrescriptionsCard } from "./MyPrescriptionsCard";
import { CompleteIntakeBanner } from "./CompleteIntakeBanner";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { usePatientPrescriptions } from "../hooks/usePatientPrescriptions";

export function PatientDashboard() {
  const { user } = useUser();
  const { patient, provider, isLoading: isLoadingProfile } = usePatientProfile();
  const { prescriptions, isLoading: isLoadingPrescriptions } = usePatientPrescriptions();

  // Determine if intake is incomplete (no patient record or no intake data)
  const hasIncompleteIntake = !patient || !patient.data;

  // Get patient name for greeting
  const patientName = patient?.first_name || user?.email?.split("@")[0] || "there";

  return (
    <DefaultLayout>
      <div className="container max-w-5xl mx-auto py-8 px-4">
        {/* Welcome Section */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A]">
            Welcome back, {patientName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s an overview of your health information
          </p>
        </div>

        {/* Complete Intake Banner */}
        <div className="mb-6">
          <CompleteIntakeBanner show={hasIncompleteIntake} />
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <PatientProfileCard patient={patient} isLoading={isLoadingProfile} />
            <MyProviderCard provider={provider} isLoading={isLoadingProfile} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <MyPrescriptionsCard
              prescriptions={prescriptions}
              isLoading={isLoadingPrescriptions}
            />
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
