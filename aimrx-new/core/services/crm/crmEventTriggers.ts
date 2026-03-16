/**
 * CRM Event Triggers - Client-side service for triggering CRM events
 * Provides clean, reusable functions for sending CRM events via API routes
 */

interface CrmEventResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Generic function to trigger CRM events via API routes
 */
async function triggerCrmEvent(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<CrmEventResponse> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "API call failed");
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * CRM Event Triggers - Clean interface for client-side CRM event sending
 */
export const crmEventTriggers = {
  /**
   * Trigger Account Created event
   */
  async accountCreated(
    userId: string,
    email: string,
  ): Promise<CrmEventResponse> {
    return triggerCrmEvent("/api/klaviyo/account-created", {
      userId,
      email,
    });
  },

  /**
   * Trigger Onboarding Completed event
   */
  async onboardingCompleted(
    userId: string,
    email: string,
  ): Promise<CrmEventResponse> {
    return triggerCrmEvent("/api/klaviyo/onboarding-completed", {
      userId,
      email,
    });
  },

  /**
   * Trigger User Logged In event
   */
  async userLoggedIn(
    userId: string,
    email: string,
    daysSinceLastLogin?: number,
  ): Promise<CrmEventResponse> {
    return triggerCrmEvent("/api/klaviyo/user-logged-in", {
      userId,
      email,
      ...(daysSinceLastLogin !== undefined && { daysSinceLastLogin }),
    });
  },
} as const;
