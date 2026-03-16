# 3.11 Notifications

## 3.11.1 List error notifications
`GET api/notifications/errors?clinic={clinic}&pageNumber={pageNumber}`

Lists the number of notifications for just transmission errors for the clinician. Can be set to pull errors for the current clinic, or all clinics the clinician is part of. The clinician and clinic are determined from the Authentication token used here.

### REQUEST INFORMATION
#### URI Parameters:
| Name | Type | Additional Information |
| ---- | ---- | --------------------- |
| Clinic | String | Determines whether the errors will be pulled for all clinics or just the current clinic. Defaults to current. |
| pageNumber | Integer | Page number of results for search. Defaults to page 1 |

#### Body Parameters: None.

### RESPONSE INFORMATION
#### Resource Description:
| Name | Type | Additional Information |
| ---- | ---- | --------------------- |
| Items | Collection of TransmissionError | Lists prescriptions with transmission errors. See [4.1.17 Transmission Error] |
| Result | Result | See [4.1.30 Result] |

#### Sample Response Formats:

**JSON:**
```json
{
  "Items": [
    {
      "PrescriptionId": 0,
      "DateWritten": "2024-06-20T16:35:19.916Z",
      "ErrorDateTimeStamp": "2024-06-20T16:35:19.916Z",
      "ErrorDetails": "string",
      "PatientId": 0,
      "ClinicId": 0
    }
  ],
  "PageResult": {
    "CurrentPage": 0,
    "TotalPages": 0,
    "PageSize": 0,
    "TotalCount": 0,
    "HasPrevious": true,
    "HasNext": true
  },
  "Result": {
    "ResultCode": "string",
    "ResultDescription": "string"
  }
}
```

**XML:**
```xml
<PagedListResponse[TransmissionErrors]>
  <Items>
    <PrescriptionId>1</PrescriptionId>
    <DateWritten>1970-01-01T00:00:00.001Z</DateWritten>
    <ErrorDateTimeStamp>1970-01-01T00:00:00.001Z</ErrorDateTimeStamp>
    <ErrorDetails>string</ErrorDetails>
    <PatientId>1</PatientId>
    <ClinicId>1</ClinicId>
  </Items>
  <PageResult>
    <CurrentPage>1</CurrentPage>
    <TotalPages>1</TotalPages>
    <PageSize>1</PageSize>
    <TotalCount>1</TotalCount>
    <HasPrevious>true</HasPrevious>
    <HasNext>true</HasNext>
  </PageResult>
  <Result>
    <ResultCode>string</ResultCode>
    <ResultDescription>string</ResultDescription>
  </Result>
</PagedListResponse[TransmissionErrors]>
```

## 3.11.2 Count notifications
`GET api/notifications/counts`

Lists the number of notifications for refill requests, change requests, transmission errors, and prescriptions that are pending a response from the clinician at a single clinic. The clinician and clinic are determined from the Authentication token used here.

### REQUEST INFORMATION
#### URI Parameters: None.
#### Body Parameters: None.

### RESPONSE INFORMATION
#### Resource Description:
| Name | Type | Additional Information |
| ---- | ---- | --------------------- |
| PrescriberNotificationCounts | Collection of PrescriberNotificationCounts | See [4.1.32 Prescriber Notification Counts] |
| Result | Result | See [4.1.30 Result] |

#### Sample Response Formats:

**JSON:**
```json
{
  "RefillRequestsCount": 0,
  "TransactionErrorsCount": 0,
  "PendingPrescriptionsCount": 0,
  "PendingRxChangeCount": 0,
  "Result": {
    "ResultCode": "string",
    "ResultDescription": "string"
  }
}
```

**XML:**
```xml
<PrescriberNotificationCountsResponse>
  <RefillRequestsCount>1</RefillRequestsCount>
  <TransactionErrorsCount>1</TransactionErrorsCount>
  <PendingPrescriptionsCount>1</PendingPrescriptionsCount>
  <PendingRxChangeCount>1</PendingRxChangeCount>
  <Result>
    <ResultCode>string</ResultCode>
    <ResultDescription>string</ResultDescription>
  </Result>
</PrescriberNotificationCountsResponse>
```