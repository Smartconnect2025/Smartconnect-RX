# Shared Medical Forms

## Overview

This module contains reusable medical form components that can be used across different features like intake and medication questionnaires.

## Components

- **MedicalConditionField**: Reusable component for capturing medical conditions
- **CurrentMedicationField**: Component for current medication tracking
- **AllergyField**: Component for allergy information
- **MedicalFormField**: Generic form field wrapper for medical data

## Usage

```tsx
import { 
  MedicalConditionField, 
  CurrentMedicationField, 
  AllergyField 
} from "@/features/shared/medical-forms";

// Use in any medical form
<MedicalConditionField 
  form={form} 
  index={0} 
  onRemove={() => removeCondition(0)} 
/>
```

## Schemas

Shared Zod validation schemas for medical data consistency across features.

## Types

Common TypeScript interfaces for medical form data. 