# DoseSpot Push Notifications

_DoseSpot Push Notifications Supplement Version 1.0.3 – May 2024_

## Overview

When enabled, DoseSpot will send notifications for key workflow events. This reduces the amount of API pull requests that need to be made by the client. Push notifications are delivered by HTTPS endpoint. All data delivered is in a json format.

Push notification requests will automatically time out after 20 seconds to prevent backup issues.

## Notification Methods and Client Requirements

### HTTPS Endpoint

Notifications are sent via HTTPS POST and will include a secret key in the authentication header. Clients must provide an HTTPS endpoint.

**Configurations required:**

- **https endpoint**: text field of up to 200 characters
- **Secret**: A randomly generated 32-character secret. This can be edited at the client's request.

## Push Notifications Enabled

When enabled, sends the following types of push notifications.

### Confirmed Clinicians

This notification will indicate when a clinician has been confirmed in our Admin Console.

Example JSON:

```json
{
  "EventType": "ClinicianConfirmed",
  "Data": {
    "ClinicianId": 123
  }
}
```

### Prescriber Notification Counts

This notification will indicate a change to the prescriber's notification count at the single clinic and total sum level. For example: when a pending prescription is added or removed, when a transmission error is added or removed, when a refill request is added or removed, or when a change request is added or removed.

Example JSON:

```json
{
  "EventType": "PrescriberNotificationCounts",
  "Data": {
    "ClinicianId": 123,
    "ClinicId": 45,
    "PendingPrescriptionCount": 10,
    "TransmissionErrorCount": 0,
    "RefillRequestCount": 2,
    "ChangeRequestCount": 1,
    "Total": {
      "PendingPrescriptionCount": 15,
      "TransmissionErrorCount": 1,
      "RefillRequestCount": 4,
      "ChangeRequestCount": 1
    }
  }
}
```

### Prescription Status Changes

PrescriptionResult will indicate a prescription has reached a final status of PharmacyVerified, erxSent, Printed, or Error.

Example JSON:

```json
{
  "EventType": "PrescriptionResult",
  "Data": {
    "PatientId": 4321,
    "ClinicId": 21,
    "ClinicianId": 123,
    "AgentId": 123,
    "PrescriptionId": 155501,
    "RelatedRxRequestQueueItemId": 1623,
    "PrescriptionStatus": 13,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "StatusDetails": "Prescription delivery verified"
  }
}
```

OR

```json
{
  "EventType": "PrescriptionResult",
  "Data": {
    "PatientId": 4321,
    "ClinicId": 21,
    "ClinicianId": 123,
    "AgentId": 123,
    "PrescriptionId": 155501,
    "RelatedRxRequestQueueItemId": 1623,
    "PrescriptionStatus": 13,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "StatusDetails": "Unable to connect to remote server"
  }
}
```

### Medication Status Update

MedicationStatusUpdates will indicate a change to patient predication status from the pharmacy. Notifications are sent for the following scenarios: medication discontinued (3), medication deleted (4), medication completed (5), medication cancelled (8), medication cancel denied (9), medication fully filled (11), medication partially filled (12), medication not filled (13).

Note: statusNotes contains notes from the pharmacy relating to the RxFill message.

Example JSON:

```json
{
  "EventType": "MedicationStatusUpdate",
  "Data": {
    "PatientId": 4321,
    "ClinicId": 21,
    "ClinicianId": 123,
    "PrescriptionId": 155501,
    "RelatedRxRequestQueueItemId": 1623,
    "RelatedRxChangeQueueItemId": 1,
    "MedicationStatus": 12,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "StatusNotes": "Patient picked up partial fill",
    "AgentId": 1234
  }
}
```

### Clinician Locked

ClinicianLockedOut will indicate a clinician has failed login three times and is locked out of their account. Does not send follow-up notifications for further login attempts until their account is unlocked.

Example JSON:

```json
{
  "EventType": "ClinicianLockedOut",
  "Data": {
    "ClinicianId": 123,
    "LockoutDateTime": "2020-08-27T09:30:00.123Z",
    "ErrorDetails": "Invalid clinic key"
  }
}
```

_Note: ErrorDetails is the specific login failure reason. This could be any of the errors returned by the SSO validation._

### IDP Success

IDPSuccess will indicate a clinician has completed IDP successfully. It sends a notification for all types of IDP completion (Legal Agreement, IDP Letter, IDP OTP, Manual IDP).

Example JSON:

```json
{
  "EventType": "ClinicianIDPCompleteSuccess",
  "Data": {
    "ClinicianId": 123,
    "ClinicianIDPCompleteDate": "2022-01-01T:12:28:57",
    "IDPCompleteType": "OTP"
  }
}
```

### TFA Activation

TFAActivation will indicate a clinician has successfully activated Two-Factor Authentication (mobile or token).

Example JSON:

```json
{
  "EventType": "ClinicianTfaActivateSuccess",
  "Data": {
    "ClinicianId": 123
  }
}
```

### TFA Deactivation

TFADeactivation will indicate a clinician has successfully deactivated Two-Factor Authentication (mobile or token).

Example JSON:

```json
{
  "EventType": "ClinicianTfaDeactivateSuccess",
  "Data": {
    "ClinicianId": 123
  }
}
```

### PIN Reset

ClinicianPINReset will indicate a clinician's PIN number has been reset in the Admin Console.

Example JSON:

```json
{
  "EventType": "ClinicianPINReset",
  "Data": {
    "ClinicianId": 155501,
    "DateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

### Self-Reported Updates

SelfReportedMedicationStatusUpdate will indicate an addition or change to a patient's self-reported medications.

Example JSON:

```json
{
  "EventType": "SelfReportedMedicationStatusUpdate",
  "Data": {
    "Status": "Added",
    "PatientId": 155501,
    "SelfReportedMedicationId": 155513,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "ClinicianId": 123,
    "AgentId": 1234
  }
}
```

OR

```json
{
  "EventType": "SelfReportedMedicationStatusUpdate",
  "Data": {
    "Status": "Edited",
    "PatientId": 155501,
    "SelfReportedMedicationId": 155513,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "ClinicianId": 123,
    "AgentId": 1234
  }
}
```

OR

```json
{
  "EventType": "SelfReportedMedicationStatusUpdate",
  "Data": {
    "Status": "Deleted",
    "PatientId": 155501,
    "SelfReportedMedicationId": 155513,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "ClinicianId": 123,
    "AgentId": 1234
  }
}
```

### Pharmacy

PharmacyStatusUpdate will indicate an addition, removal or change to a patient's listed pharmacies.

Example JSON:

```json
{
  "EventType": "PharmacyStatusUpdate",
  "Data": {
    "PatientId": 155501,
    "PharmacyId": 155512,
    "Status": "Added",
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

OR

```json
{
  "EventType": "PharmacyStatusUpdate",
  "Data": {
    "PatientId": 155501,
    "PharmacyId": 155512,
    "PharmacyStatus": "Edited",
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

OR

```json
{
  "EventType": "PharmacyStatusUpdate",
  "Data": {
    "PatientId": 155501,
    "PharmacyId": 155512,
    "PharmacyStatus": "3",
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

### ePA

PriorAuthorizationStatusUpdate will indicate a new response from PBMs regarding Prior Authorizations.

Example JSON:

```json
{
  "EventType": "PriorAuthorizationStatusUpdate",
  "Data": {
    "PriorAuthorizationCaseId": 1623,
    "ClinicId": 123,
    "PatientId": 123,
    "PrescriptionId": 123,
    "PrescriberId": 123,
    "PharmacyId": 1,
    "PriorAuthorizationCaseStatus": "deleted",
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

### Patients

PatientStatusUpdate will indicate an addition or change to a patient record.

Example JSON:

```json
{
  "EventType": "PatientStatusUpdate",
  "Data": {
    "Status": "Added",
    "PatientId": 155501,
    "ClinicianId": 123,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "SourceType": "SureScripts"
  }
}
```

OR

```json
{
  "EventType": "PatientStatusUpdate",
  "Data": {
    "Status": "Deleted",
    "PatientId": 155501,
    "ClinicianId": 123,
    "StatusDateTime": "2020-08-27T09:30:00.123Z",
    "SourceType": "EMR"
  }
}
```

### Allergy

AllergyStatusUpdate will indicate an addition, deletion, or change to a patient's reported allergies.

Example JSON:

```json
{
  "EventType": "AllergyStatusUpdate",
  "Data": {
    "Status": "Added",
    "PatientId": 155501,
    "PatientAllergyId": 155511,
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

OR

```json
{
  "EventType": "AllergyStatusUpdate",
  "Data": {
    "Status": "Edited",
    "PatientId": 155501,
    "PatientAllergyId": 155511,
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

OR

```json
{
  "EventType": "AllergyStatusUpdate",
  "Data": {
    "Status": "Deleted",
    "PatientId": 155501,
    "PatientAllergyId": 155511,
    "StatusDateTime": "2020-08-27T09:30:00.123Z"
  }
}
```

---

_980 Washington Street · Suite 330 · Dedham, MA 02026 · phone: 1-888-847-6814 · www.dosespot.com_  
_©2024 PRN Software LLC. Confidential_
