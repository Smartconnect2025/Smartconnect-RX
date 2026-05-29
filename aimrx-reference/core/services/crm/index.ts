/**
 * CRM Services Module
 *
 * Provides integration with Customer Relationship Management (CRM) systems
 * for behavioral event tracking and customer profile management.
 *
 * Currently supports:
 * - Klaviyo CRM integration
 *
 * @example
 * ```typescript
 * import { klaviyoService, KlaviyoEvents, KlaviyoHelpers } from "@core/services/crm";
 *
 * // Send a custom event
 * await klaviyoService.sendEvent({
 *   eventName: KlaviyoEvents.ACCOUNT_CREATED,
 *   patientId: "user-123",
 *   email: "user@example.com"
 * });
 *
 * // Use helper methods for common events
 * await KlaviyoHelpers.sendAccountCreated("user-123", "user@example.com");
 * ```
 */

// Klaviyo Service and Types
export {
  klaviyoService,
  KlaviyoHelpers,
  KlaviyoEvents,
  KlaviyoProfileProperties,
  OnboardingStatus,
  EngagementStatus,
  type KlaviyoEventName,
  type KlaviyoProfile,
  type KlaviyoEventProperties,
  type SendEventParams,
  type OnboardingStatusValue,
  type EngagementStatusValue,
} from "./klaviyoService";

export { crmEventTriggers } from "./crmEventTriggers";
