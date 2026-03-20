"use client";

import React from "react";
import { useUser } from "@core/auth";
import { ProviderDashboard } from "@/features/provider-dashboard";
import { AdminDashboard } from "@/features/admin-dashboard";
import { PatientDashboard } from "@/features/patient-dashboard";

import DefaultLayout from "@/components/layout/DefaultLayout";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  const { user, userRole } = useUser();

  // Show admin dashboard for admins
  if (userRole === "admin") {
    return (
      <DefaultLayout>
        <AdminDashboard />
      </DefaultLayout>
    );
  }

  // Show provider dashboard for providers
  if (userRole === "provider") {
    return (
      <DefaultLayout>
        <ProviderDashboard />
      </DefaultLayout>
    );
  }

  // Show patient dashboard for authenticated patients (after intake completion)
  // Note: Route guard redirects to intake if not completed
  if (user) {
    return <PatientDashboard />;
  }

  // Default landing page for non-authenticated users
  return (
    <DefaultLayout>
      <div className="min-h-[80vh] flex flex-col">
        <div className="bg-[#1B3A5C] text-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              SmartConnect RX
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white/80 max-w-3xl mx-auto">
              All-in-One VPN and Network Solution Provider for Pharmacies
            </p>
            <p className="mt-6 text-base md:text-lg text-white/70 max-w-2xl mx-auto">
              Connecting patients, providers, and pharmacies with a secure, HIPAA-compliant platform for prescription management and payment processing.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" className="text-lg px-8 py-6 bg-white text-[#1B3A5C] hover:bg-gray-100 font-semibold">
                  Provider Login
                </Button>
              </Link>
              <Link href="/request-pharmacy-access">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-white text-white hover:bg-white/10 font-semibold">
                  Request Access
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white py-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Why Choose SmartConnect RX?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">100% Uptime</h3>
                <p className="text-sm text-gray-600">Reliable infrastructure ensuring your pharmacy stays connected around the clock.</p>
              </div>
              <div className="text-center p-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Encryption</h3>
                <p className="text-sm text-gray-600">HIPAA-compliant encryption protecting all patient data and transactions.</p>
              </div>
              <div className="text-center p-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">24/7 Support</h3>
                <p className="text-sm text-gray-600">Dedicated support team available to help your pharmacy whenever you need it.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Trusted by Leading Pharmacies
            </h2>
            <p className="text-gray-600 mb-10 max-w-2xl mx-auto">
              SmartConnect RX integrates with PioneerRx, Liberty, DigitalRx, QS1, BestRx, and more — providing seamless connectivity for compounding and specialty pharmacies.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-70">
              <span className="text-lg font-semibold text-gray-500">PioneerRx</span>
              <span className="text-lg font-semibold text-gray-500">Liberty</span>
              <span className="text-lg font-semibold text-gray-500">DigitalRx</span>
              <span className="text-lg font-semibold text-gray-500">QS1</span>
              <span className="text-lg font-semibold text-gray-500">BestRx</span>
            </div>
            <div className="mt-12">
              <Link href="/auth/login">
                <Button size="lg" className="bg-[#1B3A5C] hover:bg-[#152d49] text-lg px-8 py-6 font-semibold">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-[#1B3A5C] py-10">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <p className="text-white/90 text-lg font-medium mb-2">Find out more!</p>
            <p className="text-white/70">(512) 377-9898</p>
            <p className="text-white/70">sales@smartconnectrx.com</p>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
