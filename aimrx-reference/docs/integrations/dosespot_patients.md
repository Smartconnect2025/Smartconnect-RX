# DoseSpot RESTful API - PATIENTS Resource

## 3.12 Patients

### 3.12.1 Search for patient
**GET api/patients/search?firstname={firstname}&lastname={lastname}&dob={dob}&pageNumber={pageNumber}&patientStatus={patientStatus}**

Returns a list of patient records matching a specified search query.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| firstname | String | Patient's first name. Minimum length: 2 characters |
| lastname | String | Patient's last name. Minimum length: 2 characters |
| dob | Date | Patient's date of birth |
| status | Integer | Default value is 2<br>Values: See [4.2.21 Patient Status] |
| pageNumber | Integer | Page number of results for search. Defaults to page 1 |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Items | Collection of Patient | See [4.1.9 Patient] |
| Result | Result | See [4.1.30 Result] |

### 3.12.2 Add patient
**POST api/patients**

Creates a new patient and returns the corresponding patient ID.

Creating a patient is usually the first step after creating the clinic (see [3.3.3 Add clinic]) and the clinician (see [3.2.1 Add clinician]), after which you could use the patient ID as a parameter for other API requests specific to a patient's record.

#### REQUEST INFORMATION
URI Parameters: None.

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| Prefix | String(10) | Patient's name prefix (i.e., Mr.) |
| FirstName | String(35) | Patient's first name (i.e., Maria) |
| MiddleName | String(35) | Patient's middle name |
| LastName | String(35) | Patient's last name (i.e., Garcia) |
| Suffix | String(10) | Patient's suffix (i.e., Jr., III) |
| DateOfBirth | Date | Patient's date of birth. Must not be a date after today. Must be after 1900. |
| Gender | GenderType | Patient's gender<br>Values: See [4.2.5 Gender Type] |
| Email | String(80) | Patient's email |
| Address1 | String(35) | Patient's home street address—line one (i.e., 539 Main Street) |
| Address2 | String(35) | Patient's home street address—line two (i.e., Suite #2043) |
| City | String(35) | Patient's home city |
| State | String(10) | Patient's home state |
| ZipCode | String(10) | Patient's home zip code |
| PhoneAdditional1 | String(25) | Patient's first additional phone number |
| PhoneAdditional2 | String(25) | Patient's second additional phone number |
| PhoneAdditionalType1 | PhoneTypes | Patient's first additional phone type<br>Values: See [4.2.8 Phone Types] |
| PhoneAdditionalType2 | PhoneTypes | Patient's second additional phone type<br>Values: See [4.2.8 Phone Types] |
| PrimaryPhone | String(25) | Patient's default phone number |
| PrimaryPhoneType | PhoneTypes | Patient's default phone type<br>Values: See [4.2.8 Phone Types] |
| Weight | Decimal Number | Patient's weight in pounds or kilograms<br>Required if patient is under 19 years old |
| WeightMetric | WeightUnitItem | Values: See [4.2.12 Weight Unit Item] |
| Height | Decimal Number | Patient's height in inches or centimeters<br>Required if patient is under 19 years old |
| HeightMetric | HeightUnitItem | Values: See [4.2.15 Height Unit Item] |
| NonDoseSpotMedicalRecordNumber | String(35) | EMR-specific patient identifier |
| Active | Boolean | True if patient is active; otherwise, it is false |
| Encounter | String(50) | Identifier for the encounter originating a prescription order |
| IsHospice | Boolean | True if patient is hospice patient; otherwise, it is false |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Id | Integer | DoseSpot's unique patient identifier |
| Result | Result | See [4.1.30 Result] |

### 3.12.3 Get patient demographic information
**GET api/patients/{patientId}**

Retrieves the existing demographic information in a patient record.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Item | Patient | See [4.1.9 Patient] |
| Result | Result | See [4.1.30 Result] |

### 3.12.4 Edit patient demographic information
**PUT api/patients/{patientId}**

Updates the demographic information for an existing patient record.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| Prefix | String(10) | Patient's name prefix (i.e., Mr.) |
| FirstName | String(35) | Patient's first name (i.e., Maria) |
| MiddleName | String(35) | Patient's middle name |
| LastName | String(35) | Patient's last name (i.e., Garcia) |
| Suffix | String(10) | Patient's suffix (i.e., Jr., III) |
| DateOfBirth | Date | Patient's date of birth. Must not be a date after today. Must be after 1900. |
| Gender | GenderType | Patient's gender<br>Values: See [4.2.5 Gender Type] |
| Email | String(80) | Patient's email |
| Address1 | String(35) | Patient's home street address—line one (i.e., 539 Main Street) |
| Address2 | String(35) | Patient's home street address—line two (i.e., Suite #2043) |
| City | String(35) | Patient's home city |
| State | String(20) | Patient's home state |
| ZipCode | String(10) | Patient's zip code |
| PhoneAdditional1 | String(25) | Patient's first additional phone number |
| PhoneAdditional2 | String(25) | Patient's second additional phone number |
| PhoneAdditionalType1 | PhoneTypes | Patient's first additional phone type<br>Values: See [4.2.8 Phone Types] |
| PhoneAdditionalType2 | PhoneTypes | Patient's second additional phone type<br>Values: See [4.2.8 Phone Types] |
| PrimaryPhone | String(25) | Patient's default phone number |
| PrimaryPhoneType | PhoneTypes | Patient's default phone type<br>Values: See [4.2.8 Phone Types] |
| Weight | Decimal Number | Patient's weight in pounds or kilograms<br>Required if patient is under 19 years old |
| WeightMetric | WeightUnitItem | Values: See [4.2.12 Weight Unit Item] |
| Height | Decimal Number | Patient's height in inches or centimeters<br>Required if patient is under 19 years old |
| HeightMetric | HeightUnitItem | Values: See [4.2.15 Height Unit Item] |
| NonDoseSpotMedicalRecordNumber | String(35) | EMR-specific patient identifier |
| Active | Boolean | True if patient is active; otherwise, it is false |
| Encounter | String(50) | Identifier for the encounter originating a prescription order |
| IsHospice | Boolean | True if patient is hospice patient; otherwise, it is false |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Id | Integer | DoseSpot's unique patient identifier |
| Result | Result | See [4.1.30 Result] |

### 3.12.5 Get patient pharmacies
**GET api/patients/{patientId}/pharmacies**

Retrieves a detailed list of preferred pharmacies in the patient's record.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Items | Collection of Pharmacy | See [4.1.11 Pharmacy] |
| Result | Result | See [4.1.30 Result] |

### 3.12.6 Add pharmacy
**POST api/patients/{patientId}/pharmacies**

Adds a pharmacy to a patient's preferred pharmacies list. One preferred pharmacy per patient record can be designated as "primary." This should be used to indicate a patient's top preference and will be automatically linked to new prescriptions for that patient if another pharmacyId is not explicitly specified.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| SetAsPrimary | Boolean | Sets pharmacy as patient's primary/default pharmacy |
| pharmacyId | Integer | DoseSpot's unique pharmacy identifier |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Result | Result | See [4.1.30 Result] |

### 3.12.7 Get patient clinic information
**GET api/patients/{patientId}/clinics**

Retrieves information on all clinics that have been associated with a patient.

Determines clinics by checking those a patient is directly linked to, as well as those linked to the patient by past prescriptions. The list returned will only show clinics which are visible to the user making the call (may be one, or multiple depending on if the user is an admin user or has access to multiple clinics).

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Items | Collection of Clinic | See [4.1.4 Clinic] |
| Result | Result | See [4.1.30 Result] |

### 3.12.8 Get patient clinician information
**GET api/patients/{patientId}/clinicians**

Retrieves information on all clinicians that have affected a patient record.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Items | Collection of Clinician | See [4.1.5 Clinician] |
| Result | Result | See [4.1.30 Result] |

### 3.12.9 Merge patient records
**POST api/patients/merge**

Merges the medications in one patient record to another patient record. This includes all types of self-reported medications and prescriptions. Other patient data such as demographics, drug allergies, preferred pharmacies, etc. are NOT merged.

#### REQUEST INFORMATION
URI Parameters: None.

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| FromPatientId | Integer | The PatientID whose records will be merged |
| ToPatientId | Integer | The PatientID the records will be merged to |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Result | Result | See [4.1.30 Result] |

### 3.12.10 Patient transfer
**POST api/patients/{patientId}/transfer**

Transfers a patient between clinics under the same client. This operation can be used by billing admins, client admins, and clinician admins.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| ClinicIdToRemove | Integer | Patient's original clinic |
| ClinicIdToAdd | Integer | Clinic patient will be moved to |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Result | Result | See [4.1.30 Result] |

### 3.12.11 Custom insurance information
**POST api/patients/{patientId}/insurance**

If the custom insurance clinic configuration has been enabled, will save custom insurance information.
Note: only proxy, prescribing agents, and prescribers can add or edit custom insurance information.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |

Body Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| PatientInsuranceIdentifierType | PatientInsuranceIdentifierType | See [4.2.16 Patient Insurance Identifier Type] |
| PatientInsuranceIdentifier | String | Inclusive between 0 and 35 |
| PersonCode | String | Inclusive between 0 and 2 |
| PayerName | String | Pharmacy Benefit Manager (PBM)/Payer name |
| CustomEligibilityDetails | Collection of CustomEligibilityInfo | See [4.1.23 Custom Eligibility Info] |

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Id | Integer | DoseSpot's unique patient identifier |
| Result | Result | See [4.1.30 Result] |

### 3.12.12 Delete pharmacy
**DELETE api/patients/{patientId}/pharmacies/{pharmacyId}**

Removes a pharmacy from a patient's preferred pharmacies list. This does not change any existing medications in that patient's record even if they are queued up or already sent to that pharmacy.

#### REQUEST INFORMATION
URI Parameters:

| Name | Type | Additional Information |
|------|------|------------------------|
| patientId | Integer | DoseSpot's unique patient identifier |
| pharmacyId | Integer | DoseSpot's unique pharmacy identifier |

Body Parameters: None.

#### RESPONSE INFORMATION
Resource Description:

| Name | Type | Additional Information |
|------|------|------------------------|
| Result | Result | See [4.1.30 Result] |