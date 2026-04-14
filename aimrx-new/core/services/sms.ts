import { createAdminClient } from "@core/database/client";

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

async function getTwilioClient() {
  if (!isSmsConfigured()) return null;
  const twilio = await import("twilio");
  return twilio.default(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

async function logSms(
  phone: string,
  patientName: string,
  details: string,
  success: boolean,
  queueId?: string | null,
) {
  try {
    const supabase = createAdminClient();
    await supabase.from("system_logs").insert({
      user_id: null,
      user_email: phone,
      user_name: patientName || "Patient",
      action: success ? "PATIENT_SMS_SENT" : "PATIENT_SMS_FAILED",
      details,
      queue_id: queueId || null,
      status: success ? "success" : "error",
    });
  } catch (err) {
    console.error("[sms] Failed to log SMS:", err);
  }
}

export async function sendSms(
  phone: string,
  message: string,
  patientName?: string,
  logDetails?: string,
  queueId?: string | null,
): Promise<boolean> {
  if (!isSmsConfigured() || !phone) return false;

  try {
    const client = await getTwilioClient();
    if (!client) return false;

    await client.messages.create({
      body: message,
      to: phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });

    if (logDetails) {
      await logSms(phone, patientName || "Patient", logDetails, true, queueId);
    }
    return true;
  } catch (err) {
    console.error("[sms] Failed to send SMS:", err);
    if (logDetails) {
      await logSms(phone, patientName || "Patient", `${logDetails} | Error: ${err instanceof Error ? err.message : "Unknown"}`, false, queueId);
    }
    return false;
  }
}

export async function sendPaymentLinkSms(params: {
  phone: string;
  patientName: string;
  medication: string;
  amount: string;
  paymentUrl: string;
  providerName?: string;
}): Promise<boolean> {
  const message = `Hi ${params.patientName}, your prescription for ${params.medication} ($${params.amount}) is ready for payment. Complete your secure payment here: ${params.paymentUrl} - AIM Medical`;
  const details = `Payment Request SMS | To: ${params.phone} | Medication: ${params.medication} | Amount: $${params.amount} | Provider: ${params.providerName || "N/A"}`;
  return sendSms(params.phone, message, params.patientName, details);
}

export async function sendStatusSms(params: {
  phone: string;
  patientName: string;
  medication: string;
  statusType: string;
  trackingNumber?: string;
  providerName?: string;
  pharmacyName?: string;
}): Promise<boolean> {
  const statusMessages: Record<string, string> = {
    pharmacy_processing: `Hi ${params.patientName}, your prescription for ${params.medication} is being prepared${params.pharmacyName ? ` by ${params.pharmacyName}` : ""}. We'll notify you when it ships.`,
    shipped: `Hi ${params.patientName}, your ${params.medication} prescription has shipped!${params.trackingNumber ? ` Tracking: ${params.trackingNumber}` : ""} - AIM Medical`,
    delivered: `Hi ${params.patientName}, your ${params.medication} prescription has been delivered. Please check your delivery location. - AIM Medical`,
    ready_for_pickup: `Hi ${params.patientName}, your ${params.medication} prescription is ready for pickup${params.pharmacyName ? ` at ${params.pharmacyName}` : ""}. Bring a valid photo ID. - AIM Medical`,
  };

  const message = statusMessages[params.statusType] || `Hi ${params.patientName}, update on your ${params.medication} prescription: ${params.statusType}. - AIM Medical`;
  const details = `Status SMS | To: ${params.phone} | Medication: ${params.medication} | Status: ${params.statusType} | Provider: ${params.providerName || "N/A"} | Pharmacy: ${params.pharmacyName || "N/A"}${params.trackingNumber ? ` | Tracking: ${params.trackingNumber}` : ""}`;
  return sendSms(params.phone, message, params.patientName, details);
}
