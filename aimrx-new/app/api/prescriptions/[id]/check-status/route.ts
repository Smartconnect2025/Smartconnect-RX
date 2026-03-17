import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import {
  resolvePharmacyBackend,
  fetchDigitalRxStatus,
  mapDigitalRxStatus,
} from "../../_shared/digitalrx-helpers";
import {
  fetchPioneerRxStatus,
  mapPioneerRxStatus,
} from "../../_shared/pioneerrx-helpers";
import { resolvePharmacyBackendAny } from "../../_shared/pharmacy-dispatcher";
import { ensureTrackerRegistered } from "../../_shared/tracking-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabaseAdmin = createAdminClient();

  try {
    const { user, userRole } = await getUser();
    if (!user || !userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin access required" },
        { status: 403 },
      );
    }

    const { id: prescriptionId } = await params;

    const { data: prescription, error: prescError } = await supabaseAdmin
      .from("prescriptions")
      .select("id, queue_id, status, tracking_number, pharmacy_id, medication")
      .eq("id", prescriptionId)
      .single();

    if (prescError || !prescription) {
      console.error("Prescription not found:", prescError);
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    if (!prescription.queue_id) {
      return NextResponse.json(
        {
          success: false,
          error: "No queue ID - prescription may not have been submitted to pharmacy yet",
        },
        { status: 400 },
      );
    }

    const backend = await resolvePharmacyBackendAny(supabaseAdmin, prescription.pharmacy_id);

    if (!backend) {
      console.error("No pharmacy backend found for prescription");
      return NextResponse.json(
        {
          success: false,
          error: "Pharmacy backend configuration not found. Please contact support.",
        },
        { status: 404 },
      );
    }

    let newStatus = prescription.status;
    let trackingNumber = prescription.tracking_number;
    let lastUpdated = new Date().toISOString();

    if (backend.systemType === "PioneerRx") {
      const apiResult = await fetchPioneerRxStatus(
        {
          apiKey: backend.apiKey,
          sharedSecret: backend.sharedSecret,
          baseUrl: backend.baseUrl,
          storeId: backend.storeId,
          locationId: backend.locationId,
        },
        prescription.queue_id,
      );

      if (!apiResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: apiResult.error,
            ...(apiResult.errorText && { details: apiResult.errorText }),
            ...(apiResult.rawResponse && { details: apiResult.rawResponse }),
          },
          { status: 502 },
        );
      }

      const mapped = mapPioneerRxStatus(
        apiResult.data,
        prescription.status,
        prescription.tracking_number,
      );
      newStatus = mapped.newStatus;
      trackingNumber = mapped.trackingNumber;
      lastUpdated = apiResult.data.lastUpdated || new Date().toISOString();
    } else {
      const digitalBackend = await resolvePharmacyBackend(supabaseAdmin, prescription.pharmacy_id);

      if (!digitalBackend) {
        return NextResponse.json(
          { success: false, error: "Pharmacy backend configuration not found." },
          { status: 404 },
        );
      }

      const apiResult = await fetchDigitalRxStatus(digitalBackend, prescription.queue_id);

      if (!apiResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: apiResult.error,
            ...(apiResult.errorText && { details: apiResult.errorText }),
            ...(apiResult.rawResponse && { details: apiResult.rawResponse }),
          },
          { status: 502 },
        );
      }

      const mapped = mapDigitalRxStatus(
        apiResult.data,
        prescription.status,
        prescription.tracking_number,
      );
      newStatus = mapped.newStatus;
      trackingNumber = mapped.trackingNumber;
      lastUpdated = apiResult.data.LastUpdated || new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        status: newStatus,
        tracking_number: trackingNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (trackingNumber) {
      ensureTrackerRegistered(prescriptionId, trackingNumber).catch((err) =>
        console.error("[check-status] EasyPost registration error:", err),
      );
    }

    if (updateError) {
      console.error("Failed to update prescription:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update prescription status in database",
        },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("system_logs").insert({
      action: "PRESCRIPTION_STATUS_CHECKED",
      details: `Checked status via ${backend.systemType} for ${prescription.medication} (Queue ${prescription.queue_id}) - Status: ${newStatus}${trackingNumber ? ` - Tracking: ${trackingNumber}` : ""}`,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      queue_id: prescription.queue_id,
      old_status: prescription.status,
      new_status: newStatus,
      tracking_number: trackingNumber,
      last_updated: lastUpdated,
      changed: prescription.status !== newStatus,
      system_type: backend.systemType,
    });
  } catch (error) {
    console.error("Error checking prescription status:", error);

    try {
      await supabaseAdmin.from("system_logs").insert({
        action: "PRESCRIPTION_STATUS_CHECK_ERROR",
        details: `Error checking status: ${error instanceof Error ? error.message : String(error)}`,
        status: "error",
      });
    } catch { /* ignore */ }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while checking prescription status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
