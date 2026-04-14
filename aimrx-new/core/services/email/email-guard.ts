import { createAdminClient } from "@core/database/client";

export async function checkEmailDedup(
  recipientEmail: string,
  emailType: string,
  dedupKey: string,
  windowMinutes: number = 30,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = createAdminClient();
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("system_logs")
      .select("id")
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .eq("user_email", recipientEmail)
      .ilike("details", `%${dedupKey}%`)
      .ilike("details", `%${emailType}%`)
      .gte("created_at", windowStart)
      .limit(1);

    if (data && data.length > 0) {
      return { allowed: false, reason: `Duplicate email blocked: ${emailType} to ${recipientEmail} within ${windowMinutes}min window` };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .gte("created_at", oneHourAgo);

    if ((hourlyCount || 0) >= 100) {
      return { allowed: false, reason: "Hourly email rate limit reached (100/hour)" };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from("system_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PATIENT_NOTIFICATION_SENT")
      .gte("created_at", oneDayAgo);

    if ((dailyCount || 0) >= 500) {
      return { allowed: false, reason: "Daily email rate limit reached (500/day)" };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[email-guard] Dedup check failed, allowing send:", err);
    return { allowed: true };
  }
}

export async function logEmailSent(
  recipientEmail: string,
  patientName: string,
  details: string,
  queueId?: string | null,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: recipientEmail,
      user_name: patientName || "Patient",
      action: "PATIENT_NOTIFICATION_SENT",
      details,
      queue_id: queueId || null,
      status: "success",
    });
  } catch (err) {
    console.error("[email-guard] Failed to log email send:", err);
  }
}

export async function logEmailFailed(
  recipientEmail: string,
  patientName: string,
  details: string,
  queueId?: string | null,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: recipientEmail,
      user_name: patientName || "Patient",
      action: "PATIENT_NOTIFICATION_FAILED",
      details,
      queue_id: queueId || null,
      status: "error",
    });
  } catch (err) {
    console.error("[email-guard] Failed to log email failure:", err);
  }
}
