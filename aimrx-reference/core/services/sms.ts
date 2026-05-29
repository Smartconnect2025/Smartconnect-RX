import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return null;
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

export function isSmsConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

function formatPhoneForTwilio(phone: unknown): string | null {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const intlDigits = trimmed.replace(/\D/g, "");
    if (intlDigits.length >= 10 && intlDigits.length <= 15) return `+${intlDigits}`;
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms(
  to: string,
  message: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const client = getTwilioClient();
    if (!client) {
      return { success: false, error: "Twilio not configured" };
    }

    const formattedTo = formatPhoneForTwilio(to);
    if (!formattedTo) {
      console.warn(`[SMS] Invalid phone number: ${to}`);
      return { success: false, error: `Invalid phone number: ${to}` };
    }

    const result = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER!,
      to: formattedTo,
    });

    console.log(`[SMS] Sent to ${to}: SID=${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] Failed to send to ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export async function sendPaymentLinkSms(
  to: string,
  patientName: string,
  medication: string,
  amount: string,
  paymentUrl: string,
  providerName?: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const message =
    `AIM Medical: Hi ${patientName}, ` +
    `your prescription for ${medication} is ready. ` +
    `Amount due: $${amount}. ` +
    `Pay securely here: ${paymentUrl} ` +
    (providerName ? `Prescribed by ${providerName}. ` : "") +
    `Questions? Call (769) 304-1830. ` +
    `Reply STOP to opt out.`;

  return sendSms(to, message);
}

export async function sendStatusSms(
  to: string,
  patientName: string,
  medication: string,
  statusType: "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup",
  trackingNumber?: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const statusMessages: Record<string, string> = {
    pharmacy_processing: `your prescription for ${medication} is being prepared by the pharmacy.`,
    shipped: `your prescription for ${medication} has shipped!${trackingNumber ? ` Tracking: ${trackingNumber}` : ""}`,
    delivered: `your prescription for ${medication} has been delivered. Please check your delivery location.`,
    ready_for_pickup: `your prescription for ${medication} is ready for pickup at the pharmacy.`,
  };

  const message =
    `AIM Medical: Hi ${patientName}, ` +
    statusMessages[statusType] +
    ` Questions? Call (769) 304-1830.` +
    ` Reply STOP to opt out.`;

  return sendSms(to, message);
}
