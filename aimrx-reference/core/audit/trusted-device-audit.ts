import { createAdminClient } from "@core/database/client";
import { scrubError } from "@core/auth/scrub-trust-token";

/**
 * Audit-log helper for trusted-device lifecycle events.
 *
 * Writes one row to public.system_logs per event using a raw Supabase
 * admin insert (same pattern as the digitalrx webhook + reconcile cron).
 *
 * Fire-and-forget: a failed insert is logged via console.warn and
 * swallowed. This helper must never throw or break the user-facing
 * flow that called it.
 */

export type TrustedDeviceAuditAction =
  | "TRUSTED_DEVICE_GRANTED"
  | "TRUSTED_DEVICE_USED"
  | "TRUSTED_DEVICE_REVOKED"
  | "TRUSTED_DEVICE_FINGERPRINT_MISMATCH"
  | "TRUSTED_DEVICE_EXPIRED"
  | "TRUSTED_DEVICE_MISMATCH_DAILY_SUMMARY";

export interface LogTrustedDeviceEventArgs {
  action: TrustedDeviceAuditAction;
  /** The user the device belongs to. May be null for unauthenticated paths. */
  userId: string | null;
  /** trusted_devices.id when known. Always written into details when present. */
  deviceId?: string | null;
  /**
   * Who triggered the event. For GRANTED/USED this is the user themselves.
   * For REVOKED this is whoever called revoke (user, admin, or null for
   * the password-change trigger / system actions).
   */
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Extra structured fields appended to the human-readable details string. */
  detailsExtra?: Record<string, unknown>;
  status?: "success" | "error";
}

interface UserLookupRow {
  email: string | null;
  full_name: string | null;
}

/**
 * Best-effort user identity lookup for the system_logs row. Never throws.
 * Returns nulls on any failure — the audit row still gets written, just
 * without the human-readable identity columns.
 */
async function resolveUserIdentity(
  userId: string | null,
): Promise<UserLookupRow> {
  if (!userId) return { email: null, full_name: null };
  try {
    const supabase = createAdminClient();
    const [authResult, roleResult] = await Promise.allSettled([
      supabase.auth.admin.getUserById(userId),
      supabase
        .from("user_roles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    let email: string | null = null;
    if (
      authResult.status === "fulfilled" &&
      authResult.value.data?.user?.email
    ) {
      email = authResult.value.data.user.email;
    }
    let full_name: string | null = null;
    if (
      roleResult.status === "fulfilled" &&
      roleResult.value.data?.full_name
    ) {
      full_name = roleResult.value.data.full_name as string;
    }
    return { email, full_name };
  } catch {
    return { email: null, full_name: null };
  }
}

function buildDetails(
  action: TrustedDeviceAuditAction,
  deviceId: string | null | undefined,
  detailsExtra: Record<string, unknown> | undefined,
): string {
  const dev = deviceId ? `device=${deviceId}` : "device=?";
  const extra = detailsExtra
    ? Object.entries(detailsExtra)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(" ")
    : "";

  let msg: string;
  switch (action) {
    case "TRUSTED_DEVICE_GRANTED":
      msg = "Trusted device granted (90-day trust)";
      break;
    case "TRUSTED_DEVICE_USED":
      msg = "Trusted device skipped 2FA via cookie";
      break;
    case "TRUSTED_DEVICE_REVOKED":
      msg = "Trusted device revoked";
      break;
    case "TRUSTED_DEVICE_FINGERPRINT_MISMATCH":
      msg = "Trusted device fingerprint changed — trust auto-broken";
      break;
    case "TRUSTED_DEVICE_EXPIRED":
      msg = "Trusted device 90-day window elapsed — trust auto-broken";
      break;
    case "TRUSTED_DEVICE_MISMATCH_DAILY_SUMMARY":
      msg = "Trusted device fingerprint mismatch — 24h summary";
      break;
  }
  return [msg, dev, extra].filter(Boolean).join(" | ");
}

export async function logTrustedDeviceEvent(
  args: LogTrustedDeviceEventArgs,
): Promise<void> {
  try {
    const {
      action,
      userId,
      deviceId,
      actorId,
      ip,
      userAgent,
      detailsExtra,
      status,
    } = args;

    const identity = await resolveUserIdentity(userId);
    const supabase = createAdminClient();

    // Fold actor provenance into the details string when it differs from
    // the device owner (e.g. admin-initiated revoke, password-change-
    // triggered auto-revoke). Self-actions stay quiet to keep the
    // human-readable line short.
    const detailsExtraWithActor: Record<string, unknown> = {
      ...(detailsExtra ?? {}),
    };
    if (actorId && actorId !== userId) {
      detailsExtraWithActor.actor = actorId;
    } else if (actorId === null && userId) {
      // null actor on a known-user event = system trigger (e.g. cron,
      // password-change auto-revoke). Worth recording for forensics.
      detailsExtraWithActor.actor = "system";
    }

    const { error } = await supabase.from("system_logs").insert({
      user_id: userId,
      user_email: identity.email,
      user_name: identity.full_name,
      action,
      details: buildDetails(action, deviceId ?? null, detailsExtraWithActor),
      status: status ?? "success",
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
    });

    if (error) {
      console.warn("[trusted-device-audit] system_logs insert failed", {
        action,
        error: scrubError(error),
      });
    }
  } catch (err) {
    console.warn("[trusted-device-audit] handler threw", {
      action: args.action,
      error: scrubError(err),
    });
  }
}
