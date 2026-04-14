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
      .eq("action", `EMAIL_SENT_${emailType.toUpperCase()}`)
      .gte("created_at", windowStart)
      .ilike("details", `%${dedupKey}%`)
      .ilike("user_email", recipientEmail)
      .limit(1);

    if (data && data.length > 0) {
      return { allowed: false, reason: `Duplicate email blocked: ${emailType} to ${recipientEmail} within ${windowMinutes}min window` };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[email-guard] Dedup check failed, allowing send:", err);
    return { allowed: true };
  }
}

export async function logEmailSent(
  recipientEmail: string,
  emailType: string,
  dedupKey: string,
  details: string,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: recipientEmail,
      user_name: "Email System",
      action: `EMAIL_SENT_${emailType.toUpperCase()}`,
      details: `${details} [key:${dedupKey}]`,
      status: "success",
    });
  } catch (err) {
    console.error("[email-guard] Failed to log email send:", err);
  }
}
