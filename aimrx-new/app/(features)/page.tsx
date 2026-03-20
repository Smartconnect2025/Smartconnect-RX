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
        <div className="relative bg-gradient-to-br from-[#0F2A4A] via-[#1B3A5C] to-[#1E3A8A] text-white py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-blue-400 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-4 max-w-5xl text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm text-white/90 font-medium">The Amazon of Regenerative Medicine</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl leading-tight">
              SmartConnect RX
            </h1>
            <p className="mt-5 text-lg md:text-2xl text-white/80 max-w-3xl mx-auto font-light">
              One platform connecting pharmacies, providers, and patients — from prescription to doorstep.
            </p>
            <p className="mt-4 text-base md:text-lg text-white/60 max-w-2xl mx-auto">
              Streamlining prescriptions, payments, and fulfillment with HIPAA-compliant security. The marketplace where regenerative medicine moves faster.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-[#1B3A5C] hover:bg-gray-100 font-semibold shadow-lg shadow-black/20">
                  Provider Login
                </Button>
              </Link>
              <Link href="/request-pharmacy-access">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-white/30 text-white hover:bg-white/10 font-semibold backdrop-blur-sm">
                  Join Our Network
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white py-20">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-center text-sm font-semibold text-[#1E3A8A] uppercase tracking-widest mb-3">Why Providers Love Us</p>
            <h2 className="text-2xl md:text-4xl font-bold text-center text-gray-900 mb-4">
              Everything You Need. Nothing You Don&apos;t.
            </h2>
            <p className="text-center text-gray-500 mb-14 max-w-2xl mx-auto">
              SmartConnect RX replaces scattered tools with one seamless platform — prescribe, pay, ship, and track in minutes.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#1E3A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Curated Formulary</h3>
                <p className="text-sm text-gray-600 leading-relaxed">Access premium peptides, GLP-1s, and compounded medications from top pharmacies — all in one marketplace.</p>
              </div>
              <div className="text-center p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Instant Payments</h3>
                <p className="text-sm text-gray-600 leading-relaxed">Patients pay securely in one click. Funds go straight to the pharmacy — no middlemen, no delays.</p>
              </div>
              <div className="text-center p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Ship Nationwide</h3>
                <p className="text-sm text-gray-600 leading-relaxed">Built-in shipping with real-time tracking via EasyPost. Patients choose pickup, delivery, or nationwide shipping.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 py-20">
          <div className="container mx-auto px-4 max-w-5xl">
            <p className="text-center text-sm font-semibold text-[#1E3A8A] uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-center text-gray-900 mb-14">
              From Prescription to Doorstep in 3 Steps
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="relative text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center text-xl font-bold">1</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Prescribe</h3>
                <p className="text-sm text-gray-600">Providers browse the curated catalog, select medications, and send prescriptions in under a minute.</p>
              </div>
              <div className="relative text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center text-xl font-bold">2</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Pay</h3>
                <p className="text-sm text-gray-600">Patients receive a secure payment link via email, pay instantly with Stripe or Authorize.Net — directly to the pharmacy.</p>
              </div>
              <div className="relative text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center text-xl font-bold">3</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Fulfill</h3>
                <p className="text-sm text-gray-600">Pharmacies process the order and ship with tracking — or patients pick up locally. Everyone stays in the loop.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white py-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Trusted by Compounding &amp; Specialty Pharmacies
            </h2>
            <p className="text-gray-600 mb-10 max-w-2xl mx-auto">
              SmartConnect RX integrates with PioneerRx, Liberty, DigitalRx, QS1, BestRx, and more — providing seamless connectivity for compounding and specialty pharmacies.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <span className="text-lg font-semibold text-gray-400">PioneerRx</span>
              <span className="text-lg font-semibold text-gray-400">Liberty</span>
              <span className="text-lg font-semibold text-gray-400">DigitalRx</span>
              <span className="text-lg font-semibold text-gray-400">QS1</span>
              <span className="text-lg font-semibold text-gray-400">BestRx</span>
            </div>
            <div className="mt-12">
              <Link href="/auth/login">
                <Button size="lg" className="bg-[#1E3A8A] hover:bg-[#152d49] text-lg px-10 py-6 font-semibold shadow-lg">
                  Get Started Today
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#0F2A4A] to-[#1E3A8A] py-12">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <p className="text-white text-xl font-semibold mb-1">Ready to transform your practice?</p>
            <p className="text-white/70 mb-4">Talk to our team today.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 text-white/80">
              <a href="tel:+15123779898" className="hover:text-white transition-colors">(512) 377-9898</a>
              <span className="hidden sm:inline text-white/40">|</span>
              <a href="mailto:sales@smartconnectrx.com" className="hover:text-white transition-colors">sales@smartconnectrx.com</a>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
