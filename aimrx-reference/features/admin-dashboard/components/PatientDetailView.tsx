"use client";

import React from "react";
import { DetailView } from "./DetailView";
import { formatDate } from "@/utils/format-date";

interface PatientDetailViewProps {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    date_of_birth: string;
    gender?: string;
    city?: string;
    state?: string;
    created_at: string;
    status: "active" | "inactive";
    role: string;
    // Intake data
    height?: string;
    weight?: string;
    blood_type?: string;
    allergies?: string[];
    medications?: string[];
    medical_conditions?: string[];
  };
  onClose: () => void;
}

export function PatientDetailView({
  patient,
  onClose,
}: PatientDetailViewProps) {
  const sections = [
    {
      title: "Basic Information",
      fields: [
        {
          label: "Full Name",
          value: `${patient.first_name} ${patient.last_name}`,
        },
        {
          label: "Email",
          value: patient.email,
        },
        {
          label: "Phone",
          value: patient.phone_number,
        },
        {
          label: "Date of Birth",
          value: formatDate(patient.date_of_birth),
        },
        {
          label: "Gender",
          value: patient.gender,
        },
      ],
    },
    {
      title: "Location",
      fields: [
        {
          label: "City",
          value: patient.city,
        },
        {
          label: "State",
          value: patient.state,
        },
      ],
    },
    {
      title: "Medical Information",
      fields: [
        {
          label: "Height",
          value: patient.height,
        },
        {
          label: "Weight",
          value: patient.weight,
        },
        {
          label: "Blood Type",
          value: patient.blood_type,
        },
        {
          label: "Allergies",
          value: patient.allergies?.length ? (
            <div className="space-y-1">
              {patient.allergies.map((allergy, index) => (
                <div key={index}>{allergy}</div>
              ))}
            </div>
          ) : null,
        },
        {
          label: "Current Medications",
          value: patient.medications?.length ? (
            <div className="space-y-1">
              {patient.medications.map((medication, index) => (
                <div key={index}>{medication}</div>
              ))}
            </div>
          ) : null,
        },
        {
          label: "Medical Conditions",
          value: patient.medical_conditions?.length ? (
            <div className="space-y-1">
              {patient.medical_conditions.map((condition, index) => (
                <div key={index}>{condition}</div>
              ))}
            </div>
          ) : null,
        },
      ],
    },
    {
      title: "Account Information",
      fields: [
        {
          label: "Account Created",
          value: formatDate(patient.created_at),
        },
        {
          label: "Status",
          value: patient.status,
        },
        {
          label: "Role",
          value: patient.role,
        },
      ],
    },
  ];

  return (
    <DetailView
      title="Patient Details"
      description="View and manage patient information"
      sections={sections}
      status={{
        label: patient.status === "active" ? "Active" : "Inactive",
        color: patient.status === "active" ? "#16a34a" : "#6b7280",
      }}
      onClose={onClose}
    />
  );
}
