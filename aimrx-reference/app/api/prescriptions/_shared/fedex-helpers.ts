import { envConfig } from "@/core/config/envConfig";

// --- Token Cache ---

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Gets a FedEx OAuth2 access token using client_credentials flow.
 * Caches the token in memory until it expires.
 * Returns null if FedEx env vars are not configured.
 */
async function getFedExAccessToken(): Promise<string | null> {
  const { FEDEX_API_KEY, FEDEX_API_SECRET, FEDEX_API_URL } = envConfig;

  if (!FEDEX_API_KEY || !FEDEX_API_SECRET) {
    return null;
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const response = await fetch(`${FEDEX_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: FEDEX_API_KEY,
      client_secret: FEDEX_API_SECRET,
    }),
  });

  if (!response.ok) {
    console.error(
      `[fedex] OAuth token request failed: ${response.status}`,
    );
    return null;
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// --- Types ---

export interface FedExTrackingResult {
  success: true;
  fedexStatus: string;
  estimatedDelivery: string | null;
}

interface FedExAlert {
  code?: string;
  alertType?: string;
  message?: string;
}

interface FedExDateEntry {
  type?: string;
  dateTime?: string;
}

interface FedExTrackResult {
  error?: { code?: string; message?: string };
  latestStatusDetail?: {
    code?: string;
    derivedCode?: string;
    statusByLocale?: string;
    description?: string;
  };
  dateAndTimes?: FedExDateEntry[];
}

// --- Tracking ---

/**
 * Fetches tracking info from FedEx Track API for a single tracking number.
 * POST /track/v1/trackingnumbers
 *
 * Returns null if FedEx is not configured, the call fails, or tracking data is not found.
 */
export async function fetchFedExTracking(
  trackingNumber: string,
): Promise<FedExTrackingResult | null> {
  try {
    const token = await getFedExAccessToken();
    if (!token) return null;

    const { FEDEX_API_URL } = envConfig;

    const response = await fetch(
      `${FEDEX_API_URL}/track/v1/trackingnumbers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-locale": "en_US",
        },
        body: JSON.stringify({
          includeDetailedScans: false,
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber,
              },
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      // 401 = token expired/invalid — clear cache so next call gets a fresh one
      if (response.status === 401) {
        cachedToken = null;
      }
      console.error(`[fedex] Tracking request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Check for top-level alerts (e.g. TRACKING.DATA.NOTFOUND)
    const alerts: FedExAlert[] = data?.output?.alerts ?? [];
    const hasNotFound = alerts.some(
      (a) => a.code === "TRACKING.DATA.NOTFOUND",
    );
    if (hasNotFound) return null;

    // Navigate: output.completeTrackResults[0].trackResults[0]
    const trackResult: FedExTrackResult | undefined =
      data?.output?.completeTrackResults?.[0]?.trackResults?.[0];

    if (!trackResult) return null;

    // Check for per-result error
    if (trackResult.error?.code) return null;

    const fedexStatus =
      trackResult.latestStatusDetail?.description ||
      trackResult.latestStatusDetail?.statusByLocale ||
      null;

    if (!fedexStatus) return null;

    // Prefer ACTUAL_DELIVERY over ESTIMATED_DELIVERY
    const actualDelivery = trackResult.dateAndTimes?.find(
      (d) => d.type === "ACTUAL_DELIVERY",
    )?.dateTime;
    const estimatedDelivery =
      actualDelivery ||
      trackResult.dateAndTimes?.find(
        (d) => d.type === "ESTIMATED_DELIVERY",
      )?.dateTime ||
      null;

    return {
      success: true,
      fedexStatus,
      estimatedDelivery,
    };
  } catch (error) {
    console.error("[fedex] Tracking error:", error);
    return null;
  }
}
