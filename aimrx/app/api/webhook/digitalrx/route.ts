import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import { ensureTrackerRegistered } from "@/app/api/prescriptions/_shared/tracking-sync";

const DIGITALRX_WEBHOOK_SECRET = process.env.DIGITALRX_WEBHOOK_SECRET;

const CANONICAL_STATUS_MAP: Record<string, string> = {
  submitted: "submitted",
  packed: "packed",
  approved: "approved",
  "picked up": "picked_up",
  "picked_up": "picked_up",
  pickedup: "picked_up",
  shipped: "picked_up",
  delivered: "delivered",
  completed: "delivered",
  billed: "packed",
  billing: "submitted",
  processing: "packed",
  pending: "submitted",
};

function canonicalizeStatus(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  return CANONICAL_STATUS_MAP[normalized] || normalized.replace(/\s+/g, "_");
}

function deriveStatus(body: Record<string, unknown>): string {
  const rxStatus = body.RxStatus || body.Status;
  if (rxStatus && typeof rxStatus === "string" && rxStatus.trim() !== "") {
    return canonicalizeStatus(rxStatus);
  }

  if (body.DeliveredDate) return "delivered";
  if (body.PickupDate) return "picked_up";
  if (body.TrackingNumber) return "picked_up";
  if (body.ApprovedDate || body.ApprovedByInitials) return "approved";
  if (body.PackDateTime || body.PrintedDate) return "packed";

  return "submitted";
}

function mapToOrderProgress(status: string): string {
  const s = status.toLowerCase().replace(/[\s_-]/g, "");
  if (s === "delivered" || s === "completed") return "delivered";
  if (s === "shipped" || s === "pickedup") return "picked_up";
  if (s === "approved") return "approved";
  if (s === "packed") return "packed";
  return "submitted";
}

function validateToken(request: NextRequest): boolean {
  if (!DIGITALRX_WEBHOOK_SECRET) {
    console.warn("[webhook/digitalrx] DIGITALRX_WEBHOOK_SECRET not configured — allowing request (set secret to enforce auth)");
    return true;
  }

  const urlToken = request.nextUrl.searchParams.get("token");
  if (urlToken === DIGITALRX_WEBHOOK_SECRET) return true;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret === DIGITALRX_WEBHOOK_SECRET) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateToken(request)) {
      console.error("[webhook/digitalrx] Unauthorized webhook attempt");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const queueId: string | undefined = body.QueueID || body.queue_id;

    if (!queueId) {
      return NextResponse.json(
        { success: false, error: "Invalid payload — missing QueueID" },
        { status: 400 },
      );
    }

    const trackingNumber: string | undefined = body.TrackingNumber || body.tracking_number || undefined;
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
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Prescription not found for QueueID: ${queueId}`,
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

    if (body.PatCopay != null || body.PatPay != null) {
      updateData.patient_copay = String(body.PatCopay ?? body.PatPay);
    }

    if (body.BillingStatus) {
      updateData.billing_status = String(body.BillingStatus).toLowerCase();
    }

    if (body.DeliveryDate) {
      updateData.delivery_date = String(body.DeliveryDate);
    }

    if (body.DeliveredDate) {
      updateData.delivery_date = String(body.DeliveredDate);
    }

    if (body.LotNumber) {
      updateData.lot_number = String(body.LotNumber);
    }

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update(updateData)
      .eq("id", prescription.id);

    if (updateError) {
      console.error("[webhook/digitalrx] Update failed:", updateError.message);
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
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
        console.error("[webhook/digitalrx] EasyPost registration error:", err),
      );
    }

    await supabaseAdmin.from("system_logs").insert({
      user_id: null,
      user_email: "webhook@digitalrx.com",
      user_name: "DigitalRx Webhook",
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
      ).catch((err) => console.error("[webhook/digitalrx] Notification error:", err));
    }

    return NextResponse.json(
      { success: true, message: "Status updated" },
      { status: 200 },
    );
  } catch (error) {
    console.error("[webhook/digitalrx] Webhook error:", error);
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Unexpected webhook error`,
        status: "error",
      });
    } catch {
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
