# CRM Integration Services

## Overview

The CRM Integration Services provide comprehensive customer relationship management through Klaviyo
integration for behavioral event tracking and customer profile management. The service enables email
and SMS campaign automation based on patient journey milestones while maintaining HIPAA compliance
by excluding any Protected Health Information (PHI).

## Architecture & Structure

- **Core Services:** All CRM business logic and integrations live in `core/services/crm/`
- **Clean Client Interface:** `crmEventTriggers` provides client-side event triggering
- **API Routes:** Server-side routes in `app/api/klaviyo/` handle secure API communication
- **Type Safety:** Full TypeScript support with proper interfaces and validation
- **PHI Compliance:** Strict separation of behavioral data from medical information

## Main Components

### Core Services

- **klaviyoService:** Main Klaviyo API integration with event and profile management
- **crmEventTriggers:** Client-side interface for triggering CRM events
- **KlaviyoHelpers:** Helper methods for common event patterns

### Event Management

- **Account Created:** Patient registration and initial profile creation
- **Onboarding Completed:** Intake and consent completion tracking
- **User Logged In:** Login activity and engagement monitoring

### API Integration

- **Event Sending:** Secure server-side API communication with Klaviyo
- **Profile Updates:** Patient profile synchronization with behavioral data
- **Error Handling:** Graceful fallbacks that don't interrupt user experience

## API Routes

- `/api/klaviyo/account-created` — Handles account creation events
- `/api/klaviyo/onboarding-completed` — Tracks onboarding completion
- `/api/klaviyo/user-logged-in` — Monitors login activity

## Features

- **Behavioral Tracking:** Patient journey milestone tracking
- **Profile Management:** Automated customer profile updates
- **Campaign Automation:** Event-driven email and SMS campaigns
- **PHI Compliance:** Medical data exclusion with behavioral focus
- **Non-blocking Operation:** CRM failures don't impact user experience
- **Real-time Events:** Immediate event processing and profile updates

## Data Model & Integration

### Event Types

- **Account Created**
  - Triggers on user registration
  - Updates: `patient_id`, `account_created_date`, `paid` status
- **Onboarding Completed**
  - Triggers on intake/consent completion
  - Updates: `onboarding_status` to "onboarding_done"
- **User Logged In**
  - Triggers on dashboard access
  - Updates: `last_login_date`, `engagement_status`

### Profile Properties

```typescript
interface KlaviyoProfile {
  // Identity
  patient_id: string;
  account_created_date: string;

  // Subscription Status
  paid: boolean;

  // Journey Progress
  onboarding_status: "created" | "onboarding_done";

  // Engagement
  last_login_date: string;
  engagement_status: "active" | "inactive";
}
```

### Integration Points

- **Registration:** `app/auth/register/page.tsx`
- **Intake Completion:** `app/(features)/intake/consent/page.tsx`
- **Login Activity:** `app/auth/login/page.tsx`

## Usage

### Client-Side Event Triggers (Recommended)

```typescript
import { crmEventTriggers } from "@core/services/crm";

// Account creation
await crmEventTriggers.accountCreated("user-123", "user@example.com");

// Onboarding completion
await crmEventTriggers.onboardingCompleted("user-123", "user@example.com");

// Login activity
await crmEventTriggers.userLoggedIn("user-123", "user@example.com", 5);
```

### Server-Side Direct Usage

```typescript
import { KlaviyoHelpers } from "@core/services/crm";

// Direct API calls (use in API routes only)
await KlaviyoHelpers.sendAccountCreated("user-123", "user@example.com");
await KlaviyoHelpers.sendOnboardingCompleted("user-123", "user@example.com");
await KlaviyoHelpers.sendUserLoggedIn("user-123", "user@example.com", 5);
```

### Custom Event Implementation

```typescript
import { klaviyoService, KlaviyoEvents } from "@core/services/crm";

// Send custom events
await klaviyoService.sendEvent({
  eventName: KlaviyoEvents.ACCOUNT_CREATED,
  patientId: "user-123",
  email: "user@example.com",
  eventProperties: { source: "mobile_app" },
  profileProperties: { signup_method: "google" },
});
```

## Configuration

Environment variables required:

```bash
# .env
KLAVIYO_API_KEY=pk_your_klaviyo_api_key_here
```

## PHI Compliance Rules

**Safe to Send:**

- Generic event names ("Account Created", "User Logged In")
- Behavioral timestamps (login dates, completion status)
- Patient identifiers (patient_id, email)
- Journey progression data

**Never Send:**

- Medical conditions, symptoms, diagnoses
- Medication names, dosages, frequencies
- Lab results, test names, medical data
- Provider notes, clinical observations

## Monitoring & Analytics

### Real-time Tracking

- **Server Console:** Immediate event confirmation logs
- **Klaviyo Activity:** Events appear instantly in patient profiles
- **Error Logging:** Failed events logged for debugging

### Analytics Dashboard

- **Event Metrics:** Campaign trigger rates and timing
- **Profile Insights:** Patient journey progression analysis
- **Performance Monitoring:** API response times and success rates

## Extensibility

### Adding New Events

1. **Define Event:** Add to `KlaviyoEvents` constant
2. **Create Helper:** Add method to `KlaviyoHelpers`
3. **Build Route:** Create corresponding API route
4. **Add Trigger:** Update `crmEventTriggers` interface
5. **Integrate:** Call from application flow

Example:

```typescript
// 1. Add event constant
PRESCRIPTION_ORDERED: "Prescription Ordered"

// 2. Add helper method
async sendPrescriptionOrdered(patientId: string, email: string) {
  return klaviyoService.sendEvent({
    eventName: KlaviyoEvents.PRESCRIPTION_ORDERED,
    patientId,
    email,
    profileProperties: {
      last_prescription_date: new Date().toISOString()
    }
  });
}

// 3. Add trigger method
async prescriptionOrdered(userId: string, email: string) {
  return triggerCrmEvent("/api/klaviyo/prescription-ordered", {
    userId, email
  });
}
```

## Dependencies

- **Klaviyo SDK:** Customer profile and event management
- **Next.js API Routes:** Server-side API handling
- **TypeScript:** Type safety and developer experience
- **Environment Config:** Secure API key management

---

For implementation details and advanced usage patterns, see the service files in
`core/services/crm/` and the integration examples throughout the application.
