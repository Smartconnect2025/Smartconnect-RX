# Patient Intake Feature

Multi-step intake flow for new patients to complete their profile.

## Flow

1. `/intake/patient-information` - Basic info (name, DOB, phone, address, gender)
2. `/intake/medical-history` - Medical conditions, allergies, medications
3. `/intake/insurance` - Insurance information (optional)
4. `/intake/consent` - Terms and consent acceptance

## Components

- **IntakeLayout** - Progress stepper wrapper
- **PatientInfoForm** - Step 1 form
- **MedicalHistoryForm** - Step 2 form
- **InsuranceForm** - Step 3 form
- **ConsentForm** - Step 4 form

## Hooks

- **useIntakeProgress** - Tracks intake progress and handles data persistence

## Data Storage

Intake data is stored in the `patients.data` JSONB column:
- `intake_step` - Current completion status
- `intake_completed_at` - Timestamp when fully completed
- Plus all form field data

## Usage

```tsx
import { IntakeLayout, PatientInfoForm, useIntakeProgress } from "@/features/intake";

export default function PatientInformationPage() {
  const { patient, isLoading, isSaving, savePatientInfo } = useIntakeProgress();

  return (
    <IntakeLayout currentStep={1}>
      <PatientInfoForm
        defaultValues={...}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
      />
    </IntakeLayout>
  );
}
```
