# Basic EMR API Documentation

## Overview

The Basic EMR API provides RESTful endpoints for managing patients, encounters, medications, conditions, allergies, orders, vitals, and addendums. All endpoints require authentication using the built-in AUTH system. Responses follow the `{ success, data, error }` convention.

---

## Table of Contents

- [Basic EMR API Documentation](#basic-emr-api-documentation)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Authentication](#authentication)
  - [Response Format](#response-format)
  - [Endpoints](#endpoints)
    - [Patients](#patients)
    - [Encounters](#encounters)
    - [Medications](#medications)
    - [Conditions](#conditions)
    - [Allergies](#allergies)
    - [Orders](#orders)
    - [Vitals](#vitals)
    - [Addendums](#addendums)
  - [Error Handling](#error-handling)
  - [Domain Types](#domain-types)
  - [Usage Notes](#usage-notes)
  - [Example Request/Response](#example-requestresponse)

---

## Authentication

All endpoints require the user to be authenticated. Use the built-in AUTH system. Unauthenticated requests will receive a 401 Unauthorized response.

---

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

If an error occurs:

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Endpoints

### Patients

- `GET /api/basic-emr/patients?search=&page=&limit=`
  - List patients (with optional search and pagination)
- `POST /api/basic-emr/patients`
  - Create a new patient
  - Body: `CreatePatientData`
- `GET /api/basic-emr/patients/[id]`
  - Get patient by ID
- `PATCH /api/basic-emr/patients/[id]`
  - Update patient by ID
  - Body: Partial `CreatePatientData`
- `GET /api/basic-emr/patients/[id]/encounters`
  - List encounters for a patient
- `POST /api/basic-emr/patients/[id]/encounters`
  - Create an encounter for a patient
  - Body: `CreateEncounterData`

### Encounters

- `PATCH /api/basic-emr/encounters/[id]`
  - Update an encounter by ID
  - Body: Partial `Encounter`

### Medications

- `GET /api/basic-emr/medications?patientId=`
  - Get medications for a patient
- `POST /api/basic-emr/medications`
  - Create a medication
  - Body: `CreateMedicationData`
- `PATCH /api/basic-emr/medications/[id]`
  - Update medication by ID
  - Body: Partial `Medication`

### Conditions

- `GET /api/basic-emr/conditions?patientId=`
  - Get conditions for a patient
- `POST /api/basic-emr/conditions`
  - Create a condition
  - Body: `CreateConditionData`
- `PATCH /api/basic-emr/conditions/[id]`
  - Update condition by ID
  - Body: Partial `CreateConditionData & { status: ConditionStatus }`

### Allergies

- `GET /api/basic-emr/allergies?patientId=`
  - Get allergies for a patient
- `POST /api/basic-emr/allergies`
  - Create an allergy
  - Body: `CreateAllergyData`
- `PATCH /api/basic-emr/allergies/[id]`
  - Update allergy by ID
  - Body: Partial `CreateAllergyData`

### Orders

- `GET /api/basic-emr/orders?encounterId=`
  - Get orders for an encounter
- `POST /api/basic-emr/orders`
  - Create an order
  - Body: `CreateOrderData`
- `PATCH /api/basic-emr/orders/[id]`
  - Update order by ID
  - Body: Partial `CreateOrderData & { status: OrderStatus }`

### Vitals

- `GET /api/basic-emr/vitals?encounterId=`
  - Get vitals for an encounter
- `POST /api/basic-emr/vitals`
  - Create vitals
  - Body: `CreateVitalsData`
- `PATCH /api/basic-emr/vitals/[id]`
  - Update vitals by ID
  - Body: Partial `CreateVitalsData`

### Addendums

- `GET /api/basic-emr/addendums?encounterId=`
  - Get addendums for an encounter
- `POST /api/basic-emr/addendums`
  - Create an addendum
  - Body: `{ encounterId: string, content: string, author: string }`

---

## Error Handling

- All errors return `success: false` and an `error` message.
- 401 for unauthorized, 400 for validation, 404 for not found, 500 for server errors.

---

## Domain Types

- All request/response types are defined in `features/basic-emr/types.ts`.
- Example: `Patient`, `Encounter`, `Medication`, etc.

---

## Usage Notes

- All endpoints require authentication.
- Use the enums and types from `types.ts` for request bodies.
- Pagination: `page` and `limit` query params are supported for patient listing.
- All dates/times are ISO 8601 strings.
- For more details, see the service layer and type definitions.

---

## Example Request/Response

**Create Patient**

```json
POST /api/basic-emr/patients
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1980-01-01",
  "gender": "Male"
}
```

**Response:**

```json
{
  "success": true,
  "data": { ...Patient object... }
}
```

**Error Example:**

```json
{
  "success": false,
  "error": "Unauthorized"
}
```
