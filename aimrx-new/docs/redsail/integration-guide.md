# RedSail Pay — Emporos Payments Domain Integrator Guide

> OCR transcription of the 36-page integrator guide (v1.8.0). Source page
> images are in `./pages/p-01.png` … `p-36.png`. OCR is approximate —
> verify code samples and exact values against the page images.


---

## Page 1

4 Redsail Pay

Emporos Payments Domain Integrator

Guide

¥ Version History

Version Date

1.0.0 @November 3, 2025
11.0 @November 3, 2025
1.2.0 @November 3, 2025
1.21 @November 4, 2025
1.2.2 @November 4, 2025
1.3.0 @November 10, 2025
1.4.0 @November 13, 2025
15.0 @November 14, 2025
1.5.1 @November 14, 2025

Emporos Payments Domain Integrator Guide

Author
@Guillermo Chavez
@Guillermo Chavez

@Guillermo Chavez

@Marcos Frank

@Guillermo Chavez
@Guillermo Chavez
@Marcos Frank

@Guillermo Chavez

@Marcos Frank

Changes

Initial Version

Table of content added
Added theme css sample

Changed FTR1 Payments Domains URL for
placeholder

Update Webhooks diagram

Update the list of requirements by tenant
CSV to onboard tenants

Partial Refund Integrated

Fixed Price for ListPrice on items requests
and notification bodies

---

## Page 2

Version Date

1.6.0 @November 20, 2025

1.6.1 @November 25, 2025

1.7.0 @December 22, 2025

1.71 @January 30, 2026
1.7.2 @February 10, 2026
1.8.0 @March 24, 2026

v Overview

Author

@Marcos Frank

@serhii Nalapko

@Jose Baccifava

@Jose Baccifava

@Guillermo Chavez

@Marcos Frank

What is Emporos Payments Domain?

Changes

Ul Customization sections added.
Improvements on OIDC Service, testing
cards changed and integrator theme

SingleUseToken authentication allows
creating Link To Pay without a customer

SinglePaymentTransaction (SPT) on
Pharmacy side, allowing to send 1
transaction without items per request and
accepting only 1 payment.

Itemless transaction allowed. You can do
multiple payments for a transaction without
Items just sending the QHP and Total
amount.

Blind Returns with different CCOF (API Only)

Invalidate links to pay options added.

Emporos Payments Domain is a comprehensive payment processing platform that provides:

¢ )/ Secure Payment Processing - PCl-compliant DSS4 payment gatewaysS integration

« == Card on File (CCOF) - Secure card storage and be able to pay with those stored tokens.

Who Should Use This Guide?

¥ Link to Pay - SMS/Email payment links for remote transactions
@ Device Integration - Support for PIN pads and payment terminals

& White-label Ul - Customizable payment interfaces with your branding

This guide is designed for Multi-Tenant Integrators - software providers who want to integrate
payment processing into their applications:

« Point of Sale (POS) Systems - Pharmacy management, retail

« Pharmacy Management Systems (PMS) - RxMile, PioneerRx, BestRx

« Delivery Applications - Apps requiring remote payment collection

« Healthcare Platforms - Systems needing FSA/HSA support

Key Features

Emporos Payments Domain Integrator Guide

---

## Page 3

Feature Description Use Case

Ready-to-use payment

Hosted Payment Ul .
interface

Quick integration without Ul development

SDK Integration Programmatic APl access Custom payment flows and automation

CCOF Management Card tokenization and storage Processing payments with stored cards, faster

checkout
Link to Pay Remote payment collection Delivery, curbside pickup, patient billing
FSA/HSA Support Healthcare spending accounts Pharmacy and medical transactions
Device Support PIN pad integration EMV compliance, signature capture
Webhook
ebhoo Real-time event callbacks Payment confirmations, card boarding

Notifications

v Business Concepts
v Glossary

Emporos Payments Domain

The complete payment processing platform that handles authorization, capture, tokenization,
and compliance for payment transactions across multiple tenants and locations.

Integrator

Your organization - the software provider that integrates Emporos Payments into their
application (e.g., PioneerRx, RxMile, BestRx). Any application that want to integrate with
Payments Domain.

Tenant

Tenant/Merchant/Company: Each pharmacy that is a customer from the Intergatorand will use
Payments Domain.

« Unique branding/theme
« Multiple Sites (locations)
« Own OIDC authentication
« Custom payment configurations
Site
A physical location where transactions occur. Each Site has:
« Unique payment gateway credentials
« Multiple Stations (registers/lanes)
« Location-specific settings

Example: "Main Street Pharmacy", "Downtown Location Store #1234"

Emporos Payments Domain Integrator Guide

---

## Page 4

Station

An individual register, lane, or workstation within a Site where payments are initiated.

Card on File (CCOF)
Secure tokenization system that allows:
« Customers to save payment methods

« Merchants to charge stored cards

Link to Pay
Payment links that allow customers to pay remotely. Features:
« 3 Authentication Modes:

1. LastNameAndDob - Customer enters last name + date of birth (most common for
POS/PMS)

2. LastNameAndZipCode - Customer enters last name + ZIP code (delivery apps)

3. SingleUseToken - No authentication, one-time use link (invoices, billing)

Transaction

A single sale or payment session containing:
« Line items (products, prescriptions)
« Customer information
« Payment details

« Total amounts (subtotal, tax, total)

Payment Gateway
Third-party processor that handles actual card authorization. Supported gateways:

« GPI (Global Payments Integrated)

Multi-Tenant Hierarchy

Emporos uses a hierarchical tenant structure for flexible configuration:

Emporos Payments Domain Integrator Guide

---

## Page 5

Your Organization
Integrator

L

Y

Pharmacy Chain A

Tenant 1

vy

)

¥

Pharmacy Chain B
Tenant 2

4

Main Street Pharmacy

Downtown Pharmacy

Single Location

Site 1 Site 2 Site 1
S
v
Register 1 Register 2 Register 1 Register 1
Station 1 Station 2 Station 1 Station 1

graph TD

I[Your Organization<br/>Integrator]

I --> T1[Pharmacy Chain A<br/>Tenant 1]
I --> T2[Pharmacy Chain B<br/>Tenant 2]

Tl -->
Tl -->

T2 -->

S1 -->
S1 -->

S2 -->

S3 -->

S1[Main Street Pharmacy<br/>Site 1]
S2[Downtown Pharmacy<br/>Site 2]

S3[Single Location<br/>Site 1]

ST1[Register 1l<br/>Station 1]
ST2[Register 2<br/>Station 2]

ST3[Register l<br/>Station 1]

ST4[Register 1l<br/>Station 1]

style I fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
style T1 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
style T2 fill:#fff3e0,stroke:#f57c00,stroke-width:2px
style S1 fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
style S2 fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

Emporos Payments Domain Integrator Guide

---

## Page 6

style S3 fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
style ST1 fill:#f3e5f5,stroke:#7blfa2,stroke-width:1lpx
style ST2 fill:#f3e5f5,stroke:#7blfa2,stroke-width:1px
style ST3 fill:#f3e5f5,stroke:#7blfa2,stroke-width:1px
style ST4 fill:#f3e5f5,stroke:#7blfa2,stroke-width:1lpx

classDef integrator fill:#e3f2fd,stroke:#1976d2
classDef tenant fill:#fff3e0,stroke:#f57c00
classDef site fill:#e8f5e9,stroke:#388e3c
classDef station fill:#f3e5f5,stroke:#7blfa2

Configuration Precedence (highest to lowest):

1. @ station (Purple) - Individual register settings

2. @ site (Green) - Location-wide settings (gateway credentials)
3. @ Tenant (Orange) - Customer-wide settings (branding, theme)
4. @ Integrator (Blue) - Default settings for all your customers

Example: If a Station has a specific setting configured, it overrides Site, Tenant, and Integrator
settings. If not configured at Station level, the system checks Site level, then Tenant, then
Integrator.

v Examples:

BestRx

« (no concept) / Tenant — For the BestRx team will be same as pharmacy
« Pharmacy (NPI is the same of the id) / Site

o Random Fixed Guid

o NPI s 10 digit number (1234567890) )

= We cannot use this because best rx customers sometimes changes the NPI

« Workstation / Station

o Identifier WorkstationName (alphanumeric (Max Length: 100))

o (We need to check what are we gonna use here)

o numeric field (0-16 digits)
e Saved Cards / CCOF
¢ Customers

o LongintasID

« Merchant Accounts

Emporos Payments Domain Integrator Guide

---

## Page 7

o MerchantKey

o Deviceld
o Siteld
« Site
PioneerRx

Integrator: PioneerRx [ BestRx / RxMile / Nimble / Any application that want to integrate
with Payments Domain.

« Tenant/Merchant/Company: Each pharmacy that is PioneerRx customer and will use
Payments Domain.

o Tenantld - Is an identificator that Emporos dictates.

« Site/Location: Every physical location where the PioneerRx customer sells its goods.
o The integrator dictates the Siteld.

« Station/Register: Place where the POS users register transactions.
o The integrator dictates the Stationld but it should be a string (numeric 0-16 digits).

« Till/Cash Drawer: The cash drawer that contains the money for a specific station in a
particular time.

« Bag/Transaction: It's the collection of OTC Items and Prescriptions that a patient wants
to purchase.

« Autopay: Itis a PioneerRx concept that they use when they pay with CCOF.

v Environments

Environment URL Code Status When to Use

Latest features,

active .

FTR1(Feature https://empftrl-payments- Early testing of new

: development

1) dev.emporos.io/ features, development
so expect
failures

. . More stable, . .

PRV (Preview) https://payments-prv.emporos.io . Integration testing, UAT
pre-release

PROD Producti Li "

(Production) https://payments.emporos.io roduction ve Cus_omer

US EAST ready, stable transactions

Emporos Payments Domain Integrator Guide

---

## Page 8

v Technical Design Overview

Workflow to call Payments Domain
There are certain scenarios that are asynchronous to our integrators, so we designed a system to
notify them.

This system uses a queue system and sends notifications to the integrator webhook with
guarantee delivery. Retries are enabled and performed when the endpoint returns us a non-
successful response.

Integrator Integrator OIDC Service Service Bus Payments Domain Gateway

CreateToken
Token

Init Payments (Payload + Token)

Return payment link

applies to Pharmacy Payment
Do Any Action
Process Action
Result
PR ... W—
alt [Payment successful]
SendEvent(eventName + Payload)
loop [until retries runs out or Result is success]
CreateToken
Token
SendEvent(eventName + Payload)
Result
................................................................................. >
[Payment failed]
Action failed
Integrator Integrator OIDC Service Service Bus Payments Domain Gateway

sequenceDiagram
participant i as Integrator
participant o as Integrator OIDC Service
participant sb as Service Bus
participant pd as Payments Domain

Emporos Payments Domain Integrator Guide

---

## Page 9

participant g as Gateway

i->>0: CreateToken
0-->>i: Token

i->>pd: Init Payments (Payload + Token)
pd-->>i: Return payment link

Note over o,pd: This applies to Pharmacy Payments, Add CCOF & Link to
pay
i->>pd: Do Any Action
pd->>g: Process Action
g-->>pd: Result
alt Payment successful
pd->>sb: SendEvent(eventName + Payload)
loop until retries runs out or Result is success
sb->>0: CreateToken
o0-->>sb: Token
sb->>i: SendEvent(eventName + Payload)
i-->>sb: Result
end
else Payment failed
pd-->>i: Action failed
end

Authentication Flows

Flow 1: Integrator -~ Payments Domain

Emporos Payments Domain Integrator Guide

---

## Page 10

Your Application Your OIDC Server Payments Domain

POST /connect/token
(client_credentials)

\ 4

access_token (Bearer)

POST /api/{tenantld}/sdk/transaction/initialize
Authorization: Bearer {token}

Validate token signature

Token valid + tenant_id

Your Application Your OIDC Server Payments Domain

sequenceDiagram
participant App as Your Application
participant 0IDC as Your 0IDC Server
participant PD as Payments Domain

App->>0IDC: POST /connect/token<br/>(client_credentials)

0IDC-->>App: access_token (Bearer)

App->>PD: POST /api/{tenantId}/sdk/transaction/initialize<br/>Authori
zation: Bearer {token}

PD->>0IDC: Validate token signature

0IDC-->>PD: Token valid + tenant_id

PD-->>App: { urlCode: "ABC123" }

Flow 2: Payments Domain - Integrator (Webhooks)

Emporos Payments Domain Integrator Guide

---

## Page 11

Service Bus Dead Letter Queue 0IDC Server Webhook

When a Message arrives

sendNotification(message)

Payments Domain

POST /connect/token
(client_credentials)

access_token

Set CurrentResponse = 0

loop  [CurrentResponse != 200 || Max Retries Reached]

POST /webhooks/payments
Authorization: Bearer {token)
Body: {eventPayload

rrentRespon:

Ci

Response

alt [CurrentReponse 1= 200]

Save DLQ Message

Message Completed

Service Bus Dead Letter Queue Payments Domain 0IDC Server Webhook

sequenceDiagram

participant
participant
Participant
participant
participant

note over

SB as Service Bus

DLQ as Dead Letter Queue
PD as Payments Domain

0IDC as OIDC Server

WH as Webhook

SB: When a Message arrives

SB->>PD: SendNotification(message)
PD->>0IDC: POST /connect/token<br/>(client_credentials)
0IDC-->>PD: access_token

PD->> PD: Set CurrentResponse = 0
loop CurrentResponse != 200 || Max Retries Reached

PD->>WH: POST /webhooks/payments<br/>Authorization: Bearer {toke
n}<br/>Body: { eventPayload }

end

Emporos Payments Domain Integrator Guide

WH-->>PD: CurrentResponse

---

## Page 12

PD-->>SB: CurrentResponse
alt CurrentReponse != 200
SB ->>DLQ: Save DLQ Message
else
SB ->>SB: Message Completed
end

v What Emporos will provide to you

1. SDK & Development Tools

NuGet Package

Package Name: ctiporos.Payments. Sdk

Package Source: https://pkgs.dev.azure.com/emporos/Emporos/_packaging/Emporos-

Nuget/nuget/v3/index.json

Target Frameworks: .NET 8.0, .NET Standard 2.0+

Sample POS Application

A complete reference implementation demonstrating:

2.

SDK initialization and configuration

All payment flows (CCOF, Link to Pay, Manual Entry)
Customer management

Transaction handling

Error handling patterns

Testing Resources

Test Card Numbers

Card Brand Card Number CVvVv Exp Date

Visa 4012000033330026 123 Any future
MasterCard 5121212121212124 123 Any future
Discover 6510000000000810 123 Any future
Amex 3760000000000002 1234 Any future

Emporos Payments Domain Integrator Guide

12

---

## Page 13

Card Brand Card Number [&TAY) Exp Date

FSA Debit 4005100001234504 123 Any future

For more test cards or specific scenarios for test triggers like authorize or decline based on a
combination of amount and card number, visit Developer Portal | Global Payments Integrated

Emporos provides a test environment URLs.

3. Hosted Payment Ul

White-label Features
« Custom Branding implemented

« Sample theme css to be filled with your banding colors

Ul Capabilities
e Manual card entry
« Split payments
« Card on File selection

« Save card for future use

v What do you need to provide to Emporos?

Per Integrator (One-Time Setup)

Property Description Example Comment

"PioneerRx", "RxMile",

Integrator Name Your organization's name
g 9 “BestRx"

String

PNG/JPEG, 200x60px
Your branding for recommended. It can be a URL
Default Logo pharmacy-side Ul Company logo where the logo is hosted. We
need to add your URL as
trusted source.

Css Theme code
Theme CSS completed with your see Theme css below
branding colors

Theme css
/* * HiloTheme.css * Centralized theme variables for Hilo Style views and
components */

:root
/* Primary Brand Colors */

Emporos Payments Domain Integrator Guide

13

---

## Page 14

--primary-pd: rgba(16, 111, 229, 1);
--primary-hover: rgba(23, 78, 171, 1);
--primary-dark: rgba(22, 77, 171, 1);
--primary-background-hover: rgba(16, 111, 229, 0.2);
/* Additional Brand Colors */

--brand-secondary: #2e49aa;

--background-color-inverse: #ffffff;

/* Font colors */

--font-color: rgba(@, 0, 0, 1);

--font-color-grayed-out: rgha(@, 6, 6, 0.5);

--font-color-inverse: #ffffff;

/* Panel and popup backgrounds */

--main-panel-background: #ffffff;

/* Input & Borders */

--input-border-default: rgba(204, 204, 204, 1)

--input-border-light: #dee2e6;

--hilo-button-border: #E8E7F6 1px solid;
--hilo-button-radius: 100px;

/* Backgrounds */

--card-background-light: #FFFFFF;
--overlay-background: #F6FAFE;
--hilo-button-background: #FFFFFF;
--customer-card-background: #FFFFFF;
--payments-card-background: #FFFFFF;

/* Gradients */

--brand-gradient-start: var(--primary-pd, rgba(16, 111, 229, 1));

--brand-gradient-end: var(--info, rgba(193, 133, 254, 1));

--gradient-primary-info: linear-gradient(145deg, var(--brand-gradient

-start) 0%, var(--brand-gradient-end) 100%);

--bs-body-bg: #FFFFFF;

--main-panel-background: #FFFFFF;

--patient-pay-start: #2A4AA2;

--patient-pay-end: #OE2E7A;

--patient-pay-gradient: linear-gradient(145deg, var(--patient-pay-sta
rt) 0%, var(--patient-pay-end) 100%) ;
}

Per Tenant (Each end customer - group of pharmacies)

Property Description Example Comment
Patient-Facing Logo Customer's Tenant's logo
branding for

Emporos Payments Domain Integrator Guide 14

---

## Page 15

Property

Tenantld

Webhook URL

OIDC Configuration

OIDC URL

OIDC Token URL
(Optional)

OIDC Clientld (Optional)

OIDC ClientSecret

(Optional)

OIDC TenantldClaimType
(Optional)

Emporos Payments Domain Integrator Guide

Description

payment Ul
when the
patient will pay
on their device.
If not present,
we will show
the Site Name.
It has to be a
PNG/JPEG or a
URL where the
logo is hosted.

Identificator for
the tenant. It
must be a
GUID.

Endpoint for
event
notifications
(optional)

URL where
your OIDC is
hosted. It
should have the
well-known file
as per
standard.

OIDC endpoints
that allow us to
generate
tokens on your
behalf

OIDC Client Id
to be able to
issue tokens

OIDC Secret to
be able to issue
tokens

OIDC claim
type where you
will send the
Tenantld.

DEFAULT:
tenant_id

Example

8d03e72c-1451-4c75-8bad-14a0c45895e5

https://api.yourapp.com/webhooks/payments

https://emplts2-id-dev.emporos.io/emporos/

https://emplts2-id-
dev.emporos.io/emporos/connect/token

SecretClientld

Secret-PasswOrd

client_tenant_id

Comment

HTTPS URL

.well-known
folder MUST be
in that level

in case
“tenant_id" is
already used in
your platfomr

15

---

## Page 16

my-prefix:8d03e72c-1451-4c75-8bad-

Property Description Example

oIbC Prefix in the
Ten’:}_ntIdCIalmVaIuePreflx value in case 1420c4589565
(Optional) you have any.

Per Site (Each location)

Property Description

Site Name Display name

site Add Full detail Address (Main Street, Town, City,
e ress Zip Code, State, Timezone in IANA ID

Information

Format)
Site Contact info Phone 1, Phone 2

Gateway Payment processor credentials. In testing

Credentials environments Emporos will set them for you.

OIDC Service Configuration

Your OIDC service must support:

Required Capabilities
. OAuth 2.0 Client Credentials grant type

Sample Claims in JWT

"aud": ["payments-domain"

Comment

my-prefix is the
value that we
will remove to
do our
validation

Example
"Dad’s Pharmacy"

200 My favourite Street,
PharmacyTown, Pharmacyland,
Wyomying, 12345, WY

(888) 888 - 8888

Production values for: GPI Merchant ID,
Terminal ID, Username, Password

"tenant_id": "e3b79flc-e298-49d7-8271-5clbec6dca70"

"exp": 1698876543

"iss": "https://your-oidc-server.com"
Claim Required Description
Audience (must contain "payments-
aud % Yes ( pay

domain")
tenant_id Yes
request

On Boarding Documents

Emporos Payments Domain Integrator Guide

Example

"payments-domain"

Must be the Tenantld for the particular

16

---

## Page 17

Here you have the CSV files that you need to send us whenever you need to create/update/delete
a record on our side.

Tenant-Onboarding-empty.csv

Tenant-Onboarding-with-example.csv

v Integration Types

Option 1: SDK Integration
Best For: Custom payment flows, .NET applications and PREFERRED option

What you get from the SDK Integration
Strongly-typed C# models

Built-in error handling

Async/await patterns

NuGet package updates

When to Use
« You're building a .NET application

« You prefer working with C# objects

Option 2: HTTP API Integration

Best For: Non-.NET platforms, microservices, any HTTP client

What you get from the API Integration
Platform-agnostic (any language)

No SDK dependency

Direct HTTP control

Works with any HTTP client

When to Use
« You're using Node.js, Python, Java, etc.
« You want platform independence

* You prefer REST API calls

Emporos Payments Domain Integrator Guide

---

## Page 18

« You're building microservices

API Documentation
Full HTTP API reference available at:

TBP Later (Not Avaliable Yet)

v SDK Integration

Requirements

Minimum Requirements
« .NET Version: .NET 8.0, .NET 6.0, or .NET Standard 2.0+
e TLS: 1.2 or higher
o HTTP Client: Support for async/await patterns

« JSON: System.Text.Json or Newtonsoft.Json

Recommended Environment
« Framework: .NET 8.0
« IDE: Visual Studio 2022 or VS Code

« Package Manager: NuGet

Installation

Step 1: Add NuGet Source

Add the Emporos NuGet feed to your nuget.config :

<?xml version="1.0" encoding="utf-8"7?>
configuration
packageSources
add key="Emporos-Nuget" value="https://pkgs.dev.azure.com/emporos/
Emporos/_packaging/Emporos-Nuget/nuget/v3/index. json
packageSources
configuration

Step 2: Install SDK Package

dotnet add package Emporos.Payments.Sdk

Emporos Payments Domain Integrator Guide 18

---

## Page 19

Or via Package Manager Console:
Install-Package Emporos.Payments.Sdk

v Initialization

Method 1: CreateAdapterWithTokenHandler

Automatic token refresh - SDK handles everything

using Emporos.Payments.Sdk.Api.Adapters;
using Emporos.Payments.Sdk.Api.Configuration.Models;

var adapter = PaymentsAdapter.CreateAdapterWithTokenHandler (
new PaymentsSdkConfiguration

{
TenantId = "YOUR_TENANT_ID",
SiteId = "YOUR_SITE_ID",
StationId = "YOUR_STATION_ID",
PaymentsDomainApiUri = "{{Payments Domain URL}}",
ClientId = "your-client-id",
ClientSecret = "your-client-secret",
TokenUrl = "{{YourIdentityOIDCurl}}/connect/token"
}

)5

// Test connection
var pingResponse = await adapter.PingPaymentsDomainApiAsync();
if (pingResponse.Success)
{
Console.WriteLine($"[ Connected! Server time: {pingResponse.Dat
al");
}

Method 2: CreateAdapter

You handle token refresh

var adapter = PaymentsAdapter.CreateAdapter(
new PaymentsSdkConfiguration
{
TenantId = "YOUR_TENANT_ID",
SiteId = "YOUR_SITE_ID",
StationId = "YOUR_STATION_ID",
PaymentsDomainApiUri = "{{Payments Domain URL}}"

Emporos Payments Domain Integrator Guide

19

---

## Page 20

)5

// You must set token manually
var token = await GetTokenFromYourOidcAsync();
adapter.SetAuthorizationToken(token);

// Refresh token when expired
adapter.SetAuthorizationToken(await RefreshTokenAsync());

Configuration from appsettings.json

"EmporosPaymentsSdk" :
"TenantId": "YOUR_TENANT_ID"
"SiteId": "YOUR _SITE_ID"
"StationId": "YOUR_STATION_ID"
"PaymentsDomainApiUri": "{{Payments Domain URL}}"
"TokenUrl": "https://{{Identity Service}}/connect/token"
"ClientId": "your-client-id"
"ClientSecret": "your-client-secret"

// Load from configuration

var configuration = builder.Configuration
.GetSection("EmporosPaymentsSdk")
.Get<PaymentsSdkConfiguration>();

var adapter = PaymentsAdapter.CreateAdapterWithTokenHandler (configur

ation);

Business Scenarios
¥ Pharmacy Side - Collect Payments on behalf of a patient (WITH UI)

Use Case: Customer pays at pharmacy register with hosted Ul
using Emporos.Payments.Sdk.Models;
using Emporos.Payments.Sdk.Models.Requests;

using Emporos.Payments.Sdk.Enums;

// 1. Build transaction

Emporos Payments Domain Integrator Guide

---

## Page 21

var transaction = new Transaction

{
TransactionId = Guid.NewGuid().ToString(),
SiteId = "YOUR_SITE_ID",
StationId = "YOUR_STATION_ID",
TotalSale = 45.99m,
SubTotal = 42.00m,
TotalTax = 3.99m,
Customer = new Customer
{
CustomerId = "CUST_123",
FirstName = "John",
LastName = "Doe",
Dob = new DateTime (1985, 6, 15)
1,
Items = new List<TransactionItem>
{
new TransactionItem
{
TransactionItemId = Guid.NewGuid().ToString(),
Description = "Lisinopril 16mg",
Rx = "RX12345",
ListPrice = 25.00m,
Quantity = 1,
Extension = 25.00m,
ItemTypeld = ItemType.Prescription,
QhpIndicator = true
},
new TransactionItem
{
TransactionItemId = Guid.NewGuid().ToString(),
Description = "Vitamin D3",
ListPrice = 17.60m,
Quantity = 1,
Extension = 17.00m,
ItemTypeld = ItemType.Product,
QhpIndicator = true
}
}
};

// 2. Initialize payment session
var request = new InitializeTransactionRequest

{

Emporos Payments Domain Integrator Guide

21

---

## Page 22

Transaction = transaction,
TenantId "YOUR_TENANT_ID",
SiteId = "YOUR_SITE_ID"

18

var response await adapter.InitializeTransactionAsync(request);

if (response.Success)
{
// 3. Open payment URL in browser
var paymentUrl = $"https://{Payments Domain URL}/{YOUR_TENANT_I
D}/pay/{response.Data.UrlCode}";
System.Diagnostics.Process.Start(new ProcessStartInfo

{
FileName = paymentUrl,
UseShellExecute = true

1);

// 4. Customer completes payment in hosted UI

// 5. You receive webhook events (payment.success, link_to_pay.f
ully_paid)
}

Items list:
« Transaction with Items:

o A transaction can be created with items. The list of items will be requiring the
following information:

= Transactionltemld
= Description
= Quantity > 0
= [temTypeld
o If temType.Prescription — Rx required
= Sum of all ltems Extension = transaction SubTotal
« Transaction without Items - Itemless transaction:

o [tems list can be empty, and no validation will run against that list. You can do
multiple payments for a transaction without Items just sending the QHP and Total
amount.

o Sections that contains items won't be shown

Emporos Payments Domain Integrator Guide 22

---

## Page 23

v Link to Pay - eCommerce scenario - Patient paying for his goods (WITH
ul)

Link To Pay feature provides three ways to authenticate the patient using the following data:

« LastName & Dob: Used mostly by POS and PMS as they will have that data. For
example: PioneerRx & RxLocal

« LastName & ZipCode: Used by delivery applications because they will have the
ZipCode. For Example: RxMile

« SingleUseToken: Used for applications that only wants to collect payments and don't
want extra features.

o /A A This won't support payment confirmation screen or any feature after that.

Both “LastName & Dob" and “LastName & ZipCode" authentication types require an existing
customer to be attached to the transaction.

In contrast, the "SingleUseToken" authentication type can also be used without a customer
attached to the transaction.

Use Case: Customer pays remotely (delivery, curbside pickup)

var transaction = new Transaction

{
TransactionId = Guid.NewGuid().ToString(),
SiteId = "YOUR_SITE_ID",

StationId = "YOUR_STATION_ID",

TotalSale = 89.99m,

SubTotal = 82.50m,

TotalTax = 7.49m,

Customer = new Customer

{
CustomerId = "123456789", //This can be alphanumeric
FirstName = "Michael",
LastName = "Chen",

Dob = new DateTime(1975, 11, 8),
ZipCode = "90210",
Phones = new List<CustomerPhone>

{
new CustomerPhone
{
Number = "5551234567",
IsPrimary = true
}
}

Emporos Payments Domain Integrator Guide

23

---

## Page 24

Items = new List<TransactionItem>

{
new TransactionItem
{
TransactionItemId = Guid.NewGuid().ToString(),
Description = "Prescription #67890",
Rx = "67890",
ListPrice = 82.50m,
Quantity = 1,
Extension = 82.50m,
ItemTypeld = ItemType.Prescription,
QhpIndicator = true
}
},
FeatureFlags = new FeatureFlagsRequest
{
LinkToPayAuthenticationMode = LinkToPayAuthenticationMode.
stNameAndDob
}
g
var request = new CreatelLinkToPayRequest
{
Transaction = transaction
};

var response = await adapter.CreateLinkToPayAsync(request);

if (response.Success)

{
var linkCode = response.Data.LinkToPayCode;
var customerId = transaction.Customer.CustomerId;
var transactionId = transaction.Transactionld;
var siteld = transaction.Siteld;

//Url to be opened by any browser

var paymentUrl = response.Data.LinkToPayUrl;

v Cancel Link To Pay
You have 2 ways to invalidate a link to pay.

e Cancel Link To Pay (When the patient hasn't paid the transaction)

Emporos Payments Domain Integrator Guide

La

24

---

## Page 25

var response = await _adapter.CancellLinkToPayAsync(LinkToPayCode);

« Finalize Link to Pay (When the patient has partially paid for a transaction and wants
to finalize the transaction at the pharmacy)

var request = new FinalizelinkToPayRequest
{
TenantId = SelectedTenant.TenantId,
LinkToPayCode = LinkToPayCode
3

var response = await _adapter!.FinalizelLinkToPayAsync(request);

v Board a Card (WITH Ul)

Use Case: Customer adds a payment method to their account

var request = new InitializelIntegrationCcofManagementRequest

{
TenantId = "YOUR_TENANT_ID",
SiteId = "YOUR_SITE_ID",
Customer = new Customer
{
CustomerId = "CUST_123",
FirstName = "Sarah",
LastName = "Johnson",
Dob = new DateTime (1988, 5, 20)
}
s

var response = await adapter.InitializeCcofManagementAsync(request);

if (response.Success)
{
var ccofUrl = $"https://{Payments Domain}/{YOUR_TENANT_ID}/ccof/
{response.Data.UrlCode}";
System.Diagnostics.Process.Start(new ProcessStartInfo
{
FileName = ccofUrl,
UseShellExecute = true
1);

// Customer adds cards in browser

Emporos Payments Domain Integrator Guide

25

---

## Page 26

// You receive card.boarded webhook events

}
v CCOF Payment (API Only / NO Ul)

Use Case: Fast checkout with previously saved card

// 1. Get customer's saved cards
var customerResponse = await adapter.GetCustomerAsync("CUST_123");

if (!customerResponse.Success || !customerResponse.Data.Customer.Cre
ditCards.Any())
{

Console.WriteLine("Customer has no saved cards");

return;

// 2. Select card (e.g., primary card)

var card = customerResponse.Data.Customer.CreditCards
.FirstOrDefault(c => c.IsPrimary)
?? customerResponse.Data.Customer.CreditCards.First();

// 3. Process payment

var ccofRequest = new CcofSaleRequest

{
TenantId = "YOUR_TENANT_ID",
SiteId = "YOUR_SITE_ID",
StationId = "YOUR_STATION_ID",
CustomerId = "CUST_123",
CcofId = card.PaymentInformationId.ToString(),
VaultToken = card.Token,
ExpirationDate = card.ExpirationString,
ComplianceData = card.ComplianceData,
TotalAmount = 29.99m,
QhpTotalAmount = 29.99m,
TaxAmount = 2,00m,
CustomerCode = "CUST_123",
ClerkId = "CLERK_ 001",
RegisterNumber = "00001", //string numeric only
InvoiceNumber = $"INV{DateTime.Now:yyMMddHHmmss}",
Terminalld = "00001" //string numeric only

};

var paymentResponse = await adapter.CcofSaleAsync(ccofRequest);

Emporos Payments Domain Integrator Guide

---

## Page 27

if (paymentResponse.Success && paymentResponse.Data.IsSuccessful)
{

Console.WriteLine($"[4 Payment approved: ${paymentResponse.Data.
AmountApproved}");

Console.WriteLine($" Auth Code: {paymentResponse.Data.Authoriz
ationCode}");

// s CRITICAL: Update compliance data after EVERY transaction
card.ComplianceData = paymentResponse.Data.CardOnFileComplianceD
ata;
await SaveCardToYourDatabaseAsync(card);
}
else
{
Console.WriteLine($"){ Payment failed: {paymentResponse.Data.Sta
tus}t");
}

v Void Same-Day Payment (APl Only / NO UI)

Use Case: Cancel a payment before batch settlement. In the case that the VOID fails, it will
automatically try to do a Refund.

// 1. Get transaction to find payment
var getTransactionRequest = new GetTransactionRequest

{
TransactionId = "TRANSACTION_ID",
CustomerId = "CUST_123",
TenantId = "YOUR_TENANT_ID"

};

var transactionResponse = await adapter.GetTransactionAsync(getTrans
actionRequest);

if (transactionResponse.Success)

{
// 2. Find active payment to void
var payment = transactionResponse.Data.Payments
.FirstOrDefault(p => p.RecordStatus == "Active");

if (payment != null)
{
// 3. Void the payment
var voidRequest = new VoidAndPersistPaymentRequest

{

Emporos Payments Domain Integrator Guide 27

---

## Page 28

TenantId = "YOUR_TENANT_ID",
SiteId = "YOUR _SITE_ID",
TransactionId = transactionResponse.Data.Transactionld,
PaymentId = payment.TransactionPaymentId,
CustomerId = "CUST_123"
+

var voidResponse = await adapter.VoidAndPersistPaymentAsync
(voidRequest);

if (voidResponse.Success)

{
Console.WriteLine("[% Payment voided successfully");

}
v Refund/Return (APl Only / NO UI)

Use Case: Return funds partial or full during the current of future day after a transaction
complete

var transaction = await adapter.GetTransactionAsync(new GetTransacti
onRequest
{

TenantId = tenantId,

CustomerId = customerld,

TransactionId = transactionId

1)

var payment = transaction.Payments.Single(p => p.TransactionPaymentI
d == transactionPaymentId);
var refundable = payment.Amount - payment.AmountReturned;

if (amount > refundable)
{

throw new InvalidOperationException($"Amount exceeds remaining b
alance {refundable:F2}");

}
var refundRequest = new RefundRequest
{
TenantId = SelectedTenant.TenantId,
SiteId = LastTransaction.Siteld,

StationId = LastTransaction.StationId,

Emporos Payments Domain Integrator Guide 28

---

## Page 29

TransactionId = LastTransaction.TransactionId,
CustomerId = customerld,
TransactionPaymentId = payment.TransactionPaymentId,
RefundAmount = refundAmount,
Terminalld = terminalld,
ClerkId = clerkId,
PaymentIndustryType = PaymentIndustryType.Retail,
CardAndCardholderPresence = CardAndCardholderPresenceEnum.Neit
her,
TaxAmount = 0.00 // Or calculation Tax
};

var refundResponse = await adapter.ReceiptReturnAsync(refundReques
t);

Important Note

Once a refund is executed to a transaction the Void Ul cannot be used for that specific
transaction.

v Blind Refund/Return CCOF

Use Case: Return funds to any specific token card previously onboard

var request = new RefundRequest
{
// Required base fields
TenantId = TenantlId,
Siteld = Siteld,
CustomerId = string.IsNullOrWhiteSpace(CustomerIdInput) ? Guid.
Empty.ToString() : CustomerIdInput,
StationId = StationId,
RegisterNumber = StationId,

// Refund amount
RefundAmount = refundAmount,

// Card token information for blind return
OriginalAccountNumber = Token,
CardExpDate = ExpirationString,

PaymentInputSource = PaymentInputSource.Vault, // « Required

PaymentCardPresence = PaymentCardPresence.NotPresent // « Requi
red,

Emporos Payments Domain Integrator Guide 29

---

## Page 30

TaxAmount = 0

I

Important Notes

« RefundAmount should be a positive number

v Notification Events

Regardless of integration method (SDK or API), Emporos sends real-time notifications via
webhooks.

Overview

Webhooks allow you to receive notifications when important events occur:
. Payments completed
. Transactions fully paid
. Cards added/Updated

Event Types

V¥ payment.success payload

"eventName": "payment.success",
"eventId": "5d3094d9-0739-4ald-aa2a-b847d7fcb370",
"eventDate": "2025-11-14T17:37:25.970929Z"
"eventPayload": {
"transactionId": "ef94dadd-eef7-466c-bbfd-6d1c359dd489",
"siteId": "111111",
"stationId": null,
"customerId": "8ce2571e-a696-44cc-b50c-f5a7cd5a0b09--a769e2d3-
0411-4aa9-a83a-05a71203b8fc",
"payment": {
"referenceNumber": "239600",
"authorizationCode": "0K9999",
"cardBrand": "Visa",
"cardType": "Credit",
"fsaApprovedAmount": 17.41,
"authorizedAmount": 17.41,
"requestedAmount": 17.41,

Emporos Payments Domain Integrator Guide

---

## Page 31

"cardLastFourdDigits": "4504",
"paymentDate": "2025-11-14T17:37:25+00:00"

I
"tepantId": "11111111-1111-1111-1111-111111111111"

V¥ link_to_pay.fully paid payload

This event is only SENT for click to pay

"eventName": "link_to_pay.fully_paid ",
"eventId": "26f7d449-54a3-480a-b434-c5047c2ebcd4",
"eventDate": "2025-11-14T17:41:33.5578702Z",
"eventPayload": {
"siteId": "111111",
"stationId": "111111",
"transaction": {
"transactionId": "ef94dadd-eef7-466c-bbfd-6d1c359dd489",
"totalSale": 174.12,
"subTotal": 138.77,
"totalTax": 35.35,
"source": null,
"customer": {
"id": "8ce2571e-a696-44cc-b50c-f5a7cd5a0b09--a769e2d3-
0411-4aa9-a83a-05a71203b8fc",
"firstName": "First",
"lastName": "Last",
"dob": "2000-01-01"
b
"payments": [{
"referenceNumber": "239600",
"authorizationCode": "0K9999",
"cardBrand": "Visa",
"cardType": "Credit",
"fsaApprovedAmount": 17.41,
"authorizedAmount": 17.41,
"requestedAmount": 17.41,
"cardLastFourdDigits": "BQCU",
"paymentDate": "2025-11-14T14:37:25-03:00"
oA
"referenceNumber": "318101",

Emporos Payments Domain Integrator Guide 31

---

## Page 32

}
P
"items":
al42eabd",
o q
85be2d8d",
iy o
dde47859",
}
1
}
1,
"tenantId":
}

Emporos Payments Domain Integrator Guide

"authorizationCode": "0K9999",
"cardBrand": "Mastercard",
"cardType": "Credit",
"fsaApprovedAmount": @,
"authorizedAmount": 156.71,
"requestedAmount": 156.71,
"cardLastFourdDigits": "4ASW",

"paymentDate": "2025-11-14T14:41:33-03:00"
[{
"transactionItemId": "54c5cd55-c91a-4c5f-9353-10e3
"description": "FSARX 979742",
"quantity": 1,
"price": 74.27,
"extension": 74.27,

"ghpIndicator": true,
"itemTypeId": 14
"transactionItemId": "6bfd810d-4f9%9a-44e6-9c61-305f
"description": "Surgilube sterile tube 144X5GM",
"quantity": 1,

"price": 30.5,

"extension": 30.5,

"ghpIndicator": false,
"itemTypeId": 9

"transactionItemId": "d072200e-64c8-4f0f-b44b-0183
"description": "Sudafed Congestion",

"quantity": 2,

"price": 17,

"extension": 34,
"ghpIndicator": true,
"itemTypeId": 9

“11111111-1111-1111-1111-111111111111"

32

---

## Page 33

¥ card.boarded payload

We have to add the flag “isFsa” because the integrators needs to save that.

"eventId": "c09b8629-836f-4767-bb64-68dad05al423",
"eventDate": "2025-12-30T22:15:07.175",
"eventName": "card.boarded",
"tenantId": "e3b79flc-e298-49d7-8271-5clbec6dca70",
"eventPayload": {

"member": "John Doe",

"expiration": "08/25",

"isPrimary": true,

"cardBrand": 3,

"lastFourDigits": "1234",

"token": "XXAABBCCDDEEFFXX",

"nickName": "Dad's card",

"complianceData": "Some gateways request this for void/return

V¥ card.updated payload

"eventId": "c09b8629-836f-4767-bb64-68dad05al423",
"eventDate": "2025-12-30T22:15:07.175",
"eventName": "card.updated",
"tenantId": "e3b79flc-e298-49d7-8271-5clbec6dca70",
"eventPayload": {

"member": "John Doe",

"expiration": "08/25",

"isPrimary": true,

"cardBrand": 3,

"lastFourDigits": "1234",

"token": "XXAABBCCDDEEFFXX",

"nickName": "Dad's card",

"complianceData": "Some gateways request this for void/return

¥ card.unboarded payload

Emporos Payments Domain Integrator Guide

---

## Page 34

"eventId": "c09b8629-836f-4767-bb64-68dad05al423",

"eventDate": "2025-12-30T22:15:07.175",
"eventName": "card.unboarded",

"tenantId": "e3b79flc-e298-49d7-8271-5clbec6dca70",

"eventPayload": {
"ccofId": "123"

}

v Ul Customization

Pharmacy Side

We allow to customize your pharmacy side with the theme that was mentioned in this guide
before. With that css file you can configure everything that you can imagine in the screen. In the
case that you need flexibility for a specific HTML tag, please contact our product team and we
can prioritize the addition of a HTML attribute data-custon-styles to add that custom

personalization.

Also we show the Logo that we request from you as the integrator so all your pharmacies sees

your logo.

Best pek

Customer Payment

aa @ a
XXXX - XXXX - XXXX - 0026 XXXX - XXXX - XXXX - 2124

o832 12726 o831

ao

XXXX - XXXX - XXXX

Fist Last.

FsasA ol st

subtotal sse7
salesTax 5335

Totaloue s

Customer Payment

tems -

Lisinopril 30 Mg Table [
FSARX 975742 s1a27
Surgilube sterile tube 144X5GM 3050
Sudafed Congestion (520
Q:20@517.00 $3400

Processed Payments v

Manual OnFile

B oo 28

0026-Exp: 12726

Subtotal
Salls Tax
Total Due

P
-

There are certain scenarios where you want to hide specific parts of the pharmacy side. Usually

when you want to embed our solution in Desktop / Mobile applications.

Emporos Payments Domain Integrator Guide

34

---

## Page 35

In order to achieve this, when initializing a transaction we expose a property in the transaction
called urvisibilityFlags that allows you to toggle the visibility on Header, Title, ItemList & Totals.
This is how a desktop POS embed the pharmacy side with all those flags in false.

Enter Payment =

DertDeacrpton ==

7 a0 Mo S Siz|  Processed Payments.
. Ghook

I —— | i

N —— | et

G card

ER IR R
gy o e ]

Manual Crodt | s o T

$14.19 o e =
. e

© (] [ ¢ m

Back o Sale

3
B

# o T EEED L

Link to Pay

For patient scenarios we go one level more specific so each Tenant (Group of pharmacies or
pharmacy if your are in the independent business) can configure their cotors and togo .

If those are not supplied you can configure:
« Default Color (You can provide this in the theme)

« If the Logo is not provided, we show the Site Name

Emporos Payments Domain Integrator Guide

35

---

## Page 36

Select Payment Type
Items ~
Lisinopril 30 Mg Table
FSARX 979742 $7427
Surgilube sterile tube 144X5GM $3050
Sudafed Congestion
Qty: 20 @ $17.00 $34.00
o= =
Card Card on File
subtotal $138.77
Sales Tax $35.35
Total Due $174.12

RPN2

Hit Please verify the patient's last name
and date of birth

‘Once we verify your date of birth, you can pay for your
available prescriptions.

Last Name *

Date of Birth MM/DD/YYYY *
=

© All paid!

visA

Credit: $174.12
Visa - 4504
11/20/2025, 10:41 AM

Ftr1 Site

@m Main Street, Secondary Street
Our Town, GA 30907

Thank you for your payment!
A receipt for this transaction will be provided by the
pharmacy when you get your order.

If you have any questions, please call us at

o/ (706) 3645888

You can also send us text messages at

®, (706) 364-5999

Emporos Payments Domain Integrator Guide