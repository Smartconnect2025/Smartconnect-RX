# RX PORTAL PRO - CLIENT PRESENTATION

---

## 🏥 PLATFORM OVERVIEW

**Complete Healthcare Management Solution**

- **Multi-role platform**: Supports Providers, Patients, and Admins with dedicated interfaces. Each role has secure access to only their relevant features and data, ensuring privacy and workflow efficiency.

- **Real-time prescription processing**: Prescriptions are created by providers and instantly submitted to DigitalRx pharmacy for fulfillment. The entire process from creation to delivery is tracked in real-time with status updates.

- **Integrated payments**: Secure payment processing through Authorize.Net allows providers to either charge cards directly or send payment links to patients. All transactions are PCI-compliant with automatic webhook confirmations.

- **Telehealth video consultations**: Built-in HD video calling powered by CometChat enables HIPAA-compliant virtual appointments. Providers can consult with patients remotely without leaving the platform.

- **Mobile-responsive design**: The entire platform adapts seamlessly to any device - desktop, tablet, or mobile. Healthcare professionals and patients can access features on-the-go.

- **HIPAA-compliant and secure**: All patient data is encrypted and stored securely in Supabase with row-level security. Audit logs track every data access and modification for compliance.

---

## 👨‍💼 ADMIN DASHBOARD

### **Main Dashboard**

**Real-time platform metrics and KPIs**: The dashboard displays live statistics including total prescriptions created, total revenue generated, active users, and recent transactions. Admins can monitor platform health at a glance.

**Total prescriptions, revenue, active users**: Key performance indicators are prominently displayed with trend graphs showing growth over time. Compare current period to previous periods to track platform adoption and revenue growth.

**Recent activity feed**: A live stream of platform events shows recent prescription submissions, payment confirmations, new user registrations, and system alerts. This provides visibility into real-time platform usage.

**Quick access to all admin functions**: Dashboard includes shortcut buttons to commonly-used admin features like inviting providers, managing pharmacies, viewing API logs, and configuring settings. Reduces navigation time.

**System health monitoring**: Visual indicators show the status of all integrations (DigitalRx, Authorize.Net, CometChat, SendGrid). Admins are immediately alerted to any connection issues or API failures.

### **Provider Management Page**

#### **Invite New Providers**

**Email invitation system**: Admins can send email invitations to healthcare professionals to join the platform. The invitation includes a secure signup link that pre-fills provider information and guides them through account creation.

**Set provider credentials**: During invitation, admins can pre-configure provider details including NPI number, medical license numbers and states, specialties, and professional qualifications. This ensures complete provider profiles from day one.

**Assign tier levels (Tier 1-4)**: Each provider is assigned to a pricing tier that determines their discount rate on prescriptions. Tier 1 receives the highest discounts, Tier 4 receives standard rates, allowing flexible pricing for different provider relationships.

**Configure discount rates per tier**: Admins set the percentage discount each tier receives on medication costs. These discounts are automatically applied when providers create prescriptions, ensuring accurate pricing without manual calculations.

**Add company name for branding**: Providers can represent their practice or clinic by adding a company name that displays in their dashboard header. This is especially useful for group practices or healthcare organizations.

#### **Provider List & Management**

**View all registered providers**: A comprehensive table lists every provider on the platform with their name, email, tier level, join date, and activity status. Admins can search and filter to quickly find specific providers.

**Edit provider information**: Click any provider to update their professional credentials, contact information, tier assignment, or active status. Changes are saved immediately and reflected throughout the platform.

**Assign/update tier levels**: Admins can change a provider's tier at any time, which automatically adjusts the discount rates on all future prescriptions. Historical prescriptions maintain their original pricing.

**Monitor provider activity**: Track how many prescriptions each provider has created, their total revenue contribution, and last activity date. Identify your most active providers and those who may need engagement.

**Deactivate/reactivate accounts**: Temporarily disable provider accounts without deleting their data. Deactivated providers cannot log in or create prescriptions, but their historical data remains intact for reactivation.

**Track provider performance metrics**: View detailed analytics per provider including prescription volume, average prescription value, patient count, and revenue generated. Use this data for commission calculations and performance reviews.

#### **Tier-Based Pricing System**

**Tier 1: Highest discount rate**: Reserved for high-volume providers or strategic partnerships. These providers receive the maximum discount on medication costs, making prescriptions most affordable for their patients.

**Tier 2: Medium-high discount**: For established providers with consistent prescription volume. Offers competitive pricing while maintaining healthy margins for the platform.

**Tier 3: Medium discount**: Standard tier for most providers. Provides fair pricing that balances provider satisfaction with platform profitability.

**Tier 4: Standard discount**: Entry-level tier for new providers or those with lower volume. As providers grow their prescription volume, admins can promote them to higher tiers.

**Automated commission calculations**: The system automatically calculates provider earnings based on their tier discount rate and prescription volume. No manual spreadsheets or calculations required.

**Revenue tracking per provider**: View each provider's contribution to platform revenue with detailed breakdowns by time period. Export reports for accounting and commission payment processing.

### **Pharmacy Management Page**

#### **Pharmacy Integration Settings**

**DigitalRx API configuration**: Enter your DigitalRx API credentials (API key, endpoint URL) to enable automatic prescription submission. The platform securely stores credentials and uses them for all pharmacy communications.

**Pharmacy credentials management**: Manage API keys, authentication tokens, and endpoint configurations for pharmacy integrations. Update credentials when they expire without disrupting active prescriptions.

**API endpoint configuration**: Configure the exact API endpoints for prescription submission, status checking, and order tracking. Support for multiple pharmacy integrations if your platform expands beyond DigitalRx.

**Test connection functionality**: Before going live, test your pharmacy API connection with sample data. The test validates credentials, checks endpoint accessibility, and confirms proper response handling to prevent errors.

#### **Pharmacy Catalog Management**

**1000+ medications in database**: The platform comes pre-loaded with over 1000 commonly prescribed medications spanning all major categories. Medications include brand names, generic equivalents, and multiple dosage forms.

**Add/edit/remove medications**: Admins can add new medications to the catalog, update existing medication information, or remove discontinued drugs. All changes are immediately available to providers when creating prescriptions.

**Set pricing (AIM price, pharmacy price, patient price)**: For each medication, configure three price points: AIM RX cost (what you pay), pharmacy retail price (reference), and patient price (what patients pay). Tier discounts apply to patient pricing.

**Configure dosage forms and strengths**: Each medication can have multiple forms (tablets, capsules, liquid, injection, cream) and strengths (10mg, 25mg, 50mg, etc.). Providers select the exact form and strength when prescribing.

**Category management**: Organize medications into clinical categories (Antibiotics, Pain Management, Cardiovascular, Diabetes, Mental Health, etc.). This helps providers quickly filter and find medications during prescription creation.

**Bulk import/export capabilities**: Upload CSV files to add hundreds of medications at once, or export the entire catalog for backup and offline editing. Supports bulk price updates and category assignments.

#### **Medication Database**

**Medication name and generic name**: Each medication entry includes both the brand name (e.g., "Lipitor") and generic name (e.g., "Atorvastatin"). Providers can search by either name when prescribing.

**Category classification**: Every medication is tagged with its therapeutic category, making it easy to browse related drugs. Categories align with common medical specialties and conditions.

**Available dosage forms**: Medications list all available forms such as tablets, capsules, liquid suspension, injection, topical cream, inhaler, or suppository. Providers choose the most appropriate form for each patient.

**Strength options**: Each dosage form can have multiple strengths (e.g., 10mg, 20mg, 40mg tablets). Providers select the correct strength based on their clinical judgment and dosing requirements.

**Pricing tiers**: View how each medication is priced across different provider tiers. Ensures pricing consistency and helps admins optimize margins while staying competitive.

**Stock status tracking**: Monitor medication availability and stock levels. While fulfillment is handled by DigitalRx, this helps admins communicate supply issues to providers before prescriptions are created.

#### **Order Fulfillment Tracking**

**Real-time prescription status**: Track every prescription from submission to delivery. The admin dashboard shows which prescriptions are pending, in progress at the pharmacy, shipped, or delivered.

**Queue ID tracking from DigitalRx**: When a prescription is submitted, DigitalRx returns a unique Queue ID. This ID links the platform prescription to the pharmacy's order management system for end-to-end tracking.

**Delivery status updates**: As DigitalRx updates order status, the platform automatically reflects changes. Admins can see exactly where each prescription is in the fulfillment pipeline.

**Failed order management**: If a prescription submission fails due to API errors, invalid data, or pharmacy rejection, admins are alerted immediately. The failed order dashboard shows error details for troubleshooting.

**Retry failed submissions**: For prescriptions that failed to submit, admins can review the error, correct any data issues, and manually retry the submission to DigitalRx without requiring the provider to recreate the prescription.

### **Prescription Management (Admin View)**

#### **All Prescriptions Dashboard**

**Complete list of platform prescriptions**: Every prescription created on the platform is listed here, regardless of provider or patient. Admins have full visibility into all prescription activity for oversight and support.

**Filter by status**: Quickly segment prescriptions by their current state - Pending Payment, Submitted, In Progress, Shipped, or Delivered. This helps admins identify prescriptions that need attention or intervention.

**Search by patient, provider, medication**: Find specific prescriptions instantly by typing a patient name, provider name, or medication name. Search works across all prescription data for fast retrieval.

**Date range filtering**: View prescriptions created within a specific time period - today, this week, this month, or custom date ranges. Useful for generating reports and analyzing trends.

**Export to CSV/PDF**: Download prescription data for external analysis, reporting to stakeholders, or record-keeping. Exports include all prescription details, payment status, and fulfillment information.

#### **Prescription Details View**

**Patient information**: View complete patient details including name, date of birth, contact information, address, and insurance details. This helps admins verify prescription accuracy and assist with delivery issues.

**Provider information**: See which provider created the prescription, their tier level, contact information, and professional credentials. Useful for tracing prescription sources and provider performance.

**Medication details and dosage**: Full prescription details including medication name, dosage form (tablets, liquid, etc.), strength, quantity prescribed, and patient instructions (Sig). Ensures accuracy and helps resolve patient questions.

**Payment status**: Shows whether the prescription is paid, pending payment, or has payment failed. Includes transaction ID from Authorize.Net, payment method used, amount charged, and timestamp of payment.

**Pharmacy submission status**: Indicates if the prescription has been sent to DigitalRx, is awaiting payment, or failed to submit. Shows Queue ID received from pharmacy and any error messages from failed submissions.

**Queue ID from DigitalRx**: The unique identifier assigned by the pharmacy for tracking this order through their fulfillment system. This ID links platform data to pharmacy records for coordinated tracking.

**Timeline of status changes**: A chronological history showing every status change from prescription creation through delivery. Each event is timestamped, helping admins diagnose delays or issues.

**Delivery tracking**: Once shipped, view tracking number and carrier information. Some integrations allow real-time package tracking within the platform, giving admins and patients delivery visibility.

#### **Payment Tracking**

**Payment status per prescription**: At a glance, see which prescriptions have been paid, are awaiting payment, or have payment issues. Color-coded indicators make it easy to scan for problems.

**Transaction IDs from Authorize.Net**: Each payment generates a unique transaction ID from the payment gateway. Store these IDs for reconciliation, refund processing, and financial audits.

**Payment method used**: Track whether each prescription was paid via credit card, debit card, bank transfer, or other methods. Useful for analyzing payment preferences and gateway performance.

**Amount charged**: View the exact dollar amount charged to the patient, including medication cost, any shipping fees, and taxes. Compare to expected pricing to catch discrepancies.

**Refund management**: Process refunds directly from the admin panel when prescriptions are cancelled, rejected by pharmacy, or need to be corrected. Refunds are submitted to Authorize.Net and tracked in the system.

**Failed payment recovery**: When patient payments fail due to declined cards or insufficient funds, admins can resend payment links, contact patients directly, or mark prescriptions as unpaid for follow-up.

### **Analytics & Reports Page**

#### **Revenue Analytics**

**Total revenue by time period**: View total revenue generated across all prescriptions for any date range. Compare this week to last week, this month to last month, or analyze year-over-year growth trends.

**Revenue by provider**: See how much revenue each provider has generated through their prescriptions. Identify top performers and calculate commission payments based on their tier discount rates.

**Revenue by medication category**: Understand which therapeutic categories (Antibiotics, Pain Management, etc.) drive the most revenue. Use this data to optimize pharmacy inventory and marketing focus.

**Payment method breakdown**: Analyze what percentage of revenue comes from credit cards vs. other payment methods. Helps evaluate payment gateway costs and patient payment preferences.

**Refund statistics**: Track total refunds issued, refund reasons, and refund rates over time. High refund rates may indicate quality issues, fulfillment problems, or prescription errors that need addressing.

#### **Prescription Analytics**

**Total prescriptions created**: Track the absolute number of prescriptions created on the platform over any time period. This is your primary volume metric for measuring platform growth and provider adoption.

**Prescriptions by status**: Break down prescription volume by current status - how many are pending payment, in progress, delivered, etc. Helps identify bottlenecks in the fulfillment pipeline.

**Average fulfillment time**: Calculate the average time from prescription submission to delivery. Track this metric over time to ensure pharmacy partner performance meets expectations and identify improvement opportunities.

**Most prescribed medications**: Discover which medications are prescribed most frequently on your platform. Use this data to negotiate better pharmacy pricing, ensure stock availability, and optimize catalog organization.

**Provider prescription volume**: Compare how many prescriptions each provider creates. Identify high-volume providers for relationship management and low-volume providers who may need training or engagement.

#### **User Analytics**

**Active users (providers, patients)**: Track how many unique users log in and use the platform each day, week, or month. Monitor active user trends to measure platform stickiness and engagement.

**New registrations**: See how many new providers and patients join the platform over time. Compare new registrations to active users to calculate activation rates and identify onboarding issues.

**User engagement metrics**: Measure deeper engagement like prescriptions per provider, appointments booked per patient, average session duration, and feature usage. Identify which features drive retention and which are underutilized.

**Geographic distribution**: Map where your users are located to identify strong markets and expansion opportunities. Useful for targeting marketing efforts and ensuring pharmacy delivery coverage in all regions.

### **API Logs & Monitoring Page**

#### **Real-Time API Call Logs**

**All DigitalRx API calls**: Every prescription submission, status check, and order inquiry sent to DigitalRx pharmacy is logged with timestamp, request data, and response data. Essential for debugging submission failures.

**Authorize.Net webhook logs**: All payment notifications received from Authorize.Net are logged, including payment confirmations, declined cards, and refunds. Verify that webhooks are being received and processed correctly.

**Request/response payloads**: View the exact JSON data sent to and received from each API. When something goes wrong, these payloads are invaluable for identifying data format issues or API errors.

**Error tracking and debugging**: Failed API calls are flagged with error messages, HTTP status codes, and stack traces. Admins can quickly identify patterns of failures and work with integration partners to resolve issues.

**Response time monitoring**: Track how long each API call takes to complete. Slow response times from pharmacy or payment APIs can impact user experience and indicate performance problems that need addressing.

**Success/failure rates**: Monitor the percentage of API calls that succeed vs. fail over time. Declining success rates indicate integration health problems that need immediate attention before they impact users.

#### **System Health Monitoring**

**API uptime status**: Real-time indicators show whether each integration (DigitalRx, Authorize.Net, CometChat, SendGrid) is online and responding. Downtime alerts notify admins to prevent prescription submission failures.

**Database performance**: Monitor database query performance, connection pool status, and slow query detection. Database issues can slow down the entire platform, so early detection prevents user-facing problems.

**Error rate alerts**: Automated alerts trigger when error rates exceed thresholds - for example, if more than 5% of prescriptions fail to submit. Admins are notified immediately to investigate and resolve.

**Integration status**: Dashboard shows green/yellow/red health indicators for each external service. At a glance, admins know if all systems are operational or if troubleshooting is needed.

### **System Settings Page**

#### **Payment Gateway Configuration**

**Authorize.Net credentials**: Enter your Authorize.Net API Login ID and Transaction Key to enable payment processing. Credentials are encrypted and stored securely in the database.

**Stripe configuration (alternative)**: For customers who prefer Stripe, configure Stripe publishable and secret keys. The platform supports multiple payment gateways for flexibility and redundancy.

**Webhook URL setup**: Provide Authorize.Net and Stripe with your platform's webhook URL so they can send payment notifications. The platform automatically processes these webhooks to update prescription payment status.

**Test mode toggle**: Enable test mode to process payments through gateway sandboxes without charging real cards. Essential for development, testing, and training without financial risk.

#### **Email Notification Settings**

**SendGrid API configuration**: Enter your SendGrid API key to enable automated email notifications. Without this configuration, payment links and status updates won't reach patients and providers.

**Email templates management**: Customize the content and design of automated emails including payment links, prescription confirmations, shipping notifications, and appointment reminders. HTML and plain text versions.

**Notification triggers**: Configure which events trigger email notifications - prescription created, payment received, order shipped, etc. Admins can enable/disable notifications to prevent email overload.

**Test email functionality**: Send test emails to verify SendGrid integration and template rendering. Ensures emails look correct and reach recipients before going live with real users.

#### **Telehealth Settings**

**CometChat configuration**: Enter your CometChat App ID, Auth Key, and Region to enable video calling. These credentials connect your platform to CometChat's infrastructure for HIPAA-compliant video consultations.

**Video call settings**: Configure maximum call duration, recording options, waiting room features, and participant limits. Customize the telehealth experience to match your clinical workflows.

**Waiting room options**: Enable/disable virtual waiting rooms where patients wait before providers join the call. Configure waiting room messages and estimated wait times.

#### **General Settings**

**Platform name and branding**: Set your platform's public-facing name, logo URL, and brand colors. These settings control how the platform appears to users and in email communications.

**Contact information**: Configure support email addresses and phone numbers that appear in user-facing areas. Ensures patients and providers know how to reach your support team.

**Terms of service**: Upload or link to your platform's terms of service and user agreement. Required for legal compliance and displayed during user registration.

**Privacy policy links**: Link to your HIPAA privacy notice and data handling policies. Essential for healthcare compliance and user trust.

**Feature flags**: Enable or disable specific features platform-wide, such as telehealth, product catalog, or wearable integrations. Useful for staged rollouts and troubleshooting.

---

## 💊 PRESCRIPTION MANAGEMENT (PROVIDER VIEW)

### **Create Prescription - Multi-Step Wizard**

**Step 1: Select Patient**

**Search existing patients by name or email**: Providers type a patient's name or email into the search box and matching patients appear instantly. Search works across partial names, helping providers find patients quickly even with incomplete information.

**View patient details (DOB, address, phone)**: Before selecting a patient, providers can preview their basic information to confirm they're selecting the correct person. Prevents prescription errors from patient confusion.

**Create new patient inline if not found**: If a patient doesn't exist in the system, providers can create a new patient record right from the prescription wizard without navigating away. Streamlines workflow for first-time patients.

**Patient validation and verification**: The system validates patient data including date of birth format, phone number format, and address completeness. Ensures all required information is collected before prescriptions can be submitted.

**Quick access to patient medical history**: Providers can view a patient's previous prescriptions, allergies, conditions, and recent vitals without leaving the wizard. Helps ensure safe prescribing and avoid drug interactions.

**Step 2: Select Medication**

#### **Search Functionality**

**Type-ahead search with instant results**: As providers type medication names, matching drugs appear in real-time with no delay. The search is lightning-fast, searching across 1000+ medications instantly.

**Search by medication name**: Providers can search by brand name (Lipitor) or generic name (Atorvastatin) and both will return results. Fuzzy matching helps find drugs even with minor spelling errors.

**Filter by category**: When providers don't know the exact medication name, they can browse by therapeutic category like "Antibiotics" or "Pain Management" to see all drugs in that class.

**View 1000+ medications**: The platform's medication database includes over 1000 commonly prescribed drugs across all therapeutic categories, ensuring providers can prescribe what their patients need.

#### **Medication Categories**

**Antibiotics**: All common antibiotic classes including penicillins, cephalosporins, macrolides, fluoroquinolones, and more. Used for bacterial infections.

**Pain Management**: Prescription pain relievers ranging from mild analgesics to opioids. Includes NSAIDs, acetaminophen combinations, and controlled substances.

**Cardiovascular**: Medications for heart health including blood pressure drugs, cholesterol medications, anticoagulants, and heart failure treatments.

**Diabetes**: Insulin and oral diabetes medications including metformin, sulfonylureas, GLP-1 agonists, and SGLT2 inhibitors for blood sugar management.

**Mental Health**: Antidepressants, anti-anxiety medications, mood stabilizers, and antipsychotics for psychiatric conditions.

**Dermatology**: Topical and oral medications for skin conditions including acne, eczema, psoriasis, and fungal infections.

**Respiratory**: Inhalers, nebulizer solutions, and oral medications for asthma, COPD, and other breathing conditions.

**Gastrointestinal**: Medications for digestive issues including acid reflux, nausea, diarrhea, constipation, and inflammatory bowel disease.

**And more...**: Additional categories cover all major therapeutic areas ensuring comprehensive prescribing capabilities.

#### **Medication Information Display**

**Medication name**: Prominently displays the brand name of the drug in large, readable text so providers can quickly identify medications when browsing search results.

**Generic name**: Shows the generic/chemical name below the brand name. Important for understanding drug equivalents and for providers who prefer prescribing generics.

**Available dosage forms**: Lists all forms this medication comes in - tablets, capsules, liquid, injection, cream, etc. Providers see at a glance which forms are available before selecting.

**Category badge**: A colored badge shows the therapeutic category (e.g., "Antibiotic", "Pain Management") helping providers quickly identify drug classes when scanning results.

**Price information**: Displays the patient price for this medication so providers know the cost before prescribing. Helps providers choose affordable options for cost-sensitive patients.

**Step 3: Configure Dosage & Payment**

#### **Dosage Configuration**

**Select dosage form**: Providers choose the medication form most appropriate for the patient - tablets, capsules, liquid suspension, injection, topical cream, inhaler, patches, or suppositories. Each form has different administration characteristics.

**Choose strength**: After selecting the form, providers choose the strength (e.g., 10mg, 25mg, 50mg tablets). Strength options are filtered based on the selected form and what's actually available.

**Set quantity**: Enter how many units to dispense - number of tablets, milliliters of liquid, number of inhalers, etc. Quantity determines how long the medication will last.

**Enter sig/instructions for patient**: Providers type patient instructions (Sig) like "Take 1 tablet by mouth twice daily with food". These instructions appear on the prescription label and in patient's app.

**Refill information**: Specify how many refills are allowed (0-12) and refill duration. The pharmacy uses this to determine if patients can get refills without provider reauthorization.

#### **Pricing Configuration**

**AIM RX price (cost from pharmacy)**: The wholesale cost your platform pays to DigitalRx pharmacy for this medication. This is your cost basis for margin calculations.

**Pharmacy price (retail price)**: The standard retail price if a patient walked into a pharmacy without insurance. This serves as a reference point for savings comparison.

**Patient price (what patient pays)**: The actual price charged to the patient through your platform. This is typically lower than retail due to provider tier discounts and platform negotiations.

**Automatic discount calculation based on provider tier**: The system automatically applies the provider's tier discount rate to calculate patient pricing. Tier 1 providers get bigger discounts than Tier 4, all calculated automatically.

**Price override capability**: In special circumstances, providers can manually override the calculated patient price to charge more or less. Useful for financial hardship cases or promotional pricing.

#### **Payment Method Selection**

**Option 1: Direct Card Entry**

**Provider enters patient's card information**: When the provider has the patient's card physically present (office visit, phone consultation), they can enter the card number, expiration, and CVV directly into the form.

**Immediate payment processing**: As soon as the prescription is submitted, the card is charged immediately through Authorize.Net. No delay waiting for patient action.

**Instant pharmacy submission**: Because payment is confirmed instantly, the prescription is immediately sent to DigitalRx for fulfillment. The patient's medication is in the pharmacy queue within seconds.

**Faster fulfillment**: Direct card entry eliminates the "pending payment" phase, reducing the time from prescription creation to patient receiving medication. Best for urgent prescriptions.

**Option 2: Send Payment Link**

**Email link to patient**: If the provider doesn't have the patient's card, they select "Send Payment Link" and an email with a secure payment URL is sent to the patient's email address.

**Patient enters own card**: The patient receives the email, clicks the link, and enters their credit/debit card information on a secure payment page. Gives patients control over their payment method.

**Payment confirmation required before pharmacy submission**: The prescription stays in "Pending Payment" status until the patient completes payment. Only after Authorize.Net confirms payment does the prescription get sent to the pharmacy.

**Status: "Pending Payment" until paid**: Providers and admins can see which prescriptions are awaiting patient payment. Reminders can be sent if patients don't pay within a certain timeframe.

**Step 4: Review & Submit**

**Complete prescription summary**: A comprehensive review screen shows every detail of the prescription before final submission - patient name, medication, dosage, quantity, instructions, pricing, and payment method.

**Patient details verification**: Providers review patient contact information including phone and address to ensure the medication will be delivered to the correct location. Prevents delivery errors.

**Medication and dosage review**: Confirm the selected medication, dosage form, strength, quantity, and patient instructions are exactly as intended. Last chance to catch prescribing errors before submission.

**Pricing confirmation**: Review all pricing including medication cost, any fees, total amount, and tier discount applied. Ensures patients are charged correctly.

**Payment method confirmation**: Verify whether direct card entry or payment link was selected, and confirm the payment details are correct. Prevents payment processing errors.

**Submit to pharmacy button**: One final click sends the prescription to DigitalRx (if paid) or saves it as pending payment and emails the patient. Clear confirmation message appears after submission.

**Receive Queue ID from DigitalRx**: Upon successful submission, DigitalRx returns a unique Queue ID that identifies this order in their fulfillment system. This ID is stored and displayed for tracking purposes.

### **Prescription List (Provider Dashboard)**

#### **All Provider Prescriptions**

**Complete list of prescriptions created**: Providers see every prescription they've ever created in one table, regardless of status or date. This is their prescription history and active prescription dashboard.

**Filter by status**: Dropdown filters let providers view only prescriptions in a specific status - Pending Payment, Submitted, In Progress, Shipped, or Delivered. Helps focus on prescriptions needing attention.

**Search by patient name or medication**: Type a patient name or medication name to instantly filter the list to matching prescriptions. Useful for finding a specific prescription quickly among hundreds.

**Date range filtering**: Filter prescriptions created within a specific date range - today, last 7 days, last 30 days, or custom date ranges. Helpful for reviewing recent activity or analyzing historical prescribing.

**Quick status overview**: Each prescription row shows key information at a glance - patient name, medication, date created, payment status, and fulfillment status. Providers scan the list efficiently.

#### **Prescription Status Tracking**

**🟡 Pending Payment - Awaiting patient payment**: Prescription has been created and payment link sent to patient, but payment hasn't been received yet. Prescription will not be submitted to pharmacy until paid.

**🔵 Submitted - Sent to pharmacy, Queue ID received**: Payment confirmed and prescription successfully transmitted to DigitalRx pharmacy. Queue ID received and pharmacy has accepted the order for fulfillment.

**🟠 In Progress - Pharmacy is processing**: DigitalRx has started processing the order - verifying prescription details, pulling inventory, packaging medication, and preparing for shipment.

**🟢 Shipped - Order on the way to patient**: Medication has been shipped from the pharmacy to the patient's delivery address. Tracking number is available to monitor package location.

**✅ Delivered - Order completed**: Package has been delivered to the patient's address and signed for. Prescription lifecycle is complete and patient has their medication.

#### **Prescription Details**

**Click any prescription to view full details**: Clicking any prescription row opens a detailed view with comprehensive information about that prescription, payment, and fulfillment status.

**Patient contact information**: Full patient details including name, date of birth, email, phone number, and delivery address. Providers can contact patients if there are issues or questions.

**Medication details**: Complete medication information including name, generic name, dosage form, strength, quantity prescribed, patient instructions (Sig), and refill allowance.

**Payment status and transaction ID**: Shows whether payment is pending, completed, or failed. For completed payments, displays the Authorize.Net transaction ID for financial reconciliation.

**Queue ID for pharmacy tracking**: The unique identifier DigitalRx assigned to this order. This ID can be used to inquire about order status directly with the pharmacy if needed.

**Delivery tracking number (if available)**: Once shipped, the tracking number from the shipping carrier (USPS, UPS, FedEx) appears. Some integrations allow tracking within the platform.

**Status timeline**: A chronological history showing every status change the prescription went through with timestamps. Helps providers understand when delays occurred or how quickly the order was fulfilled.

### **Prescription Actions**

**View prescription details**: Open the full prescription detail page showing all information about the patient, medication, dosage, pricing, payment, and fulfillment status.

**Resend payment link to patient**: If a patient didn't receive or lost the payment link email, providers can resend it with one click. A new email with the same payment link is sent.

**Contact patient via email/phone**: Patient contact information is displayed prominently, making it easy for providers to reach out about prescription questions, payment issues, or delivery problems.

**Track delivery status**: For shipped prescriptions, view the current delivery status and estimated delivery date. Some integrations show real-time package tracking on a map.

**View payment receipt**: Display or download the payment receipt showing the transaction amount, date, method, and Authorize.Net transaction ID. Useful for patient billing questions.

**Download prescription PDF**: Generate a PDF copy of the prescription with all details for provider records, patient requests, or insurance documentation.

---

## 🔐 PRESCRIPTION PAYMENT FLOW

### **Flow 1: Direct Card Entry (Provider has card)**

**1. Provider creates prescription**: Provider completes the 4-step prescription wizard selecting patient, medication, dosage, and pricing. In step 3, they choose "Direct Card Entry" as the payment method.

**2. Provider enters patient's card information in Step 3**: Provider types the patient's credit/debit card number, expiration date, CVV code, and billing ZIP code into the secure payment form.

**3. Authorize.Net processes payment immediately**: Upon prescription submission, the card is charged immediately. Authorize.Net validates the card, checks for sufficient funds, and processes the transaction in real-time.

**4. Payment confirmed → Prescription submitted to DigitalRx**: Once Authorize.Net confirms payment success, the platform automatically sends the prescription to DigitalRx pharmacy API for fulfillment without any delay.

**5. Queue ID received**: DigitalRx receives the prescription, validates it, and returns a unique Queue ID. This ID confirms the pharmacy has accepted the order and it's in their fulfillment system.

**6. Status: "Paid" + "Submitted"**: The prescription's payment status updates to "Paid" and fulfillment status updates to "Submitted". Both provider and admin can see the order is moving forward.

**7. Patient receives confirmation email**: An automated email is sent to the patient with prescription details, payment confirmation, and expected delivery timeline. Includes tracking information once available.

**8. Pharmacy begins fulfillment**: DigitalRx starts processing the order - verifying insurance (if applicable), preparing the medication, packaging it, and arranging shipment to the patient's address.

### **Flow 2: Payment Link (Provider sends link)**

**1. Provider creates prescription**: Provider completes the 4-step prescription wizard. In step 3, they choose "Send Payment Link" because they don't have the patient's card information.

**2. Provider selects "Send Payment Link" in Step 3**: Instead of entering card details, provider clicks "Send Payment Link". They confirm the patient's email address where the link should be sent.

**3. Prescription saved with status: "Pending Payment"**: The prescription is saved in the database but NOT sent to the pharmacy yet. The fulfillment status is set to "Pending Payment" to indicate it's awaiting patient action.

**4. Patient receives email with secure payment link**: SendGrid sends an automated email to the patient with a "Pay Now" button linking to a secure payment page hosted on your platform.

**5. Patient clicks link and enters card information**: Patient receives the email, clicks the "Pay Now" button, and is taken to a secure payment page where they enter their credit/debit card details.

**6. Authorize.Net processes payment**: When the patient submits their card information, Authorize.Net validates and processes the payment in real-time. The patient sees a loading indicator while processing.

**7. Webhook confirms payment received**: Authorize.Net sends a webhook notification to your platform confirming the payment was successful. The webhook includes the transaction ID and payment amount.

**8. System automatically submits prescription to DigitalRx**: Upon receiving the payment confirmation webhook, your platform automatically triggers prescription submission to DigitalRx pharmacy API without any manual intervention.

**9. Queue ID received**: DigitalRx receives the prescription, validates it, and returns a Queue ID confirming the order is accepted and in their fulfillment queue.

**10. Status updates: "Paid" + "Submitted"**: The prescription's payment status changes from "Pending Payment" to "Paid", and fulfillment status changes to "Submitted". Provider and admin see the status change in real-time.

**11. Patient receives confirmation email**: Another email is sent to the patient confirming their payment was received and their prescription has been submitted to the pharmacy for fulfillment.

**12. Pharmacy begins fulfillment**: DigitalRx processes the order the same as direct card entry - verifying, preparing, packaging, and shipping the medication to the patient.

### **Payment Security**

**PCI-DSS compliant payment processing**: All payment processing meets PCI-DSS Level 1 requirements, the highest level of payment security. Regular security audits ensure ongoing compliance.

**No card data stored on platform**: Your platform never stores raw credit card numbers, CVV codes, or full card details. All sensitive data is handled exclusively by Authorize.Net.

**Tokenized transactions via Authorize.Net**: Instead of card numbers, your platform stores payment tokens that can only be used by your Authorize.Net account. Even if database is compromised, tokens are useless to attackers.

**Secure webhook verification**: All webhook notifications from Authorize.Net are cryptographically signed. Your platform verifies signatures before processing webhooks to prevent spoofing attacks.

**SSL/TLS encryption for all transactions**: All payment pages and API communications use HTTPS with TLS 1.2+ encryption. Card data is encrypted in transit protecting against man-in-the-middle attacks.

---

## 📊 KEY PLATFORM FEATURES

### **For Providers**

**Fast prescription creation (4-step wizard)**: Providers can create a complete prescription in under 2 minutes with an intuitive step-by-step wizard that guides them through patient selection, medication choice, dosage configuration, and payment setup.

**1000+ medications available**: The comprehensive medication catalog ensures providers can prescribe virtually any common medication their patients need without limitations, covering all major therapeutic categories.

**Tier-based pricing and commissions**: Providers benefit from tier-based discount rates that reduce patient costs while earning commission on prescriptions. Higher-volume providers receive better tier placements and larger discounts.

**Patient management (EMR)**: Built-in electronic medical records let providers create and manage patient profiles, track medical history, document encounters, and maintain comprehensive patient information without separate EMR software.

**Prescription history and tracking**: Providers can view their complete prescription history, track fulfillment status of active prescriptions, and monitor delivery to ensure patients receive their medications on time.

**Company branding in header**: Providers can display their practice or clinic name in the platform header, reinforcing their brand identity when working with patients and creating a professional appearance.

**Revenue tracking**: Providers can monitor their prescription volume, total revenue generated, and earned commissions. Transparent analytics help providers understand their financial performance on the platform.

### **For Patients**

**Secure payment links via email**: Patients receive professional, secure payment links via email that take them directly to a payment page. No need to log in or navigate the platform - just click and pay.

**Multiple payment methods**: Patients can pay with credit cards, debit cards, or other supported payment methods. The platform accepts all major card brands including Visa, Mastercard, American Express, and Discover.

**Prescription status tracking**: Patients can log in anytime to check the status of their prescriptions - whether they're pending payment, submitted to pharmacy, in progress, shipped, or delivered.

**Email notifications at each stage**: Automated emails keep patients informed at every step - prescription created, payment received, submitted to pharmacy, shipped, and delivered. No need to check status manually.

**Delivery tracking**: Once prescriptions ship, patients receive tracking numbers to monitor package location and estimated delivery date. Some integrations show real-time tracking maps.

**Prescription history**: Patients can view their complete prescription history including past medications, dates, prescribing providers, and dosages. Useful for managing chronic conditions and discussing treatment with doctors.

**Health data tracking**: Patients can connect wearable devices to track vitals like heart rate, blood pressure, and glucose levels. Health data is shared with providers for better informed care decisions.

### **For Admins**

**Complete platform oversight**: Admins have full visibility into all platform activity - every prescription, payment, user registration, and system event. Comprehensive dashboards provide real-time insights.

**Provider tier management**: Admins control which providers are assigned to which pricing tiers, adjusting tier levels as provider volume and relationships evolve. Tier changes take effect immediately for new prescriptions.

**Pharmacy integration control**: Admins configure and manage all pharmacy integrations including API credentials, endpoint URLs, and test modes. Integration health monitoring alerts admins to issues immediately.

**Analytics and reporting**: Robust analytics show revenue trends, prescription volume, top medications, provider performance, payment success rates, and more. Export data for external analysis or stakeholder reporting.

**API monitoring and logs**: Real-time logs of every API call to external services (DigitalRx, Authorize.Net, CometChat) with request/response data. Essential for troubleshooting integration issues.

**System configuration**: Centralized settings page for configuring payment gateways, email services, telehealth settings, branding, feature flags, and all other platform-wide configurations.

**Revenue tracking**: Track total platform revenue, revenue by provider, revenue by medication category, payment method breakdowns, and refund statistics. Financial analytics inform business decisions.

---

## 🔗 INTEGRATIONS

### **DigitalRx Pharmacy**

**Real-time prescription submission**: When providers submit prescriptions, they're instantly transmitted to DigitalRx pharmacy via secure API. No manual faxing, phone calls, or delays - prescriptions reach the pharmacy in seconds.

**Queue ID tracking**: Every submitted prescription receives a unique Queue ID from DigitalRx that links your platform's prescription record to the pharmacy's order management system. This ID enables end-to-end tracking.

**Status updates**: DigitalRx updates your platform when order status changes - from received, to in progress, to shipped, to delivered. Providers and patients see these status changes in real-time.

**Fulfillment confirmation**: When DigitalRx successfully fulfills an order, they send confirmation to your platform with shipping details. This triggers notification emails to providers and patients.

**Delivery tracking**: Once prescriptions ship, DigitalRx provides tracking numbers from shipping carriers. These tracking numbers are stored in your platform and displayed to providers and patients.

### **Authorize.Net Payment Gateway**

**Secure payment processing**: All credit and debit card transactions are processed through Authorize.Net, a trusted payment gateway with 20+ years of experience and PCI-DSS Level 1 compliance.

**Webhook notifications**: Authorize.Net sends instant webhook notifications to your platform when payments are approved, declined, refunded, or disputed. Webhooks trigger automatic prescription submission and status updates.

**Transaction tracking**: Every payment generates a unique transaction ID stored in your platform. These IDs enable transaction lookup in Authorize.Net for reconciliation, refunds, or dispute resolution.

**Refund management**: Admins can initiate refunds directly from your platform. Refund requests are sent to Authorize.Net and funds are returned to patients' cards within 3-5 business days.

**PCI compliance**: By using Authorize.Net, your platform inherits PCI compliance without storing any card data. Authorize.Net handles all sensitive payment information securely.

### **CometChat Video**

**HD video consultations**: CometChat provides high-definition video calling for telehealth appointments. Video quality automatically adjusts based on connection speed ensuring smooth consultations.

**HIPAA-compliant calls**: CometChat infrastructure meets HIPAA requirements with encrypted video streams, secure data storage, and Business Associate Agreements. Patient consultations remain private and compliant.

**Screen sharing**: During video calls, providers can share their screen with patients to show test results, educational materials, or treatment plans. Enhances communication and patient understanding.

**Chat functionality**: In addition to video, CometChat includes text chat during calls. Providers can share links, send instructions, or answer questions via chat without interrupting the video flow.

### **SendGrid Email**

**Automated notifications**: SendGrid delivers all automated emails from your platform including payment links, prescription confirmations, status updates, appointment reminders, and system alerts.

**Payment link delivery**: When providers choose "Send Payment Link", SendGrid ensures the email reaches patients reliably with high deliverability rates. Includes retry logic for temporary failures.

**Status update emails**: As prescriptions move through stages (submitted, shipped, delivered), SendGrid automatically sends notification emails to patients keeping them informed without manual intervention.

**Custom templates**: All emails use professionally designed HTML templates with your branding. Templates are responsive and render correctly on desktop and mobile email clients.

---

## 📈 BENEFITS

### **Efficiency**

**⚡ 4-step prescription creation (under 2 minutes)**: Providers can create a complete prescription from patient selection to pharmacy submission in less than 2 minutes thanks to the intuitive wizard interface and smart defaults.

**🔄 Automated pharmacy submission**: No manual faxing, phone calls, or data entry. When payment is confirmed, prescriptions are automatically sent to DigitalRx pharmacy without any human intervention, eliminating delays and errors.

**📧 Automatic email notifications**: Patients and providers receive timely email updates at every stage of the prescription lifecycle without any manual sending. Reduces support burden and keeps everyone informed.

**💳 Instant payment processing**: Direct card entry processes payments in seconds, not days. Prescriptions move from creation to pharmacy fulfillment immediately, ensuring patients get medications faster.

### **Revenue**

**💰 Tier-based provider commissions**: Providers earn commission based on their tier level, incentivizing prescription volume while maintaining healthy platform margins. Higher tiers reward loyal, high-volume providers.

**📊 Transparent pricing**: All pricing is clearly displayed to providers and patients before prescriptions are submitted. No hidden fees or surprise charges - what you see is what you pay.

**💳 Multiple payment methods**: Supporting credit cards, debit cards, and other payment methods reduces payment friction and increases conversion rates. Patients can pay however they prefer.

**📈 Revenue analytics**: Comprehensive financial reporting shows exactly how much revenue each provider, medication category, and time period generates. Data-driven decisions optimize profitability.

### **Compliance**

**🔒 HIPAA-compliant data storage**: All patient health information is stored in Supabase with row-level security, encryption at rest, and encryption in transit. Regular HIPAA compliance audits ensure ongoing adherence.

**🛡️ PCI-DSS payment security**: By using Authorize.Net for all payment processing, the platform maintains PCI-DSS compliance without storing any sensitive card data. Reduces security risk and compliance burden.

**📋 Audit logs for all actions**: Every user action - prescription creation, data access, setting changes - is logged with timestamps and user IDs. Audit logs support compliance investigations and security monitoring.

**🔐 Role-based access control**: Users can only access data and features appropriate to their role (Provider, Patient, Admin). Prevents unauthorized data access and enforces least-privilege security principles.

### **User Experience**

**📱 Mobile-responsive design**: The entire platform adapts seamlessly to smartphones and tablets. Providers can prescribe on-the-go, patients can pay from their phones, and admins can monitor from anywhere.

**🎯 Intuitive interfaces**: Clean, modern design with logical workflows makes the platform easy to learn and use. New providers become productive within minutes without extensive training.

**📧 Clear email communications**: All automated emails use plain language and clear calls-to-action. Patients know exactly what to do next, reducing confusion and support tickets.

**📦 Real-time tracking**: Live status updates and tracking information give patients peace of mind knowing exactly where their prescription is in the fulfillment process. Reduces "where's my order" inquiries.

---

## 🎯 NEXT STEPS

**1. Review this presentation**: Go through all sections to understand the full scope of platform capabilities, features, and benefits. Identify any questions or areas needing clarification.

**2. Add screenshots for each section**: Capture high-quality screenshots of every feature described - dashboards, forms, lists, detail pages, and workflows. Place images next to corresponding text descriptions.

**3. Demo the platform live**: Schedule a live demonstration where the client can see the platform in action. Walk through creating a prescription, processing a payment, and tracking fulfillment in real-time.

**4. Answer client questions**: Address any technical questions, compliance concerns, customization requests, or implementation timelines. Be prepared to discuss integration capabilities and scalability.

**5. Discuss customization needs**: Identify any client-specific requirements such as custom branding, additional integrations, unique workflows, or specialized reporting. Provide estimates for custom development.

**6. Provide pricing proposal**: Present a clear pricing proposal including licensing fees, transaction fees, implementation costs, training, support, and any customization work. Break down costs transparently.

---

**Platform Status: LIVE & PRODUCTION-READY** ✅

**URL:** https://3005.app.specode.ai
