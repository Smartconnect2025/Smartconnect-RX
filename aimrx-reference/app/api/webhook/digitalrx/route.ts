import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { notifyPrescriptionStatusChange } from "@/features/notifications/services/serverNotificationService";
import { ensureTrackerRegistered } from "@/app/api/prescriptions/_shared/tracking-sync";

const DIGITALRX_WEBHOOK_SECRET = process.env.DIGITALRX_WEBHOOK_SECRET;
const DIGITALRX_WEBHOOK_USERNAME = process.env.DIGITALRX_WEBHOOK_USERNAME;
const DIGITALRX_WEBHOOK_PASSWORD = process.env.DIGITALRX_WEBHOOK_PASSWORD;

type StatusEmailType = "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup";

const STATUS_TO_EMAIL_TYPE: Record<string, StatusEmailType> = {
  submitted: "pharmacy_processing",
  packed: "pharmacy_processing",
  approved: "pharmacy_processing",
  picked_up: "shipped",
  delivered: "delivered",
};

async function sendPatientStatusEmail(
  prescription: Record<string, unknown>,
  newStatus: string,
  trackingNumber?: string,
) {
  const emailType = STATUS_TO_EMAIL_TYPE[newStatus];
  if (!emailType) return;

  const patient = prescription.patients as { first_name?: string; last_name?: string; email?: string; phone?: string } | null;
  const pharmacy = prescription.pharmacy as { name?: string; phone?: string; address?: string } | null;

  const patientEmail = patient?.email;
  if (!patientEmail) {
    console.log(`[webhook/digitalrx] No patient email for prescription ${prescription.id} — skipping status email`);
    return;
  }

  const patientName = `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim() || "Patient";
  const medication = (prescription.medication as string) || "Your Medication";

  let providerName = "Your Provider";
  if (prescription.prescriber_id) {
    const supabase = createAdminClient();
    const { data: provider } = await supabase
      .from("providers")
      .select("prefix, first_name, last_name")
      .eq("user_id", prescription.prescriber_id as string)
      .single();
    if (provider) {
      const px = (provider as { prefix?: string | null }).prefix || "Dr.";
      providerName = `${px} ${provider.first_name || ""} ${provider.last_name || ""}`.trim();
    }
  }

  const pharmacyAddress = pharmacy?.address || undefined;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const internalApiKey = process.env.INTERNAL_API_KEY || "";

  try {
    const emailPayload: Record<string, unknown> = {
      patientEmail,
      patientPhone: patient?.phone || undefined,
      patientName,
      medication,
      providerName,
      statusType: emailType,
      prescriptionId: prescription.id,
      pharmacyName: pharmacy?.name,
      pharmacyPhone: pharmacy?.phone,
      pharmacyAddress,
    };

    if (trackingNumber) {
      emailPayload.trackingNumber = trackingNumber;
      emailPayload.trackingUrl = `https://parcelsapp.com/en/tracking/${trackingNumber}`;
    }

    const response = await fetch(`${siteUrl}/api/payments/send-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": internalApiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      console.log(`[webhook/digitalrx] ✅ Status email sent to ${patientEmail} for status '${newStatus}'`);
    } else {
      const errData = await response.json().catch(() => ({}));
      console.error(`[webhook/digitalrx] ⚠️ Status email failed:`, response.status, errData);
    }
  } catch (err) {
    console.error(`[webhook/digitalrx] ⚠️ Status email error:`, err instanceof Error ? err.message : err);
  }
}

const CANONICAL_STATUS_MAP: Record<string, string> = {
  submitted: "submitted",
  active: "submitted",
  fileonly: "submitted",
  packed: "packed",
  typed: "packed",
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
  rejected: "rejected",
  reject: "rejected",
  "rph reject": "rejected",
  "rph rejected": "rejected",
  cancelled: "rejected",
  canceled: "rejected",
  denied: "rejected",
  void: "rejected",
  voided: "rejected",
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

  if (body.DeliveredDate || body.DeliveryDate) return "delivered";
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

const STATUS_ORDINAL: Record<string, number> = {
  pending_payment: 0,
  payment_received: 1,
  submitting_to_pharmacy: 2,
  submitted: 3,
  packed: 4,
  approved: 5,
  picked_up: 6,
  delivered: 7,
};

function isKnownStatus(status: string): boolean {
  return status in STATUS_ORDINAL || status === "rejected";
}

function isForwardTransition(currentStatus: string, newStatus: string): boolean {
  if (newStatus === "rejected") return true;

  const currentOrd = STATUS_ORDINAL[currentStatus] ?? -1;
  const newOrd = STATUS_ORDINAL[newStatus] ?? -1;

  if (newOrd < 0) return false;

  return newOrd > currentOrd;
}

function validateToken(request: NextRequest): boolean {
  const hasTokenAuth = !!DIGITALRX_WEBHOOK_SECRET;
  const hasBasicAuth = !!(DIGITALRX_WEBHOOK_USERNAME && DIGITALRX_WEBHOOK_PASSWORD);

  if (!hasTokenAuth && !hasBasicAuth) {
    console.error("[webhook/digitalrx] BLOCKED — no webhook auth configured. Set DIGITALRX_WEBHOOK_SECRET or DIGITALRX_WEBHOOK_USERNAME/PASSWORD.");
    return false;
  }

  const urlToken = request.nextUrl.searchParams.get("token");
  if (hasTokenAuth && urlToken === DIGITALRX_WEBHOOK_SECRET) return true;

  const headerSecret = request.headers.get("x-webhook-secret");
  if (hasTokenAuth && headerSecret === DIGITALRX_WEBHOOK_SECRET) return true;

  const authHeader = request.headers.get("authorization");
  if (hasBasicAuth && authHeader) {
    const basicMatch = authHeader.match(/^Basic\s+(.+)$/i);
    if (basicMatch) {
      try {
        const decoded = Buffer.from(basicMatch[1].trim(), "base64").toString("utf-8");
        const colonIndex = decoded.indexOf(":");
        if (colonIndex > 0) {
          const username = decoded.slice(0, colonIndex);
          const password = decoded.slice(colonIndex + 1);
          if (username === DIGITALRX_WEBHOOK_USERNAME && password === DIGITALRX_WEBHOOK_PASSWORD) {
            return true;
          }
        }
      } catch {
        // Invalid base64, fall through
      }
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateToken(request)) {
      console.error("[webhook/digitalrx] Unauthorized webhook attempt");
      const authHeader = request.headers.get("authorization");
      const urlToken = request.nextUrl.searchParams.get("token");
      void (async () => {
        try {
          await createAdminClient().from("system_logs").insert({
            user_id: null,
            user_email: "webhook@digitalrx.com",
            user_name: "DigitalRx Webhook",
            action: "WEBHOOK_AUTH_FAILED",
            details: `Auth rejected. Has Basic: ${!!authHeader}, Has Token: ${!!urlToken}, IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
            status: "error",
          });
        } catch { /* fire and forget */ }
      })();
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseErr) {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_PARSE_ERROR",
        details: `Failed to parse JSON body: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        status: "error",
      });
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 },
      );
    }

    console.log(`[webhook/digitalrx] Received webhook for QueueID: ${body.QueueID || body.queue_id || body.queueId || "unknown"}. Body keys: ${Object.keys(body).join(",")}`);
    console.log(`[webhook/digitalrx] Raw body: ${JSON.stringify(body).slice(0, 800)}`);

    const queueId: string | undefined = body.QueueID || body.queue_id || body.queueId
      ? String(body.QueueID || body.queue_id || body.queueId)
      : undefined;

    if (!queueId) {
      return NextResponse.json(
        { success: false, error: "Invalid payload — missing QueueID" },
        { status: 400 },
      );
    }

    const trackingNumber: string | undefined = String(body.TrackingNumber || body.tracking_number || "") || undefined;
    let newStatus = body.new_status
      ? canonicalizeStatus(String(body.new_status))
      : deriveStatus(body);

    // ACTIVE_RX GUARD (Emily Freeman q2404472/q2404478 incident, May 28
    // 2026): Greenwich can briefly send a rejection keyword while
    // Active_Rx="1" (Rx still alive — TYPED / re-routing / pharmacist
    // review). Marking us "rejected" in that window permanently locks
    // the row (rejected wins via isForwardTransition), so subsequent
    // TYPED/PACKED polls can never advance it. Refuse the rejection
    // unless Active_Rx is explicitly "0" / false / no. If absent, we
    // err on the side of NOT honoring (webhook can re-fire when Active
    // truly flips).
    if (newStatus === "rejected") {
      const activeRxRaw = body.Active_Rx ?? body.active_rx ?? body.ActiveRx;
      const activeRxStr = activeRxRaw == null ? "" : String(activeRxRaw).trim().toLowerCase();
      const isExplicitlyInactive =
        activeRxStr === "0" || activeRxStr === "false" || activeRxStr === "no";
      if (!isExplicitlyInactive) {
        console.warn(`[webhook/digitalrx] Refusing rejection for QueueID ${queueId} — Active_Rx is "${activeRxStr}" (need explicit 0/false/no). Falling back to derived non-reject status.`);
        // Re-derive ignoring the reject keyword. Order of precedence:
        // (1) date/tracking signals (most authoritative — physical movement),
        // (2) non-reject workflow tokens (e.g., Statuswf="typed" → packed),
        // (3) "submitted" as the lowest no-op.
        // Without (2), a `Statuswf="typed"` payload arriving alongside a
        // refused reject would drop to "submitted" and the forward-only
        // guard would prevent advancement until a later date payload.
        const rxWorkflowRaw = body.Statuswf || body.RxStatus || body.Status;
        const rxWorkflow = typeof rxWorkflowRaw === "string" ? rxWorkflowRaw.toLowerCase().trim() : "";
        const isRejectWord =
          rxWorkflow === "rph reject" || rxWorkflow === "rph rejected" ||
          rxWorkflow === "rejected" || rxWorkflow === "reject" ||
          rxWorkflow === "cancelled" || rxWorkflow === "canceled" ||
          rxWorkflow === "denied" || rxWorkflow === "void" || rxWorkflow === "voided";
        const workflowDerived =
          !rxWorkflow || isRejectWord ? null : canonicalizeStatus(rxWorkflow);
        const dateDerived =
          body.DeliveredDate || body.DeliveryDate ? "delivered" :
          body.PickupDate || body.TrackingNumber ? "picked_up" :
          body.ApprovedDate || body.ApprovedByInitials ? "approved" :
          body.PackDateTime || body.PrintedDate ? "packed" :
          null;
        // Pick whichever is more advanced (highest ordinal); fall back to
        // submitted if both null.
        const candidates = [dateDerived, workflowDerived].filter(
          (s): s is string => !!s && s !== "rejected",
        );
        if (candidates.length === 0) {
          newStatus = "submitted";
        } else {
          newStatus = candidates.reduce((best, cur) => {
            const bestOrd = STATUS_ORDINAL[best] ?? -1;
            const curOrd = STATUS_ORDINAL[cur] ?? -1;
            return curOrd > bestOrd ? cur : best;
          });
        }
      }
    }

    const supabaseAdmin = createAdminClient();

    const { data: prescription, error: findError } = await supabaseAdmin
      .from("prescriptions")
      .select("id, status, queue_id, prescriber_id, medication, dosage, patient_id, tracking_number, payment_transaction_id, payment_status, patient_price, patients(first_name, last_name, email, phone), pharmacy:pharmacies!pharmacy_id(name, phone, address)")
      .eq("queue_id", queueId)
      .single();

    if (findError || !prescription) {
      console.error(`[webhook/digitalrx] Prescription lookup failed for QueueID ${queueId}. DB error: ${findError?.message || "no match"}. Full body: ${JSON.stringify(body).slice(0, 500)}`);
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_STATUS_UPDATE",
        details: `Prescription not found for QueueID: ${queueId}. DB error: ${findError?.message || "no match"}. Body keys: ${Object.keys(body).join(",")}`,
        queue_id: queueId,
        status: "error",
      });
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    if (!isKnownStatus(newStatus)) {
      console.warn(`[webhook/digitalrx] Unknown status "${newStatus}" for ${prescription.id} (QueueID: ${queueId}) — not persisting`);
      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_UNKNOWN_STATUS",
        details: `Unknown status "${newStatus}" received for QueueID: ${queueId}. Raw body: ${JSON.stringify(body).slice(0, 500)}`,
        queue_id: queueId,
        status: "warning",
      });
      return NextResponse.json(
        { success: true, message: `Unknown status "${newStatus}" logged but not persisted` },
        { status: 200 },
      );
    }

    if (!isForwardTransition(prescription.status, newStatus)) {
      console.log(`[webhook/digitalrx] Ignoring backward transition for ${prescription.id}: ${prescription.status} → ${newStatus}`);

      if (trackingNumber) {
        await supabaseAdmin
          .from("prescriptions")
          .update({ tracking_number: trackingNumber, updated_at: new Date().toISOString() })
          .eq("id", prescription.id);

        ensureTrackerRegistered(prescription.id, trackingNumber).catch((err) =>
          console.error("[webhook/digitalrx] EasyPost registration error:", err),
        );
      }

      await supabaseAdmin.from("system_logs").insert({
        user_id: null,
        user_email: "webhook@digitalrx.com",
        user_name: "DigitalRx Webhook",
        action: "WEBHOOK_STATUS_SKIP",
        details: `Backward transition blocked: ${prescription.status} → ${newStatus} for QueueID: ${queueId}`,
        queue_id: queueId,
        status: "info",
      });

      return NextResponse.json(
        { success: true, message: "Status transition ignored (not forward)" },
        { status: 200 },
      );
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    if (body.PatCopay != null || body.PatPay != null) {
      console.log(`[webhook/digitalrx] PatCopay: ${body.PatCopay ?? body.PatPay}`);
    }

    if (body.BillingStatus) {
      console.log(`[webhook/digitalrx] BillingStatus: ${body.BillingStatus}`);
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

    if (newStatus === "rejected" && prescription.status !== "rejected") {
      try {
        const { data: rxDetail } = await supabaseAdmin
          .from("prescriptions")
          .select("id, patient_price, payment_transaction_id, payment_status")
          .eq("id", prescription.id)
          .single();

        const alreadyHandled = rxDetail?.payment_status === "refunded" ||
          rxDetail?.payment_status === "rejected_refunded" ||
          rxDetail?.payment_status === "rejected_refund_pending";

        if (rxDetail && rxDetail.payment_status === "paid" && !alreadyHandled) {
          const { data: casResult } = await supabaseAdmin
            .from("prescriptions")
            .update({
              payment_status: "rejected_refund_pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", prescription.id)
            .eq("payment_status", "paid")
            .select("id")
            .single();

          if (!casResult) {
            console.log(`[webhook/digitalrx] Skipping refund for ${prescription.id} — concurrent rejection already handled`);
          } else {
            const transactionId = rxDetail.payment_transaction_id;
            const refundAmountCents = Math.round((Number(rxDetail.patient_price) || 0) * 100);

            if (transactionId && refundAmountCents > 0) {
              console.log(`[webhook/digitalrx] Pharmacy rejected prescription ${prescription.id} — initiating partial refund of ${refundAmountCents} cents`);

              const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
              const internalApiKey = process.env.INTERNAL_API_KEY || "";

              try {
                const refundResponse = await fetch(`${siteUrl}/api/payments/refund-partial`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-internal-api-key": internalApiKey,
                  },
                  body: JSON.stringify({
                    transactionId,
                    prescriptionId: prescription.id,
                    refundAmountCents,
                    reason: `Pharmacy rejected medication`,
                  }),
                });

                if (refundResponse.ok) {
                  console.log(`[webhook/digitalrx] Partial refund succeeded for ${prescription.id}`);
                  await supabaseAdmin
                    .from("prescriptions")
                    .update({ payment_status: "rejected_refunded" })
                    .eq("id", prescription.id);
                } else {
                  const errorBody = await refundResponse.text().catch(() => "");
                  console.error(`[webhook/digitalrx] Partial refund failed for ${prescription.id}: ${errorBody}`);
                }
              } catch (refundErr) {
                console.error(`[webhook/digitalrx] Partial refund error for ${prescription.id}:`, refundErr instanceof Error ? refundErr.message : "Unknown");
              }
            }
          }
        }
      } catch (rejectionErr) {
        console.error(`[webhook/digitalrx] Rejection handling error:`, rejectionErr instanceof Error ? rejectionErr.message : "Unknown");
      }
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

    sendPatientStatusEmail(
      prescription as unknown as Record<string, unknown>,
      newStatus,
      trackingNumber,
    ).catch((err) => console.error("[webhook/digitalrx] Status email dispatch error:", err));

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

export async function GET(request: NextRequest) {
  const isAuthed = validateToken(request);
  return NextResponse.json({
    status: "ok",
    service: "DigitalRx Webhook Endpoint",
    authenticated: isAuthed,
    timestamp: new Date().toISOString(),
  });
}
