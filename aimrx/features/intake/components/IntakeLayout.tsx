"use client";

import { Check } from "lucide-react";
import { INTAKE_STEPS } from "../types";

interface IntakeLayoutProps {
  currentStep: number;
  children: React.ReactNode;
}

export function IntakeLayout({ currentStep, children }: IntakeLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A]">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">
            Please complete the following steps to set up your account
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {INTAKE_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      currentStep > step.id
                        ? "bg-[#1E3A8A] border-[#1E3A8A] text-white"
                        : currentStep === step.id
                          ? "border-[#1E3A8A] text-[#1E3A8A] bg-white"
                          : "border-gray-300 text-gray-400 bg-white"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center hidden sm:block ${
                      currentStep >= step.id
                        ? "text-[#1E3A8A]"
                        : "text-gray-400"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                {/* Connector Line */}
                {index < INTAKE_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      currentStep > step.id ? "bg-[#1E3A8A]" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
