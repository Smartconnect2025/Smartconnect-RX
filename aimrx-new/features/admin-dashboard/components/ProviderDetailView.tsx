"use client";

import React from "react";
import { DetailView } from "./DetailView";
import { formatDate } from "@/utils/format-date";

import { Provider } from "../types";

interface ProviderDetailViewProps {
  provider: Provider;
  onClose: () => void;
}

export function ProviderDetailView({
  provider,
  onClose,
}: ProviderDetailViewProps) {
  const sections = [
    {
      title: "Basic Information",
      fields: [
        {
          label: "Name",
          value:
            provider.first_name && provider.last_name
              ? `${provider.first_name} ${provider.last_name}`
              : "",
        },
        {
          label: "Email",
          value: provider.email || "Not provided",
        },
        {
          label: "Phone",
          value: provider.phone_number || "Not provided",
        },
        {
          label: "Role",
          value: provider.role,
        },
      ],
    },
    {
      title: "Professional Information",
      fields: [
        {
          label: "NPI Number",
          value: provider.npi_number || "Not provided",
        },
        {
          label: "Specialty",
          value: provider.specialty || "Not specified",
        },
        {
          label: "Medical Licenses",
          value: provider.medical_licenses && provider.medical_licenses.length > 0
            ? provider.medical_licenses
                .map((license) => `${license.state}: ${license.licenseNumber}`)
                .join(", ")
            : "Not specified",
        },
        {
          label: "Licensed States",
          value: provider.licensed_states?.join(", ") || "Not specified",
        },
        {
          label: "Service Types",
          value: provider.service_types?.join(", ") || "Not specified",
        },
        {
          label: "Insurance Plans",
          value: provider.insurance_plans?.join(", ") || "Not specified",
        },
      ],
    },
    {
      title: "Account Information",
      fields: [
        {
          label: "Account Created",
          value: formatDate(provider.created_at),
        },
        {
          label: "Status",
          value: provider.status,
        },
      ],
    },
  ];

  return (
    <DetailView
      title="Provider Details"
      description="View and manage provider information"
      sections={sections}
      status={{
        label: provider.status === "active" ? "Active" : "Inactive",
        color: provider.status === "active" ? "#16a34a" : "#6b7280",
      }}
      onClose={onClose}
    />
  );
}
