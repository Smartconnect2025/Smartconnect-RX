import EasyPostClient from "@easypost/api";

let client: InstanceType<typeof EasyPostClient> | null = null;

export function getEasyPostClient(): InstanceType<typeof EasyPostClient> | null {
  const apiKey = process.env.EASYPOST_TEST_API_KEY || process.env.EASYPOST_API_KEY;
  if (!apiKey) {
    console.warn("[easypost] No API key configured");
    return null;
  }
  if (!client) {
    client = new EasyPostClient(apiKey);
  }
  return client;
}

export function detectCarrier(trackingNumber: string): string {
  if (!trackingNumber) return "unknown";
  const tn = trackingNumber.trim().toUpperCase();

  if (/^\d{12,22}$/.test(tn) || /^\d{34}$/.test(tn)) return "FedEx";
  if (/^1Z[A-Z0-9]{16}$/.test(tn)) return "UPS";
  if (/^(94|93|92|91|70|23|13)\d{18,22}$/.test(tn) || /^\d{20,30}$/.test(tn)) return "USPS";
  if (/^\d{10,11}$/.test(tn)) return "DHL";

  return "FedEx";
}

const EASYPOST_CARRIER_MAP: Record<string, string> = {
  FedEx: "FedEx",
  UPS: "UPS",
  USPS: "USPS",
  DHL: "DHLExpress",
};

export function easypostCarrierCode(carrier: string): string {
  return EASYPOST_CARRIER_MAP[carrier] || carrier;
}

export interface TrackingUpdate {
  fedexStatus: string;
  orderProgress: string;
  estimatedDelivery: string | null;
  deliveryDate: string | null;
  carrier: string;
  eventId: string | null;
}

export function mapEasyPostStatus(tracker: {
  status?: string;
  status_detail?: string;
  est_delivery_date?: string;
  tracking_details?: Array<{
    datetime?: string;
    message?: string;
    status?: string;
    status_detail?: string;
  }>;
  carrier?: string;
  id?: string;
}): TrackingUpdate {
  const status = tracker.status || "unknown";
  const statusDetail = tracker.status_detail || status;

  const statusDisplayMap: Record<string, string> = {
    pre_transit: "Label Created",
    in_transit: "In Transit",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    return_to_sender: "Return to Sender",
    failure: "Delivery Failed",
    cancelled: "Cancelled",
    error: "Tracking Error",
    available_for_pickup: "Available for Pickup",
    unknown: "Unknown",
  };

  const fedexStatus = statusDisplayMap[status] || statusDetail || status;

  const progressMap: Record<string, string> = {
    pre_transit: "shipped",
    in_transit: "shipped",
    out_for_delivery: "shipped",
    delivered: "delivered",
    return_to_sender: "shipped",
    failure: "shipped",
    available_for_pickup: "shipped",
  };

  const orderProgress = progressMap[status] || "shipped";

  let deliveryDate: string | null = null;
  if (status === "delivered" && tracker.tracking_details?.length) {
    const deliveryEvent = tracker.tracking_details.find(
      (d) => d.status === "delivered"
    );
    if (deliveryEvent?.datetime) {
      deliveryDate = deliveryEvent.datetime;
    }
  }

  const latestEvent = tracker.tracking_details?.[0];
  const eventId = latestEvent
    ? `${latestEvent.datetime}_${latestEvent.status}`
    : null;

  return {
    fedexStatus,
    orderProgress,
    estimatedDelivery: tracker.est_delivery_date || null,
    deliveryDate,
    carrier: tracker.carrier || "unknown",
    eventId,
  };
}
