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
      <div className="flex flex-col flex-1">

        <div className="bg-[#1B3A5C] text-white">
          <div className="container mx-auto px-6 max-w-4xl py-24 md:py-32 text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6">
              Prescriptions Made Simple
            </h1>
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Connect with pharmacies, prescribe, collect payment, and ship — all from one place.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" className="text-base px-8 py-5 bg-white text-[#1B3A5C] hover:bg-gray-100 font-semibold rounded-lg">
                  Sign In
                </Button>
              </Link>
              <Link href="/request-pharmacy-access">
                <Button variant="outline" size="lg" className="text-base px-8 py-5 bg-transparent border-2 border-white text-white hover:bg-white/10 hover:text-white font-semibold rounded-lg">
                  Join Our Network
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white py-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Curated Formulary</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Premium peptides, GLP-1s, and compounded medications from verified pharmacies.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Secure Payments</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Patients pay securely online. Funds go directly to the pharmacy.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#1B3A5C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Nationwide Shipping</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Built-in shipping with tracking. Pickup, delivery, or ship anywhere.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-6 max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Trusted by Compounding &amp; Specialty Pharmacies
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              Integrates with PioneerRx, Liberty, DigitalRx, QS1, BestRx, and more.
            </p>
            <Link href="/auth/login">
              <Button size="lg" className="bg-[#1B3A5C] hover:bg-[#152d49] text-base px-8 py-5 font-semibold rounded-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </DefaultLayout>
  );
}
