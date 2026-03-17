import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import { ensureTrackerRegistered } from "@/app/api/prescriptions/_shared/tracking-sync";

const PIONEERRX_WEBHOOK_SECRET = process.env.PIONEERRX_WEBHOOK_SECRET;

const CANONICAL_STATUS_MAP: Record<string, string> = {
  received: "submitted",
  queued: "submitted",
  pending: "submitted",
  submitted: "submitted",
  filled: "packed",
  dispensed: "packed",
  packed: "packed",
  verified: "approved",
  approved: "approved",
  shipped: "picked_up",
  "in transit": "picked_up",
  "picked up": "picked_up",
  picked_up: "picked_up",
  delivered: "delivered",
  complete: "delivered",
  completed: "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  rejected: "cancelled",
};

function canonicalizeStatus(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  return CANONICAL_STATUS_MAP[normalized] || normalized.replace(/\s+/g, "_");
}

function deriveStatus(body: Record<string, unknown>): string {
  const rxStatus = body.status || body.Status || body.rxStatus || body.RxStatus;
  if (rxStatus && typeof rxStatus === "string" && rxStatus.trim() !== "") {
    return canonicalizeStatus(rxStatus);
  }

  if (body.deliveredDate || body.DeliveredDate) return "delivered";
  if (body.trackingNumber || body.TrackingNumber) return "picked_up";
  if (body.dispensedDate || body.DispensedDate) return "packed";
  if (body.fillDate || body.FillDate) return "packed";
  if (body.cancelledDate || body.CancelledDate) return "cancelled";

  return "submitted";
}

function mapToOrderProgress(status: string): string {
  const s = status.toLowerCase().replace(/[\s_-]/g, "");
  if (s === "delivered" || s === "completed" || s === "complete") return "delivered";
  if (s === "shipped" || s === "pickedup" || s === "intransit") return "picked_up";
  if (s === "approved" || s === "verified") return "approved";
  if (s === "packed" || s === "filled" || s === "dispensed") return "packed";
  if (s === "cancelled" || s === "canceled" || s === "rejected") return "cancelled";
  return "submitted";
}

function validateToken(request: NextRequest): boolean {
  if (!PIONEERRX_WEBHOOK_SECRET) {
    console.error("[webhook/pioneerrx] PIONEERRX_WEBHOOK_SECRET not configured — rejecting request. Set PIONEERRX_WEBHOOK_SECRET env var.");
    return false;
  }

  const urlToken = request.nextUrl.searchParams.get("token");
  if (urlToken === PIONEERRX_WEBHOOK_SECRET) return true;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret === PIONEERRX_WEBHOOK_SECRET) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateToken(request)) {
      console.error("[webhook/pioneerrx] Unauthorized webhook attempt");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const queueId: string | undefined =
      body.rxTransactionID || body.RxTransactionID ||
      body.QueueID || body.queue_id || body.id;

    if (!queueId) {
      return NextResponse.json(
        { success: false, error: "Invalid payload — missing rxTransactionID or QueueID" },
        { status: 400 },
      );
    }

    const trackingNumber: string | undefined =
      body.trackingNumber || body.TrackingNumber || body.tracking_number || undefined;
    const newStatus = body.new_status
      ? canonicalizeStatus(String(body.new_status))
      : deriveStatus(body);

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
        details: `Prescription not found for ID: ${queueId}`,
        queue_id: queueId,
        status: "error",
      });
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    updateData.order_progress = mapToOrderProgress(newStatus);

    if (body.patientCopay != null || body.PatCopay != null || body.PatPay != null) {
      updateData.patient_copay = String(body.patientCopay ?? body.PatCopay ?? body.PatPay);
    }

    if (body.deliveryDate || body.DeliveryDate) {
      updateData.delivery_date = String(body.deliveryDate || body.DeliveryDate);
    }

    if (body.deliveredDate || body.DeliveredDate) {
      updateData.delivery_date = String(body.deliveredDate || body.DeliveredDate);
    }

    if (body.lotNumber || body.LotNumber) {
      updateData.lot_number = String(body.lotNumber || body.LotNumber);
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
      return NextResponse.json(
        { success: false, error: "Update failed" },
        { status: 500 },
      );
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
      details: `Status updated from '${prescription.status}' to '${newStatus}'${trackingNumber ? ` with tracking ${trackingNumber}` : ""}`,
      queue_id: queueId,
      status: "success",
    });

    if (prescription.prescriber_id && newStatus !== prescription.status) {
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

    return NextResponse.json(
      { success: true, message: "Status updated" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[webhook/pioneerrx] Webhook error:", error);
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@pioneerrx.com",
        user_name: "PioneerRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Unexpected webhook error`,
        status: "error",
      });
    } catch { /* ignore */ }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
