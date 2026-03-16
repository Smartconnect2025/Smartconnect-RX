# Patient Dashboard Feature

Dashboard landing page for patients (role: "user") after login.

## Overview

This feature provides a personalized dashboard for patients to view their health information,
including their profile, assigned provider, and prescription status.

## Components

- **PatientDashboard** - Main dashboard component that composes all sub-components
- **PatientProfileCard** - Displays patient's personal and medical information
- **MyProviderCard** - Shows assigned provider details and contact info
- **MyPrescriptionsCard** - Lists recent prescriptions with status badges
- **CompleteIntakeBanner** - CTA banner shown when intake is incomplete

## Hooks

- **usePatientProfile** - Fetches patient profile and provider data
- **usePatientPrescriptions** - Fetches patient's prescription history

## Usage

```tsx
import { PatientDashboard } from "@/features/patient-dashboard";

export default function HomePage() {
  return <PatientDashboard />;
}
```

## Data Sources

- Patient data: `patients` table (linked by user_id)
- Provider data: `providers` table (linked by patient.provider_id)
- Prescriptions: `prescriptions` table (linked by patient_id)
