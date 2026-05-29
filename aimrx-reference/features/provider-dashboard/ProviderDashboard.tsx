"use client";

import React from "react";
import { cn } from "@/utils/tailwind-utils";
import { ProviderDashboardProps } from "./types";
import Link from "next/link";
import { FileText, UserPlus } from "lucide-react";

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  className,
}) => {

  return (
    <div
      className={cn(
        "container mx-auto max-w-5xl py-8 sm:py-16 px-4",
        className,
      )}
    >
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
          Welcome to Your AIM Portal
        </h1>
        <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
          Streamline your regenerative medicine practice with AI-powered prescription management and patient records
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
        <Link
          href="/prescriptions/new/step1"
          className="group bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-[#1E3A8A] rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <div className="bg-[#1E3A8A]/10 rounded-full p-4 mb-4 group-hover:bg-[#1E3A8A]/20 transition-all duration-200">
            <FileText className="h-12 w-12 text-[#1E3A8A]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Write New Prescription</h3>
          <p className="text-sm text-gray-600">Submit peptides, PRP/PRF, and regenerative therapies</p>
        </Link>
        <Link
          href="/basic-emr"
          className="group bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-[#00AEEF] rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <div className="bg-[#00AEEF]/10 rounded-full p-4 mb-4 group-hover:bg-[#00AEEF]/20 transition-all duration-200">
            <UserPlus className="h-12 w-12 text-[#00AEEF]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Register New Patient</h3>
          <p className="text-sm text-gray-600">Add patients and manage electronic medical records</p>
        </Link>
      </div>

      {/* Appointments sections hidden per user request */}
      {/* <div className="mb-8">
        <UpcomingMeetings
          appointments={appointments}
          loading={loading}
          error={error}
          cancelAppointment={cancelAppointment}
        />
      </div> */}

      {/* Past Appointments */}
      {/* <div className="mb-8">
        <PastAppointments
          pastAppointments={pastAppointments}
          pastLoading={pastLoading}
          pastError={pastError}
        />
      </div> */}
    </div>
  );
};
