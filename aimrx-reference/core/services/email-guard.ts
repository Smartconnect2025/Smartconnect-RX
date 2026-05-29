import { createAdminClient } from "@core/database/client";

const HOURLY_EMAIL_CAP = 100;
const DAILY_EMAIL_CAP = 500;

export interface EmailGuardResult {
  allowed: boolean;
  reason?: string;
}

export async function checkEmailDedup(
  recipientEmail: string,
  emailType: string,
  deduplicationKey: string,
  windowMinutes: number = 60,
): Promise<EmailGuardResult> {
  try {
    const supabase = createAdminClient();
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from("system_logs")
      .select("id")
      .eq("user_email", recipientEmail)
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .ilike("details", `%${deduplicationKey}%`)
      .ilike("details", `%${emailType}%`)
      .gte("created_at", windowStart)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        allowed: false,
        reason: `Duplicate: ${emailType} already sent to ${recipientEmail} for ${deduplicationKey} within ${windowMinutes}min`,
      };
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .gte("created_at", hourAgo);

    if ((hourlyCount ?? 0) >= HOURLY_EMAIL_CAP) {
      return {
        allowed: false,
        reason: `Rate limit: ${hourlyCount} emails sent in the last hour (cap: ${HOURLY_EMAIL_CAP})`,
      };
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .gte("created_at", dayAgo);

    if ((dailyCount ?? 0) >= DAILY_EMAIL_CAP) {
      return {
        allowed: false,
        reason: `Rate limit: ${dailyCount} emails sent in the last 24h (cap: ${DAILY_EMAIL_CAP})`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[email-guard] Check failed:", err instanceof Error ? err.message : err);
    return { allowed: true };
  }
}
