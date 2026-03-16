/**
 * Klaviyo CRM Integration Service
 * Handles patient behavioral events and profile management for Klaviyo CRM.
 * Ensures no PHI (Protected Health Information) is sent to Klaviyo.
 */

import { envConfig } from "@core/config";

export const KlaviyoEvents = {
  ACCOUNT_CREATED: "Account Created",
  ONBOARDING_COMPLETED: "Onboarding Completed",
  USER_LOGGED_IN: "User Logged In",
} as const;

export type KlaviyoEventName =
  (typeof KlaviyoEvents)[keyof typeof KlaviyoEvents];

export const KlaviyoProfileProperties = {
  PATIENT_ID: "patient_id",
  ACCOUNT_CREATED_DATE: "account_created_date",
  PAID: "paid",
  ONBOARDING_STATUS: "onboarding_status",
  LAST_LOGIN_DATE: "last_login_date",
  ENGAGEMENT_STATUS: "engagement_status",
} as const;

export type KlaviyoProfilePropertyKey =
  (typeof KlaviyoProfileProperties)[keyof typeof KlaviyoProfileProperties];

export const OnboardingStatus = {
  CREATED: "created",
  ONBOARDING_DONE: "onboarding_done",
} as const;

export type OnboardingStatusValue =
  (typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export const EngagementStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type EngagementStatusValue =
  (typeof EngagementStatus)[keyof typeof EngagementStatus];

export interface KlaviyoProfile {
  [KlaviyoProfileProperties.PATIENT_ID]?: string;
  [KlaviyoProfileProperties.ACCOUNT_CREATED_DATE]?: string;
  [KlaviyoProfileProperties.PAID]?: boolean;
  [KlaviyoProfileProperties.ONBOARDING_STATUS]?: OnboardingStatusValue;
  [KlaviyoProfileProperties.LAST_LOGIN_DATE]?: string;
  [KlaviyoProfileProperties.ENGAGEMENT_STATUS]?: EngagementStatusValue;
  [key: string]: unknown;
}

export interface KlaviyoEventProperties {
  [key: string]: string | number | boolean | Date;
}

export interface SendEventParams {
  eventName: KlaviyoEventName;
  patientId: string;
  email?: string;
  eventProperties?: KlaviyoEventProperties;
  profileProperties?: Partial<KlaviyoProfile>;
}

export interface KlaviyoErrorResponse {
  errors: Array<{
    id: string;
    status: number;
    code: string;
    title: string;
    detail: string;
    source?: { pointer: string };
  }>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

class KlaviyoService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://a.klaviyo.com/api";
  private readonly apiVersion = "2023-10-15";

  constructor() {
    this.apiKey = envConfig.KLAVIYO_API_KEY;
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  async sendEvent(params: SendEventParams): Promise<ApiResponse> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      if (params.email) {
        await this.ensureProfileExists(params.patientId, params.email);
      }

      const payload = this.buildEventPayload(params);
      const response = await this.makeRequest("/events/", "POST", payload);

      if (!response.ok) {
        const errorData: KlaviyoErrorResponse = await response.json();
        const errorMessage = this.formatErrorMessage(errorData);
        console.error("Klaviyo API error:", errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to send Klaviyo event:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async ensureProfileExists(
    patientId: string,
    email: string,
  ): Promise<void> {
    try {
      const profilePayload = {
        data: {
          type: "profile",
          attributes: {
            email,
            external_id: patientId,
            properties: {
              [KlaviyoProfileProperties.PATIENT_ID]: patientId,
            },
          },
        },
      };

      await this.makeRequest("/profiles/", "POST", profilePayload);
    } catch (error) {
      // Silently handle profile creation errors
    }
  }

  private buildEventPayload(params: SendEventParams) {
    const {
      eventName,
      patientId,
      email,
      eventProperties = {},
      profileProperties = {},
    } = params;

    const finalEventProperties = {
      timestamp: new Date().toISOString(),
      ...eventProperties,
    };

    const finalProfileProperties = {
      [KlaviyoProfileProperties.PATIENT_ID]: patientId,
      ...profileProperties,
    };

    return {
      data: {
        type: "event",
        attributes: {
          properties: finalEventProperties,
          time: new Date().toISOString(),
          value: 1,
          unique_id: `${patientId}_${eventName}_${Date.now()}`,
          metric: {
            data: {
              type: "metric",
              attributes: { name: eventName },
            },
          },
          profile: {
            data: {
              type: "profile",
              attributes: {
                external_id: patientId,
                ...(email && { email }),
                properties: finalProfileProperties,
              },
            },
          },
        },
      },
    };
  }

  private async makeRequest(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: unknown,
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const requestOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        "Content-Type": "application/json",
        revision: this.apiVersion,
      },
    };

    if (body && (method === "POST" || method === "PATCH")) {
      requestOptions.body = JSON.stringify(body);
    }

    return fetch(url, requestOptions);
  }

  private formatErrorMessage(errorResponse: KlaviyoErrorResponse): string {
    if (!errorResponse.errors || errorResponse.errors.length === 0) {
      return "Unknown Klaviyo API error";
    }

    const error = errorResponse.errors[0];
    return `${error.title}: ${error.detail} (Code: ${error.code})`;
  }
}

export const klaviyoService = new KlaviyoService();

export const KlaviyoHelpers = {
  async sendAccountCreated(
    patientId: string,
    email: string,
    additionalProperties: Partial<KlaviyoProfile> = {},
  ): Promise<ApiResponse> {
    return klaviyoService.sendEvent({
      eventName: KlaviyoEvents.ACCOUNT_CREATED,
      patientId,
      email,
      profileProperties: {
        [KlaviyoProfileProperties.ACCOUNT_CREATED_DATE]:
          new Date().toISOString(),
        [KlaviyoProfileProperties.PAID]: false,
        [KlaviyoProfileProperties.ONBOARDING_STATUS]: OnboardingStatus.CREATED,
        [KlaviyoProfileProperties.ENGAGEMENT_STATUS]: EngagementStatus.ACTIVE,
        ...additionalProperties,
      },
    });
  },

  async sendOnboardingCompleted(
    patientId: string,
    email: string,
    additionalProperties: Partial<KlaviyoProfile> = {},
  ): Promise<ApiResponse> {
    return klaviyoService.sendEvent({
      eventName: KlaviyoEvents.ONBOARDING_COMPLETED,
      patientId,
      email,
      profileProperties: {
        [KlaviyoProfileProperties.ONBOARDING_STATUS]:
          OnboardingStatus.ONBOARDING_DONE,
        [KlaviyoProfileProperties.LAST_LOGIN_DATE]: new Date().toISOString(),
        [KlaviyoProfileProperties.ENGAGEMENT_STATUS]: EngagementStatus.ACTIVE,
        ...additionalProperties,
      },
    });
  },

  async sendUserLoggedIn(
    patientId: string,
    email: string,
    daysSinceLastLogin?: number,
    additionalProperties: Partial<KlaviyoProfile> = {},
  ): Promise<ApiResponse> {
    const eventProperties: KlaviyoEventProperties = {};
    if (daysSinceLastLogin !== undefined) {
      eventProperties.days_since_last_login = daysSinceLastLogin;
    }

    return klaviyoService.sendEvent({
      eventName: KlaviyoEvents.USER_LOGGED_IN,
      patientId,
      email,
      eventProperties,
      profileProperties: {
        [KlaviyoProfileProperties.LAST_LOGIN_DATE]: new Date().toISOString(),
        [KlaviyoProfileProperties.ENGAGEMENT_STATUS]: EngagementStatus.ACTIVE,
        ...additionalProperties,
      },
    });
  },
} as const;
