# DoseSpot RESTful API V2 Authentication Guide V2 Jumpstart
Version 1.2  
February 2025

## Table of Contents
- [Updates](#updates)
- [1. GETTING STARTED](#1-getting-started)
  - [1.1 How to Gain Access to the RESTful API](#11-how-to-gain-access-to-the-restful-api)
  - [1.2 Base URL](#12-base-url)
  - [1.3 Authentication](#13-authentication)
    - [1.3.1 Creating a JWT Access Token](#131-creating-a-jwt-access-token)
    - [1.3.2 Using an Access Token](#132-using-an-access-token)
    - [1.3.3 Rate Limits](#133-rate-limits)
  - [1.4 HTTP Specifics](#14-http-specifics)
  - [1.5 String Properties](#15-string-properties)
    - [1.5.1 General Information](#151-general-information)
    - [1.5.2 Specific Field Requirements](#152-specific-field-requirements)
  - [1.6 Invoking DoseSpot UI](#16-invoking-dosespot-ui)
    - [1.6.1 Parameters](#161-parameters)
    - [1.6.1 Invoking DoseSpot UI](#161-invoking-dosespot-ui-1)
    - [1.6.1 SSO Error](#161-sso-error)
  - [1.7 Additional Resources](#17-additional-resources)

## Updates

### February 2025
1.3.3 Total Token+read+write operations = 2000

### May 2024
Added 1.3.3 Rate Limits

### February 2024
- Removed SupervisorID from acr_values. This is included as a body parameter in relevant POST requests.
- The "O" in OnBehalfOfUserId should be capitalized. This has been updated.
- 1.2 Base URL - Added note about V2 URLs

## 1. GETTING STARTED

### 1.1 How to Gain Access to the RESTful API
You may speak with a DoseSpot Client Integration Specialist in order to grant access from your DoseSpot Staging environment to the RESTful API. This is enabled at the clinic level, so if you need to use multiple Staging clinics be sure to make that clear to your Integration Specialist. If you have not yet received your unique Clinic Id, User Id, and Clinic Key for working in the DoseSpot Staging environment, you will receive those at this time as well.

### 1.2 Base URL
All RESTful API requests must be made using the base URL: https://my.staging.dosespot.com/webapi/v2/. If testing off the Postman collections, use the base URL: https://my.staging.dosespot.com/webapi/.

The endpoints shown for each operation in this guide should be appended to the base URL.

Note: The production base URL is different and will be provided after passing the Surescripts certification in the staging environment.

### 1.3 Authentication
Every RESTful API request in DoseSpot needs to be authenticated. To authenticate, you must create a JWT Access token. All other API operations then require the token to be used as a Bearer in the Request Header.

#### 1.3.1 Creating a JWT Access Token
Perform an HTTP POST to https://my.staging.dosespot.com/webapi/v2/connect/token to create the token.
- A Subscription Key is required in the Header of all API requests: Subscription-Key: {{subscription-Key}}

The body of this request must use the x-www-form-urlencoded content type and the following key-value pairs:

| Key | Value |
|-----|-------|
| grant_type | password |
| client_id | {{clinicId}} |
| client_secret | {{clinicKey}} |
| username | {{UserId}} |
| password | {{clinicKey}} |
| scope | api |
| acr_values | OnBehalfOfUserId={{OnBehalfOfUserId}} |

Note: Use the exact string "password" and "api" without quotation marks. It is case sensitive.

Note: acr_values are optional for prescribing clinicians but required for proxies. SupervisorId can overwrite the supervisorId marked for a clinic in the Admin Console.

If your request was valid, you will receive an access token in the response section. In the Staging environment, tokens are currently set to expire after 10 minutes.

#### 1.3.2 Using an Access Token
In your subsequent API requests, specify the access token as an HTTP Header, such as:
```
Authorization: Bearer {access_token}
```

Note: A token has an indicated expiration date. Once it expires, you will get a 401 HTTP error code. You will have to obtain a new token after expiration to continue sending RESTful API requests.

#### 1.3.3 Rate Limits
DoseSpot has rate limits in place to prevent overloading our systems, which differ from the limits in place in v1 of the API. If these limits are exceeded, clients must wait 10 seconds before attempting another call.

| Request Type | Limit (per 10 seconds) |
|-------------|------------------------|
| Token requests | 2000 |
| Individual read operation (GET) | 1000 |
| Individual write operation (POST, PUT, PATCH, DELETE) | 400 |
| Total read+write operations | 2000 |
| Total token+read+write operations | 2000 |

### 1.4 HTTP Specifics
DoseSpot RESTful API uses four main HTTP methods: GET, POST, PUT, and DELETE. Different HTTP request methods perform different actions when applied to the same URL.

| HTTP Method | Definition |
|------------|------------|
| GET | Retrieves resource information/representation<br>Does not modify the resource in any way |
| POST | Creates a new resource into the collection of resources |
| PUT | Updates/replaces an existing resource |
| DELETE | Deletes an existing resource |
| PATCH | Applies partial updates to an existing resource |

Both JSON and XML formats are supported by the DoseSpot RESTful API.

### 1.5 String Properties

#### 1.5.1 General Information
- All values in string fields must be trimmed of spaces (on the left and right)
- The following special characters are supported: .!"#$%&'()*+,-/:;<=>?@[\]^_`{|}~

#### 1.5.2 Specific Field Requirements
Zip Code:
- 5 digits or 5 digits + 4 digit code extension

State:
- Must be a valid US state two-letter abbreviation or full name

Phone Numbers:
- Must be formatted for the United States with 3 digit area code and then 7 digits
- Must not contain 7 or more repeated numbers
- Extensions are allowed by using an 'x' before them
- Must have a valid area code which is currently in service.
- All area codes are now supported with the exception of '555' and codes that start with '0' or '1'

### 1.6 Invoking DoseSpot UI

#### 1.6.1 Parameters
Before creating an access token, the following parameters are required: ClinicId, ClinicKey, UserId, Encrypted ClinicId, and Encrypted UserId.

Creating the Encrypted ClinicId:
1. You have been provided a ClinicKey in UTF8
2. Create an alpha-numeric random phrase 32 characters long in UTF8
3. Append the ClinicKey to the random phrase (random phrase THEN ClinicKey)
4. Get the Byte value from UTF8 String
5. Use SHA512 to hash the byte value you received in step 4
6. Get a Base64String out of the hash that you created
   a. If there are two '=' signs at the end, remove them.
7. Prepend the same random phrase from step 2 to your code from step 6 (random phrase THEN Step 6 result)
8. If the encrypted ClinicId is going to be passed in a query string, make sure to UrlEncode the entire code

Creating the Encrypted UserId:
1. Take the first 22 characters of the phrase from step 2 of 'Creating the Encrypted ClinicId'
2. Append the 22 character phrase to the UserId string (UserId THEN random phrase)
3. Append the ClinicKey to the string (Step 2 THEN ClinicKey)
4. Get the Byte value of the string
5. Use SHA512 to hash the byte value you received in step 4
6. Get a Base64String out of the hash that you created
   a. If there are two '=' signs at the end, remove them.
7. If the encrypted UserId is going to be passed in a query string, make sure to UrlEncode the entire code

#### 1.6.1 Invoking DoseSpot UI
To invoke the DoseSpot UI, the Single Sign On values (as calculated above) must be passed into the URL: https://my.staging.dosespot.com/LoginSingleSignOn.aspx.

The following items can be appended to the SSO URL: EncouterId; OnBehalfOfUserId; SingleSignOneSupervisorId. Do not pass any patient or prescription information though the SSO. Use APIs for that instead.

**REQUEST INFORMATION**  
Query Parameters:

| Name | Type |
|------|------|
| PatientID | Integer |
| RefillsErrors | Value must be 1. If this paremeter is set, PatientID is not required and vice versa. This instructs the DoseSpot UI to redirect to the clinician's notification summary page rather than a patient-specific page. |

Sample Query String:
```
http://my.staging.dosespot.com/LoginSingleSignOn.aspx?SingleSignOnClinicId={ClinicId}&SingleSignOnUserId={ClinicianId}&PatientId={PatientId}&OnBehalfOfUserId={ClinicianId}&EncounterID={EncounterID}&SingleSignOnSupervisorId={SupervisorId}&SingleSignOnPhraseLength=32&SingleSignOnCode=5rSMknTiyWIkhWiioYtbdKYazXhHTO5opcrll13La%2BXa7DyF04f3lhAaYf4NPNoObMwJGtoOo87M7iZYxpDDfzaQZseQ8evhN%2BkxtrbpX6tteX7am8Hexw&SingleSignOnUserIdVerify=l4VlPE4xuij6BNCZKlj%2F6ZYBlDtiRuAHCLgis9vgJJvwTkkI0BC0Q%2FsI2cXI2kbRdWITp6vQc7wAzJKxEDpg%2FA
```

```
http://my.staging.dosespot.com/LoginSingleSignOn.aspx?SingleSignOnClinicId={ClinicId}&SingleSignOnUserId={ClinicianId}&SingleSignOnPhraseLength=32&SingleSignOnCode=5rSMknTiyWIkhWiioYtbdKYazXhHTO5opcrll13La%2BXa7DyF04f3lhAaYf4NPNoObMwJGtoOo87M7iZYxpDDfzaQZseQ8evhN%2BkxtrbpX6tteX7am8Hexw&SingleSignOnUserIdVerify=l4VlPE4xuij6BNCZKlj%2F6ZYBlDtiRuAHCLgis9vgJJvwTkkI0BC0Q%2FsI2cXI2kbRdWITp6vQc7wAzJKxEDpg%2FA&RefillsErrors=1
```

Note: This is done by using an iframe, browser control, etc., and setting the endpoint to the full URL (URL encoded). Additional details based on your technology stack can be provided upon request.

**RESPONSE INFORMATION**  
If PatientID is specified:
1. Opens the DoseSpot UI to the patient page

If the refills errors request is specified:
1. The request is redirected to the clinician's notification summary page for the single clinic they used in the SSO parameters

#### 1.6.1 SSO Error
If there is an error invoking the DoseSpot UI, DoseSpot will open an error message page giving information about what occurred.

| Error Name | Error Type |
|------------|------------|
| Clinician is not active | The clinician is currently marked Inactive in DoseSpot |
| Clinician has not been confirmed | The clinician has not been confirmed |
| Clinician is locked out | The clinician Account is currently locked |
| Clinician does not have access to clinic | The clinician is not tied to the clinicID entered |
| Incorrect SSO calculations | The encrypted IDs were not formatted correctly |
| Clinician does not have access to the patient | If coming in with patientID, the patientID is not connected to the clinician |
| Data validation errors | If coming in with patient demographic information, one or more fields is invalid |

### 1.7 Additional Resources
For additional help, refer to the DoseSpot ASP.NET Web API Help Page:
https://my.staging.dosespot.com/webapi/v2/swagger/ui/index#/