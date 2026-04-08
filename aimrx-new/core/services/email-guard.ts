import { createAdminClient } from "@core/lib/supabase/admin";

interface DeduplicationResult {
  allowed: boolean;
  reason?: string;
}

export async function checkEmailDedup(
  recipientEmail: string,
  emailType: string,
  deduplicationKey: string,
  windowMinutes: number = 30
): Promise<DeduplicationResult> {
  try {
    const supabase = createAdminClient();
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { count: recentCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .in("action", ["PATIENT_NOTIFICATION_SENT", "PATIENT_SMS_SENT"])
      .eq("user_email", recipientEmail)
      .eq("status", "success")
      .ilike("details", `%${deduplicationKey}%`)
      .gte("created_at", windowStart);

    if (recentCount && recentCount > 0) {
      return {
        allowed: false,
        reason: `Duplicate ${emailType} to ${recipientEmail} within ${windowMinutes} minutes`,
      };
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .in("action", ["PATIENT_NOTIFICATION_SENT", "PATIENT_SMS_SENT"])
      .eq("user_email", recipientEmail)
      .gte("created_at", hourAgo);

    if (hourlyCount && hourlyCount >= 100) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${recipientEmail} has received 100+ notifications in the last hour`,
      };
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .in("action", ["PATIENT_NOTIFICATION_SENT", "PATIENT_SMS_SENT"])
      .eq("user_email", recipientEmail)
      .gte("created_at", dayAgo);

    if (dailyCount && dailyCount >= 500) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${recipientEmail} has received 500+ notifications today`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[EMAIL-GUARD] Error checking dedup:", error);
    return { allowed: true };
  }
}
