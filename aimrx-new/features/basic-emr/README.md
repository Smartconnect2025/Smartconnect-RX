# Basic EMR Feature

## Overview

The Basic EMR (Electronic Medical Record) feature provides a comprehensive patient management and
clinical documentation system. It includes patient charts, encounter management, clinical notes,
vitals tracking, and medical data management.

## Features

### Patient Management

- Patient list with search and pagination
- Create and edit patient profiles
- Comprehensive patient demographics
- Patient chart view with medical history

### Clinical Documentation

- SOAP notes with structured clinical content
- Vitals recording (blood pressure, heart rate, weight, etc.)
- Addendum system for finalized notes
- Clinical encounter management

### Medical Data

- Medications tracking with dosage and frequency
- Medical conditions with severity status
- Allergies and reactions management
- Laboratory results integration

### Encounter Workflow

- Clinical encounters with state management (upcoming, in-progress, completed)
- Notes, Orders, and Billing tabs
- Encounter finalization workflow

### Orders and Billing Flow

- **Patient Order Placement**: Orders automatically create encounters for provider review
- **Provider Review**: Approve/reject orders through encounter interface
- **Order Status Tracking**: Real-time status updates (pending, approved, rejected, cancelled)
- **Patient Order Visibility**: Patients can track order status in "My Orders" page

### Appointment Encounter Flow

- **Patient Appointment Booking**: Appointments automatically create encounters for provider review
- **Provider Encounter Creation**: Providers can create encounters and appointments for patients
- **Appointment-Encounter Linking**: Encounters linked to appointments via `appointment_id` foreign
  key
- **Business Type Tracking**: Encounters marked as 'appointment_based' for workflow differentiation

## Workflow System

### Encounter Types & Workflows

The EMR now supports different encounter workflows based on business type:

#### Clinical Encounters (Original UI)

- Standard clinical workflow with Notes, Orders, and Billing tabs
- Full encounter documentation and finalization flow
- Vitals and intake panels

#### Order-Based Encounters (Original UI)

- Custom layout for order review and approval
- Order details and billing information
- Provider notes with approve/reject actions

#### D2C Encounters (New Workflow)

- Assessment → Recommendations → Checkout → Follow-up flow
- Product recommendations and purchasing
- Automated follow-up scheduling

#### Coaching Encounters (New Workflow)

- Session Notes → Goals → Resources → Next Session flow
- Progress tracking and goal management
- Resource sharing and session planning

### Implementation Details

- Modular workflow configuration system
- Workflow-specific layouts and components
- Automatic workflow detection based on encounter type
- Backward compatibility for existing encounters

## Usage

```tsx
import { BasicEmr } from "@/features/basic-emr";

// Main EMR dashboard
<BasicEmr />;
```

## Routes

- `/basic-emr` - Patient list dashboard
- `/basic-emr/patients/new` - Create new patient
- `/basic-emr/patients/[id]` - Patient chart view
- `/basic-emr/patients/[id]/edit` - Edit patient
- `/basic-emr/patients/[id]/encounters/[encounterId]` - Encounter view

## Components

- `PatientList` - Main patient dashboard with search
- `PatientChart` - Comprehensive patient view with tabs
- `EncounterView` - Clinical encounter management
- `PatientForm` - Patient creation/editing forms
- Medical data forms (medications, conditions, allergies)

## State Management

Uses Zustand for:

- Patient data management
- Current encounter state
- Clinical data state
- UI state management
