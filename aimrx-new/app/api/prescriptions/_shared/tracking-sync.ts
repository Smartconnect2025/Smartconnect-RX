import { createAdminClient } from "@core/database/client";
import {
  getEasyPostClient,
  detectCarrier,
  easypostCarrierCode,
  mapEasyPostStatus,
} from "./easypost-helpers";

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
    console.error(`[easypost] Failed to create tracker: ${msg}`);
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

  console.log(
    `[tracking-sync] Updated prescription ${prescriptionId} via ${source}: ${update.fedexStatus}`,
  );

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
