import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import { ensureTrackerRegistered } from "@/app/api/prescriptions/_shared/tracking-sync";
import { sendPatientStatusEmail } from "@core/services/email/send-patient-status-email";

const PIONEERRX_WEBHOOK_USERNAME = process.env.PIONEERRX_WEBHOOK_USERNAME;
const PIONEERRX_WEBHOOK_PASSWORD = process.env.PIONEERRX_WEBHOOK_PASSWORD;
const PIONEERRX_WEBHOOK_SECRET = process.env.PIONEERRX_WEBHOOK_SECRET;

const EVENT_STATUS_MAP: Record<number, string> = {
  1: "submitted",
  2: "packed",
  3: "cancelled",
  5: "packed",
  6: "delivered",
  7: "submitted",
  8: "approved",
  9: "packed",
  10: "submitted",
  11: "packed",
  12: "submitted",
};

const RX_STATUS_TEXT_MAP: Record<string, string> = {
  "waiting for data entry": "submitted",
  "data entry": "submitted",
  "fill in progress": "submitted",
  "fillable on hold": "submitted",
  "on hold": "submitted",
  "ready for pharmacist review": "packed",
  "pharmacist review": "packed",
  "verified": "approved",
  "ready for pickup": "ready_for_pickup",
  "ready for delivery": "ready_for_pickup",
  "ready for shipping": "ready_for_pickup",
  "will call": "ready_for_pickup",
  "out for delivery": "picked_up",
  "in transit": "picked_up",
  "shipped": "picked_up",
  "picked up": "picked_up",
  "completed": "delivered",
  "complete": "delivered",
  "delivered": "delivered",
  "cancelled": "cancelled",
  "canceled": "cancelled",
  "rejected": "cancelled",
  "voided": "cancelled",
  "discontinued": "cancelled",
  "reversed": "cancelled",
  "received": "submitted",
  "queued": "submitted",
  "pending": "submitted",
  "filled": "packed",
  "dispensed": "packed",
  "packed": "packed",
  "approved": "approved",
};

function mapToOrderProgress(status: string): string {
  const s = status.toLowerCase().replace(/[\s_-]/g, "");
  if (s === "delivered" || s === "completed" || s === "complete") return "delivered";
  if (s === "shipped" || s === "pickedup" || s === "intransit") return "picked_up";
  if (s === "readyforpickup" || s === "readyfordelivery" || s === "readyforshipping" || s === "willcall") return "ready_for_pickup";
  if (s === "approved" || s === "verified") return "approved";
  if (s === "packed" || s === "filled" || s === "dispensed") return "packed";
  if (s === "cancelled" || s === "canceled" || s === "rejected") return "cancelled";
  return "submitted";
}

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    if (PIONEERRX_WEBHOOK_USERNAME && PIONEERRX_WEBHOOK_PASSWORD) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
      const [user, pass] = decoded.split(":");
      if (user === PIONEERRX_WEBHOOK_USERNAME && pass === PIONEERRX_WEBHOOK_PASSWORD) {
        return true;
      }
    }
  }

  if (PIONEERRX_WEBHOOK_SECRET) {
    const urlToken = request.nextUrl.searchParams.get("token");
    if (urlToken === PIONEERRX_WEBHOOK_SECRET) return true;

    const headerSecret = request.headers.get("x-webhook-secret");
    if (headerSecret === PIONEERRX_WEBHOOK_SECRET) return true;
  }

  if (!PIONEERRX_WEBHOOK_SECRET && !PIONEERRX_WEBHOOK_USERNAME) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhook/pioneerrx] SECURITY: No auth configured in production — rejecting request. Set PIONEERRX_WEBHOOK_USERNAME/PASSWORD or PIONEERRX_WEBHOOK_SECRET.",
      );
      return false;
    }
    console.warn(
      "[webhook/pioneerrx] No auth configured — accepting request in development. Set PIONEERRX_WEBHOOK_USERNAME/PASSWORD or PIONEERRX_WEBHOOK_SECRET for production.",
    );
    return true;
  }

  return false;
}

interface RxEventBody {
  MessageHeader?: {
    Version?: number;
    MessageID?: string;
    SentOnUTC?: string;
    Workstation?: string;
    InitiatingEventID?: string | number;
    InitiatingEventText?: string;
  };
  Message_Header?: {
    Message_ID?: string;
    Message_Type?: string;
  };
  Body?: {
    Pharmacy?: Record<string, unknown>;
    Patient?: Record<string, unknown>;
    Rx?: {
      RxNumber?: number;
      RxPioneerRxID?: string;
      RxFillTransactionPioneerRxID?: string;
      CurrentRxStatusID?: number;
      CurrentRxStatusText?: string;
      CurrentRxTransactionStatusID?: number;
      CurrentRxTransactionStatusText?: string;
      CompletedDate?: string;
      TrackingNumber?: string;
      [key: string]: unknown;
    };
    Claims?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function deriveStatusFromEvent(body: RxEventBody): {
  newStatus: string;
  queueId: string | null;
  trackingNumber: string | null;
  rxNumber: number | null;
} {
  let newStatus = "submitted";
  let queueId: string | null = null;
  let trackingNumber: string | null = null;
  let rxNumber: number | null = null;

  const rx = body.Body?.Rx;
  if (rx) {
    queueId = rx.RxFillTransactionPioneerRxID || rx.RxPioneerRxID || null;
    rxNumber = rx.RxNumber || null;
    trackingNumber = rx.TrackingNumber || null;

    if (rx.CurrentRxTransactionStatusText) {
      const normalized = rx.CurrentRxTransactionStatusText.toLowerCase().trim();
      newStatus = RX_STATUS_TEXT_MAP[normalized] || newStatus;
    } else if (rx.CurrentRxStatusText) {
      const normalized = rx.CurrentRxStatusText.toLowerCase().trim();
      newStatus = RX_STATUS_TEXT_MAP[normalized] || newStatus;
    } else if (rx.CompletedDate) {
      newStatus = "delivered";
    }
  }

  const eventId = body.MessageHeader?.InitiatingEventID;
  if (eventId && !rx?.CurrentRxTransactionStatusText && !rx?.CurrentRxStatusText) {
    const eventNum = typeof eventId === "string" ? parseInt(eventId) : eventId;
    if (EVENT_STATUS_MAP[eventNum]) {
      newStatus = EVENT_STATUS_MAP[eventNum];
    }
  }

  if (!queueId) {
    queueId =
      (body as Record<string, unknown>).rxTransactionID as string ||
      (body as Record<string, unknown>).RxTransactionID as string ||
      (body as Record<string, unknown>).QueueID as string ||
      (body as Record<string, unknown>).queue_id as string ||
      (body as Record<string, unknown>).id as string ||
      null;

    if (!queueId && !trackingNumber) {
      trackingNumber =
        (body as Record<string, unknown>).trackingNumber as string ||
        (body as Record<string, unknown>).TrackingNumber as string ||
        null;
    }

    const rawStatus =
      (body as Record<string, unknown>).status as string ||
      (body as Record<string, unknown>).Status as string ||
      (body as Record<string, unknown>).new_status as string;

    if (rawStatus) {
      const normalized = rawStatus.toLowerCase().trim();
      newStatus = RX_STATUS_TEXT_MAP[normalized] || normalized.replace(/\s+/g, "_");
    }
  }

  return { newStatus, queueId, trackingNumber, rxNumber };
}

function buildAckResponse(messageId: string): NextResponse {
  return NextResponse.json(
    {
      Message_Header: {
        Message_ID: messageId,
        Message_Type: "ACK",
      },
    },
    { status: 200 },
  );
}

function buildNakResponse(messageId: string, error: string): NextResponse {
  return NextResponse.json(
    {
      Message_Header: {
        Message_ID: messageId,
        Message_Type: "NAK",
        Error: error,
      },
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAuth(request)) {
      console.error("[webhook/pioneerrx] Unauthorized webhook attempt");
      return NextResponse.json(
        { Status: "Error", Message: "Unauthorized", success: false },
        { status: 401 },
      );
    }

    const body: RxEventBody = await request.json();

    const messageId = body.MessageHeader?.MessageID || body.Message_Header?.Message_ID || "";
    const eventText =
      body.MessageHeader?.InitiatingEventText ||
      body.MessageHeader?.InitiatingEventID ||
      "unknown";
    console.log(
      `[webhook/pioneerrx] Received event: ${eventText}, messageId: ${messageId || "none"}`,
    );

    const { newStatus, queueId, trackingNumber, rxNumber } = deriveStatusFromEvent(body);

    if (!queueId) {
      console.warn("[webhook/pioneerrx] No queueId found in payload, logging and acknowledging");
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@pioneerrx.com",
        user_name: "PioneerRx Webhook",
        action: "WEBHOOK_EVENT_RECEIVED",
        details: `Event '${eventText}' received but no queueId found. RxNumber: ${rxNumber || "none"}`,
        status: "warning",
      });
      return buildAckResponse(messageId);
    }

    const supabaseAdmin = createAdminClient();

    const { data: prescription, error: findError } = await supabaseAdmin
      .from("prescriptions")
      .select("id, status, queue_id, prescriber_id, patients(first_name, last_name)")
      .eq("queue_id", queueId)
      .single();

    if (findError || !prescription) {
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@pioneerrx.com",
        user_name: "PioneerRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Prescription not found for queueId: ${queueId}, event: ${eventText}`,
        queue_id: queueId,
        status: "warning",
      });
      return buildNakResponse(messageId, "UnknownID or missing id");
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      order_progress: mapToOrderProgress(newStatus),
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    const rx = body.Body?.Rx;
    if (rx) {
      if (rx.CompletedDate) {
        updateData.delivery_date = String(rx.CompletedDate);
      }
    }

    const flatBody = body as Record<string, unknown>;
    if (flatBody.patientCopay != null || flatBody.PatCopay != null || flatBody.PatPay != null) {
      updateData.patient_copay = String(flatBody.patientCopay ?? flatBody.PatCopay ?? flatBody.PatPay);
    }
    if (flatBody.lotNumber || flatBody.LotNumber) {
      updateData.lot_number = String(flatBody.lotNumber || flatBody.LotNumber);
    }
    if (flatBody.deliveryDate || flatBody.DeliveryDate || flatBody.deliveredDate || flatBody.DeliveredDate) {
      updateData.delivery_date = String(
        flatBody.deliveryDate || flatBody.DeliveryDate || flatBody.deliveredDate || flatBody.DeliveredDate,
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update(updateData)
      .eq("id", prescription.id);

    if (updateError) {
      console.error("[webhook/pioneerrx] Update failed:", updateError.message);
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@pioneerrx.com",
        user_name: "PioneerRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Failed to update prescription: ${updateError.message}`,
        queue_id: queueId,
        status: "error",
      });
      return buildNakResponse(messageId, "Internal processing error");
    }

    if (trackingNumber) {
      ensureTrackerRegistered(prescription.id, trackingNumber).catch((err) =>
        console.error("[webhook/pioneerrx] EasyPost registration error:", err),
      );
    }

    await supabaseAdmin.from("system_logs").insert({
      user_id: null,
      user_email: "webhook@pioneerrx.com",
      user_name: "PioneerRx Webhook",
      action: "WEBHOOK_STATUS_UPDATE",
      details: `Event '${eventText}': status updated from '${prescription.status}' to '${newStatus}'${trackingNumber ? ` with tracking ${trackingNumber}` : ""} (rxNumber: ${rxNumber || "none"})`,
      queue_id: queueId,
      status: "success",
    });

    if (newStatus !== prescription.status) {
      if (prescription.prescriber_id) {
        const patient = prescription.patients as { first_name?: string; last_name?: string } | null;
        const patientName = patient
          ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim()
          : "Patient";
        notifyPrescriptionStatusChange(
          prescription.prescriber_id,
          queueId,
          patientName,
          newStatus,
          prescription.id,
        ).catch((err) => console.error("[webhook/pioneerrx] Notification error:", err));
      }

      sendPatientStatusEmail({
        prescriptionId: prescription.id,
        newStatus,
        trackingNumber: trackingNumber || null,
      }).catch((err) => console.error("[webhook/pioneerrx] Patient status email error:", err));
    }

    return buildAckResponse(messageId);
  } catch (error) {
    console.error("[webhook/pioneerrx] Webhook error:", error);
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@pioneerrx.com",
        user_name: "PioneerRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: "Unexpected webhook error",
        status: "error",
      });
    } catch { /* ignore */ }
    return buildNakResponse("", "Malformed Json");
  }
}
