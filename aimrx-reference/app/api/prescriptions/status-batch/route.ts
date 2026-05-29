import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import {
  resolvePharmacyBackendsBatch,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
  isForwardStatusTransition,
  type ResolvedBackend,
} from "../_shared/digitalrx-helpers";
import { fetchAndApplyTracking } from "../_shared/tracking-sync";

type StatusEmailType = "pharmacy_processing" | "shipped" | "delivered" | "ready_for_pickup";

const BATCH_EMAIL_MAP: Record<string, StatusEmailType> = {
  delivered: "delivered",
  picked_up: "shipped",
  approved: "pharmacy_processing",
  packed: "pharmacy_processing",
};

async function dispatchStatusEmail(prescriptionId: string, newStatus: string) {
  const emailType = BATCH_EMAIL_MAP[newStatus];
  if (!emailType) return;

  const supabase = createAdminClient();
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("patient_id, prescriber_id, medication, dosage, pharmacy_id, tracking_number")
    .eq("id", prescriptionId)
    .single();
  if (!rx?.patient_id) return;

  const { data: patient } = await supabase.from("patients").select("email, first_name, last_name, phone").eq("id", rx.patient_id).single();
  if (!patient?.email) return;

  const { data: provider } = await supabase.from("providers").select("prefix, first_name, last_name").eq("user_id", rx.prescriber_id).single();

  let pharmacyName: string | undefined;
  let pharmacyPhone: string | undefined;
  if (rx.pharmacy_id) {
    const { data: pharmacy } = await supabase.from("pharmacies").select("name, phone").eq("id", rx.pharmacy_id).single();
    pharmacyName = pharmacy?.name;
    pharmacyPhone = pharmacy?.phone;
  }

  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.aimrx.com";
  const payload: Record<string, unknown> = {
    patientEmail: patient.email,
    patientPhone: patient.phone || undefined,
    patientName: `${patient.first_name} ${patient.last_name}`,
    medication: [rx.medication, rx.dosage].filter(Boolean).join(" "),
    providerName: provider ? `${provider.prefix || "Dr."} ${provider.first_name} ${provider.last_name}` : "Your Provider",
    statusType: emailType,
    prescriptionId,
    pharmacyName,
    pharmacyPhone,
  };
  if (rx.tracking_number) {
    payload.trackingNumber = rx.tracking_number;
    payload.trackingUrl = `https://parcelsapp.com/en/tracking/${rx.tracking_number}`;
  }

  try {
    const res = await fetch(`${APP_URL}/api/payments/send-status-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-api-key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`[status-batch] Email failed for ${prescriptionId}: ${res.status}`);
    else console.log(`[status-batch] Email sent: ${emailType} → ${patient.email}`);
  } catch (err) {
    console.error(`[status-batch] Email error for ${prescriptionId}:`, err);
  }
}

interface BatchStatusRequest {
  prescription_ids?: string[];
  user_id?: string;
}

interface PrescriptionRow {
  id: string;
  queue_id: string | null;
  status: string;
  pharmacy_id: string | null;
  tracking_number: string | null;
  fedex_status: string | null;
  estimated_delivery: string | null;
  last_tracking_check: string | null;
  easypost_tracker_id: string | null;
}

async function fetchPrescriptions(
  supabase: ReturnType<typeof createAdminClient>,
  body: BatchStatusRequest,
): Promise<{ data: PrescriptionRow[] | null; error: string | null }> {
  let query = supabase
    .from("prescriptions")
    .select(
      "id, queue_id, status, pharmacy_id, tracking_number, fedex_status, estimated_delivery, last_tracking_check, easypost_tracker_id",
    );

  if (body.prescription_ids && body.prescription_ids.length > 0) {
    query = query.in("id", body.prescription_ids);
  } else if (body.user_id) {
    query = query.eq("prescriber_id", body.user_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Database error fetching prescriptions:", error);
    return { data: null, error: "Failed to fetch prescriptions" };
  }

  return { data, error: null };
}

async function processPrescription(
  supabase: ReturnType<typeof createAdminClient>,
  prescription: PrescriptionRow,
  backendMap: Map<string, ResolvedBackend>,
) {
  const TRACKING_CHECK_INTERVAL_MS = 30 * 60 * 1000;

  const dbResult = {
    prescription_id: prescription.id,
    queue_id: prescription.queue_id,
    success: true,
    updated_status: prescription.status,
    tracking_number: prescription.tracking_number,
    fedex_status: prescription.fedex_status,
    estimated_delivery: prescription.estimated_delivery,
  };

  if (!prescription.queue_id) {
    return dbResult;
  }

  let newStatus = prescription.status;
  let trackingNumber = prescription.tracking_number;

  const skipPollingStatuses = ["delivered", "picked_up", "cancelled", "refunded", "rejected"];
  // RULE: Greenwich-cancelled "dead" queue_ids must NEVER be polled — they are
  // truly cancelled and the upstream API still returns stale "submitted" which
  // would otherwise flip them back. Mirrors DEAD_QUEUE_IDS in
  // core/cron/jobs/digitalrx-reconcile.ts. (Joseph, May 21 2026.)
  const DEAD_QUEUE_IDS = new Set([
    "2186204", // Andrew Wicks
    "2199336", // Charles Koch
    "2203179", // Michael Landow
    "2222233", // Scott Province
    "2233282", // Brian Bielot
  ]);
  if (prescription.queue_id && DEAD_QUEUE_IDS.has(prescription.queue_id)) {
    return dbResult;
  }
  if (!skipPollingStatuses.includes(prescription.status)) {
    const backend =
      (prescription.pharmacy_id
        ? backendMap.get(prescription.pharmacy_id)
        : null) || backendMap.get("__default__");

    if (backend) {
      try {
        const apiResult = await fetchDigitalRxStatus(
          backend,
          prescription.queue_id,
        );

        if (apiResult.success) {
          const mapped = mapDigitalRxStatus(apiResult.data, prescription.status);
          newStatus = mapped.newStatus;
          trackingNumber = mapped.trackingNumber || trackingNumber;

          const updates: { status?: string; tracking_number?: string } = {};
          // Forward-only status guard — same rule as the webhook and reconcile
          // cron. UI polling fires this endpoint frequently, so a transient
          // backward map (TYPED on a row already past packed, or any blip
          // that resolves to an earlier ordinal) must NOT regress the visible
          // status. Tracking is still written (monotonic). Silent skip — no
          // system_logs entry, to keep this high-volume endpoint quiet.
          if (
            newStatus !== prescription.status &&
            isForwardStatusTransition(prescription.status, newStatus)
          ) {
            updates.status = newStatus;
          } else if (newStatus !== prescription.status) {
            // Keep visible status pinned to the existing forward value so the
            // response payload reflects what the DB actually holds.
            newStatus = prescription.status;
          }
          if (mapped.trackingNumber) {
            updates.tracking_number = mapped.trackingNumber;
          }

          if (Object.keys(updates).length > 0) {
            console.log(
              `[status-batch] Updating prescription ${prescription.id}: ${JSON.stringify(updates)}`,
            );
            await supabase
              .from("prescriptions")
              .update(updates)
              .eq("id", prescription.id);

            if (updates.status && updates.status !== prescription.status) {
              // Audit log every status change written by this endpoint.
              // Historically status-batch wrote silently (console-only),
              // making mystery flips like Emily Freeman q2404472/q2404478
              // (May 28 2026) impossible to trace. The reconcile cron
              // writes CRON_DIGITALRX_STATUS_CHANGED; the webhook writes
              // its own audit row; this third writer was the gap.
              // Fire-and-forget — never block the user's page load.
              void supabase
                .from("system_logs")
                .insert({
                  action: "BATCH_DIGITALRX_STATUS_CHANGED",
                  status: updates.status === "rejected" ? "warning" : "success",
                  queue_id: prescription.queue_id,
                  details: `prescriptionId=${prescription.id} oldStatus=${prescription.status} newStatus=${updates.status} source=status-batch trigger=ui-poll`,
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(
                      `[status-batch] Audit log write failed for ${prescription.id}: ${error.message}`,
                    );
                  }
                });

              dispatchStatusEmail(prescription.id, updates.status).catch((err) =>
                console.error(`[status-batch] Email dispatch error for ${prescription.id}:`, err),
              );
            }
          }
        }
      } catch {
        // DigitalRx failed — continue with DB data
      }
    }
  }

  let carrierStatus = prescription.fedex_status;
  let estimatedDelivery = prescription.estimated_delivery;

  if (trackingNumber) {
    const lastCheck = prescription.last_tracking_check
      ? new Date(prescription.last_tracking_check).getTime()
      : 0;
    const shouldCheck = Date.now() - lastCheck > TRACKING_CHECK_INTERVAL_MS;

    if (shouldCheck) {
      try {
        const trackingResult = await fetchAndApplyTracking(
          prescription.id,
          trackingNumber,
          prescription.easypost_tracker_id || null,
        );
        if (trackingResult.updated) {
          const { data: refreshed } = await supabase
            .from("prescriptions")
            .select("fedex_status, estimated_delivery")
            .eq("id", prescription.id)
            .single();
          if (refreshed) {
            carrierStatus = refreshed.fedex_status;
            estimatedDelivery = refreshed.estimated_delivery;
          }
        }
      } catch {
        // EasyPost failed — continue with DB data
      }
    }
  }

  return {
    prescription_id: prescription.id,
    queue_id: prescription.queue_id,
    success: true,
    updated_status: newStatus,
    tracking_number: trackingNumber,
    fedex_status: carrierStatus,
    estimated_delivery: estimatedDelivery,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: BatchStatusRequest = await request.json();
    const supabase = createAdminClient();

    const isAdmin = userRole && ["admin", "super_admin"].includes(userRole);

    if (!isAdmin) {
      // Each non-admin caller (provider OR delegate/Provider Assistant) only
      // polls statuses for prescriptions they themselves submitted. Delegates
      // are treated as separate prescribers — no shared visibility.
      body.user_id = user.id;
      body.prescription_ids = undefined;
    }

    if (
      !(body.prescription_ids && body.prescription_ids.length > 0) &&
      !body.user_id
    ) {
      return NextResponse.json(
        { success: false, error: "Must provide prescription_ids or user_id" },
        { status: 400 },
      );
    }

    const { data: prescriptions, error: fetchError } = await fetchPrescriptions(
      supabase,
      body,
    );

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError },
        { status: 500 },
      );
    }

    if (!prescriptions || prescriptions.length === 0) {
      return NextResponse.json(
        { success: true, statuses: [] },
        { status: 200 },
      );
    }

    const pharmacyIds = prescriptions
      .map((p) => p.pharmacy_id)
      .filter((id): id is string => id !== null);

    const backendMap = await resolvePharmacyBackendsBatch(
      supabase,
      pharmacyIds,
    );

    const statuses = await Promise.all(
      prescriptions.map((prescription) =>
        processPrescription(supabase, prescription, backendMap),
      ),
    );

    return NextResponse.json({ success: true, statuses }, { status: 200 });
  } catch (error) {
    console.error("Batch Status Check Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          error_details: error instanceof Error ? error.stack : String(error),
        }),
      },
      { status: 500 },
    );
  }
}
