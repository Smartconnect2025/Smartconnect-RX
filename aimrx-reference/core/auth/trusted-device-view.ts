import "server-only";

import type { TrustedDeviceRow } from "@core/auth/trusted-device";

/**
 * UI-safe representation of a trusted_devices row for the
 * /settings/security "My Trusted Devices" section. Never exposes
 * token_hash or device_fingerprint_hash to the client.
 */
export interface TrustedDeviceView {
  id: string;
  deviceName: string;
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  isCurrent: boolean;
}

interface ParsedUA {
  browser: string;
  os: string;
}

/**
 * Tiny dependency-free UA parser. Recognizes the major browser/OS
 * combos AimRX users actually run; everything else falls back to
 * "Unknown browser" / "Unknown OS". Order matters — Edge must beat
 * Chrome, Chrome must beat Safari (UA strings are nested).
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua || typeof ua !== "string") {
    return { browser: "Unknown browser", os: "Unknown OS" };
  }

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Chromium\//i.test(ua)) browser = "Chromium";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows NT 10/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os };
}

export function deviceNameFromUA(ua: string | null | undefined): string {
  const { browser, os } = parseUserAgent(ua);
  if (browser === "Unknown browser" && os === "Unknown OS") {
    return "Unknown device";
  }
  return `${browser} on ${os}`;
}

/**
 * Project a TrustedDeviceRow into the UI-safe view sent to the client.
 * `currentTokenHash`, when supplied and matching the row's token_hash,
 * marks the row as the device the user is currently signed in from.
 */
export function toTrustedDeviceView(
  row: TrustedDeviceRow,
  currentTokenHash: string | null,
): TrustedDeviceView {
  return {
    id: row.id,
    deviceName: deviceNameFromUA(row.user_agent),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    ip: row.ip_last_seen || row.ip_first_seen || null,
    isCurrent:
      !!currentTokenHash && row.token_hash === currentTokenHash,
  };
}
