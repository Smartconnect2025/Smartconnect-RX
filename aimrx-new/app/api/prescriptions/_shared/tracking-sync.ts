import { createAdminClient } from "@core/database/client";
import {
  getEasyPostClient,
  detectCarrier,
  easypostCarrierCode,
  mapEasyPostStatus,
} from "./easypost-helpers";
import { alertBadTrackingNumber } from "@core/services/admin-alerts";

type StatusEmailType = "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup";

const STATUS_EMAIL_MAP: Record<string, StatusEmailType> = {
  delivered: "delivered",
  picked_up: "shipped",
};

async function wasNotificationAlreadySent(
  supabase: ReturnType<typeof createAdminClient>,
  prescriptionId: string,
  statusType: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("system_logs")
    .select("id")
    .eq("action", "PATIENT_STATUS_EMAIL_SENT")
    .ilike("details", `%${prescriptionId}%`)
    .ilike("details", `%${statusType}%`)
    .limit(1);
  return (data && data.length > 0) || false;
}

async function recordNotificationSent(
  supabase: ReturnType<typeof createAdminClient>,
  prescriptionId: string,
  statusType: string,
  recipientEmail: string,
) {
  await supabase.from("system_logs").insert({
    user_id: null,
    user_email: "system@aimrx.com",
    user_name: "Patient Notification",
    action: "PATIENT_STATUS_EMAIL_SENT",
    details: `${statusType} email sent for ${prescriptionId} to ${recipientEmail}`,
    status: "success",
  });
}

async function sendStatusEmail(prescriptionId: string, newStatus: string, trackingNumber?: string) {
  const emailType = STATUS_EMAIL_MAP[newStatus];
  if (!emailType) return;

  const supabase = createAdminClient();
  const alreadySent = await wasNotificationAlreadySent(supabase, prescriptionId, emailType);
  if (alreadySent) {
    console.log(`[tracking-sync] Skipping duplicate ${emailType} email for ${prescriptionId}`);
    return;
  }

  const { data: rx } = await supabase
    .from("prescriptions")
    .select("patient_id, prescriber_id, medication, dosage, pharmacy_id, tracking_number")
    .eq("id", prescriptionId)
    .single();

  if (!rx?.patient_id) return;

  const { data: patient } = await supabase
    .from("patients")
    .select("email, first_name, last_name, phone")
    .eq("id", rx.patient_id)
    .single();

  if (!patient?.email) return;

  const { data: provider } = await supabase
    .from("providers")
    .select("first_name, last_name")
    .eq("user_id", rx.prescriber_id)
    .single();

  let pharmacyName: string | undefined;
  let pharmacyPhone: string | undefined;
  let pharmacyAddress: string | undefined;

  if (rx.pharmacy_id) {
    const { data: pharmacy } = await supabase
      .from("pharmacies")
      .select("name, phone, address")
      .eq("id", rx.pharmacy_id)
      .single();
    pharmacyName = pharmacy?.name;
    pharmacyPhone = pharmacy?.phone;
    pharmacyAddress = pharmacy?.address;
  }

  const medication = [rx.medication, rx.dosage].filter(Boolean).join(" ");
  const providerName = provider ? `Dr. ${provider.first_name} ${provider.last_name}` : "Your Provider";
  const patientName = `${patient.first_name} ${patient.last_name}`;
  const tracking = trackingNumber || rx.tracking_number;

  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const payload: Record<string, unknown> = {
      patientEmail: patient.email,
      patientPhone: patient.phone || undefined,
      patientName,
      medication,
      providerName,
      statusType: emailType,
      prescriptionId,
      pharmacyName,
      pharmacyPhone,
      pharmacyAddress,
    };

    if (tracking) {
      payload.trackingNumber = tracking;
    }

    const response = await fetch(`${APP_URL}/api/payments/send-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[tracking-sync] Status email FAILED for ${prescriptionId}: ${response.status}`);
    } else {
      console.log(`[tracking-sync] Status email sent: ${emailType} -> ${patient.email}`);
      await recordNotificationSent(supabase, prescriptionId, emailType, patient.email);
    }
  } catch (err) {
    console.error(`[tracking-sync] Status email error for ${prescriptionId}:`, err);
  }
}

export async function ensureTrackerRegistered(
  prescriptionId: string,
  trackingNumber: string,
  carrier?: string,
): Promise<{ trackerId: string | null; error?: string }> {
  const ep = getEasyPostClient();
  if (!ep) return { trackerId: null, error: "EasyPost not configured" };

  const supabase = createAdminClient();

  const { data: rx } = await supabase
    .from("prescriptions")
    .select("easypost_tracker_id, tracking_carrier")
    .eq("id", prescriptionId)
    .single();

  if (rx?.easypost_tracker_id) {
    return { trackerId: rx.easypost_tracker_id };
  }

  const resolvedCarrier = carrier || detectCarrier(trackingNumber);

  try {
    const tracker = await ep.Tracker.create({
      tracking_code: trackingNumber,
      carrier: easypostCarrierCode(resolvedCarrier),
    });

    await supabase
      .from("prescriptions")
      .update({
        easypost_tracker_id: tracker.id,
        tracking_carrier: resolvedCarrier,
        last_tracking_check: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    console.log(
      `[easypost] Tracker registered: ${tracker.id} for prescription ${prescriptionId} (${resolvedCarrier} ${trackingNumber})`,
    );

    return { trackerId: tracker.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("in-flight")) {
      console.log(`[easypost] Tracker already exists for ${trackingNumber}, looking it up...`);
      try {
        const trackers = await ep.Tracker.all({
          tracking_code: trackingNumber,
        });
        const existing = (trackers as { trackers?: Array<{ id: string }> })?.trackers?.[0];
        if (existing?.id) {
          await supabase
            .from("prescriptions")
            .update({
              easypost_tracker_id: existing.id,
              last_tracking_check: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", prescriptionId);
          console.log(`[easypost] Found existing tracker: ${existing.id}`);
          return { trackerId: existing.id };
        }
      } catch (lookupErr) {
        console.error(`[easypost] Tracker lookup failed:`, lookupErr);
      }
    }

    console.error(`[easypost] Failed to create tracker: ${msg}`);

    if (msg.includes("carrier") || msg.includes("not found") || msg.includes("invalid")) {
      alertBadTrackingNumber(
        "Unknown",
        "",
        trackingNumber,
        prescriptionId,
        msg,
      ).catch((e) => console.error("[easypost] Admin alert error:", e));
    }

    return { trackerId: null, error: msg };
  }
}

export async function applyTrackingUpdate(
  prescriptionId: string,
  trackerPayload: Record<string, unknown>,
  source: string,
): Promise<{ updated: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { data: rx } = await supabase
    .from("prescriptions")
    .select("id, status, fedex_status, last_tracking_event_id, order_progress")
    .eq("id", prescriptionId)
    .single();

  if (!rx) return { updated: false, error: "Prescription not found" };

  const update = mapEasyPostStatus(
    trackerPayload as Parameters<typeof mapEasyPostStatus>[0],
  );

  if (update.eventId && update.eventId === rx.last_tracking_event_id) {
    return { updated: false };
  }

  if (rx.status === "delivered" && update.orderProgress !== "delivered") {
    return { updated: false };
  }

  const updateData: Record<string, unknown> = {
    fedex_status: update.fedexStatus,
    last_tracking_check: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (update.eventId) {
    updateData.last_tracking_event_id = update.eventId;
  }

  if (update.carrier && update.carrier !== "unknown") {
    updateData.tracking_carrier = update.carrier;
  }

  if (update.estimatedDelivery) {
    updateData.estimated_delivery = update.estimatedDelivery;
  }

  if (update.deliveryDate) {
    updateData.delivery_date = update.deliveryDate;
  }

  if (update.orderProgress === "delivered") {
    updateData.status = "delivered";
    updateData.order_progress = "delivered";
  } else if (update.orderProgress === "shipped") {
    if (!["delivered", "picked_up"].includes(rx.status)) {
      updateData.status = "picked_up";
    }
    if (rx.order_progress !== "delivered") {
      updateData.order_progress = "shipped";
    }
  }

  const { error } = await supabase
    .from("prescriptions")
    .update(updateData)
    .eq("id", prescriptionId);

  if (error) {
    console.error(`[tracking-sync] Update failed for ${prescriptionId}:`, error.message);
    return { updated: false, error: error.message };
  }

  const newStatus = updateData.status as string | undefined;
  console.log(
    `[tracking-sync] Updated ${prescriptionId} via ${source}: ${update.fedexStatus}${newStatus ? ` (status -> ${newStatus})` : ""}`,
  );

  if (newStatus && newStatus !== rx.status) {
    const trackingNum = (trackerPayload as { tracking_code?: string }).tracking_code;
    sendStatusEmail(prescriptionId, newStatus, trackingNum || undefined).catch((err) =>
      console.error(`[tracking-sync] Email dispatch error:`, err),
    );
  }

  return { updated: true };
}

export async function fetchAndApplyTracking(
  prescriptionId: string,
  trackingNumber: string,
  easypostTrackerId?: string | null,
): Promise<{ updated: boolean; error?: string }> {
  const ep = getEasyPostClient();
  if (!ep) return { updated: false, error: "EasyPost not configured" };

  try {
    let tracker;
    if (easypostTrackerId) {
      tracker = await ep.Tracker.retrieve(easypostTrackerId);
    } else {
      const result = await ensureTrackerRegistered(
        prescriptionId,
        trackingNumber,
      );
      if (!result.trackerId) {
        return { updated: false, error: result.error };
      }
      tracker = await ep.Tracker.retrieve(result.trackerId);
    }

    return applyTrackingUpdate(prescriptionId, tracker as unknown as Record<string, unknown>, "polling");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tracking-sync] fetchAndApply error: ${msg}`);
    return { updated: false, error: msg };
  }
}
