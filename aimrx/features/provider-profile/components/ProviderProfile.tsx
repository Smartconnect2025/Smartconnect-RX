"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { PracticeDetailsForm } from "./forms/PracticeDetailsForm";
import { ProfessionalInfoForm } from "./forms/ProfessionalInfoForm";
import { ProviderTabsNavigation } from "./ProviderTabsNavigation";
import { AvailabilityCard } from "./AvailabilityCard";
import { ProfileForm } from "./forms/ProfileForm";

export function ProviderProfile() {
  const pathname = usePathname();

  const getCurrentTabContent = () => {
    switch (pathname) {
      case "/provider/professional-info":
        return {
          title: "Professional Information",
          formId: "professional-info-form",
          form: <ProfessionalInfoForm />,
        };
      case "/provider/practice-details":
        return {
          title: "Practice Details",
          formId: "practice-details-form",
          form: <PracticeDetailsForm />,
        };
      case "/provider/availability":
        return {
          title: "Availability",
          formId: "availability-form",
          form: <AvailabilityCard />,
        };
      default: // "/provider/profile"
        return {
          title: "Personal Profile",
          formId: "profile-form",
          form: <ProfileForm />,
        };
    }
  };

  const currentTab = getCurrentTabContent();

  return (
    <div className="min-h-screen bg-gray-50">
      <ProviderTabsNavigation />

      <div className="max-w-5xl mx-auto py-8">
        <div className="space-y-8">{currentTab.form}</div>
      </div>
    </div>
  );
}
