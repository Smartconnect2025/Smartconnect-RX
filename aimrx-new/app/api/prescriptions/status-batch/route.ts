import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import {
  resolvePharmacyBackendsBatch,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
  type ResolvedBackend,
} from "../_shared/digitalrx-helpers";
import {
  fetchPioneerRxStatus,
  mapPioneerRxStatus,
  type PioneerRxBackend,
} from "../_shared/pioneerrx-helpers";
import {
  resolvePharmacyBackendsBatchAll,
  type ResolvedPharmacyBackend,
} from "../_shared/pharmacy-dispatcher";
import { fetchFedExTracking } from "../_shared/fedex-helpers";

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
}

async function fetchPrescriptions(
  supabase: ReturnType<typeof createAdminClient>,
  body: BatchStatusRequest,
): Promise<{ data: PrescriptionRow[] | null; error: string | null }> {
  let query = supabase
    .from("prescriptions")
    .select(
      "id, queue_id, status, pharmacy_id, tracking_number, fedex_status, estimated_delivery, last_tracking_check",
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
  unifiedBackendMap: Map<string, ResolvedPharmacyBackend>,
  digitalBackendMap: Map<string, ResolvedBackend>,
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

  if (!prescription.queue_id || !prescription.pharmacy_id) {
    return dbResult;
  }

  const unifiedBackend = unifiedBackendMap.get(prescription.pharmacy_id);

  if (!unifiedBackend) {
    return dbResult;
  }

  let newStatus = prescription.status;
  let trackingNumber = prescription.tracking_number;

  try {
    if (unifiedBackend.systemType === "PioneerRx") {
      const prxBackend: PioneerRxBackend = {
        apiKey: unifiedBackend.apiKey,
        sharedSecret: unifiedBackend.sharedSecret,
        baseUrl: unifiedBackend.baseUrl,
        storeId: unifiedBackend.storeId,
        locationId: unifiedBackend.locationId,
      };

      const apiResult = await fetchPioneerRxStatus(prxBackend, prescription.queue_id);

      if (apiResult.success) {
        const mapped = mapPioneerRxStatus(apiResult.data, prescription.status);
        newStatus = mapped.newStatus;
        trackingNumber = mapped.trackingNumber || trackingNumber;

        const updates: { status?: string; tracking_number?: string } = {};
        if (newStatus !== prescription.status) updates.status = newStatus;
        if (mapped.trackingNumber) updates.tracking_number = mapped.trackingNumber;

        if (Object.keys(updates).length > 0) {
          await supabase.from("prescriptions").update(updates).eq("id", prescription.id);
        }
      } else {
        console.error(`[status-batch] PioneerRx status check failed for prescription ${prescription.id}:`, apiResult.error || "Unknown error");
        return { ...dbResult, success: false, error: `PioneerRx status check failed: ${apiResult.error || "Unknown error"}` };
      }
    } else {
      const digitalBackend = digitalBackendMap.get(prescription.pharmacy_id);

      if (digitalBackend) {
        const apiResult = await fetchDigitalRxStatus(digitalBackend, prescription.queue_id);

        if (apiResult.success) {
          const mapped = mapDigitalRxStatus(apiResult.data, prescription.status);
          newStatus = mapped.newStatus;
          trackingNumber = mapped.trackingNumber || trackingNumber;

          const updates: { status?: string; tracking_number?: string } = {};
          if (newStatus !== prescription.status) updates.status = newStatus;
          if (mapped.trackingNumber) updates.tracking_number = mapped.trackingNumber;

          if (Object.keys(updates).length > 0) {
            await supabase.from("prescriptions").update(updates).eq("id", prescription.id);
          }
        } else {
          console.error(`[status-batch] DigitalRx status check failed for prescription ${prescription.id}:`, apiResult.error || "Unknown error");
          return { ...dbResult, success: false, error: `DigitalRx status check failed: ${apiResult.error || "Unknown error"}` };
        }
      }
    }
  } catch (err) {
    console.error(`[status-batch] Pharmacy API error for prescription ${prescription.id}:`, err instanceof Error ? err.message : err);
    return {
      ...dbResult,
      success: false,
      error: `Pharmacy API error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  let fedexStatus = prescription.fedex_status;
  let estimatedDelivery = prescription.estimated_delivery;

  if (trackingNumber) {
    const lastCheck = prescription.last_tracking_check
      ? new Date(prescription.last_tracking_check).getTime()
      : 0;
    const shouldCheck = Date.now() - lastCheck > TRACKING_CHECK_INTERVAL_MS;

    if (shouldCheck) {
      try {
        const fedexResult = await fetchFedExTracking(trackingNumber);
        if (fedexResult) {
          fedexStatus = fedexResult.fedexStatus;
          estimatedDelivery = fedexResult.estimatedDelivery;

          await supabase
            .from("prescriptions")
            .update({
              fedex_status: fedexStatus,
              estimated_delivery: estimatedDelivery,
              last_tracking_check: new Date().toISOString(),
            })
            .eq("id", prescription.id);
        }
      } catch (fedexErr) {
        console.error(`[status-batch] FedEx tracking error for prescription ${prescription.id}:`, fedexErr instanceof Error ? fedexErr.message : fedexErr);
      }
    }
  }

  return {
    prescription_id: prescription.id,
    queue_id: prescription.queue_id,
    success: true,
    updated_status: newStatus,
    tracking_number: trackingNumber,
    fedex_status: fedexStatus,
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

    const [unifiedBackendMap, digitalBackendMap] = await Promise.all([
      resolvePharmacyBackendsBatchAll(supabase, pharmacyIds),
      resolvePharmacyBackendsBatch(supabase, pharmacyIds),
    ]);

    const statuses = await Promise.all(
      prescriptions.map((prescription) =>
        processPrescription(supabase, prescription, unifiedBackendMap, digitalBackendMap),
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
